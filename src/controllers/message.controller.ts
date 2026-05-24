import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import MessageModel from "../model/message.model";
import ChatModel from "../model/chat.model";
import PostModel from "../model/post.model";
import { ResponseHelper } from "../helper/utils";
import { Types } from "mongoose";
import { socketService } from "../utils/socket";
import { messageQueue } from "../utils/MessageQueue";

export class MessageController {
  // Send a new message
  static async sendMessage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { recipient, content, postId, chatId } = req.body;
      const sender = req.user?.id;

      if (!sender) {
        res.status(401).json(ResponseHelper.error("Unauthorized"));
        return;
      }

      if (!recipient || !content) {
        res.status(400).json(ResponseHelper.error("Recipient and content are required"));
        return;
      }

      // Create or find existing chat
      let chat;
      if (chatId) {
        chat = await ChatModel.findById(chatId);
      }
      
      if (!chat) {
        chat = await ChatModel.findOrCreateChat(sender, recipient, postId);
      }

      // Create new message
      const message = new MessageModel({
        sender,
        recipient,
        content,
        post: postId,
        chatId: chat._id
      });

      // Update chat metadata locally first
      chat.lastMessage = content;
      chat.lastMessageTimestamp = new Date();
      const currentCount = chat.unreadCount.get(recipient) || 0;
      chat.unreadCount.set(recipient, currentCount + 1);

      // Save both message and chat in parallel (different documents)
      await Promise.all([
        message.save(),
        chat.save()
      ]);

      // Process message through the Queue System immediately
      messageQueue.enqueue({
        _id: message._id,
        from: sender,
        to: recipient,
        content,
        postId,
        chatId: chat._id,
        createdAt: message.createdAt
      });

      res.status(201).json(ResponseHelper.success(message, "Message sent successfully"));
    } catch (error) {
      console.error("Send message error:", error);
      res.status(500).json(ResponseHelper.error("Internal server error"));
    }
  }

  // Get conversation between two users
  static async getConversation(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { userId } = req.params; // The other user's ID
      const currentUserId = req.user?.id;

      if (!currentUserId) {
        res.status(401).json(ResponseHelper.error("Unauthorized"));
        return;
      }

      if (!userId || userId === "undefined") {
        res.status(400).json(ResponseHelper.error("User ID is required"));
        return;
      }

      if (!Types.ObjectId.isValid(userId)) {
        res.status(400).json(ResponseHelper.error("Invalid User ID format"));
        return;
      }

      // Find the chat first to verify membership and get messages by chatId
      const chat = await ChatModel.findOne({
        $and: [
          { participants: { $in: [currentUserId] } },
          { $or: [
            { _id: userId }, // In case userId parameter is actually a chatId
            { participants: { $in: [userId] } }
          ]}
        ]
      });

      let messages = [];
      if (chat) {
        console.log(`🔍 Found chat ${chat._id}, fetching messages...`);
        messages = await MessageModel.find({ chatId: chat._id }).sort({ createdAt: 1 });
      } else {
        console.log(`⚠️ No chat found between ${currentUserId} and ${userId}, falling back to ID search`);
        const u1 = new Types.ObjectId(currentUserId);
        const u2 = new Types.ObjectId(userId);
        messages = await MessageModel.find({
          $or: [
            { sender: u1, recipient: u2 },
            { sender: u2, recipient: u1 }
          ]
        }).sort({ createdAt: 1 });
      }
      
      console.log(`✅ Found ${messages.length} messages`);

      // Mark messages as read
      await MessageModel.updateMany(
        {
          recipient: currentUserId,
          sender: userId,
          read: false
        },
        {
          $set: {
            read: true,
            readAt: new Date()
          }
        }
      );

      // Update chat unread count
      const activeChatObj = await ChatModel.findOrCreateChat(currentUserId, userId);
      activeChatObj.unreadCount.set(currentUserId, 0);
      await activeChatObj.save();

      // Notify the sender that their messages were read
      const io = socketService.getIO();
      io.to(`chat:${activeChatObj._id}`).emit("message_read_update", {
        chatId: activeChatObj._id,
        readerId: currentUserId
      });

      res.status(200).json(ResponseHelper.success(messages, "Conversation retrieved successfully"));
    } catch (error) {
      console.error("Get conversation error:", error);
      res.status(500).json(ResponseHelper.error("Internal server error"));
    }
  }

  // Get all chats for current user
  static async getUserChats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json(ResponseHelper.error("Unauthorized"));
        return;
      }

      const chats = await ChatModel.getChatsForUser(userId);

      res.status(200).json(ResponseHelper.success(chats, "Chats retrieved successfully"));
    } catch (error) {
      console.error("Get user chats error:", error);
      res.status(500).json(ResponseHelper.error("Internal server error"));
    }
  }

  // Get unread message count
  static async getUnreadCount(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json(ResponseHelper.error("Unauthorized"));
        return;
      }

      const unreadCount = await MessageModel.getUnreadCount(userId);

      res.status(200).json(ResponseHelper.success({ count: unreadCount }, "Unread count retrieved successfully"));
    } catch (error) {
      console.error("Get unread count error:", error);
      res.status(500).json(ResponseHelper.error("Internal server error"));
    }
  }

  // Contact pet owner - special endpoint for contacting pet owner through a post
  static async contactPetOwner(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { postId, message: userMessage } = req.body;
      const sender = req.user?.id;

      if (!sender) {
        res.status(401).json(ResponseHelper.error("Unauthorized"));
        return;
      }

      if (!postId || !userMessage) {
        res.status(400).json(ResponseHelper.error("Post ID and message are required"));
        return;
      }

      // Find the post and get the owner
      const post = await PostModel.findById(postId).populate("owner");
      if (!post) {
        res.status(404).json(ResponseHelper.error("Post not found"));
        return;
      }

      if (!post.owner) {
        res.status(404).json(ResponseHelper.error("Post owner not found. The user account may have been deleted."));
        return;
      }

      const recipient = post.owner._id ? post.owner._id.toString() : post.owner.toString();

      if (sender === recipient) {
        res.status(400).json(ResponseHelper.error("You cannot contact yourself on your own post"));
        return;
      }


      // Create or find existing chat
      const chat = await ChatModel.findOrCreateChat(sender, recipient, postId);

      // Create new message
      const message = new MessageModel({
        sender,
        recipient,
        content: userMessage,
        post: postId,
        chatId: chat._id
      });

      // Update chat metadata locally first
      chat.lastMessage = userMessage;
      chat.lastMessageTimestamp = new Date();
      const currentCount = chat.unreadCount.get(recipient) || 0;
      chat.unreadCount.set(recipient, currentCount + 1);

      // Save both message and chat in parallel
      await Promise.all([
        message.save(),
        chat.save()
      ]);

      // Process through Queue System immediately
      messageQueue.enqueue({
        _id: message._id,
        from: sender,
        to: recipient,
        content: userMessage,
        postId,
        chatId: chat._id,
        createdAt: message.createdAt,
        type: "pet_inquiry"
      });

      res.status(201).json(ResponseHelper.success(
        {
          message,
          success: true,
          petOwner: post.owner
        },
        "Message sent to pet owner successfully"
      ));
    } catch (error) {
      console.error("Contact pet owner error:", error);
      res.status(500).json(ResponseHelper.error("Internal server error"));
    }
  }
}