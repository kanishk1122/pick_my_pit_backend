import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import AddressModel from "../model/address.model.js";
import { ResponseHelper } from "../helper/utils.js";
import Joi from "joi";

// Validation schemas
const addressValidation = Joi.object({
  userId: Joi.string().required(),
  street: Joi.string().required().min(5).max(200),
  city: Joi.string().required().min(2).max(100),
  state: Joi.string().required().min(2).max(100),
  latitude: Joi.number().optional(),
  longitude: Joi.number().optional(),
  landmark: Joi.string().allow("").max(200),
  postalCode: Joi.string()
    .required()
    .pattern(/^\d{6}$/),
  country: Joi.string().required().min(2).max(100),
  isDefault: Joi.boolean().default(false),
});

const addressUpdateValidation = Joi.object({
  street: Joi.string().min(5).max(200),
  city: Joi.string().min(2).max(100),
  state: Joi.string().min(2).max(100),
  latitude: Joi.number().optional(),
  longitude: Joi.number().optional(),
  landmark: Joi.string().allow("").max(200),
  postalCode: Joi.string().pattern(/^\d{6}$/),
  country: Joi.string().min(2).max(100),
  isDefault: Joi.boolean(),
}).min(1);

export class AddressController {
  // Get user addresses
  static async getUserAddresses(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json(ResponseHelper.error("User not authenticated"));
        return;
      }

      const addresses = await AddressModel.find({ userId: req.user.id }).sort({
        isDefault: -1,
        createdAt: -1,
      });

      res
        .status(200)
        .json(
          ResponseHelper.success(addresses, "Addresses retrieved successfully")
        );
    } catch (error) {
      console.error("Get addresses error:", error);
      res.status(500).json(ResponseHelper.error("Internal server error"));
    }
  }

  // Get address by ID
  static async getAddressById(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { id } = req.params;

      if (!req.user) {
        res.status(401).json(ResponseHelper.error("User not authenticated"));
        return;
      }

      const address = await AddressModel.findOne({
        _id: id,
        userId: req.user.id,
      });

      if (!address) {
        res.status(404).json(ResponseHelper.error("Address not found"));
        return;
      }

      res
        .status(200)
        .json(
          ResponseHelper.success(address, "Address retrieved successfully")
        );
    } catch (error) {
      console.error("Get address error:", error);
      res.status(500).json(ResponseHelper.error("Internal server error"));
    }
  }

  // Create new address
  static async createAddress(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json(ResponseHelper.error("User not authenticated"));
        return;
      }

      const addressData = {
        ...req.body,
        userId: req.user.id,
      };

      const { error, value } = addressValidation.validate(addressData);
      if (error) {
        res
          .status(400)
          .json(ResponseHelper.error("Validation failed", error.details));
        return;
      }

      const address = new AddressModel(value);
      await address.save();

      res
        .status(201)
        .json(ResponseHelper.success(address, "Address created successfully"));
    } catch (error) {
      console.error("Create address error:", error);
      res.status(500).json(ResponseHelper.error("Internal server error"));
    }
  }

  // Update address
  static async updateAddress(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { id } = req.params;

      if (!req.user) {
        res.status(401).json(ResponseHelper.error("User not authenticated"));
        return;
      }

      const { error, value } = addressUpdateValidation.validate(req.body);
      if (error) {
        res
          .status(400)
          .json(ResponseHelper.error("Validation failed", error.details));
        return;
      }

      const address = await AddressModel.findOneAndUpdate(
        { _id: id, userId: req.user.id },
        { $set: value },
        { new: true }
      );

      if (!address) {
        res.status(404).json(ResponseHelper.error("Address not found"));
        return;
      }

      res
        .status(200)
        .json(ResponseHelper.success(address, "Address updated successfully"));
    } catch (error) {
      console.error("Update address error:", error);
      res.status(500).json(ResponseHelper.error("Internal server error"));
    }
  }

  // Delete address
  static async deleteAddress(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { id } = req.params;

      if (!req.user) {
        res.status(401).json(ResponseHelper.error("User not authenticated"));
        return;
      }

      const address = await AddressModel.findOneAndDelete({
        _id: id,
        userId: req.user.id,
      });

      if (!address) {
        res.status(404).json(ResponseHelper.error("Address not found"));
        return;
      }

      res
        .status(200)
        .json(ResponseHelper.success(null, "Address deleted successfully"));
    } catch (error) {
      console.error("Delete address error:", error);
      res.status(500).json(ResponseHelper.error("Internal server error"));
    }
  }

  // Set default address
  static async setDefaultAddress(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { id } = req.params;

      if (!req.user) {
        res.status(401).json(ResponseHelper.error("User not authenticated"));
        return;
      }

      // First, unset all default addresses for this user
      await AddressModel.updateMany(
        { userId: req.user.id },
        { isDefault: false }
      );

      // Then set the specified address as default
      const address = await AddressModel.findOneAndUpdate(
        { _id: id, userId: req.user.id },
        { isDefault: true },
        { new: true }
      );

      if (!address) {
        res.status(404).json(ResponseHelper.error("Address not found"));
        return;
      }

      res
        .status(200)
        .json(
          ResponseHelper.success(address, "Default address set successfully")
        );
    } catch (error) {
      console.error("Set default address error:", error);
      res.status(500).json(ResponseHelper.error("Internal server error"));
    }
  }

  // Get default address
  static async getDefaultAddress(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json(ResponseHelper.error("User not authenticated"));
        return;
      }

      const address = await AddressModel.findOne({
        userId: req.user.id,
        isDefault: true,
      });

      if (!address) {
        res.status(404).json(ResponseHelper.error("No default address found"));
        return;
      }

      res
        .status(200)
        .json(
          ResponseHelper.success(
            address,
            "Default address retrieved successfully"
          )
        );
    } catch (error) {
      console.error("Get default address error:", error);
      res.status(500).json(ResponseHelper.error("Internal server error"));
    }
  }
}
