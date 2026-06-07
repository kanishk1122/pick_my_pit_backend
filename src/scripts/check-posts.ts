import { database, prisma } from "../config/database";
import dotenv from "dotenv";

dotenv.config();

async function main() {
  try {
    await database.connect();
    const count = await prisma.post.count();
    console.log("Total posts in DB:", count);
    const posts = await prisma.post.findMany({
      include: {
        owner: true,
      }
    });
    console.log("Posts details:", JSON.stringify(posts, null, 2));
  } catch (err) {
    console.error("Error checking posts:", err);
  } finally {
    await database.disconnect();
    process.exit(0);
  }
}

main();
