import mongoose from "mongoose";
import dotenv from "dotenv";
import PostModel from "./src/model/post.model";

dotenv.config();

async function fixPosts() {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error("MONGO_URI is not defined in .env");
    }

    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB");

    const newOwnerId = new mongoose.Types.ObjectId("69ee4b1b97cdbddde923d3d3");

    const result = await PostModel.updateMany(
      {}, // Match all posts
      { $set: { owner: newOwnerId } }
    );

    console.log(`✅ Successfully updated ${result.modifiedCount} posts.`);
    console.log(`All posts now belong to owner ID: ${newOwnerId}`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

fixPosts();
