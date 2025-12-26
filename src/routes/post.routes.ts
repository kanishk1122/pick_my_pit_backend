import { Router } from "express";
import { PostController } from "../controllers/post.controller";
import {
  authMiddleware,
  verifyAdminToken,
} from "../middleware/auth.middleware";

const router = Router();

// Filter route - must come before /:id route
router.get("/filter", PostController.filterPosts);

router.get(
  "/pending-approvals",
  verifyAdminToken,
  PostController.getPendingApprovals
);
// Public routes
router.get("/", PostController.getAllPosts);
router.get("/slug/:slug", PostController.getPostBySlug);
router.get("/user-posts", authMiddleware, PostController.getUserPosts); // Changed route to avoid conflict
router.get("/getpost-admin", verifyAdminToken, PostController.getPostsForAdmin);
router.get("/:id", PostController.getPostById);
router.get("/admin/:id", verifyAdminToken, PostController.getPostForAdminbyId);

// Protected routes (middleware will be added later)
router.put("/:id/approve", verifyAdminToken, PostController.approvePost);
router.post("/:id/reject", verifyAdminToken, PostController.rejectPost);
router.put("/:id/ban", verifyAdminToken, PostController.banPost);
router.post("/", authMiddleware, PostController.createPost);
router.put("/:id", authMiddleware, PostController.updatePost);
router.delete("/:id", authMiddleware, PostController.deletePost);

export default router;
