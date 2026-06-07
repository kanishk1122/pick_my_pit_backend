import { database, prisma } from "../config/database";
import dotenv from "dotenv";

dotenv.config();

async function main() {
  try {
    console.log("🔌 Connecting to PostgreSQL database...");
    await database.connect();
    console.log("✅ Connected successfully.");

    // Check if user exists
    console.log("🌱 Checking or creating default user...");
    let user = await prisma.user.findFirst({
      where: { email: "sarah@gmail.com" }
    });
    if (!user) {
      user = await prisma.user.create({
        data: {
          firstname: "Sarah",
          lastname: "Smith",
          email: "sarah@gmail.com",
          status: "active",
          emailConfirm: true,
        }
      });
      console.log("✅ Created user:", user.id);
    } else {
      console.log("⚠️ User already exists:", user.id);
    }

    // Create address
    console.log("🌱 Checking or creating address...");
    let address = await prisma.address.findFirst({
      where: { userId: user.id }
    });
    if (!address) {
      address = await prisma.address.create({
        data: {
          userId: user.id,
          street: "123 Main St",
          city: "New York",
          state: "NY",
          latitude: 40.7128,
          longitude: -74.0060,
          postalCode: "10001",
          country: "USA"
        }
      });
      console.log("✅ Created address:", address.id);
    } else {
      console.log("⚠️ Address already exists:", address.id);
    }

    // Check if there are posts
    const postCount = await prisma.post.count();
    console.log(`🌱 Checking posts... Currently ${postCount} posts in database.`);
    
    // Seed pending posts if there are less than 2
    console.log("🌱 Seeding pending posts...");
    await prisma.post.upsert({
      where: { slug: "golden-retriever-needs-new-home-123456" },
      update: { status: "pending" },
      create: {
        ownerId: user.id,
        title: "Golden Retriever needs new home",
        slug: "golden-retriever-needs-new-home-123456",
        discription: "Bella is a friendly Golden Retriever. She loves playing fetch and is great with kids.",
        amount: 0,
        type: "free",
        category: "Golden Retriever",
        species: "Dog",
        speciesSlug: "dog",
        breedSlug: "golden-retriever",
        addressId: address.id,
        ageValue: 2,
        ageUnit: "years",
        status: "pending",
        images: ["https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&q=80&w=400"]
      }
    });

    await prisma.post.upsert({
      where: { slug: "found-3-kittens-near-park-654321" },
      update: { status: "pending" },
      create: {
        ownerId: user.id,
        title: "Found 3 kittens near park",
        slug: "found-3-kittens-near-park-654321",
        discription: "Found three healthy kittens near the community park. Looking for kind adopters.",
        amount: 0,
        type: "free",
        category: "Domestic Short Hair",
        species: "Cat",
        speciesSlug: "cat",
        breedSlug: "domestic-short-hair",
        addressId: address.id,
        ageValue: 3,
        ageUnit: "months",
        status: "pending",
        images: ["https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&q=80&w=400"]
      }
    });

    console.log("✅ Seeded pending posts successfully!");

  } catch (err) {
    console.error("❌ Seeding posts failed:", err);
  } finally {
    console.log("🔌 Disconnecting database...");
    await database.disconnect();
    console.log("✅ Disconnected.");
    process.exit(0);
  }
}

main();
