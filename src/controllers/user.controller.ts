import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import UserModel from "../model/user.model.js";
import { ResponseHelper } from "../helper/utils.js";

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

      const users = await UserModel.find()
        .select("-password -sessionToken -emailConfirmToken")
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 });

      const total = await UserModel.countDocuments();

      res
        .status(200)
        .json(
          ResponseHelper.paginated(
            users,
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

      const user = await UserModel.findById(id)
        .select("-password -sessionToken -emailConfirmToken")
        .populate("addresses");

      if (!user) {
        res.status(404).json(ResponseHelper.error("User not found"));
        return;
      }

      res
        .status(200)
        .json(ResponseHelper.success(user, "User retrieved successfully"));
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
      const { id } = req.params;
      const updates = req.body;

      // Remove sensitive fields from updates
      delete updates.password;
      delete updates.role;
      delete updates.emailConfirm;
      delete updates.sessionToken;

      const user = await UserModel.findByIdAndUpdate(
        id,
        { $set: updates },
        { new: true, select: "-password -sessionToken -emailConfirmToken" }
      );

      if (!user) {
        res.status(404).json(ResponseHelper.error("User not found"));
        return;
      }

      res
        .status(200)
        .json(ResponseHelper.success(user, "User updated successfully"));
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

      const user = await UserModel.findByIdAndDelete(id);

      if (!user) {
        res.status(404).json(ResponseHelper.error("User not found"));
        return;
      }

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

      const user = await UserModel.findById(req.user.id)
        .select("-password -sessionToken -emailConfirmToken")
        .populate("addresses");

      if (!user) {
        res.status(404).json(ResponseHelper.error("User not found"));
        return;
      }

      res
        .status(200)
        .json(ResponseHelper.success(user, "Profile retrieved successfully"));
    } catch (error) {
      console.error("Get profile error:", error);
      res.status(500).json(ResponseHelper.error("Internal server error"));
    }
  }
}
