import { database, prisma } from "../config/database";
import { ImageSafetyService } from "../utils/imageSafety";
import { redisService } from "../utils/redis";
import { SandboxedJob } from "bullmq";

function formatPost(post: any) {
  if (!post) return null;
  return {
    ...post,
    _id: post.id,
    discription: post.discription,
    age: post.ageValue !== null && post.ageValue !== undefined ? { value: post.ageValue, unit: post.ageUnit } : undefined,
    formattedAge: post.ageValue !== null && post.ageValue !== undefined ? `${post.ageValue} ${post.ageValue === 1 ? post.ageUnit.slice(0, -1) : post.ageUnit} old` : "",
  };
}

export default async function (job: SandboxedJob) {
  const { postData } = job.data;

  // 1. Ensure DB Connection in child process
  try {
    await database.connect();
  } catch (err: any) {
    console.error("Worker DB connection error:", err.message);
    throw err;
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
    const rejectedPost = await prisma.post.create({
      data: {
        ...postData,
        status: "rejected",
        meta: { rejectReason: "Automated spam detection" }
      }
    });
    return { success: false, reason: "spam", post: formatPost(rejectedPost) };
  }

  // 4. Image Safety Detection
  if (postData.images && Array.isArray(postData.images)) {
    for (const imageUrl of postData.images) {
      const isSafe = await ImageSafetyService.isImageSafe(imageUrl);
      if (!isSafe) {
        console.warn("🚫 [Worker] Post REJECTED: Unsafe image detected", imageUrl);
        const rejectedPost = await prisma.post.create({
          data: {
            ...postData,
            status: "rejected",
            meta: { rejectReason: "Automated NSFW detection" }
          }
        });
        return { success: false, reason: "nsfw", post: formatPost(rejectedPost) };
      }
    }
  }

  // 5. Save Valid Post to DB
  const post = await prisma.post.create({
    data: postData
  });
  console.log("💾 [Worker] Post saved to DB:", post.id);

  // 6. Cache in Redis
  const formattedPost = formatPost(post);
  try {
    const cacheKey = `post:slug:${post.slug}`;
    await redisService.set(cacheKey, formattedPost, 3600);
    await redisService.set(`post:id:${post.id}`, formattedPost, 3600);
    console.log("🚀 [Worker] Post cached in Redis:", cacheKey);
  } catch (cacheErr: any) {
    console.error("❌ [Worker] Redis caching failed:", cacheErr.message);
  }

  return { success: true, post: formattedPost };
}

