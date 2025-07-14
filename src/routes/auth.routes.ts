import { Router } from "express";
import { AuthController } from "../controllers/auth.controller.js";

const router = Router();

// User Authentication Routes
router.post("/register", AuthController.register);
router.post("/login", AuthController.login);
router.post("/google-auth", AuthController.googleAuth);

// Admin Authentication Routes
router.post("/admin/login", AuthController.adminLogin);

// Simple logout routes (no middleware for now)
router.post("/logout", AuthController.logout);
router.post("/admin/logout", AuthController.logout);

export default router;
