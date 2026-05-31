import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { prisma } from "../config/database";
import { ResponseHelper } from "../helper/utils";
import Joi from "joi";

// Validation schemas
const breedValidation = Joi.object({
  name: Joi.string().required().min(2).max(50),
  species: Joi.string().required(),
  speciesName: Joi.string().required().min(2).max(50),
  description: Joi.string().allow("").max(500),
  characteristics: Joi.array().items(Joi.string()).default([]),
  active: Joi.boolean().default(true),
});

function formatBreed(breed: any) {
  if (!breed) return null;
  const formatted = {
    ...breed,
    _id: breed.id,
  };
  if (formatted.species) {
    formatted.species = {
      ...formatted.species,
      _id: formatted.species.id
    };
  }
  return formatted;
}

export class BreedController {
  // Get all breeds
  static async getAllBreeds(req: Request, res: Response): Promise<void> {
    try {
      const { species, active } = req.query;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = (page - 1) * limit;

      let query: any = {};

      if (species) {
        query.speciesId = species as string;
      }

      if (active === "true") {
        query.active = true;
      }

      const breeds = await prisma.breed.findMany({
        where: query,
        include: {
          species: true
        },
        orderBy: [
          { popularity: "desc" },
          { name: "asc" }
        ],
        skip,
        take: limit
      });

      const total = await prisma.breed.count({ where: query });
      const formattedBreeds = breeds.map(formatBreed);

      res
        .status(200)
        .json(
          ResponseHelper.paginated(
            formattedBreeds,
            total,
            page,
            limit,
            "Breeds retrieved successfully"
          )
        );
    } catch (error) {
      console.error("Get breeds error:", error);
      res.status(500).json(ResponseHelper.error("Internal server error"));
    }
  }

  // Get breed by ID
  static async getBreedById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const breed = await prisma.breed.findUnique({
        where: { id },
        include: {
          species: true
        }
      });

      if (!breed) {
        res.status(404).json(ResponseHelper.error("Breed not found"));
        return;
      }

      res
        .status(200)
        .json(ResponseHelper.success(formatBreed(breed), "Breed retrieved successfully"));
    } catch (error) {
      console.error("Get breed error:", error);
      res.status(500).json(ResponseHelper.error("Internal server error"));
    }
  }

  // Get breeds by species
  static async getBreedsBySpecies(req: Request, res: Response): Promise<void> {
    try {
      const { speciesName } = req.params;
      const activeOnly = req.query.active === "true";

      // 1. Find the species by its name to get the ID
      const species = await prisma.species.findFirst({
        where: {
          name: { equals: speciesName, mode: "insensitive" }
        }
      });

      if (!species) {
        res
          .status(404)
          .json(ResponseHelper.error(`Species '${speciesName}' not found`));
        return;
      }

      const query: any = {
        speciesId: species.id
      };

      if (activeOnly) {
        query.active = true;
      }

      // 2. Query breeds for this species
      const breeds = await prisma.breed.findMany({
        where: query,
        include: {
          species: true
        },
        orderBy: [
          { popularity: "desc" },
          { name: "asc" }
        ]
      });

      const formattedBreeds = breeds.map(formatBreed);

      res
        .status(200)
        .json(ResponseHelper.success(formattedBreeds, "Breeds retrieved successfully"));
    } catch (error) {
      console.error("Get breeds by species error:", error);
      res.status(500).json(ResponseHelper.error("Internal server error"));
    }
  }

  // Get breed by name and species
  static async getBreedByName(req: Request, res: Response): Promise<void> {
    try {
      const { name } = req.params;
      const { species } = req.query;

      const query: any = {
        name: name.toLowerCase()
      };
      if (species) {
        query.speciesId = species as string;
      }

      const breed = await prisma.breed.findFirst({
        where: query,
        include: {
          species: true
        }
      });

      if (!breed) {
        res.status(404).json(ResponseHelper.error("Breed not found"));
        return;
      }

      res
        .status(200)
        .json(ResponseHelper.success(formatBreed(breed), "Breed retrieved successfully"));
    } catch (error) {
      console.error("Get breed by name error:", error);
      res.status(500).json(ResponseHelper.error("Internal server error"));
    }
  }

  // Create new breed (Admin only)
  static async createBreed(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { error, value } = breedValidation.validate(req.body);
      if (error) {
        res
          .status(400)
          .json(ResponseHelper.error("Validation failed", error.details));
        return;
      }

      // Verify species exists
      const species = await prisma.species.findUnique({
        where: { id: value.species }
      });
      if (!species) {
        res.status(400).json(ResponseHelper.error("Invalid species ID"));
        return;
      }

      // Check if breed already exists for this species
      const existingBreed = await prisma.breed.findFirst({
        where: {
          name: value.name.toLowerCase(),
          speciesId: value.species
        }
      });
      if (existingBreed) {
        res
          .status(409)
          .json(
            ResponseHelper.error(
              "Breed with this name already exists for this species"
            )
          );
        return;
      }

      const breed = await prisma.breed.create({
        data: {
          name: value.name.toLowerCase(),
          speciesId: value.species,
          speciesName: value.speciesName,
          description: value.description || "",
          characteristics: value.characteristics || [],
          active: value.active,
        },
        include: {
          species: true
        }
      });

      res
        .status(201)
        .json(
          ResponseHelper.success(formatBreed(breed), "Breed created successfully")
        );
    } catch (error) {
      console.error("Create breed error:", error);
      res.status(500).json(ResponseHelper.error("Internal server error"));
    }
  }

  // Update breed (Admin only)
  static async updateBreed(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { id } = req.params;
      const { error, value } = breedValidation.validate(req.body);

      if (error) {
        res
          .status(400)
          .json(ResponseHelper.error("Validation failed", error.details));
        return;
      }

      // Verify species exists if species is being updated
      if (value.species) {
        const species = await prisma.species.findUnique({
          where: { id: value.species }
        });
        if (!species) {
          res.status(400).json(ResponseHelper.error("Invalid species ID"));
          return;
        }
      }

      const existingBreed = await prisma.breed.findUnique({ where: { id } });
      if (!existingBreed) {
        res.status(404).json(ResponseHelper.error("Breed not found"));
        return;
      }

      const updatedBreed = await prisma.breed.update({
        where: { id },
        data: {
          name: value.name.toLowerCase(),
          speciesId: value.species,
          speciesName: value.speciesName,
          description: value.description || "",
          characteristics: value.characteristics || [],
          active: value.active,
        },
        include: {
          species: true
        }
      });

      res
        .status(200)
        .json(ResponseHelper.success(formatBreed(updatedBreed), "Breed updated successfully"));
    } catch (error) {
      console.error("Update breed error:", error);
      res.status(500).json(ResponseHelper.error("Internal server error"));
    }
  }

  // Delete breed (Admin only)
  static async deleteBreed(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { id } = req.params;

      const existingBreed = await prisma.breed.findUnique({ where: { id } });
      if (!existingBreed) {
        res.status(404).json(ResponseHelper.error("Breed not found"));
        return;
      }

      await prisma.breed.delete({
        where: { id }
      });

      res
        .status(200)
        .json(ResponseHelper.success(null, "Breed deleted successfully"));
    } catch (error) {
      console.error("Delete breed error:", error);
      res.status(500).json(ResponseHelper.error("Internal server error"));
    }
  }
}

