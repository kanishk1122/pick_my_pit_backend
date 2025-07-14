import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import SpeciesModel from "../model/species.model.js";
import { ResponseHelper } from "../helper/utils.js";
import Joi from "joi";

// Validation schemas
const speciesValidation = Joi.object({
  name: Joi.string().required().min(2).max(50),
  displayName: Joi.string().required().min(2).max(50),
  description: Joi.string().allow("").max(500),
  icon: Joi.string().allow("").max(200),
  active: Joi.boolean().default(true),
});

export class SpeciesController {
  // Get all species
  static async getAllSpecies(req: Request, res: Response): Promise<void> {
    try {
      const activeOnly = req.query.active === "true";

      let query = {};
      if (activeOnly) {
        query = { active: true };
      }

      const species = await SpeciesModel.find(query).sort({
        popularity: -1,
        displayName: 1,
      });

      res
        .status(200)
        .json(
          ResponseHelper.success(species, "Species retrieved successfully")
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

      const species = await SpeciesModel.findById(id);

      if (!species) {
        res.status(404).json(ResponseHelper.error("Species not found"));
        return;
      }

      res
        .status(200)
        .json(
          ResponseHelper.success(species, "Species retrieved successfully")
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

      const species = await SpeciesModel.findByName(name);

      if (!species) {
        res.status(404).json(ResponseHelper.error("Species not found"));
        return;
      }

      res
        .status(200)
        .json(
          ResponseHelper.success(species, "Species retrieved successfully")
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
      const existingSpecies = await SpeciesModel.findByName(value.name);
      if (existingSpecies) {
        res
          .status(409)
          .json(ResponseHelper.error("Species with this name already exists"));
        return;
      }

      const species = new SpeciesModel(value);
      await species.save();

      res
        .status(201)
        .json(ResponseHelper.success(species, "Species created successfully"));
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

      const species = await SpeciesModel.findByIdAndUpdate(
        id,
        { $set: value },
        { new: true }
      );

      if (!species) {
        res.status(404).json(ResponseHelper.error("Species not found"));
        return;
      }

      res
        .status(200)
        .json(ResponseHelper.success(species, "Species updated successfully"));
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

      const species = await SpeciesModel.findByIdAndDelete(id);

      if (!species) {
        res.status(404).json(ResponseHelper.error("Species not found"));
        return;
      }

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
      const species = await SpeciesModel.findActive();

      res
        .status(200)
        .json(
          ResponseHelper.success(
            species,
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
      const species = await SpeciesModel.find({ active: true }).sort({
        popularity: -1,
        displayName: 1,
      });

      // If you have a breed model, you can populate it here
      // const speciesWithBreeds = await Promise.all(
      //   species.map(async (s) => {
      //     const breeds = await BreedModel.find({ species: s._id, active: true });
      //     return {
      //       ...s.toObject(),
      //       breeds
      //     };
      //   })
      // );

      res
        .status(200)
        .json(
          ResponseHelper.success(
            species,
            "Species hierarchy retrieved successfully"
          )
        );
    } catch (error) {
      console.error("Get species hierarchy error:", error);
      res.status(500).json(ResponseHelper.error("Internal server error"));
    }
  }
}
