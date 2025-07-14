import { Router } from "express";
import { AddressController } from "../controllers/address.controller.js";

const router = Router();

// All address routes require authentication (middleware will be added later)
router.get("/", AddressController.getUserAddresses);
router.get("/default", AddressController.getDefaultAddress);
router.get("/:id", AddressController.getAddressById);
router.post("/", AddressController.createAddress);
router.put("/:id", AddressController.updateAddress);
router.put("/:id/default", AddressController.setDefaultAddress);
router.delete("/:id", AddressController.deleteAddress);

export default router;
