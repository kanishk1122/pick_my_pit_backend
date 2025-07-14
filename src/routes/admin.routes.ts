import { Router } from "express";
import { AdminController } from "../controllers/admin.controller.js";

const router = Router();

// Admin profile routes (middleware will be added later)
router.get("/profile", AdminController.getProfile);
router.put("/profile", AdminController.updateProfile);

// Dashboard
router.get("/dashboard/stats", AdminController.getDashboardStats);

// Admin management (Super admin only - middleware will be added later)
router.get("/", AdminController.getAllAdmins);
router.get("/:id", AdminController.getAdminById);
router.post("/", AdminController.createAdmin);
router.put("/:id", AdminController.updateAdmin);
router.delete("/:id", AdminController.deleteAdmin);

export default router;
