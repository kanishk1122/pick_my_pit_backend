import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import UserModel from "../model/user.model.js";
import AdminModel from "../model/admin.model.js";
import { signup_auth, login_auth } from "../helper/validation.js";
import { v4 as uuidv4 } from "uuid";
import axios from "axios";

export class AuthController {
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
      const isPasswordValid = await user.comparePassword(password);
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
      const isPasswordValid = await admin.comparePassword(password);
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
        },
      });
    } catch (error) {
      console.error("Admin login error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Logout
  static async logout(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
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

      console.log(
        `Processing Google Auth - Token segments: ${token.split(".").length}`
      );

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

      console.log(
        `Google Auth for: ${email}, Name: ${given_name} ${family_name}`
      );

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
        console.log(`Creating new user for: ${email}`);
        // Create new user (sign-up flow)
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

      // Generate session token for compatibility
      const sessionToken = uuidv4();

      // Update user with session token
      await UserModel.findByIdAndUpdate(
        user._id,
        { sessionToken },
        { new: true }
      );

      // Prepare user details for the response
      const userDetails = {
        id: user._id,
        firstname: user.firstname,
        lastname: user.lastname,
        email: user.email,
        userpic: user.userpic,
        gender: user.gender,
        status: user.status || "active",
        sessionToken,
        coins: user.coins || 0,
      };

      // Send response
      res.status(isNewUser ? 201 : 200).json({
        success: true,
        message: isNewUser
          ? "User registered successfully"
          : "Login successful",
        data: {
          user: userDetails,
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
}
