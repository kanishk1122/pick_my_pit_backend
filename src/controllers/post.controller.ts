import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import PostModel from "../model/post.model.js";
import {
  post_validation,
  post_update_validation,
} from "../helper/validation.js";
import { ResponseHelper } from "../helper/utils.js";

export class PostController {
  // Create new post
  static async createPost(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { error, value } = post_validation.validate(req.body);
      if (error) {
        res
          .status(400)
          .json(ResponseHelper.error("Validation failed", error.details));
        return;
      }

      if (!req.user) {
        res.status(401).json(ResponseHelper.error("User not authenticated"));
        return;
      }

      const postData = {
        ...value,
        owner: req.user.id,
      };

      const post = new PostModel(postData);
      await post.save();

      const populatedPost = await PostModel.findById(post._id)
        .populate("owner", "firstname lastname userpic")
        .populate("address");

      res
        .status(201)
        .json(
          ResponseHelper.success(populatedPost, "Post created successfully")
        );
    } catch (error) {
      console.error("Create post error:", error);
      res.status(500).json(ResponseHelper.error("Internal server error"));
    }
  }

  // Get all posts
  static async getAllPosts(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      const filter: any = {};

      // // Filter by status
      // if (req.query.status) {
      //   filter.status = req.query.status;
      // } else {
      //   filter.status = "available"; // Default to available posts
      // }

      // // Filter by species
      // if (req.query.species) {
      //   filter.species = req.query.species;
      // }

      // // Filter by category/breed
      // if (req.query.category) {
      //   filter.category = req.query.category;
      // }

      // // Filter by type (free/paid)
      // if (req.query.type) {
      //   filter.type = req.query.type;
      // }

      const posts = await PostModel.find(filter)
        .populate("owner", "firstname lastname userpic")
        .populate("address")
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 });

      console.log("[post controller] post :", posts); // Debug log

      const total = await PostModel.countDocuments(filter);

      res
        .status(200)
        .json(
          ResponseHelper.paginated(
            posts,
            total,
            page,
            limit,
            "Posts retrieved successfully"
          )
        );
    } catch (error) {
      console.error("Get posts error:", error);
      res.status(500).json(ResponseHelper.error("Internal server error"));
    }
  }

  // Get post by ID
  static async getPostById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const post = await PostModel.findById(id)
        .populate("owner", "firstname lastname userpic phone email")
        .populate("address");

      if (!post) {
        res.status(404).json(ResponseHelper.error("Post not found"));
        return;
      }

      res
        .status(200)
        .json(ResponseHelper.success(post, "Post retrieved successfully"));
    } catch (error) {
      console.error("Get post error:", error);
      res.status(500).json(ResponseHelper.error("Internal server error"));
    }
  }

  // Get post by slug
  static async getPostBySlug(req: Request, res: Response): Promise<void> {
    try {
      const { slug } = req.params;

      const post = await PostModel.findBySlug(slug);

      if (!post) {
        res.status(404).json(ResponseHelper.error("Post not found"));
        return;
      }

      res
        .status(200)
        .json(ResponseHelper.success(post, "Post retrieved successfully"));
    } catch (error) {
      console.error("Get post by slug error:", error);
      res.status(500).json(ResponseHelper.error("Internal server error"));
    }
  }

  // Update post
  static async updatePost(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { id } = req.params;
      const { error, value } = post_update_validation.validate(req.body);

      if (error) {
        res
          .status(400)
          .json(ResponseHelper.error("Validation failed", error.details));
        return;
      }

      if (!req.user) {
        res.status(401).json(ResponseHelper.error("User not authenticated"));
        return;
      }

      // Find the post and check ownership
      const post = await PostModel.findById(id);
      if (!post) {
        res.status(404).json(ResponseHelper.error("Post not found"));
        return;
      }

      if (
        post.owner.toString() !== req.user.id &&
        !["admin", "superadmin"].includes(req.user.role)
      ) {
        res
          .status(403)
          .json(ResponseHelper.error("You can only update your own posts"));
        return;
      }

      const updatedPost = await PostModel.findByIdAndUpdate(
        id,
        { $set: value },
        { new: true }
      )
        .populate("owner", "firstname lastname userpic")
        .populate("address");

      res
        .status(200)
        .json(ResponseHelper.success(updatedPost, "Post updated successfully"));
    } catch (error) {
      console.error("Update post error:", error);
      res.status(500).json(ResponseHelper.error("Internal server error"));
    }
  }

  // Delete post
  static async deletePost(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { id } = req.params;

      if (!req.user) {
        res.status(401).json(ResponseHelper.error("User not authenticated"));
        return;
      }

      // Find the post and check ownership
      const post = await PostModel.findById(id);
      if (!post) {
        res.status(404).json(ResponseHelper.error("Post not found"));
        return;
      }

      if (
        post.owner.toString() !== req.user.id &&
        !["admin", "superadmin"].includes(req.user.role)
      ) {
        res
          .status(403)
          .json(ResponseHelper.error("You can only delete your own posts"));
        return;
      }

      await PostModel.findByIdAndDelete(id);

      res
        .status(200)
        .json(ResponseHelper.success(null, "Post deleted successfully"));
    } catch (error) {
      console.error("Delete post error:", error);
      res.status(500).json(ResponseHelper.error("Internal server error"));
    }
  }

  // Get user's posts
  static async getUserPosts(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json(ResponseHelper.error("User not authenticated"));
        return;
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      const posts = await PostModel.find({ owner: req.user.id })
        .populate("address")
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 });

      const total = await PostModel.countDocuments({ owner: req.user.id });

      res
        .status(200)
        .json(
          ResponseHelper.paginated(
            posts,
            total,
            page,
            limit,
            "User posts retrieved successfully"
          )
        );
    } catch (error) {
      console.error("Get user posts error:", error);
      res.status(500).json(ResponseHelper.error("Internal server error"));
    }
  }

  // Filter posts with advanced filtering
  static async filterPosts(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      const filter: any = {}; // Remove default status filter

      // Filter by status only if explicitly provided
      if (req.query.status && req.query.status !== "") {
        filter.status = req.query.status;
      }

      // Filter by species
      if (req.query.species && req.query.species !== "") {
        filter.species = { $regex: req.query.species, $options: "i" };
      }

      // Filter by breed/category
      if (req.query.breed && req.query.breed !== "") {
        filter.category = { $regex: req.query.breed, $options: "i" };
      }

      // Filter by type (free/paid)
      if (req.query.type && req.query.type !== "") {
        filter.type = req.query.type;
      }

      // Filter by price range (only for paid posts or when no type filter)
      const minPrice = parseFloat(req.query.minPrice as string) || 0;
      const maxPrice = parseFloat(req.query.maxPrice as string) || 100000;

      if (
        req.query.type !== "free" &&
        (req.query.minPrice || req.query.maxPrice)
      ) {
        filter.amount = {
          $gte: minPrice,
          $lte: maxPrice,
        };
      }

      // Search by title or description (note: using 'discription' to match DB)
      if (req.query.search && req.query.search !== "") {
        filter.$or = [
          { title: { $regex: req.query.search, $options: "i" } },
          { discription: { $regex: req.query.search, $options: "i" } },
        ];
      }

      console.log("Filter query:", filter); // Debug log

      const posts = await PostModel.find(filter)
        .populate("owner", "firstname lastname userpic phone")
        .populate("address")
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 });

      const total = await PostModel.countDocuments(filter);

      res.status(200).json(
        ResponseHelper.paginated(
          posts,
          total,
          page,
          limit,
          "Filtered posts retrieved successfully",
     
        )
      );
    } catch (error) {
      console.error("Filter posts error:", error);
      res.status(500).json(ResponseHelper.error("Internal server error"));
    }
  }
}
