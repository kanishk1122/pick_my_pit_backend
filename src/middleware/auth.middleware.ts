import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config/index";
import UserModel from "../model/user.model";
import AdminModel from "../model/admin.model";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    firstname?: string;
    lastname?: string;
  };
  admin?: {
    id: string;
    email: string;
    role: string;
    firstname?: string;
    lastname?: string;
  };
  adminUser?: any;
}

export interface JWTPayload {
  id: string;
  email: string;
  role: string;
  firstname?: string;
  lastname?: string;
}

// Main auth middleware for cookie-based JWT authentication
export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Get token from cookies instead of Authorization header
    const token = req.cookies.auth_token;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided.",
      });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "your-secret-key"
    ) as JWTPayload;

    // Verify user exists and is active
    const user = await UserModel.findById(decoded.id);
    if (!user || user.status !== "active") {
      return res.status(401).json({
        success: false,
        message: "User not found or inactive.",
      });
    }

    req.user = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      firstname: user.firstname,
      lastname: user.lastname,
    };
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        success: false,
        message: "Token expired. Please log in again.",
      });
    }

    res.status(400).json({
      success: false,
      message: "Invalid token.",
    });
  }
};

// Middleware to verify user token (for header-based auth)
export const verifyUserToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        msg: "Access denied. No token provided.",
      });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "your-secret-key"
    ) as JWTPayload;

    // Verify user exists and is active
    const user = await UserModel.findById(decoded.id);
    if (!user || user.status !== "active") {
      return res.status(401).json({
        success: false,
        msg: "User not found or inactive.",
      });
    }

    req.user = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      firstname: user.firstname,
      lastname: user.lastname,
    };
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        success: false,
        msg: "Token expired. Please log in again.",
      });
    }

    res.status(400).json({
      success: false,
      msg: "Invalid token.",
    });
  }
};

// Middleware to verify admin token
export const verifyAdminToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        msg: "Access denied. No token provided.",
      });
    }

    const decoded = jwt.verify(token, config.jwtSecret) as JWTPayload;

    // Check if token contains admin role
    if (!decoded.role || !["admin", "superadmin"].includes(decoded.role)) {
      return res.status(403).json({
        success: false,
        msg: "Access denied. Not authorized as admin.",
      });
    }

    req.admin = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        success: false,
        msg: "Token expired. Please log in again.",
      });
    }

    res.status(400).json({
      success: false,
      msg: "Invalid token.",
    });
  }
};

// Validate admin exists in database
export const validateAdminExists = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.admin || !req.admin.id) {
      return res.status(400).json({
        success: false,
        msg: "Invalid admin data in token",
      });
    }

    let adminExists = false;

    // Try Admin model first
    try {
      const admin = await AdminModel.findById(req.admin.id);
      if (admin && admin.status === "active") {
        adminExists = true;
        req.adminUser = admin;
      }
    } catch (err) {
      console.log("Admin model check error:", err);
    }

    // Fallback to User model with admin role
    if (!adminExists) {
      try {
        const admin = await UserModel.findOne({
          _id: req.admin.id,
          role: { $in: ["admin", "superadmin"] },
          status: "active",
        });
        if (admin) {
          adminExists = true;
          req.adminUser = admin;
        }
      } catch (err) {
        console.log("User model check error:", err);
      }
    }

    if (!adminExists) {
      return res.status(401).json({
        success: false,
        msg: "Admin user no longer exists or is inactive",
      });
    }

    next();
  } catch (error) {
    console.error("Admin validation error:", error);
    res.status(500).json({
      success: false,
      msg: "Server error during admin validation",
    });
  }
};

// Middleware to check if user is super admin
export const requireSuperAdmin = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.admin || req.admin.role !== "superadmin") {
    return res.status(403).json({
      success: false,
      msg: "Access denied. Super admin privileges required.",
    });
  }
  next();
};

// Middleware to verify ownership or admin privileges
export const verifyOwnershipOrAdmin = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.params;

    // If user is admin, allow access
    if (req.admin) {
      return next();
    }

    // If regular user, check if they own the resource
    if (req.user && req.user.id === userId) {
      return next();
    }

    return res.status(403).json({
      success: false,
      msg: "Access denied. You can only access your own resources.",
    });
  } catch (error) {
    console.error("Ownership verification error:", error);
    res.status(500).json({
      success: false,
      msg: "Server error during ownership verification",
    });
  }
};
