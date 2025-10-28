import { Router } from "express";
import { UserController } from "../controllers/user.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

// Public routes
router.get("/:id", UserController.getUserById);

// Protected user routes 
router.get("/profile/me", authMiddleware, UserController.getProfile);
router.put("/profile/me", authMiddleware, UserController.updateUser);
router.put("/:id", authMiddleware, UserController.updateUser);

// Admin only routes 
router.get("/", authMiddleware, UserController.getAllUsers);
router.delete("/:id", authMiddleware, UserController.deleteUser);

export default router;
