import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { prisma } from "../config/database";
import { ResponseHelper } from "../helper/utils";
import Joi from "joi";

// Validation schemas
const speciesValidation = Joi.object({
  name: Joi.string().required().min(2).max(50),
  displayName: Joi.string().required().min(2).max(50),
  description: Joi.string().allow("").max(500),
  icon: Joi.string().allow("").max(200),
  active: Joi.boolean().default(true),
});

function formatSpecies(species: any) {
  if (!species) return null;
  return {
    ...species,
    _id: species.id,
  };
}

export class SpeciesController {
  // Get all species
  static async getAllSpecies(req: Request, res: Response): Promise<void> {
    try {
      const activeOnly = req.query.active === "true";

      const query: any = {};
      if (activeOnly) {
        query.active = true;
      }

      const species = await prisma.species.findMany({
        where: query,
        orderBy: [
          { popularity: "desc" },
          { displayName: "asc" }
        ]
      });

      const formattedSpecies = species.map(formatSpecies);

      res
        .status(200)
        .json(
          ResponseHelper.success(formattedSpecies, "Species retrieved successfully")
        );
    } catch (error) {
      console.error("Get species error:", error);
      res.status(500).json(ResponseHelper.error("Internal server error"));
    }
  }

  // Get species by ID
  static async getSpeciesById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const species = await prisma.species.findUnique({
        where: { id }
      });

      if (!species) {
        res.status(404).json(ResponseHelper.error("Species not found"));
        return;
      }

      res
        .status(200)
        .json(
          ResponseHelper.success(formatSpecies(species), "Species retrieved successfully")
        );
    } catch (error) {
      console.error("Get species error:", error);
      res.status(500).json(ResponseHelper.error("Internal server error"));
    }
  }

  // Get species by name
  static async getSpeciesByName(req: Request, res: Response): Promise<void> {
    try {
      const { name } = req.params;

      const species = await prisma.species.findFirst({
        where: {
          name: name.toLowerCase()
        }
      });

      if (!species) {
        res.status(404).json(ResponseHelper.error("Species not found"));
        return;
      }

      res
        .status(200)
        .json(
          ResponseHelper.success(formatSpecies(species), "Species retrieved successfully")
        );
    } catch (error) {
      console.error("Get species by name error:", error);
      res.status(500).json(ResponseHelper.error("Internal server error"));
    }
  }

  // Create new species (Admin only)
  static async createSpecies(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { error, value } = speciesValidation.validate(req.body);
      if (error) {
        res
          .status(400)
          .json(ResponseHelper.error("Validation failed", error.details));
        return;
      }

      // Check if species already exists
      const existingSpecies = await prisma.species.findFirst({
        where: { name: value.name.toLowerCase() }
      });
      if (existingSpecies) {
        res
          .status(409)
          .json(ResponseHelper.error("Species with this name already exists"));
        return;
      }

      const species = await prisma.species.create({
        data: {
          name: value.name.toLowerCase(),
          displayName: value.displayName,
          description: value.description || "",
          icon: value.icon || "",
          active: value.active
        }
      });

      res
        .status(201)
        .json(ResponseHelper.success(formatSpecies(species), "Species created successfully"));
    } catch (error) {
      console.error("Create species error:", error);
      res.status(500).json(ResponseHelper.error("Internal server error"));
    }
  }

  // Update species (Admin only)
  static async updateSpecies(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { id } = req.params;
      const { error, value } = speciesValidation.validate(req.body);

      if (error) {
        res
          .status(400)
          .json(ResponseHelper.error("Validation failed", error.details));
        return;
      }

      const existingSpecies = await prisma.species.findUnique({ where: { id } });
      if (!existingSpecies) {
        res.status(404).json(ResponseHelper.error("Species not found"));
        return;
      }

      const species = await prisma.species.update({
        where: { id },
        data: {
          name: value.name.toLowerCase(),
          displayName: value.displayName,
          description: value.description || "",
          icon: value.icon || "",
          active: value.active
        }
      });

      res
        .status(200)
        .json(ResponseHelper.success(formatSpecies(species), "Species updated successfully"));
    } catch (error) {
      console.error("Update species error:", error);
      res.status(500).json(ResponseHelper.error("Internal server error"));
    }
  }

  // Delete species (Admin only)
  static async deleteSpecies(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { id } = req.params;

      const existingSpecies = await prisma.species.findUnique({ where: { id } });
      if (!existingSpecies) {
        res.status(404).json(ResponseHelper.error("Species not found"));
        return;
      }

      await prisma.species.delete({
        where: { id }
      });

      res
        .status(200)
        .json(ResponseHelper.success(null, "Species deleted successfully"));
    } catch (error) {
      console.error("Delete species error:", error);
      res.status(500).json(ResponseHelper.error("Internal server error"));
    }
  }

  // Get active species for public use
  static async getActiveSpecies(req: Request, res: Response): Promise<void> {
    try {
      const species = await prisma.species.findMany({
        where: { active: true },
        orderBy: [
          { popularity: "desc" },
          { displayName: "asc" }
        ]
      });

      const formattedSpecies = species.map(formatSpecies);

      res
        .status(200)
        .json(
          ResponseHelper.success(
            formattedSpecies,
            "Active species retrieved successfully"
          )
        );
    } catch (error) {
      console.error("Get active species error:", error);
      res.status(500).json(ResponseHelper.error("Internal server error"));
    }
  }

  // Get species hierarchy with breeds
  static async getSpeciesHierarchy(req: Request, res: Response): Promise<void> {
    try {
      const species = await prisma.species.findMany({
        where: { active: true },
        orderBy: [
          { popularity: "desc" },
          { displayName: "asc" }
        ]
      });

      const formattedSpecies = species.map(formatSpecies);

      res
        .status(200)
        .json(
          ResponseHelper.success(
            formattedSpecies,
            "Species hierarchy retrieved successfully"
          )
        );
    } catch (error) {
      console.error("Get species hierarchy error:", error);
      res.status(500).json(ResponseHelper.error("Internal server error"));
    }
  }
}

