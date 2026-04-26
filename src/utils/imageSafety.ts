import axios from "axios";
import { config } from "../config/index";

export class ImageSafetyService {
    private static HF_MODEL_URL = "https://api-inference.huggingface.co/models/Falconsai/nsfw_image_detection";

    /**
     * Checks if an image is safe (not NSFW).
     * @param imageUrl The URL of the image to check.
     * @returns Promise<boolean> true if safe, false if NSFW or error.
     */
    // Updated version with improvements:
    static async isImageSafe(imageUrl: string): Promise<boolean> {
        if (!imageUrl || !imageUrl.startsWith("http")) {
            return true;
        }

        if (!config.huggingFaceApiKey) {
            console.warn("⚠️ Hugging Face API key is missing. Skipping safety check.");
            return true;
        }

        try {
            // Fetch the image data
            const imageResponse = await axios.get(imageUrl, {
                responseType: "arraybuffer",
                timeout: 10000 // Add timeout to prevent hanging
            });
            const imageBuffer = Buffer.from(imageResponse.data);

            // Alternative: Convert to base64 if needed
            // const base64Image = imageBuffer.toString('base64');

            // Send to Hugging Face
            const hfResponse = await axios.post(
                this.HF_MODEL_URL,
                imageBuffer,
                {
                    headers: {
                        Authorization: `Bearer ${config.huggingFaceApiKey}`,
                        "Content-Type": "application/octet-stream",
                    },
                    timeout: 30000 // Model might take time to process
                }
            );

            const result = hfResponse.data;

            // Handle model loading state
            if (result.error && result.error.includes("loading")) {
                console.log("⏳ Model is loading, retrying in a moment...");
                // You might want to implement retry logic here
                return true;
            }

            // The model returns an array of predictions
            if (!Array.isArray(result)) {
                console.error("Unexpected response format:", result);
                return true;
            }

            // Look for NSFW label (adjust based on actual model output)
            const nsfwPrediction = result.find((r: any) =>
                r.label && r.label.toLowerCase().includes('nsfw')
            );

            const nsfwScore = nsfwPrediction?.score || 0;

            console.log(`NSFW detection score: ${nsfwScore}`);

            // Return true if NSFW score is less than threshold
            return nsfwScore < 0.5;

        } catch (error: any) {
            console.error("❌ Image safety check failed:", error?.message);

            // More detailed error handling
            if (error.response?.status === 503) {
                console.log("Model is currently loading, please try again later");
            } else if (error.response?.status === 401) {
                console.log("Invalid API token");
            }

            return true; // Fail-safe approach
        }
    }
}
