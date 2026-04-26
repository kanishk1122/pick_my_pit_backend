import { kafkaService } from "../utils/kafka";
import { redisService } from "../utils/redis";
import PostModel from "../model/post.model";
import { ImageSafetyService } from "../utils/imageSafety";
import { socketService } from "../utils/socket";

export const startPostConsumer = async () => {
    await kafkaService.connect();
    await redisService.connect();

    await kafkaService.subscribe("post-create", async (data) => {
        console.log("📥 Received post-create event:", data.title);

        try {
            // --- REJECT LOGIC ---

            // 1. Text Spam Check
            const spamWords = ["spam", "fake", "scam", "test"];
            const containsSpam = spamWords.some(word =>
                data.title.toLowerCase().includes(word) ||
                data.discription.toLowerCase().includes(word)
            );

            if (containsSpam) {
                console.warn("🚫 Post REJECTED: Spam detected in title or description", data.title);
                const rejectedPost = new PostModel({
                    ...data,
                    status: "rejected",
                    meta: { rejectReason: "Automated spam detection" }
                });
                await rejectedPost.save();
                return;
            }

            // 2. Image Safety Check (Hugging Face)
            if (data.images && Array.isArray(data.images)) {
                for (const imageUrl of data.images) {
                    const isSafe = await ImageSafetyService.isImageSafe(imageUrl);
                    if (!isSafe) {
                        console.warn("🚫 Post REJECTED: Unsafe image detected", imageUrl);
                        const rejectedPost = new PostModel({
                            ...data,
                            status: "rejected",
                            meta: { rejectReason: "Automated NSFW detection" }
                        });
                        await rejectedPost.save();
                        return;
                    }
                }
            }

            // --- DB PERSISTENCE ---
            const post = new PostModel(data);
            await post.save();
            console.log("💾 Post saved to DB:", post._id);

            // --- REDIS CACHING ---
            const cacheKey = `post:slug:${post.slug}`;
            await redisService.set(cacheKey, post, 3600);
            await redisService.set(`post:id:${post._id}`, post, 3600);

            console.log("🚀 Post cached in Redis:", cacheKey);

            // --- SOCKET NOTIFICATION ---
            socketService.emit("post_created", post);
        } catch (error) {
            console.error("❌ Error processing post-create event:", error);
        }
    });
};
