import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import BreedModel from "../model/breed.model.js";
import SpeciesModel from "../model/species.model.js";
import { ResponseHelper } from "../helper/utils.js";
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
        query.species = species;
      }

      if (active === "true") {
        query.active = true;
      }

      const breeds = await BreedModel.find(query)
        .populate("species")
        .skip(skip)
        .limit(limit)
        .sort({ popularity: -1, name: 1 });

      const total = await BreedModel.countDocuments(query);

      res
        .status(200)
        .json(
          ResponseHelper.paginated(
            breeds,
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

      const breed = await BreedModel.findById(id).populate("species");

      if (!breed) {
        res.status(404).json(ResponseHelper.error("Breed not found"));
        return;
      }

      res
        .status(200)
        .json(ResponseHelper.success(breed, "Breed retrieved successfully"));
    } catch (error) {
      console.error("Get breed error:", error);
      res.status(500).json(ResponseHelper.error("Internal server error"));
    }
  }

  // Get breeds by species
  static async getBreedsBySpecies(req: Request, res: Response): Promise<void> {
    try {
      const { speciesId } = req.params;
      const activeOnly = req.query.active === "true";

      let breeds;
      if (activeOnly) {
        breeds = await BreedModel.findActiveBySpecies(speciesId);
      } else {
        breeds = await BreedModel.findBySpecies(speciesId);
      }

      res
        .status(200)
        .json(ResponseHelper.success(breeds, "Breeds retrieved successfully"));
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

      const breed = await BreedModel.findByName(name, species as string);

      if (!breed) {
        res.status(404).json(ResponseHelper.error("Breed not found"));
        return;
      }

      res
        .status(200)
        .json(ResponseHelper.success(breed, "Breed retrieved successfully"));
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
      const species = await SpeciesModel.findById(value.species);
      if (!species) {
        res.status(400).json(ResponseHelper.error("Invalid species ID"));
        return;
      }

      // Check if breed already exists for this species
      const existingBreed = await BreedModel.findByName(
        value.name,
        value.species
      );
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

      const breed = new BreedModel(value);
      await breed.save();

      const populatedBreed = await BreedModel.findById(breed._id).populate(
        "species"
      );

      res
        .status(201)
        .json(
          ResponseHelper.success(populatedBreed, "Breed created successfully")
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
        const species = await SpeciesModel.findById(value.species);
        if (!species) {
          res.status(400).json(ResponseHelper.error("Invalid species ID"));
          return;
        }
      }

      const breed = await BreedModel.findByIdAndUpdate(
        id,
        { $set: value },
        { new: true }
      ).populate("species");

      if (!breed) {
        res.status(404).json(ResponseHelper.error("Breed not found"));
        return;
      }

      res
        .status(200)
        .json(ResponseHelper.success(breed, "Breed updated successfully"));
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

      const breed = await BreedModel.findByIdAndDelete(id);

      if (!breed) {
        res.status(404).json(ResponseHelper.error("Breed not found"));
        return;
      }

      res
        .status(200)
        .json(ResponseHelper.success(null, "Breed deleted successfully"));
    } catch (error) {
      console.error("Delete breed error:", error);
      res.status(500).json(ResponseHelper.error("Internal server error"));
    }
  }
}
