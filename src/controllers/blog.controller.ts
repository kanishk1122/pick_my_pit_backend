import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import BlogModel from "../model/blog.model";
import { ResponseHelper } from "../helper/utils";
import { CloudinaryHelper } from "../helper/cloudinary";
import Joi from "joi";

// Validation schema for creating a blog post
const blogCreateValidation = Joi.object({
  title: Joi.string().required().min(5).max(150),
  content: Joi.object().required(),
  category: Joi.string().required(),
  coverImage: Joi.string().allow(""), // Allow base64 or URL or empty
  status: Joi.string().valid("draft", "published").default("draft"),
});

// Validation schema for updating a blog post
const blogUpdateValidation = Joi.object({
  title: Joi.string().min(5).max(150),
  content: Joi.object(),
  category: Joi.string(),
  coverImage: Joi.string().allow(""), // Allow base64 or URL or empty
  status: Joi.string().valid("draft", "published"),
});

export class BlogController {
  // --- CREATE BLOG ---
  static async createBlog(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { error, value } = blogCreateValidation.validate(req.body);
      if (error) {
        res
          .status(400)
          .json(ResponseHelper.error("Validation failed", error.details));
        return;
      }
      // Prefer admin id (admin routes), fallback to user id if present
      const authorId = req.admin?.id || req.user?.id;
      if (!authorId) {
        res
          .status(401)
          .json(ResponseHelper.error("Unauthorized: missing user context"));
        return;
      }

      // Convert base64 coverImage to Cloudinary URL if provided
      let coverImageUrl = "";
      if (value.coverImage && value.coverImage.startsWith("data:image")) {
        try {
          coverImageUrl = await CloudinaryHelper.uploadBase64Image(
            value.coverImage,
            "pickmypit/blogs"
          );
        } catch (uploadError: any) {
          res
            .status(400)
            .json(
              ResponseHelper.error("Image upload failed", uploadError.message)
            );
          return;
        }
      } else {
        coverImageUrl = value.coverImage || "";
      }

      const blogPost = new BlogModel({
        ...value,
        coverImage: coverImageUrl,
        author: authorId,
      });

      await blogPost.save();
      const populatedPost = await BlogModel.findById(blogPost._id).populate(
        "author",
        "firstname lastname userpic"
      );
      res
        .status(201)
        .json(
          ResponseHelper.success(
            populatedPost,
            "Blog post created successfully"
          )
        );
    } catch (error: any) {
      if (error?.code === 11000) {
        // Duplicate key (likely title or slug)
        res
          .status(409)
          .json(
            ResponseHelper.error(
              "A blog with this title already exists",
              error?.keyValue
            )
          );
        return;
      }
      res
        .status(500)
        .json(ResponseHelper.error("Internal server error", error));
    }
  }

  // --- GET ALL BLOGS (Public & Admin) ---
  static async getAllBlogs(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      const filter: any = {};
      // For public view, only show published posts. Admin can see all.
      const status = req.query.status as string;
      if (status && status !== "all") {
        filter.status = status;
      } else if (!status) {
        filter.status = "published";
      }

      const blogs = await BlogModel.find(filter)
        .populate("author", "firstname lastname userpic")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await BlogModel.countDocuments(filter);

      res
        .status(200)
        .json(
          ResponseHelper.paginated(
            blogs,
            total,
            page,
            limit,
            "Blog posts retrieved successfully"
          )
        );
    } catch (error) {
      res
        .status(500)
        .json(ResponseHelper.error("Internal server error", error));
    }
  }

  // --- GET BLOG BY SLUG (Public) ---
  static async getBlogBySlug(req: Request, res: Response): Promise<void> {
    try {
      const { slug } = req.params;
      const blog = await BlogModel.findOne({
        slug,
        status: "published",
      }).populate("author", "firstname lastname userpic");

      if (!blog) {
        res.status(404).json(ResponseHelper.error("Blog post not found"));
        return;
      }
      res
        .status(200)
        .json(ResponseHelper.success(blog, "Blog post retrieved successfully"));
    } catch (error) {
      res
        .status(500)
        .json(ResponseHelper.error("Internal server error", error));
    }
  }

  // --- GET BLOG BY ID (Admin) ---
  static async getBlogById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const blog = await BlogModel.findById(id).populate(
        "author",
        "firstname lastname userpic"
      );

      if (!blog) {
        res.status(404).json(ResponseHelper.error("Blog post not found"));
        return;
      }
      res
        .status(200)
        .json(ResponseHelper.success(blog, "Blog post retrieved successfully"));
    } catch (error) {
      res
        .status(500)
        .json(ResponseHelper.error("Internal server error", error));
    }
  }

  // --- UPDATE BLOG ---
  static async updateBlog(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { id } = req.params;
      const { error, value } = blogUpdateValidation.validate(req.body);
      if (error) {
        res
          .status(400)
          .json(ResponseHelper.error("Validation failed", error.details));
        return;
      }

      // Convert base64 coverImage to Cloudinary URL if provided and is base64
      if (value.coverImage && value.coverImage.startsWith("data:image")) {
        try {
          value.coverImage = await CloudinaryHelper.uploadBase64Image(
            value.coverImage,
            "pickmypit/blogs"
          );
        } catch (uploadError: any) {
          res
            .status(400)
            .json(
              ResponseHelper.error("Image upload failed", uploadError.message)
            );
          return;
        }
      }

      const updatedBlog = await BlogModel.findByIdAndUpdate(
        id,
        { $set: value },
        { new: true }
      ).populate("author", "firstname lastname userpic");

      if (!updatedBlog) {
        res.status(404).json(ResponseHelper.error("Blog post not found"));
        return;
      }
      res
        .status(200)
        .json(
          ResponseHelper.success(updatedBlog, "Blog post updated successfully")
        );
    } catch (error) {
      res
        .status(500)
        .json(ResponseHelper.error("Internal server error", error));
    }
  }

  // --- DELETE BLOG ---
  static async deleteBlog(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { id } = req.params;
      const deletedBlog = await BlogModel.findByIdAndDelete(id);

      if (!deletedBlog) {
        res.status(404).json(ResponseHelper.error("Blog post not found"));
        return;
      }
      res
        .status(200)
        .json(ResponseHelper.success(null, "Blog post deleted successfully"));
    } catch (error) {
      res
        .status(500)
        .json(ResponseHelper.error("Internal server error", error));
    }
  }
}
