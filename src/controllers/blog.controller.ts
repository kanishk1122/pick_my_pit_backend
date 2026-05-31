import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { prisma } from "../config/database";
import { ResponseHelper } from "../helper/utils";
import { CloudinaryHelper } from "../helper/cloudinary";
import Joi from "joi";
import { redisService } from "../utils/redis";
import { ImageSafetyService } from "../utils/imageSafety";
import { socketService } from "../utils/socket";
import slugify from "slugify";

// Validation schema for creating a blog post
const blogCreateValidation = Joi.object({
  title: Joi.string().required().min(5).max(150),
  content: Joi.object().required(),
  category: Joi.string().required(),
  coverImage: Joi.string().allow(""),
  status: Joi.string().valid("draft", "published").default("draft"),
});

// Validation schema for updating a blog post
const blogUpdateValidation = Joi.object({
  title: Joi.string().min(5).max(150),
  content: Joi.object(),
  category: Joi.string(),
  coverImage: Joi.string().allow(""),
  status: Joi.string().valid("draft", "published"),
});

function formatBlog(blog: any) {
  if (!blog) return null;
  const formatted = {
    ...blog,
    _id: blog.id,
  };
  if (formatted.author) {
    formatted.author = {
      ...formatted.author,
      _id: formatted.author.id
    };
  }
  return formatted;
}

export class BlogController {
  static async createBlog(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { error, value } = blogCreateValidation.validate(req.body);
      if (error) {
        res.status(400).json(ResponseHelper.error("Validation failed", error.details));
        return;
      }
      const authorId = req.admin?.id || req.user?.id;
      if (!authorId) {
        res.status(401).json(ResponseHelper.error("Unauthorized: missing user context"));
        return;
      }

      let coverImageUrl = "";
      if (value.coverImage && value.coverImage.startsWith("data:image")) {
        try {
          coverImageUrl = await CloudinaryHelper.uploadBase64Image(value.coverImage, "pickmypit/blogs");
        } catch (uploadError: any) {
          res.status(400).json(ResponseHelper.error("Image upload failed", uploadError.message));
          return;
        }
      } else {
        coverImageUrl = value.coverImage || "";
      }

      const slug = slugify(value.title, { lower: true, strict: true });

      const blogData = {
        title: value.title,
        content: value.content,
        category: value.category,
        coverImage: coverImageUrl,
        status: value.status,
        slug: slug,
        authorId: authorId,
      };

      // Background Processing
      (async () => {
        try {
            const spamWords = ["spam", "fake", "scam"];
            if (spamWords.some(word => blogData.title.toLowerCase().includes(word))) {
                console.warn("🚫 Blog REJECTED: Spam detected in title", blogData.title);
                return;
            }

            if (blogData.coverImage) {
                const isSafe = await ImageSafetyService.isImageSafe(blogData.coverImage);
                if (!isSafe) {
                    console.warn("🚫 Blog REJECTED: Unsafe cover image detected", blogData.coverImage);
                    return;
                }
            }

            const blogPost = await prisma.blog.create({
              data: blogData,
              include: {
                author: {
                  select: { id: true, firstname: true, lastname: true, userpic: true }
                }
              }
            });
            console.log("💾 Blog saved to DB:", blogPost.id);

            const formatted = formatBlog(blogPost);

            const cacheKey = `blog:${blogPost.slug}`;
            await redisService.set(cacheKey, formatted, 3600);
            await redisService.set(`blog:id:${blogPost.id}`, formatted, 3600);

            console.log("🚀 Blog cached in Redis:", cacheKey);

            socketService.emit("blog_created", formatted);
        } catch (error: any) {
            console.error("❌ Error processing blog creation:", error.message);
        }
      })();

      res.status(202).json(ResponseHelper.success(null, "Blog post creation initiated. It will be live shortly."));
    } catch (error: any) {
      if (error?.code === "P2002" || error?.message?.includes("Unique constraint")) {
        res.status(409).json(ResponseHelper.error("A blog with this title already exists"));
        return;
      }
      res.status(500).json(ResponseHelper.error("Internal server error", error));
    }
  }

  // --- GET ALL BLOGS (Public & Admin) ---
  static async getAllBlogs(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      const filter: any = {};
      const status = req.query.status as string;
      if (status && status !== "all") {
        filter.status = status;
      } else if (!status) {
        filter.status = "published";
      }

      const blogs = await prisma.blog.findMany({
        where: filter,
        include: {
          author: {
            select: { id: true, firstname: true, lastname: true, userpic: true }
          }
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit
      });

      const total = await prisma.blog.count({ where: filter });
      const formattedBlogs = blogs.map(formatBlog);

      res
        .status(200)
        .json(
          ResponseHelper.paginated(
            formattedBlogs,
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

      // --- REDIS CACHE CHECK ---
      const cachedBlog = await redisService.get(`blog:${slug}`);
      if (cachedBlog) {
        console.log("🚀 Serving from Redis cache:", slug);
        res
          .status(200)
          .json(ResponseHelper.success(cachedBlog, "Blog post retrieved successfully (from cache)"));
        return;
      }

      const blog = await prisma.blog.findFirst({
        where: {
          slug,
          status: "published",
        },
        include: {
          author: {
            select: { id: true, firstname: true, lastname: true, userpic: true }
          }
        }
      });

      if (!blog) {
        res.status(404).json(ResponseHelper.error("Blog post not found"));
        return;
      }

      const formatted = formatBlog(blog);

      // Update cache
      await redisService.set(`blog:${slug}`, formatted, 3600);

      res
        .status(200)
        .json(ResponseHelper.success(formatted, "Blog post retrieved successfully"));
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

      // --- REDIS CACHE CHECK ---
      const cachedBlog = await redisService.get(`blog:id:${id}`);
      if (cachedBlog) {
        res
          .status(200)
          .json(ResponseHelper.success(cachedBlog, "Blog post retrieved successfully (from cache)"));
        return;
      }

      const blog = await prisma.blog.findUnique({
        where: { id },
        include: {
          author: {
            select: { id: true, firstname: true, lastname: true, userpic: true }
          }
        }
      });

      if (!blog) {
        res.status(404).json(ResponseHelper.error("Blog post not found"));
        return;
      }

      const formatted = formatBlog(blog);

      // Update cache
      await redisService.set(`blog:id:${id}`, formatted, 3600);

      res
        .status(200)
        .json(ResponseHelper.success(formatted, "Blog post retrieved successfully"));
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

      if (value.title) {
        value.slug = slugify(value.title, { lower: true, strict: true });
      }

      const updatedBlog = await prisma.blog.update({
        where: { id },
        data: value,
        include: {
          author: {
            select: { id: true, firstname: true, lastname: true, userpic: true }
          }
        }
      });

      // Invalidate cache
      await redisService.del(`blog:${updatedBlog.slug}`);
      await redisService.del(`blog:id:${id}`);

      res
        .status(200)
        .json(
          ResponseHelper.success(formatBlog(updatedBlog), "Blog post updated successfully")
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
      const deletedBlog = await prisma.blog.delete({
        where: { id }
      });

      // Invalidate cache
      await redisService.del(`blog:${deletedBlog.slug}`);
      await redisService.del(`blog:id:${id}`);

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

