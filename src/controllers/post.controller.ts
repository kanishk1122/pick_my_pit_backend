import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import PostModel from "../model/post.model";
import { post_validation, post_update_validation } from "../helper/validation";
import { ResponseHelper } from "../helper/utils";
import { Types } from "mongoose";

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

      // Custom validation for phone numbers and links
      const phoneRegex =
        /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
      const linkRegex = /(https?:\/\/[^\s]+)/g;

      if (phoneRegex.test(value.title) || linkRegex.test(value.title)) {
        res
          .status(400)
          .json(
            ResponseHelper.error("Title cannot contain phone numbers or links.")
          );
        return;
      }

      phoneRegex.lastIndex = 0; // Reset regex state
      linkRegex.lastIndex = 0; // Reset regex state

      if (
        phoneRegex.test(value.discription) ||
        linkRegex.test(value.discription)
      ) {
        res
          .status(400)
          .json(
            ResponseHelper.error(
              "Description cannot contain phone numbers or links."
            )
          );
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

      const filter: any = { status: "available" }; // Default to available posts

      // Filter by species
      if (req.query.species && req.query.species !== "") {
        filter.species = { $regex: new RegExp(`^${req.query.species}$`, "i") };
      }

      // Filter by breed/category
      if (req.query.breed && req.query.breed !== "") {
        filter.category = { $regex: new RegExp(`^${req.query.breed}$`, "i") };
      }

      // Filter by type (free/paid)
      if (req.query.type && req.query.type !== "") {
        filter.type = req.query.type;
      }

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

      if (!Types.ObjectId.isValid(id)) {
        res.status(400).json(ResponseHelper.error("Invalid post ID format."));
        return;
      }

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

      // Custom validation for phone numbers and links
      const phoneRegex =
        /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
      const linkRegex = /(https?:\/\/[^\s]+)/g;

      if (
        value.title &&
        (phoneRegex.test(value.title) || linkRegex.test(value.title))
      ) {
        res
          .status(400)
          .json(
            ResponseHelper.error("Title cannot contain phone numbers or links.")
          );
        return;
      }

      phoneRegex.lastIndex = 0; // Reset regex state
      linkRegex.lastIndex = 0; // Reset regex state

      if (
        value.discription &&
        (phoneRegex.test(value.discription) ||
          linkRegex.test(value.discription))
      ) {
        res
          .status(400)
          .json(
            ResponseHelper.error(
              "Description cannot contain phone numbers or links."
            )
          );
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
      const limit = parseInt(req.query.limit as string) || 12;
      const skip = (page - 1) * limit;
      const sortBy = (req.query.sort as string) || "newest";

      const filter: any = { status: "available" }; // Default to available posts

      // Filter by status only if explicitly provided
      if (req.query.status && req.query.status !== "") {
        filter.status = req.query.status;
      }

      // Filter by species
      if (req.query.species && req.query.species !== "") {
        filter.species = { $regex: new RegExp(`^${req.query.species}$`, "i") };
      }

      // Filter by breed/category
      if (req.query.breed && req.query.breed !== "") {
        filter.category = { $regex: new RegExp(`^${req.query.breed}$`, "i") };
      }

      // Filter by type (free/paid)
      if (req.query.type && req.query.type !== "") {
        filter.type = req.query.type;
      }

      // Filter by price range, only if type is 'paid'
      if (req.query.type === "paid") {
        const minPrice = parseFloat(req.query.minPrice as string) || 0;
        const maxPrice =
          parseFloat(req.query.maxPrice as string) || Number.MAX_SAFE_INTEGER;

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

      // Sorting logic
      let sort: any = {};
      switch (sortBy) {
        case "oldest":
          sort = { createdAt: 1 };
          break;
        case "price-low":
          sort = { amount: 1 };
          break;
        case "price-high":
          sort = { amount: -1 };
          break;
        case "title-az":
          sort = { title: 1 };
          break;
        case "title-za":
          sort = { title: -1 };
          break;
        case "newest":
        default:
          sort = { createdAt: -1 };
          break;
      }

      console.log("Filter query:", filter); // Debug log
      console.log("Sort query:", sort); // Debug log

      const posts = await PostModel.find(filter)
        .populate("owner", "firstname lastname userpic phone")
        .populate("address")
        .skip(skip)
        .limit(limit)
        .sort(sort);

      const total = await PostModel.countDocuments(filter);

      res
        .status(200)
        .json(
          ResponseHelper.paginated(
            posts,
            total,
            page,
            limit,
            "Filtered posts retrieved successfully"
          )
        );
    } catch (error) {
      console.error("Filter posts error:", error);
      res.status(500).json(ResponseHelper.error("Internal server error"));
    }
  }

  // Get pending approvals (non-active posts)
  static async getPendingApprovals(req: Request, res: Response): Promise<void> {
    try {
      console.log("Fetching approvals with filters:", req.query);

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      // 1. Extract Query Parameters
      const { search, status, species } = req.query;

      // 2. Initialize Filter Object
      const filter: any = {};

      // --- Status Filter ---
      if (status) {
        // If frontend specifically asks for "all", we don't filter by status.
        // Otherwise, we filter by the specific status (pending, approved, rejected)
        if (status !== "all") {
          filter.status = status;
        }
      } else {
        // Default Fallback: If no status param is provided at all,
        // strictly show "pending" (matches route name intent)
        filter.status = "pending";
      }

      // --- Species Filter ---
      if (species && species !== "all") {
        filter.species = species;
      }

      // --- Search Filter (Regex) ---
      if (search) {
        // Create a case-insensitive regex
        const searchRegex = new RegExp(search as string, "i");

        // Search in Title, Description, or Breed
        filter.$or = [
          { title: searchRegex },
          { description: searchRegex },
          { breed: searchRegex },
        ];
      }

      // 3. Execute Query with the Filter
      const posts = await PostModel.find(filter)
        .populate("owner", "firstname lastname userpic phone email")
        .populate("address")
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 });

      // 4. Get Total Count based on the SAME filter (Crucial for correct pagination)
      const total = await PostModel.countDocuments(filter);

      console.log(`Found ${posts.length} posts. Total matching: ${total}`);

      res
        .status(200)
        .json(
          ResponseHelper.paginated(
            posts,
            total,
            page,
            limit,
            "Approvals retrieved successfully"
          )
        );
    } catch (error) {
      console.error("Get pending approvals error:", error);
      res.status(500).json(ResponseHelper.error("Internal server error"));
    }
  }

  // Approve post
  static async approvePost(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { id } = req.params;

      // if (!req.user) {
      //   res.status(401).json(ResponseHelper.error("User not authenticated"));
      //   return;
      // }

      // Find the post
      const post = await PostModel.findById(id);
      if (!post) {
        res.status(404).json(ResponseHelper.error("Post not found"));
        return;
      }

      // Check if user is admin or superadmin
      if (!req.user || !["admin", "superadmin"].includes(req.user.role)) {
        res
          .status(403)
          .json(ResponseHelper.error("Only admins can approve posts"));
        return;
      }

      // Update status to active
      const updatedPost = await PostModel.findByIdAndUpdate(
        id,
        { $set: { status: "available" } },
        { new: true }
      )
        .populate("owner", "firstname lastname userpic")
        .populate("address");

      res
        .status(200)
        .json(
          ResponseHelper.success(updatedPost, "Post approved successfully")
        );
    } catch (error) {
      console.error("Approve post error:", error);
      res.status(500).json(ResponseHelper.error("Internal server error"));
    }
  }

  // Reject post
  static async rejectPost(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { id } = req.params;

      // if (!req.user) {
      //   res.status(401).json(ResponseHelper.error("User not authenticated"));
      //   return;
      // }

      // Find the post
      const post = await PostModel.findById(id);
      if (!post) {
        res.status(404).json(ResponseHelper.error("Post not found"));
        return;
      }

      // Check if user is admin or superadmin
      if (!req.user || !["admin", "superadmin"].includes(req.user.role)) {
        res
          .status(403)
          .json(ResponseHelper.error("Only admins can reject posts"));
        return;
      }

      // Update status to rejected
      const updatedPost = await PostModel.findByIdAndUpdate(
        id,
        { $set: { status: "rejected" } },
        { new: true }
      )
        .populate("owner", "firstname lastname userpic")
        .populate("address");

      res
        .status(200)
        .json(
          ResponseHelper.success(updatedPost, "Post rejected successfully")
        );
    } catch (error) {
      console.error("Reject post error:", error);
      res.status(500).json(ResponseHelper.error("Internal server error"));
    }
  }
}
