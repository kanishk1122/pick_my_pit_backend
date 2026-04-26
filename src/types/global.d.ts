// Custom type definitions for modules that might not have complete types

declare module "*.json" {
  const value: any;
  export default value;
}


// Additional type for process.env if needed
declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV?: string;
    PORT?: string;
    DATABASE_URL?: string;
    MONGO_URI?: string;
    REDIS_URL?: string;
    JWT_SECRET?: string;
    SESSION_SECRET?: string;
    CRYPTO_KEY?: string;
    CLOUDINARY_CLOUD_NAME?: string;
    CLOUDINARY_API_KEY?: string;
    CLOUDINARY_API_SECRET?: string;
    EMAIL_HOST?: string;
    EMAIL_PORT?: string;
    EMAIL_USER?: string;
    EMAIL_PASS?: string;
    ADMIN_UI_URL?: string;
    CLIENT_URL?: string;
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
  }
}
