import jwt from "jsonwebtoken";
import { config } from "../config/index.js";

export interface TokenPayload {
  id: string;
  email: string;
  role: string;
  firstname?: string;
  lastname?: string;
}

export class JWTHelper {
  private static readonly secret = config.jwtSecret;
  private static readonly expiresIn = "7d";

  static generateToken(payload: TokenPayload): string {
    return jwt.sign(payload, this.secret, { expiresIn: this.expiresIn });
  }

  static verifyToken(token: string): TokenPayload {
    return jwt.verify(token, this.secret) as TokenPayload;
  }

  static generateRefreshToken(payload: TokenPayload): string {
    return jwt.sign(payload, this.secret, { expiresIn: "30d" });
  }

  static generateEmailVerificationToken(userId: string, email: string): string {
    return jwt.sign(
      { userId, email, type: "email_verification" },
      this.secret,
      { expiresIn: "24h" }
    );
  }

  static generatePasswordResetToken(userId: string, email: string): string {
    return jwt.sign({ userId, email, type: "password_reset" }, this.secret, {
      expiresIn: "1h",
    });
  }

  static decodeToken(token: string): any {
    return jwt.decode(token);
  }

  static isTokenExpired(token: string): boolean {
    try {
      const decoded = jwt.decode(token) as any;
      if (!decoded || !decoded.exp) return true;

      const currentTime = Math.floor(Date.now() / 1000);
      return decoded.exp < currentTime;
    } catch (error) {
      return true;
    }
  }
}
