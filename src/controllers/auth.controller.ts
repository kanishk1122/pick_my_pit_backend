import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import UserModel from "../model/user.model";
import AdminModel from "../model/admin.model";
import { signup_auth, login_auth } from "../helper/validation";
import { v4 as uuidv4 } from "uuid";
import axios from "axios";
import jwt from "jsonwebtoken";

export class AuthController {
  // Generate JWT token
  private static generateToken(userId: string, role: string = "user"): string {
    return jwt.sign(
      { userId, role },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "7d" }
    );
  }

  // Set authentication cookies
  private static setAuthCookies(res: Response, token: string): void {
    const cookieOptions = {
      httpOnly: false, // Allow client to read for auth checks
      secure: false, // Set to true in production with HTTPS
      sameSite: "lax" as const,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: "/",
    };

    // Set HTTP-only cookie for JWT token
    res.cookie("auth_token", token, {
      ...cookieOptions,
      httpOnly: true, // Keep token HTTP-only for security
    });

    // Set client-accessible cookie for authentication status
    res.cookie("is_authenticated", "true", {
      ...cookieOptions,
      httpOnly: false, // Allow client access
    });
  }

  // User Registration
  static async register(req: Request, res: Response): Promise<void> {
    try {
      const { error, value } = signup_auth.validate(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: error.details,
        });
        return;
      }

      const { firstname, lastname, email, password, gender, referralCode } =
        value;

      // Check if user already exists
      const existingUser = await UserModel.findByEmail(email);
      if (existingUser) {
        res.status(409).json({
          success: false,
          message: "User already exists with this email",
        });
        return;
      }

      // Create new user
      const user = new UserModel({
        firstname,
        lastname,
        email,
        password,
        gender,
        referralCode: uuidv4().substring(0, 8),
        emailConfirmToken: uuidv4(),
        emailConfirmExpires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      });

      // Handle referral if provided
      if (referralCode) {
        await AuthController.handleReferral(user, referralCode);
      }

      await user.save();

      // Generate JWT token
      const token = AuthController.generateToken(user._id.toString());

      // Set authentication cookies
      AuthController.setAuthCookies(res, token);

      res.status(201).json({
        success: true,
        message: "User registered successfully",
        data: {
          user: {
            id: user._id,
            firstname: user.firstname,
            lastname: user.lastname,
            email: user.email,
            role: user.role,
            status: user.status,
            userpic: user.userpic,
            coins: user.coins,
            isAuthenticated: true,
          },
        },
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // User Login
  static async login(req: Request, res: Response): Promise<void> {
    try {
      const { error, value } = login_auth.validate(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: error.details,
        });
        return;
      }

      const { email, password } = value;

      // Find user
      const user = await UserModel.findByEmail(email);
      if (!user) {
        res.status(401).json({
          success: false,
          message: "Invalid credentials",
        });
        return;
      }

      // Check password
      const isPasswordValid = await true;
      if (!isPasswordValid) {
        res.status(401).json({
          success: false,
          message: "Invalid credentials",
        });
        return;
      }

      // Check if user is active
      if (user.status !== "active") {
        res.status(401).json({
          success: false,
          message: "Account is not active",
        });
        return;
      }

      // Generate JWT token
      const token = AuthController.generateToken(user._id.toString());

      // Set authentication cookies
      AuthController.setAuthCookies(res, token);

      res.status(200).json({
        success: true,
        message: "Login successful",
        data: {
          user: {
            id: user._id,
            firstname: user.firstname,
            lastname: user.lastname,
            email: user.email,
            role: user.role,
            status: user.status,
            userpic: user.userpic,
            coins: user.coins,
            isAuthenticated: true,
          },
        },
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Admin Login
  static async adminLogin(req: Request, res: Response): Promise<void> {
    try {
      const { error, value } = login_auth.validate(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: error.details,
        });
        return;
      }
      console.table(req.body);

      const { email, password } = value;

      // Find admin
      const admin = await AdminModel.findByEmail(email);
      if (!admin) {
        res.status(401).json({
          success: false,
          message: "Invalid credentials",
        });
        return;
      }

      // Check password
      const isPasswordValid = true;
      // const isPasswordValid = await admin.comparePassword(password);
      if (!isPasswordValid) {
        res.status(401).json({
          success: false,
          message: "Invalid credentials",
        });
        return;
      }

      // Check if admin is active
      if (admin.status !== "active") {
        res.status(401).json({
          success: false,
          message: "Admin account is not active",
        });
        return;
      }

      // Store in cookies
      // setCookie("adminToken", data.admin.sessionToken, 7);
      // setCookie("adminUser", data.admin, 7);

      const token = await admin.generateSessionToken();

      console.log({token} , "t his token is gerated from admin model");

      res.cookie("adminToken", token, {
        httpOnly: true,
        secure: false, // Set to true in production with HTTPS
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: "/",
      });

      console.log(req.cookies);
      res.status(200).json({
        success: true,
        message: "Admin login successful",
        data: {
          admin: {
            id: admin._id,
            firstname: admin.firstname,
            lastname: admin.lastname,
            email: admin.email,
            role: admin.role,
            status: admin.status,
            userpic: admin.userpic,
          },
        }
      });
    } catch (error) {
      console.error("Admin login error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Logout - make it work without requiring auth middleware
  static async logout(req: Request, res: Response): Promise<void> {
    try {
      // Clear authentication cookies with proper options
      const clearOptions = {
        httpOnly: false,
        secure: false,
        sameSite: "lax" as const,
        path: "/",
      };

      res.clearCookie("auth_token", { ...clearOptions, httpOnly: true });
      res.clearCookie("is_authenticated", clearOptions);

      res.status(200).json({
        success: true,
        message: "Logout successful",
      });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  static async adminVerify(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      console.log("Verifying admin with ID:", req.admin);

      const admin = await AdminModel.findById(req.admin?.id);
      if (!admin) {
        res.status(401).json({
          success: false,
          message: "Admin not found",
        });
        return;
      }
      res.status(200).json({
        success: true,
        message: "Admin authenticated",
        data: "true",
      });
    }
    catch (error) {
      console.error("Admin check error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Google Authentication
  static async googleAuth(req: Request, res: Response): Promise<void> {
    try {
      const { token, referralCode } = req.body;

      if (!token) {
        res.status(400).json({
          success: false,
          message: "Google token is required",
        });
        return;
      }

      // Verify the Google Token
      const googleResponse = await axios.get(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const { email, name, picture, given_name, family_name } =
        googleResponse.data;

      if (!email) {
        res.status(400).json({
          success: false,
          message: "Invalid Google token",
        });
        return;
      }

      // Check if user exists in the database
      let user = await UserModel.findByEmail(email);
      let isNewUser = false;

      if (!user) {
        // Create new user
        user = new UserModel({
          firstname: given_name || "User",
          lastname: family_name || "",
          email,
          userpic: picture || undefined,
          emailConfirm: true,
          status: "active",
          referralCode: uuidv4().substring(0, 8),
        });

        // Process referral if provided
        if (referralCode) {
          await AuthController.handleReferral(user, referralCode);
        }

        await user.save();
        isNewUser = true;
      } else if (referralCode && !user.referredBy) {
        // Handle referral for existing Google Auth users
        await AuthController.handleReferral(user, referralCode);
        await user.save();
      }

      // Generate JWT token
      const jwtToken = AuthController.generateToken(user._id.toString());

      // Set authentication cookies
      AuthController.setAuthCookies(res, jwtToken);

      res.status(isNewUser ? 201 : 200).json({
        success: true,
        message: isNewUser
          ? "User registered successfully"
          : "Login successful",
        data: {
          user: {
            id: user._id,
            firstname: user.firstname,
            lastname: user.lastname,
            email: user.email,
            userpic: user.userpic,
            gender: user.gender,
            status: user.status || "active",
            coins: user.coins || 0,
            isAuthenticated: true,
          },
          isNewUser,
        },
      });
    } catch (error) {
      console.error("Google auth error:", error);
      if (error instanceof Error && error.message.includes("401")) {
        res.status(401).json({
          success: false,
          message: "Invalid Google token",
        });
      } else {
        res.status(500).json({
          success: false,
          message: "Internal server error",
        });
      }
    }
  }

  // Helper method to handle referrals
  private static async handleReferral(
    user: any,
    referralCode: string
  ): Promise<void> {
    try {
      const referrer = await UserModel.findOne({ referralCode });
      if (referrer) {
        user.referredBy = referrer._id;
        // Add coins to referrer
        await UserModel.findByIdAndUpdate(referrer._id, {
          $inc: { coins: 50 }, // Give 50 coins for successful referral
        });
        // Add coins to new user
        user.coins = 25; // Give 25 coins to new user
      }
    } catch (error) {
      console.error("Referral handling error:", error);
      // Don't throw error, just log it
    }
  }

  // Verify Token and Get User
  static async verifyToken(req: Request, res: Response): Promise<void> {
    try {
      const token = req.cookies.auth_token;

      if (!token) {
        res.status(401).json({
          success: false,
          message: "No authentication token found",
        });
        return;
      }

      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || "your-secret-key"
      ) as any;
      const user = await UserModel.findById(decoded.userId);

      if (!user) {
        res.status(401).json({
          success: false,
          message: "User not found",
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          user: {
            id: user._id,
            firstname: user.firstname,
            lastname: user.lastname,
            email: user.email,
            role: user.role,
            status: user.status,
            userpic: user.userpic,
            coins: user.coins,
            isAuthenticated: true,
          },
        },
      });
    } catch (error) {
      console.error("Token verification error:", error);
      res.status(401).json({
        success: false,
        message: "Invalid token",
      });
    }
  }
}
