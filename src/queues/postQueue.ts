import { Queue } from "bullmq";
import { config } from "../config/index";

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

export const postQueue = new Queue("post-creation", {
  connection,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: 100, // keep last 100 failed jobs for debugging
  },
});
