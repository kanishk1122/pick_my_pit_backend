import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { prisma } from "../config/database";
import { ResponseHelper } from "../helper/utils";

function formatUser(user: any) {
  if (!user) return null;
  const formatted = {
    ...user,
    _id: user.id,
  };
  delete formatted.password;
  delete formatted.sessionToken;
  delete formatted.emailConfirmToken;
  if (formatted.addresses) {
    formatted.addresses = formatted.addresses.map((addr: any) => ({
      ...addr,
      _id: addr.id,
      location: {
        type: "Point",
        coordinates: [addr.longitude, addr.latitude]
      }
    }));
  }
  return formatted;
}

export class UserController {
  // Get all users (Admin only)
  static async getAllUsers(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      const users = await prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take: limit
      });

      const total = await prisma.user.count();
      const formattedUsers = users.map(formatUser);

      res
        .status(200)
        .json(
          ResponseHelper.paginated(
            formattedUsers,
            total,
            page,
            limit,
            "Users retrieved successfully"
          )
        );
    } catch (error) {
      console.error("Get users error:", error);
      res.status(500).json(ResponseHelper.error("Internal server error"));
    }
  }

  // Get user by ID
  static async getUserById(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { id } = req.params;

      const user = await prisma.user.findUnique({
        where: { id },
        include: {
          addresses: true
        }
      });

      if (!user) {
        res.status(404).json(ResponseHelper.error("User not found"));
        return;
      }

      res
        .status(200)
        .json(ResponseHelper.success(formatUser(user), "User retrieved successfully"));
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json(ResponseHelper.error("Internal server error"));
    }
  }

  // Update user profile
  static async updateUser(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json(ResponseHelper.error("User not authenticated"));
        return;
      }

      const updates = { ...req.body };

      // Remove sensitive fields from updates
      delete updates.password;
      delete updates.role;
      delete updates.emailConfirm;
      delete updates.sessionToken;
      delete updates.id;
      delete updates._id;

      const user = await prisma.user.update({
        where: { id: req.user.id },
        data: updates
      });

      res
        .status(200)
        .json(ResponseHelper.success(formatUser(user), "User updated successfully"));
    } catch (error) {
      console.error("Update user error:", error);
      res.status(500).json(ResponseHelper.error("Internal server error"));
    }
  }

  // Delete user (Admin only)
  static async deleteUser(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { id } = req.params;

      const user = await prisma.user.delete({
        where: { id }
      });

      res
        .status(200)
        .json(ResponseHelper.success(null, "User deleted successfully"));
    } catch (error) {
      console.error("Delete user error:", error);
      res.status(500).json(ResponseHelper.error("Internal server error"));
    }
  }

  // Get user's own profile
  static async getProfile(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json(ResponseHelper.error("User not authenticated"));
        return;
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: {
          addresses: true
        }
      });

      if (!user) {
        res.status(404).json(ResponseHelper.error("User not found"));
        return;
      }

      res
        .status(200)
        .json(ResponseHelper.success(formatUser(user), "Profile retrieved successfully"));
    } catch (error) {
      console.error("Get profile error:", error);
      res.status(500).json(ResponseHelper.error("Internal server error"));
    }
  }
}

