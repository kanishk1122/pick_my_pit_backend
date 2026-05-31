import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { prisma } from "../config/database";
import { ResponseHelper } from "../helper/utils";
import { socketService } from "../utils/socket";
import { messageQueue } from "../utils/MessageQueue";

function formatChat(chat: any) {
  if (!chat) return null;
  const formatted = {
    ...chat,
    _id: chat.id,
    participants: chat.participants ? chat.participants.map((p: any) => ({ ...p, _id: p.id })) : [],
  };
  if (formatted.post) {
    formatted.post = {
      ...formatted.post,
      _id: formatted.post.id,
      price: formatted.post.amount,
    };
  }
  return formatted;
}

function formatMessage(msg: any) {
  if (!msg) return null;
  return {
    ...msg,
    _id: msg.id,
    sender: msg.senderId,
    recipient: msg.recipientId,
  };
}

async function findOrCreateChat(user1: string, user2: string, postId?: string) {
  const chats = await prisma.chat.findMany({
    where: {
      postId: postId || null,
      AND: [
        { participants: { some: { id: user1 } } },
        { participants: { some: { id: user2 } } }
      ]
    },
    include: {
      participants: true
    }
  });

  let chat = chats.find(c => c.participants.length === 2);

  if (!chat) {
    chat = await prisma.chat.create({
      data: {
        postId: postId || null,
        unreadCount: {},
        participants: {
          connect: [
            { id: user1 },
            { id: user2 }
          ]
        }
      },
      include: {
        participants: true
      }
    });
  }

  return chat;
}

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
        chat = await prisma.chat.findUnique({
          where: { id: chatId },
          include: { participants: true }
        });
      }
      
      if (!chat) {
        chat = await findOrCreateChat(sender, recipient, postId);
      }

      // Create new message
      const message = await prisma.message.create({
        data: {
          senderId: sender,
          recipientId: recipient,
          content,
          postId: postId || null,
          chatId: chat.id
        }
      });

      // Update chat metadata
      const unreadCountObj = (chat.unreadCount as Record<string, number>) || {};
      const currentCount = unreadCountObj[recipient] || 0;
      unreadCountObj[recipient] = currentCount + 1;

      await prisma.chat.update({
        where: { id: chat.id },
        data: {
          lastMessage: content,
          lastMessageTimestamp: new Date(),
          unreadCount: unreadCountObj
        }
      });

      // Process message through the Queue System immediately
      messageQueue.enqueue({
        _id: message.id,
        from: sender,
        to: recipient,
        content,
        postId,
        chatId: chat.id,
        createdAt: message.createdAt
      });

      res.status(201).json(ResponseHelper.success(formatMessage(message), "Message sent successfully"));
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

      // Find the chat first to verify membership and get messages by chatId
      const chat = await prisma.chat.findFirst({
        where: {
          AND: [
            { participants: { some: { id: currentUserId } } },
            {
              OR: [
                { id: userId }, // In case userId parameter is actually a chatId
                { participants: { some: { id: userId } } }
              ]
            }
          ]
        }
      });

      let messages = [];
      if (chat) {
        console.log(`🔍 Found chat ${chat.id}, fetching messages...`);
        messages = await prisma.message.findMany({
          where: { chatId: chat.id },
          orderBy: { createdAt: "asc" }
        });
      } else {
        console.log(`⚠️ No chat found between ${currentUserId} and ${userId}, falling back to ID search`);
        messages = await prisma.message.findMany({
          where: {
            OR: [
              { senderId: currentUserId, recipientId: userId },
              { senderId: userId, recipientId: currentUserId }
            ]
          },
          orderBy: { createdAt: "asc" }
        });
      }
      
      console.log(`✅ Found ${messages.length} messages`);

      // Mark messages as read
      await prisma.message.updateMany({
        where: {
          recipientId: currentUserId,
          senderId: userId,
          read: false
        },
        data: {
          read: true,
          readAt: new Date()
        }
      });

      // Update chat unread count
      const activeChatObj = await findOrCreateChat(currentUserId, userId);
      const unreadCountObj = (activeChatObj.unreadCount as Record<string, number>) || {};
      unreadCountObj[currentUserId] = 0;

      await prisma.chat.update({
        where: { id: activeChatObj.id },
        data: { unreadCount: unreadCountObj }
      });

      // Notify the sender that their messages were read
      const io = socketService.getIO();
      io.to(`chat:${activeChatObj.id}`).emit("message_read_update", {
        chatId: activeChatObj.id,
        readerId: currentUserId
      });

      const formattedMessages = messages.map(formatMessage);

      res.status(200).json(ResponseHelper.success(formattedMessages, "Conversation retrieved successfully"));
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

      const chats = await prisma.chat.findMany({
        where: {
          participants: {
            some: { id: userId }
          }
        },
        include: {
          participants: {
            select: { id: true, firstname: true, lastname: true, userpic: true }
          },
          post: {
            select: { id: true, title: true, images: true, category: true, amount: true }
          }
        },
        orderBy: {
          lastMessageTimestamp: "desc"
        }
      });

      const formattedChats = chats.map(formatChat);

      res.status(200).json(ResponseHelper.success(formattedChats, "Chats retrieved successfully"));
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

      const unreadCount = await prisma.message.count({
        where: {
          recipientId: userId,
          read: false
        }
      });

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
      const post = await prisma.post.findUnique({
        where: { id: postId },
        include: { owner: true }
      });
      
      if (!post) {
        res.status(404).json(ResponseHelper.error("Post not found"));
        return;
      }

      if (!post.owner) {
        res.status(404).json(ResponseHelper.error("Post owner not found. The user account may have been deleted."));
        return;
      }

      const recipient = post.owner.id;

      if (sender === recipient) {
        res.status(400).json(ResponseHelper.error("You cannot contact yourself on your own post"));
        return;
      }

      // Create or find existing chat
      const chat = await findOrCreateChat(sender, recipient, postId);

      // Create new message
      const message = await prisma.message.create({
        data: {
          senderId: sender,
          recipientId: recipient,
          content: userMessage,
          postId: postId,
          chatId: chat.id
        }
      });

      // Update chat metadata
      const unreadCountObj = (chat.unreadCount as Record<string, number>) || {};
      const currentCount = unreadCountObj[recipient] || 0;
      unreadCountObj[recipient] = currentCount + 1;

      await prisma.chat.update({
        where: { id: chat.id },
        data: {
          lastMessage: userMessage,
          lastMessageTimestamp: new Date(),
          unreadCount: unreadCountObj
        }
      });

      // Process through Queue System immediately
      messageQueue.enqueue({
        _id: message.id,
        from: sender,
        to: recipient,
        content: userMessage,
        postId,
        chatId: chat.id,
        createdAt: message.createdAt
      });

      res.status(201).json(ResponseHelper.success(
        {
          message: formatMessage(message),
          success: true,
          petOwner: {
            ...post.owner,
            _id: post.owner.id
          }
        },
        "Message sent to pet owner successfully"
      ));
    } catch (error) {
      console.error("Contact pet owner error:", error);
      res.status(500).json(ResponseHelper.error("Internal server error"));
    }
  }
}