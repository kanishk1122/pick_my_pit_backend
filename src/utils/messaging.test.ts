import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import MessageModel from "../model/message.model";
import ChatModel from "../model/chat.model";
import PostModel from "../model/post.model";
import { ResponseHelper } from "../helper/utils";
import { Types } from "mongoose";
import { socketService } from "../utils/socket";

// Test function to verify messaging system
export const testMessagingSystem = async () => {
  try {
    // Test creating a chat
    const testChat = new ChatModel({
      participants: [new Types.ObjectId(), new Types.ObjectId()],
      unreadCount: new Map()
    });

    await testChat.save();
    console.log("Chat created successfully");

    // Test creating a message
    const testMessage = new MessageModel({
      sender: new Types.ObjectId(),
      recipient: new Types.ObjectId(),
      content: "Test message",
      read: false
    });

    await testMessage.save();
    console.log("Message created successfully");

    return true;
  } catch (error) {
    console.error("Error testing messaging system:", error);
    return false;
  }
};