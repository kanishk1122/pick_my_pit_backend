import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import AdminModel from "../model/admin.model.js";
import UserModel from "../model/user.model.js";
import PostModel from "../model/post.model.js";
import { ResponseHelper } from "../helper/utils.js";
import Joi from "joi";

// Validation schemas
const adminCreateValidation = Joi.object({
  firstname: Joi.string().required().min(2).max(30),
  lastname: Joi.string().required().min(2).max(30),
  email: Joi.string().email().required(),
  password: Joi.string().required().min(6).max(20),
  role: Joi.string().valid("admin", "superadmin").default("admin"),
  gender: Joi.string().valid("male", "female", "other").optional(),
});

const adminUpdateValidation = Joi.object({
  firstname: Joi.string().min(2).max(30),
  lastname: Joi.string().min(2).max(30),
  email: Joi.string().email(),
  role: Joi.string().valid("admin", "superadmin"),
  status: Joi.string().valid("active", "inactive"),
  gender: Joi.string().valid("male", "female", "other"),
}).min(1);

export class AdminController {
  // Get dashboard statistics
  static async getDashboardStats(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const totalUsers = await UserModel.countDocuments();
      const activeUsers = await UserModel.countDocuments({ status: "active" });
      const totalPosts = await PostModel.countDocuments();
      const availablePosts = await PostModel.countDocuments({
        status: "available",
      });
      const soldPosts = await PostModel.countDocuments({ status: "sold" });
      const adoptedPosts = await PostModel.countDocuments({
        status: "adopted",
      });
      const totalAdmins = await AdminModel.countDocuments();

      // Recent users (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const recentUsers = await UserModel.countDocuments({
        createdAt: { $gte: thirtyDaysAgo },
      });

      // Recent posts (last 30 days)
      const recentPosts = await PostModel.countDocuments({
        createdAt: { $gte: thirtyDaysAgo },
      });

      const stats = {
        users: {
          total: totalUsers,
          active: activeUsers,
          recent: recentUsers,
        },
        posts: {
          total: totalPosts,
          available: availablePosts,
          sold: soldPosts,
          adopted: adoptedPosts,
          recent: recentPosts,
        },
        admins: {
          total: totalAdmins,
        },
      };

      res
        .status(200)
        .json(
          ResponseHelper.success(
            stats,
            "Dashboard statistics retrieved successfully"
          )
        );
    } catch (error) {
      console.error("Get dashboard stats error:", error);
      res.status(500).json(ResponseHelper.error("Internal server error"));
    }
  }

  // Get all admins (Super admin only)
  static async getAllAdmins(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      const admins = await AdminModel.find()
        .select("-password")
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 });

      const total = await AdminModel.countDocuments();

      res
        .status(200)
        .json(
          ResponseHelper.paginated(
            admins,
            total,
            page,
            limit,
            "Admins retrieved successfully"
          )
        );
    } catch (error) {
      console.error("Get admins error:", error);
      res.status(500).json(ResponseHelper.error("Internal server error"));
    }
  }

  // Get admin by ID
  static async getAdminById(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { id } = req.params;

      const admin = await AdminModel.findById(id).select("-password");

      if (!admin) {
        res.status(404).json(ResponseHelper.error("Admin not found"));
        return;
      }

      res
        .status(200)
        .json(ResponseHelper.success(admin, "Admin retrieved successfully"));
    } catch (error) {
      console.error("Get admin error:", error);
      res.status(500).json(ResponseHelper.error("Internal server error"));
    }
  }

  // Create new admin (Super admin only)
  static async createAdmin(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { error, value } = adminCreateValidation.validate(req.body);
      if (error) {
        res
          .status(400)
          .json(ResponseHelper.error("Validation failed", error.details));
        return;
      }

      // Check if admin already exists
      const existingAdmin = await AdminModel.findByEmail(value.email);
      if (existingAdmin) {
        res
          .status(409)
          .json(ResponseHelper.error("Admin with this email already exists"));
        return;
      }

      const admin = new AdminModel(value);
      await admin.save();

      const adminResponse = await AdminModel.findById(admin._id).select(
        "-password"
      );

      res
        .status(201)
        .json(
          ResponseHelper.success(adminResponse, "Admin created successfully")
        );
    } catch (error) {
      console.error("Create admin error:", error);
      res.status(500).json(ResponseHelper.error("Internal server error"));
    }
  }

  // Update admin (Super admin only)
  static async updateAdmin(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { id } = req.params;
      const { error, value } = adminUpdateValidation.validate(req.body);

      if (error) {
        res
          .status(400)
          .json(ResponseHelper.error("Validation failed", error.details));
        return;
      }

      const admin = await AdminModel.findByIdAndUpdate(
        id,
        { $set: value },
        { new: true }
      ).select("-password");

      if (!admin) {
        res.status(404).json(ResponseHelper.error("Admin not found"));
        return;
      }

      res
        .status(200)
        .json(ResponseHelper.success(admin, "Admin updated successfully"));
    } catch (error) {
      console.error("Update admin error:", error);
      res.status(500).json(ResponseHelper.error("Internal server error"));
    }
  }

  // Delete admin (Super admin only)
  static async deleteAdmin(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { id } = req.params;

      if (!req.admin) {
        res.status(401).json(ResponseHelper.error("Admin not authenticated"));
        return;
      }

      // Prevent self-deletion
      if (req.admin.id === id) {
        res
          .status(400)
          .json(ResponseHelper.error("Cannot delete your own account"));
        return;
      }

      const admin = await AdminModel.findByIdAndDelete(id);

      if (!admin) {
        res.status(404).json(ResponseHelper.error("Admin not found"));
        return;
      }

      res
        .status(200)
        .json(ResponseHelper.success(null, "Admin deleted successfully"));
    } catch (error) {
      console.error("Delete admin error:", error);
      res.status(500).json(ResponseHelper.error("Internal server error"));
    }
  }

  // Get admin profile
  static async getProfile(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      if (!req.admin) {
        res.status(401).json(ResponseHelper.error("Admin not authenticated"));
        return;
      }

      const admin = await AdminModel.findById(req.admin.id).select("-password");

      if (!admin) {
        res.status(404).json(ResponseHelper.error("Admin not found"));
        return;
      }

      res
        .status(200)
        .json(
          ResponseHelper.success(admin, "Admin profile retrieved successfully")
        );
    } catch (error) {
      console.error("Get admin profile error:", error);
      res.status(500).json(ResponseHelper.error("Internal server error"));
    }
  }

  // Update admin profile
  static async updateProfile(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      if (!req.admin) {
        res.status(401).json(ResponseHelper.error("Admin not authenticated"));
        return;
      }

      const allowedUpdates = ["firstname", "lastname", "gender"];
      const updates: any = {};

      for (const field of allowedUpdates) {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      }

      if (Object.keys(updates).length === 0) {
        res.status(400).json(ResponseHelper.error("No valid fields to update"));
        return;
      }

      const admin = await AdminModel.findByIdAndUpdate(
        req.admin.id,
        { $set: updates },
        { new: true }
      ).select("-password");

      res
        .status(200)
        .json(ResponseHelper.success(admin, "Profile updated successfully"));
    } catch (error) {
      console.error("Update admin profile error:", error);
      res.status(500).json(ResponseHelper.error("Internal server error"));
    }
  }
}
