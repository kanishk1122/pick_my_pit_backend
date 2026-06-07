import { database, prisma } from "../config/database";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

async function main() {
  try {
    console.log("🔌 Connecting to PostgreSQL database...");
    await database.connect();
    console.log("✅ Connected successfully.");

    const email = "admin@pickmypit.com";
    const password = "adminpassword";

    console.log(`🌱 Checking if admin exists with email ${email}...`);
    const existingAdmin = await prisma.admin.findUnique({
      where: { email },
    });

    if (existingAdmin) {
      console.log("⚠️ Admin already exists. Updating password...");
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      await prisma.admin.update({
        where: { email },
        data: {
          password: hashedPassword,
        },
      });
      console.log("✅ Admin updated successfully!");
    } else {
      console.log("🌱 Creating default admin...");
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      await prisma.admin.create({
        data: {
          firstname: "System",
          lastname: "Admin",
          email: email,
          password: hashedPassword,
          role: "superadmin",
          status: "active",
        },
      });
      console.log("✅ Admin created successfully!");
    }
  } catch (error) {
    console.error("❌ Seeding admin failed:", error);
  } finally {
    console.log("🔌 Disconnecting database...");
    await database.disconnect();
    console.log("✅ Disconnected.");
    process.exit(0);
  }
}

main();
