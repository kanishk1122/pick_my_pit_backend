import { Worker } from "bullmq";
import path from "path";
import { config } from "../config/index";
import { socketService } from "../utils/socket";
import postProcessor from "./postProcessor";

// Helper to parse Redis URL
const parseRedisUrl = (url: string) => {
  try {
    const cleanUrl = url.replace("redis://", "");
    const [hostAndPort] = cleanUrl.split("/");
    const [host, port] = hostAndPort.split(":");
    return {
      host: host || "localhost",
      port: parseInt(port || "6379", 10),
    };
  } catch {
    return { host: "localhost", port: 6380 };
  }
};

const connection = parseRedisUrl(config.redisUrl);

export const startPostWorker = () => {
  console.log(`🔌 Starting BullMQ Worker inline`);
  
  const worker = new Worker("post-creation", postProcessor, {
    connection,
    concurrency: 50, // Allow high concurrent processing of post safety checks
  });

  worker.on("completed", (job, result) => {
    if (result && result.success && result.post) {
      // Emit socket event from the main process
      try {
        socketService.emit("post_created", result.post);
        // In production, console.log is silenced, but this is kept for dev logs
        console.log(`📡 [Worker] Socket event 'post_created' emitted for post ID:`, result.post._id);
      } catch (err: any) {
        console.error("❌ [Worker] Socket emission failed:", err.message);
      }
    }
  });

  worker.on("failed", (job, err) => {
    console.error(`❌ [Worker] Job ${job?.id} failed:`, err.message);
  });

  worker.on("error", (err) => {
    console.error("❌ [Worker] Worker general error:", err);
  });

  return worker;
};
