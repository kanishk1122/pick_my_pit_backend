import dotenv from "dotenv";

dotenv.config();

interface Config {
  port: number;
  redisUrl: string;
  adminUiUrl: string;
  mongoUrl: string;
  jwtSecret: string;
  sessionSecret: string;
  cryptoKey: string;
  cloudinary: {
    cloudName: string;
    apiKey: string;
    apiSecret: string;
  };
  email: {
    host: string;
    port: number;
    user: string;
    pass: string;
  };
}

export const config: Config = {
  port: parseInt(process.env.PORT || "5000", 10),
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  adminUiUrl: process.env.ADMIN_UI_URL || "http://localhost:3000",
  mongoUrl:
    process.env.DATABASE_URL ||
    process.env.MONGO_URI ||
    "mongodb://localhost:27017/pickMyPit",
  jwtSecret: process.env.JWT_SECRET || "your_jwt_secret",
  sessionSecret: process.env.SESSION_SECRET || "your_session_secret",
  cryptoKey: process.env.CRYPTO_KEY || "your_crypto_key",
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
    apiKey: process.env.CLOUDINARY_API_KEY || "",
    apiSecret: process.env.CLOUDINARY_API_SECRET || "",
  },
  email: {
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port: parseInt(process.env.EMAIL_PORT || "587", 10),
    user: process.env.EMAIL_USER || "",
    pass: process.env.EMAIL_PASS || "",
  },
};
