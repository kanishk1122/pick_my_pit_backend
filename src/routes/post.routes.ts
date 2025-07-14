import { Router } from "express";
import { PostController } from "../controllers/post.controller.js";

const router = Router();

// Filter route - must come before /:id route
router.get("/filter", PostController.filterPosts);

// Public routes
router.get("/", PostController.getAllPosts);
router.get("/slug/:slug", PostController.getPostBySlug);
router.get("/:id", PostController.getPostById);

// Protected routes (middleware will be added later)
router.post("/", PostController.createPost);
router.put("/:id", PostController.updatePost);
router.delete("/:id", PostController.deletePost);
router.get("/user/my-posts", PostController.getUserPosts);

export default router;
