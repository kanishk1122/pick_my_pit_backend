import mongoose from "mongoose";
import { config } from "../config/index";
import PostModel from "../model/post.model";
import { ImageSafetyService } from "../utils/imageSafety";
import { redisService } from "../utils/redis";
import { SandboxedJob } from "bullmq";

export default async function (job: SandboxedJob) {
  const { postData } = job.data;

  // 1. Ensure DB Connection in child process
  if (mongoose.connection.readyState === 0) {
    try {
      await mongoose.connect(config.mongoUrl);
    } catch (err: any) {
      console.error("Worker DB connection error:", err.message);
      throw err;
    }
  }

  // 2. Ensure Redis Connection in child process
  try {
    await redisService.connect();
  } catch (err: any) {
    // Silent catch, connection is handled inside redisService
  }

  // 3. Spam Detection
  const spamWords = ["spam", "fake", "scam", "test"];
  const containsSpam = spamWords.some(word =>
    postData.title.toLowerCase().includes(word) ||
    postData.discription.toLowerCase().includes(word)
  );

  if (containsSpam) {
    console.warn("🚫 [Worker] Post REJECTED: Spam detected", postData.title);
    const rejectedPost = new PostModel({
      ...postData,
      status: "rejected",
      meta: { rejectReason: "Automated spam detection" }
    });
    await rejectedPost.save();
    return { success: false, reason: "spam", post: rejectedPost.toJSON() };
  }

  // 4. Image Safety Detection
  if (postData.images && Array.isArray(postData.images)) {
    for (const imageUrl of postData.images) {
      const isSafe = await ImageSafetyService.isImageSafe(imageUrl);
      if (!isSafe) {
        console.warn("🚫 [Worker] Post REJECTED: Unsafe image detected", imageUrl);
        const rejectedPost = new PostModel({
          ...postData,
          status: "rejected",
          meta: { rejectReason: "Automated NSFW detection" }
        });
        await rejectedPost.save();
        return { success: false, reason: "nsfw", post: rejectedPost.toJSON() };
      }
    }
  }

  // 5. Save Valid Post to DB
  const post = new PostModel(postData);
  await post.save();
  console.log("💾 [Worker] Post saved to DB:", post._id);

  // 6. Cache in Redis
  try {
    const cacheKey = `post:slug:${post.slug}`;
    await redisService.set(cacheKey, post, 3600);
    await redisService.set(`post:id:${post._id}`, post, 3600);
    console.log("🚀 [Worker] Post cached in Redis:", cacheKey);
  } catch (cacheErr: any) {
    console.error("❌ [Worker] Redis caching failed:", cacheErr.message);
  }

  return { success: true, post: post.toJSON() };
}
