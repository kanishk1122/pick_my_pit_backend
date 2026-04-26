import { kafkaService } from "../utils/kafka";
import { redisService } from "../utils/redis";
import BlogModel from "../model/blog.model";
import { ImageSafetyService } from "../utils/imageSafety";
import { socketService } from "../utils/socket";

export const startBlogConsumer = async () => {
    await kafkaService.connect();
    await redisService.connect();

    await kafkaService.subscribe("blog-create", async (data) => {
        console.log("📥 Received blog-create event:", data.title);

        try {
            // --- REJECT LOGIC ---

            // 1. Text Spam Check
            const spamWords = ["spam", "fake", "scam"];
            if (spamWords.some(word => data.title.toLowerCase().includes(word))) {
                console.warn("🚫 Blog REJECTED: Spam detected in title", data.title);
                return;
            }

            // 2. Image Safety Check (Hugging Face)
            if (data.coverImage) {
                const isSafe = await ImageSafetyService.isImageSafe(data.coverImage);
                if (!isSafe) {
                    console.warn("🚫 Blog REJECTED: Unsafe cover image detected", data.coverImage);
                    // For blogs, we can save as draft or reject. Let's just return for now as per "Reject" block.
                    return;
                }
            }

            // --- DB PERSISTENCE ---
            const blogPost = new BlogModel(data);
            await blogPost.save();
            console.log("💾 Blog saved to DB:", blogPost._id);

            // --- REDIS CACHING ---
            const cacheKey = `blog:${blogPost.slug}`;
            await redisService.set(cacheKey, blogPost, 3600);
            await redisService.set(`blog:id:${blogPost._id}`, blogPost, 3600);

            console.log("🚀 Blog cached in Redis:", cacheKey);

            // --- SOCKET NOTIFICATION ---
            socketService.emit("blog_created", blogPost);
        } catch (error: any) {
            console.error("❌ Error processing blog-create event:", error.message);
            if (error.errors) {
                console.error("Validation Errors:", Object.keys(error.errors).map(key => `${key}: ${error.errors[key].message}`));
                console.error("Payload received:", JSON.stringify(data, null, 2));
            }
        }
    });
};
