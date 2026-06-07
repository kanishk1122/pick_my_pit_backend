import { database, prisma } from "../config/database";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

interface BreedInput {
  name: string;
  description?: string;
  characteristics?: string[];
}

interface SpeciesInput {
  name: string;
  displayName: string;
  icon?: string;
  description?: string;
  breeds: BreedInput[];
}

async function main() {
  try {
    console.log("🔌 Connecting to PostgreSQL database...");
    await database.connect();
    console.log("✅ Connected successfully.");

    console.log("🗑️ Clearing existing species and breeds...");
    await prisma.breed.deleteMany({});
    await prisma.species.deleteMany({});
    console.log("✅ Existing data cleared.");

    const jsonPath = path.join(__dirname, "../../prisma/species_breeds.json");
    console.log(`📖 Reading seed data from ${jsonPath}...`);
    const fileContent = fs.readFileSync(jsonPath, "utf-8");
    const data: SpeciesInput[] = JSON.parse(fileContent);

    console.log(`🌱 Seeding ${data.length} species and their breeds...`);

    for (const speciesData of data) {
      console.log(`Processing species: ${speciesData.displayName} (${speciesData.name})...`);
      
      // Upsert Species
      const species = await prisma.species.upsert({
        where: { name: speciesData.name },
        update: {
          displayName: speciesData.displayName,
          icon: speciesData.icon || "",
          description: speciesData.description || "",
          active: true,
        },
        create: {
          name: speciesData.name,
          displayName: speciesData.displayName,
          icon: speciesData.icon || "",
          description: speciesData.description || "",
          active: true,
        },
      });

      console.log(`Species ID: ${species.id}. Seeding ${speciesData.breeds.length} breeds...`);

      for (const breedData of speciesData.breeds) {
        // Upsert Breed (unique combination of speciesId and name)
        await prisma.breed.upsert({
          where: {
            speciesId_name: {
              speciesId: species.id,
              name: breedData.name,
            },
          },
          update: {
            speciesName: species.name,
            description: breedData.description || "",
            characteristics: breedData.characteristics || [],
            active: true,
          },
          create: {
            name: breedData.name,
            speciesId: species.id,
            speciesName: species.name,
            description: breedData.description || "",
            characteristics: breedData.characteristics || [],
            active: true,
          },
        });
      }
    }

    console.log("✅ Seeding completed successfully!");
  } catch (error) {
    console.error("❌ Seeding failed:", error);
  } finally {
    console.log("🔌 Disconnecting database...");
    await database.disconnect();
    console.log("✅ Disconnected.");
    process.exit(0);
  }
}

main();
