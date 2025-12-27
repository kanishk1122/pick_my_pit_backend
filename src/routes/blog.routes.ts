import { Router } from "express";
import { BlogController } from "../controllers/blog.controller";
import { verifyAdminToken } from "../middleware/auth.middleware";

const router = Router();

// --- PUBLIC ROUTES ---
// Get all published blog posts
router.get("/", BlogController.getAllBlogs);
// Get a single blog post by its slug
router.get("/:slug", BlogController.getBlogBySlug);

// --- ADMIN ROUTES ---
const adminRouter = Router();
adminRouter.use(verifyAdminToken);

// Get all posts (including drafts) for the admin view
adminRouter.get("/all", (req, res) => {
  req.query.status = (req.query.status as string) || "all";
  return BlogController.getAllBlogs(req, res);
});

// Create a new blog post
adminRouter.post("/", BlogController.createBlog);

// Get a single blog post by ID (for editing)
adminRouter.get("/:id", BlogController.getBlogById);

// Update a blog post
adminRouter.put("/:id", BlogController.updateBlog);
// Delete a blog post
adminRouter.delete("/:id", BlogController.deleteBlog);

router.use("/admin", adminRouter);

export default router;
