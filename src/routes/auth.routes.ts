import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";

const router = Router();

// Public routes
router.post("/register", AuthController.register);
router.post("/login", AuthController.login);
router.post("/google-auth", AuthController.googleAuth);
router.get("/verify-token", AuthController.verifyToken);
router.post("/logout", AuthController.logout); // No auth middleware needed

// Admin routes
router.post("/admin/login", AuthController.adminLogin);
//
// router.options("/admin/login", AuthController.adminLogin);
router.get("/admin/verify", AuthController.adminVerify);

export default router;
