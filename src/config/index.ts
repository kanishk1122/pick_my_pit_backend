import dotenv from "dotenv";
import path from "path";

// Explicitly define the path relative to this file to ensure it always finds .env
// regardless of where the script is executed from
const envPath = path.resolve(__dirname, "../../.env");
dotenv.config({ path: envPath });

interface Config {
  port: number;
  redisUrl: string;
  adminUiUrl: string;
  mongoUrl: string;
  jwtSecret: string;
  sessionSecret: string;
  cryptoKey: string;
  kafkaBrokers: string[];
  huggingFaceApiKey: string;
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
    "mongodb://127.0.0.1:27017/pickMyPit",
  jwtSecret: process.env.JWT_SECRET || "your_jwt_secret",
  sessionSecret: process.env.SESSION_SECRET || "your_session_secret",
  cryptoKey: process.env.CRYPTO_KEY || "your_crypto_key",
  kafkaBrokers: (process.env.KAFKA_BROKERS || "127.0.0.1:9092").split(","),
  huggingFaceApiKey: process.env.HUGGINGFACE_API_KEY || "",
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
