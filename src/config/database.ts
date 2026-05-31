import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { config } from "./index";

let prisma: PrismaClient;
let pool: Pool;

class Database {
  private static instance: Database;
  private isConnected: boolean = false;

  private constructor() {}

  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  public async connect(): Promise<void> {
    if (this.isConnected) {
      console.log("Already connected to PostgreSQL");
      return;
    }

    try {
      const isWorker = process.argv.some(arg => arg.includes("postProcessor"));
      const maxPoolSize = isWorker ? 2 : parseInt(process.env.DB_POOL_MAX || "30", 10);

      pool = new Pool({
        connectionString: config.mongoUrl,
        max: maxPoolSize,
        idleTimeoutMillis: 30000,
      });

      const adapter = new PrismaPg(pool);
      prisma = new PrismaClient({ adapter });

      // Test connection and enable PostGIS extension
      await prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS postgis;`;

      console.log("Connected to PostgreSQL via Prisma");
      this.isConnected = true;
    } catch (error) {
      console.error("PostgreSQL connection error:", error);
      process.exit(1);
    }
  }

  public async disconnect(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      await prisma.$disconnect();
      await pool.end();
      this.isConnected = false;
      console.log("Disconnected from PostgreSQL");
    } catch (error) {
      console.error("Error disconnecting from PostgreSQL:", error);
    }
  }

  public getConnectionStatus(): boolean {
    return this.isConnected;
  }
}

export const database = Database.getInstance();
export { prisma };

