import { Application } from "express";
import authRoutes from "./auth.routes";
import userRoutes from "./user.routes";
import postRoutes from "./post.routes";
import addressRoutes from "./address.routes";
import speciesRoutes from "./species.routes";
import breedRoutes from "./breed.routes";
import blogRoutes from "./blog.routes";
import adminRoutes from "./admin.routes";

export const registerRoutes = (app: Application): void => {
  // Health check
  app.get("/health", (req, res) => {
    res.status(200).json({
      success: true,
      message: "Server is healthy",
      timestamp: new Date().toISOString(),
    });
  });

  // API routes
  app.use("/api/auth", authRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/posts", postRoutes);
  app.use("/api/addresses", addressRoutes);
  app.use("/api/species", speciesRoutes);
  app.use("/api/breeds", breedRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/blogs", blogRoutes);

  // Root route
  // app.get("/", (req, res) => {
  //   res.status(200).json({
  //     success: true,
  //     message: "Pick My Pit API v2",
  //     version: "2.0.0",
  //     endpoints: {
  //       auth: "/api/auth",
  //       users: "/api/users",
  //       posts: "/api/posts",
  //       addresses: "/api/addresses",
  //       species: "/api/species",
  //       breeds: "/api/breeds",
  //       admin: "/api/admin",
  //       health: "/health",
  //     },
  //   });
  // });

  // 404 handler
  // app.use("*", (req, res) => {
  //   res.status(404).json({
  //     success: false,
  //     message: "Route not found",
  //     path: req.originalUrl,
  //   });
  // });
};
