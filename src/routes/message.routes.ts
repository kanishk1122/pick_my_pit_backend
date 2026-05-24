import { Router } from "express";
import { MessageController } from "../controllers/message.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Send a new message
router.post("/send", MessageController.sendMessage);

// Get conversation between current user and another user
router.get("/conversation/:userId", MessageController.getConversation);

// Get all chats for current user
router.get("/chats", MessageController.getUserChats);

// Get unread message count for current user
router.get("/unread-count", MessageController.getUnreadCount);

// Contact pet owner through a post
router.post("/contact-pet-owner", MessageController.contactPetOwner);

export default router;