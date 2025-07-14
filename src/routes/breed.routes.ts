import { Router } from "express";
import { BreedController } from "../controllers/breed.controller.js";

const router = Router();

// Public routes
router.get("/", BreedController.getAllBreeds);
router.get("/species/:speciesId", BreedController.getBreedsBySpecies);
router.get("/name/:name", BreedController.getBreedByName);
router.get("/:id", BreedController.getBreedById);

// Admin routes (middleware will be added later)
router.post("/", BreedController.createBreed);
router.put("/:id", BreedController.updateBreed);
router.delete("/:id", BreedController.deleteBreed);

export default router;
