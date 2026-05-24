import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import MessageModel from "../model/message.model";
import ChatModel from "../model/chat.model";
import PostModel from "../model/post.model";
import { ResponseHelper } from "../helper/utils";
import { Types } from "mongoose";
import { socketService } from "../utils/socket";

// Test the integration between messaging system and post system
export const testPostMessagingIntegration = async (postId: string, userId: string) => {
  try {
    // Find the post by ID
    const post = await PostModel.findById(postId).populate("owner");

    if (!post) {
      throw new Error("Post not found");
    }

    // Verify the post has an owner
    if (!post.owner) {
      throw new Error("Post owner not found");
    }

    // Test creating a chat between the user and post owner
    const chat = await ChatModel.findOrCreateChat(userId, post.owner._id.toString());

    // Test sending a message
    const testMessage = new MessageModel({
      sender: new Types.ObjectId(userId),
      recipient: post.owner._id,
      content: "Test message about your pet listing",
      post: new Types.ObjectId(postId),
      chatId: chat._id,
      read: false
    });

    await testMessage.save();

    console.log("Post messaging integration test passed");
    return true;
  } catch (error) {
    console.error("Post messaging integration test failed:", error);
    return false;
  }
};