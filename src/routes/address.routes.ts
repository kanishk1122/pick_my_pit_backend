import { Router } from "express";
import { AddressController } from "../controllers/address.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

// All address routes require authentication (middleware will be added later)
router.get("/", authMiddleware, AddressController.getUserAddresses as any);
router.get(
  "/default",
  authMiddleware,
  AddressController.getDefaultAddress as any
);
router.get("/:id", authMiddleware, AddressController.getAddressById as any);
router.post("/", authMiddleware, AddressController.createAddress as any);
router.put("/:id", authMiddleware, AddressController.updateAddress as any);
router.put(
  "/:id/default",
  authMiddleware,
  AddressController.setDefaultAddress as any
);
router.delete("/:id", authMiddleware, AddressController.deleteAddress as any);

export default router;
