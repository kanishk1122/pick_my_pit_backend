import { Router } from "express";
import { UserController } from "../controllers/user.controller.js";

const router = Router();

// Public routes
router.get("/:id", UserController.getUserById);

// Protected user routes (middleware will be added later)
router.get("/profile/me", UserController.getProfile);
router.put("/profile/me", UserController.updateUser);
router.put("/:id", UserController.updateUser);

// Admin only routes (middleware will be added later)
router.get("/", UserController.getAllUsers);
router.delete("/:id", UserController.deleteUser);

export default router;
