import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { prisma } from "../config/database";
import { post_validation, post_update_validation } from "../helper/validation";
import { ResponseHelper } from "../helper/utils";
import { redisService } from "../utils/redis";
import { postQueue } from "../queues/postQueue";
import slugify from "slugify";

function formatPost(post: any) {
  if (!post) return null;
  const formatted = {
    ...post,
    _id: post.id,
    discription: post.discription, // preserve spelling from codebase
    age: post.ageValue !== null && post.ageValue !== undefined ? { value: post.ageValue, unit: post.ageUnit } : undefined,
    formattedAge: post.ageValue !== null && post.ageValue !== undefined ? `${post.ageValue} ${post.ageValue === 1 ? post.ageUnit.slice(0, -1) : post.ageUnit} old` : "",
  };
  if (formatted.owner) {
    formatted.owner = {
      ...formatted.owner,
      _id: formatted.owner.id
    };
  }
  if (formatted.address) {
    formatted.address = {
      ...formatted.address,
      _id: formatted.address.id,
      location: {
        type: "Point",
        coordinates: [formatted.address.longitude, formatted.address.latitude]
      }
    };
  }
  return formatted;
}

export class PostController {
  static async banPost(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { id } = req.params;
      const post = await prisma.post.findUnique({
        where: { id }
      });
      if (!post) {
        res.status(404).json(ResponseHelper.error("Post not found"));
        return;
      }
      const updatedPost = await prisma.post.update({
        where: { id },
        data: { status: "banned" }
      });

      await redisService.del(`post:${updatedPost.slug}`);
      await redisService.del(`post:id:${id}`);

      res.status(200).json(ResponseHelper.success(formatPost(updatedPost), "Post banned successfully"));
    } catch (error) {
      console.error("Ban post error:", error);
      res.status(500).json(ResponseHelper.error("Internal server error"));
    }
  }

  static async createPost(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { error, value } = post_validation.validate(req.body);
      if (error) {
        res.status(400).json(ResponseHelper.error("Validation failed", error.details));
        return;
      }

      if (!req.user) {
        res.status(401).json(ResponseHelper.error("User not authenticated"));
        return;
      }

      // Generate a unique slug in the controller so we have it before processing
      const baseSlug = slugify(value.title || "pet-post", { lower: true, strict: true });
      const uniqueId = new Date().getTime().toString().slice(-6);
      const slug = `${baseSlug}-${uniqueId}`;

      const postData = {
        title: value.title,
        slug: slug,
        discription: value.discription,
        amount: value.amount,
        type: value.type,
        category: value.category,
        species: value.species,
        speciesSlug: slugify(value.species, { lower: true }),
        breedSlug: slugify(value.category, { lower: true }),
        images: value.images,
        ageValue: value.age?.value,
        ageUnit: value.age?.unit || "months",
        ownerId: req.user.id,
        addressId: value.addressId,
        isNegotiable: value.isNegotiable,
      };

      // Queue the background processing job using BullMQ
      await postQueue.add("create-post", { postData });

      res.status(202).json(ResponseHelper.success(null, "Post creation initiated. It will be live shortly."));
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

      const filter: any = { status: "active" };

      // Filter by species
      if (req.query.species && req.query.species !== "") {
        filter.species = { equals: req.query.species as string, mode: "insensitive" };
      }

      // Filter by breed/category
      if (req.query.breed && req.query.breed !== "") {
        filter.category = { equals: req.query.breed as string, mode: "insensitive" };
      }

      // Filter by type (free/paid)
      if (req.query.type && req.query.type !== "") {
        filter.type = req.query.type as string;
      }

      const posts = await prisma.post.findMany({
        where: filter,
        include: {
          owner: {
            select: { id: true, firstname: true, lastname: true, userpic: true }
          },
          address: true
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit
      });

      console.log("[post controller] posts fetched:", posts.length);

      const total = await prisma.post.count({ where: filter });
      const formattedPosts = posts.map(formatPost);

      res
        .status(200)
        .json(
          ResponseHelper.paginated(
            formattedPosts,
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

      // --- REDIS CACHE CHECK ---
      const cacheKey = `post:id:${id}`;
      const cachedPost = await redisService.get(cacheKey);
      if (cachedPost) {
        console.log("🚀 Serving post from Redis:", id);
        res.status(200).json(ResponseHelper.success(cachedPost, "Post retrieved successfully (from cache)"));
        return;
      }

      const post = await prisma.post.findUnique({
        where: { id },
        include: {
          owner: {
            select: { id: true, firstname: true, lastname: true, userpic: true, phone: true, email: true }
          },
          address: true
        }
      });

      if (!post) {
        res.status(404).json(ResponseHelper.error("Post not found"));
        return;
      }

      const formatted = formatPost(post);

      // Update Cache
      await redisService.set(cacheKey, formatted, 3600);

      res
        .status(200)
        .json(ResponseHelper.success(formatted, "Post retrieved successfully"));
    } catch (error) {
      console.error("Get post error:", error);
      res.status(500).json(ResponseHelper.error("Internal server error"));
    }
  }

  static async getPostsForAdmin(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;
      const status = req.query.status as string;

      const filter: any = {};
      if (status && status !== "all") {
        filter.status = status;
      }

      console.log("Admin fetching posts with filter:", filter);

      const posts = await prisma.post.findMany({
        where: filter,
        include: {
          owner: {
            select: { id: true, firstname: true, lastname: true, userpic: true, phone: true, email: true }
          },
          address: true
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit
      });

      const total = await prisma.post.count({ where: filter });
      const formattedPosts = posts.map(formatPost);

      res
        .status(200)
        .json(
          ResponseHelper.paginated(
            formattedPosts,
            total,
            page,
            limit,
            "Posts retrieved for admin successfully"
          )
        );
    } catch (error) {
      console.error("Get posts for admin error:", error);
      res.status(500).json(ResponseHelper.error("Internal server error"));
    }
  }

  // Get any post by ID for Admin
  static async getPostForAdminbyId(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const post = await prisma.post.findUnique({
        where: { id },
        include: {
          owner: {
            select: { id: true, firstname: true, lastname: true, userpic: true, phone: true, email: true }
          },
          address: true
        }
      });

      if (!post) {
        res.status(404).json(ResponseHelper.error("Post not found"));
        return;
      }

      res
        .status(200)
        .json(
          ResponseHelper.success(formatPost(post), "Post retrieved for admin successfully")
        );
    } catch (error) {
      console.error("Get post for admin error:", error);
      res.status(500).json(ResponseHelper.error("Internal server error"));
    }
  }

  // Get post by slug
  static async getPostBySlug(req: Request, res: Response): Promise<void> {
    try {
      const { slug } = req.params;

      // --- REDIS CACHE CHECK ---
      const cacheKey = `post:slug:${slug}`;
      const cachedPost = await redisService.get(cacheKey);
      if (cachedPost) {
        console.log("🚀 Serving post from Redis (slug):", slug);
        res.status(200).json(ResponseHelper.success(cachedPost, "Post retrieved successfully (from cache)"));
        return;
      }

      const post = await prisma.post.findUnique({
        where: { slug: slug.toLowerCase() },
        include: {
          owner: {
            select: { id: true, firstname: true, lastname: true, userpic: true }
          },
          address: true
        }
      });

      if (!post) {
        res.status(404).json(ResponseHelper.error("Post not found"));
        return;
      }

      const formatted = formatPost(post);

      // Update Cache
      await redisService.set(cacheKey, formatted, 3600);

      res
        .status(200)
        .json(ResponseHelper.success(formatted, "Post retrieved successfully"));
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
      const post = await prisma.post.findUnique({ where: { id } });
      if (!post) {
        res.status(404).json(ResponseHelper.error("Post not found"));
        return;
      }

      if (
        post.ownerId !== req.user.id &&
        !["admin", "superadmin"].includes(req.user.role)
      ) {
        res
          .status(403)
          .json(ResponseHelper.error("You can only update your own posts"));
        return;
      }

      // Process values for PostgreSQL schema
      const updateData: any = {
        title: value.title,
        discription: value.discription,
        amount: value.amount,
        type: value.type,
        category: value.category,
        species: value.species,
        speciesSlug: slugify(value.species, { lower: true }),
        breedSlug: slugify(value.category, { lower: true }),
      };

      const updatedPost = await prisma.post.update({
        where: { id },
        data: updateData,
        include: {
          owner: {
            select: { id: true, firstname: true, lastname: true, userpic: true }
          },
          address: true
        }
      });

      // Cache Invalidation
      await redisService.del(`post:slug:${updatedPost.slug}`);
      await redisService.del(`post:id:${id}`);

      res
        .status(200)
        .json(ResponseHelper.success(formatPost(updatedPost), "Post updated successfully"));
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
      const post = await prisma.post.findUnique({ where: { id } });
      if (!post) {
        res.status(404).json(ResponseHelper.error("Post not found"));
        return;
      }

      if (
        post.ownerId !== req.user.id &&
        !["admin", "superadmin"].includes(req.user.role)
      ) {
        res
          .status(403)
          .json(ResponseHelper.error("You can only delete your own posts"));
        return;
      }

      const deletedPost = await prisma.post.delete({
        where: { id }
      });

      // Cache Invalidation
      await redisService.del(`post:slug:${deletedPost.slug}`);
      await redisService.del(`post:id:${id}`);

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

      const posts = await prisma.post.findMany({
        where: { ownerId: req.user.id },
        include: {
          address: true
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit
      });

      const total = await prisma.post.count({
        where: { ownerId: req.user.id }
      });

      const formattedPosts = posts.map(formatPost);

      res
        .status(200)
        .json(
          ResponseHelper.paginated(
            formattedPosts,
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

      // --- REDIS CACHE CHECK ---
      const cacheKey = `posts:filter:${JSON.stringify(req.query)}`;
      const cachedResponse = await redisService.get(cacheKey);
      if (cachedResponse) {
        res.status(200).json(cachedResponse);
        return;
      }

      const filter: any = { status: "active" };

      // Filter by status only if explicitly provided
      if (req.query.status && req.query.status !== "") {
        filter.status = req.query.status as string;
      }

      // Filter by species
      if (req.query.species && req.query.species !== "") {
        filter.species = { equals: req.query.species as string, mode: "insensitive" };
      }

      // Filter by breed/category
      if (req.query.breed && req.query.breed !== "") {
        filter.category = { equals: req.query.breed as string, mode: "insensitive" };
      }

      // Filter by type (free/paid)
      if (req.query.type && req.query.type !== "") {
        filter.type = req.query.type as string;
      }

      // Filter by price range, only if type is 'paid'
      if (req.query.type === "paid") {
        const minPrice = parseFloat(req.query.minPrice as string) || 0;
        const maxPrice =
          parseFloat(req.query.maxPrice as string) || Number.MAX_SAFE_INTEGER;

        filter.amount = {
          gte: minPrice,
          lte: maxPrice,
        };
      }
      if (req.query.minPrice === "" && req.query.maxPrice === "") {
        delete filter.amount;
      }
      if (Number(req.query.minPrice) > 0) {
        const minPrice = parseFloat(req.query.minPrice as string) || 0;
        filter.amount = { ...filter.amount, gte: minPrice };
      }
      if (req.query && Number(req.query.maxPrice) > 0) {
        const maxPrice =
          parseFloat(req.query.maxPrice as string) || Number.MAX_SAFE_INTEGER;
        filter.amount = { ...filter.amount, lte: maxPrice };
      }

      // Search by title, description, or city/state
      if (req.query.search && req.query.search !== "") {
        const searchStr = req.query.search as string;
        
        // Find addresses matching city or state
        const matchingAddresses = await prisma.address.findMany({
          where: {
            OR: [
              { city: { contains: searchStr, mode: "insensitive" } },
              { state: { contains: searchStr, mode: "insensitive" } }
            ]
          },
          select: { id: true }
        });
        const matchingAddressIds = matchingAddresses.map(addr => addr.id);

        filter.OR = [
          { title: { contains: searchStr, mode: "insensitive" } },
          { discription: { contains: searchStr, mode: "insensitive" } },
          { addressId: { in: matchingAddressIds } }
        ];
      }

      // Direct City/State Filtering
      if (req.query.city && req.query.city !== "") {
        const cityAddresses = await prisma.address.findMany({
          where: {
            city: { equals: req.query.city as string, mode: "insensitive" }
          },
          select: { id: true }
        });
        filter.addressId = { in: cityAddresses.map(addr => addr.id) };
      }

      // Location-based filtering (Radius search using PostGIS)
      if (req.query.nearMe === "true") {
        const longitude = parseFloat(req.query.longitude as string);
        const latitude = parseFloat(req.query.latitude as string);
        const maxDistanceKm = parseFloat(req.query.maxDistance as string) || 50; // Default 50km

        if (!isNaN(longitude) && !isNaN(latitude)) {
          const radiusInMeters = maxDistanceKm * 1000;

          // Find address IDs within PostGIS range
          const matchingAddresses = await prisma.$queryRaw<Array<{ id: string }>>`
            SELECT id FROM "Address"
            WHERE ST_DWithin(
              ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
              ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography,
              ${radiusInMeters}
            )
          `;
          const geoAddressIds = matchingAddresses.map(addr => addr.id);

          if (filter.addressId) {
            const existingIds = filter.addressId.in || [];
            filter.addressId = { in: existingIds.filter((id: string) => geoAddressIds.includes(id)) };
          } else {
            filter.addressId = { in: geoAddressIds };
          }
        }
      }

      // Sorting logic
      let orderBy: any = {};
      switch (sortBy) {
        case "oldest":
          orderBy = { createdAt: "asc" };
          break;
        case "price-low":
          orderBy = { amount: "asc" };
          break;
        case "price-high":
          orderBy = { amount: "desc" };
          break;
        case "title-az":
          orderBy = { title: "asc" };
          break;
        case "title-za":
          orderBy = { title: "desc" };
          break;
        case "newest":
        default:
          orderBy = { createdAt: "desc" };
          break;
      }

      const posts = await prisma.post.findMany({
        where: filter,
        include: {
          address: true,
          owner: {
            select: { id: true, firstname: true, lastname: true, userpic: true }
          }
        },
        skip,
        take: limit,
        orderBy
      });

      const total = await prisma.post.count({ where: filter });
      const formattedPosts = posts.map(formatPost);

      const responseData = ResponseHelper.paginated(
        formattedPosts,
        total,
        page,
        limit,
        "Filtered posts retrieved successfully"
      );

      // Update cache
      await redisService.set(cacheKey, responseData, 10);

      res.status(200).json(responseData);
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

      const { search, status, species } = req.query;

      const filter: any = {};

      // --- Status Filter ---
      if (status) {
        if (status !== "all") {
          filter.status = status as string;
        }
      } else {
        filter.status = "pending";
      }

      // --- Species Filter ---
      if (species && species !== "all") {
        filter.species = species as string;
      }

      // --- Search Filter ---
      if (search) {
        const searchStr = search as string;
        filter.OR = [
          { title: { contains: searchStr, mode: "insensitive" } },
          { discription: { contains: searchStr, mode: "insensitive" } },
          { category: { contains: searchStr, mode: "insensitive" } },
        ];
      }

      const posts = await prisma.post.findMany({
        where: filter,
        include: {
          owner: {
            select: { id: true, firstname: true, lastname: true, userpic: true, phone: true, email: true }
          },
          address: true
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit
      });

      const total = await prisma.post.count({ where: filter });
      const formattedPosts = posts.map(formatPost);

      console.log(`Found ${posts.length} posts. Total matching: ${total}`);

      res
        .status(200)
        .json(
          ResponseHelper.paginated(
            formattedPosts,
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
      const post = await prisma.post.findUnique({ where: { id } });
      if (!post) {
        res.status(404).json(ResponseHelper.error("Post not found"));
        return;
      }

      // Update status to active
      const updatedPost = await prisma.post.update({
        where: { id },
        data: { status: "active" }
      });

      await redisService.del(`post:slug:${updatedPost.slug}`);
      await redisService.del(`post:id:${id}`);

      res
        .status(200)
        .json(
          ResponseHelper.success(formatPost(updatedPost), "Post approved successfully")
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
      const { reason } = req.body;

      const post = await prisma.post.findUnique({ where: { id } });
      if (!post) {
        res.status(404).json(ResponseHelper.error("Post not found"));
        return;
      }

      // Update status to rejected
      const updatedPost = await prisma.post.update({
        where: { id },
        data: {
          status: "rejected",
          meta: { rejectReason: reason }
        },
        include: {
          owner: {
            select: { id: true, firstname: true, lastname: true, userpic: true }
          },
          address: true
        }
      });

      await redisService.del(`post:slug:${updatedPost.slug}`);
      await redisService.del(`post:id:${id}`);

      res
        .status(200)
        .json(
          ResponseHelper.success(formatPost(updatedPost), "Post rejected successfully")
        );
    } catch (error) {
      console.error("Reject post error:", error);
      res.status(500).json(ResponseHelper.error("Internal server error"));
    }
  }
}

