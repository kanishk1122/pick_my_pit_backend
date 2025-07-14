import { Router } from "express";
import { SpeciesController } from "../controllers/species.controller.js";

const router = Router();

// Public routes - specific routes must come before parameterized routes
router.get("/", SpeciesController.getAllSpecies);
router.get("/active", SpeciesController.getActiveSpecies);
router.get("/hierarchy", SpeciesController.getSpeciesHierarchy);
router.get("/name/:name", SpeciesController.getSpeciesByName);
router.get("/:id", SpeciesController.getSpeciesById);

// Admin routes (middleware will be added later)
router.post("/", SpeciesController.createSpecies);
router.put("/:id", SpeciesController.updateSpecies);
router.delete("/:id", SpeciesController.deleteSpecies);

export default router;
