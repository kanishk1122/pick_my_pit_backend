import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { prisma } from "../config/database";
import { ResponseHelper } from "../helper/utils";
import Joi from "joi";
import bcrypt from "bcryptjs";

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

function formatAdmin(admin: any) {
  if (!admin) return null;
  const formatted = {
    ...admin,
    _id: admin.id,
  };
  delete formatted.password;
  return formatted;
}

export class AdminController {
  // Get dashboard statistics
  static async getDashboardStats(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const totalUsers = await prisma.user.count();
      const activeUsers = await prisma.user.count({ where: { status: "active" } });
      const totalPosts = await prisma.post.count();
      const availablePosts = await prisma.post.count({
        where: { status: "available" }
      });
      const soldPosts = await prisma.post.count({ where: { status: "sold" } });
      const adoptedPosts = await prisma.post.count({
        where: { status: "adopted" }
      });
      const totalAdmins = await prisma.admin.count();

      // Recent users (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const recentUsers = await prisma.user.count({
        where: {
          createdAt: { gte: thirtyDaysAgo }
        }
      });

      // Recent posts (last 30 days)
      const recentPosts = await prisma.post.count({
        where: {
          createdAt: { gte: thirtyDaysAgo }
        }
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

      const admins = await prisma.admin.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take: limit
      });

      const total = await prisma.admin.count();
      const formattedAdmins = admins.map(formatAdmin);

      res
        .status(200)
        .json(
          ResponseHelper.paginated(
            formattedAdmins,
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

      const admin = await prisma.admin.findUnique({
        where: { id }
      });

      if (!admin) {
        res.status(404).json(ResponseHelper.error("Admin not found"));
        return;
      }

      res
        .status(200)
        .json(ResponseHelper.success(formatAdmin(admin), "Admin retrieved successfully"));
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
      const existingAdmin = await prisma.admin.findUnique({
        where: { email: value.email.toLowerCase() }
      });
      if (existingAdmin) {
        res
          .status(409)
          .json(ResponseHelper.error("Admin with this email already exists"));
        return;
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(value.password, salt);

      const admin = await prisma.admin.create({
        data: {
          firstname: value.firstname,
          lastname: value.lastname,
          email: value.email.toLowerCase(),
          password: hashedPassword,
          role: value.role,
          gender: value.gender,
        }
      });

      res
        .status(201)
        .json(
          ResponseHelper.success(formatAdmin(admin), "Admin created successfully")
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

      const existingAdmin = await prisma.admin.findUnique({ where: { id } });
      if (!existingAdmin) {
        res.status(404).json(ResponseHelper.error("Admin not found"));
        return;
      }

      const admin = await prisma.admin.update({
        where: { id },
        data: value
      });

      res
        .status(200)
        .json(ResponseHelper.success(formatAdmin(admin), "Admin updated successfully"));
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

      await prisma.admin.delete({
        where: { id }
      });

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

      const admin = await prisma.admin.findUnique({
        where: { id: req.admin.id }
      });

      if (!admin) {
        res.status(404).json(ResponseHelper.error("Admin not found"));
        return;
      }

      res
        .status(200)
        .json(
          ResponseHelper.success(formatAdmin(admin), "Admin profile retrieved successfully")
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

      const admin = await prisma.admin.update({
        where: { id: req.admin.id },
        data: updates
      });

      res
        .status(200)
        .json(ResponseHelper.success(formatAdmin(admin), "Profile updated successfully"));
    } catch (error) {
      console.error("Update admin profile error:", error);
      res.status(500).json(ResponseHelper.error("Internal server error"));
    }
  }
}

