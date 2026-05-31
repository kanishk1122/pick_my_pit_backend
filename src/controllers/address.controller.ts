import { Request, Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { prisma } from "../config/database";
import { ResponseHelper } from "../helper/utils";
import Joi from "joi";

// Validation schemas
const addressValidation = Joi.object({
  userId: Joi.string().required(),
  street: Joi.string().required().min(5).max(200),
  city: Joi.string().required().min(2).max(100),
  state: Joi.string().required().min(2).max(100),
  location: Joi.object({
    type: Joi.string().valid("Point").required(),
    coordinates: Joi.array().items(Joi.number()).length(2).required(),
  }).required(),
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

function formatAddress(address: any) {
  if (!address) return null;
  return {
    _id: address.id,
    id: address.id,
    userId: address.userId,
    street: address.street,
    city: address.city,
    state: address.state,
    landmark: address.landmark,
    postalCode: address.postalCode,
    country: address.country,
    isDefault: address.isDefault,
    createdAt: address.createdAt,
    updatedAt: address.updatedAt,
    location: {
      type: "Point",
      coordinates: [address.longitude, address.latitude]
    }
  };
}

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

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 4; // Set limit to 4 for 2x2 grid
      const skip = (page - 1) * limit;

      const addresses = await prisma.address.findMany({
        where: { userId: req.user.id },
        orderBy: [
          { isDefault: "desc" },
          { createdAt: "desc" }
        ],
        skip,
        take: limit
      });

      const total = await prisma.address.count({
        where: { userId: req.user.id }
      });

      const formattedAddresses = addresses.map(formatAddress);

      res.status(200).json(
        ResponseHelper.success(
          {
            addresses: formattedAddresses,
            pagination: {
              total,
              page,
              limit,
              totalPages: Math.ceil(total / limit),
            },
          },
          "Addresses retrieved successfully"
        )
      );
    } catch (error) {
      console.error("Get addresses error:", error);
      res.status(500).json(ResponseHelper.error("Internal server error"));
    }
  }

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

      const address = await prisma.address.findFirst({
        where: {
          id,
          userId: req.user.id,
        }
      });

      if (!address) {
        res.status(404).json(ResponseHelper.error("Address not found"));
        return;
      }

      res
        .status(200)
        .json(
          ResponseHelper.success(formatAddress(address), "Address retrieved successfully")
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

      console.log("Create address request body:", req.user);

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

      // If set as default, clear other default addresses for user
      if (value.isDefault) {
        await prisma.address.updateMany({
          where: { userId: req.user.id },
          data: { isDefault: false }
        });
      }

      const address = await prisma.address.create({
        data: {
          userId: value.userId,
          street: value.street,
          city: value.city,
          state: value.state,
          longitude: value.location.coordinates[0],
          latitude: value.location.coordinates[1],
          landmark: value.landmark,
          postalCode: value.postalCode,
          country: value.country,
          isDefault: value.isDefault
        }
      });

      res
        .status(201)
        .json(ResponseHelper.success(formatAddress(address), "Address created successfully"));
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

      // Check existence and ownership
      const existingAddress = await prisma.address.findFirst({
        where: { id, userId: req.user.id }
      });

      if (!existingAddress) {
        res.status(404).json(ResponseHelper.error("Address not found"));
        return;
      }

      // If changing to default, unset other defaults
      if (value.isDefault) {
        await prisma.address.updateMany({
          where: { userId: req.user.id },
          data: { isDefault: false }
        });
      }

      // Map request properties to database fields
      const updateData: any = {};
      if (value.street !== undefined) updateData.street = value.street;
      if (value.city !== undefined) updateData.city = value.city;
      if (value.state !== undefined) updateData.state = value.state;
      if (value.landmark !== undefined) updateData.landmark = value.landmark;
      if (value.postalCode !== undefined) updateData.postalCode = value.postalCode;
      if (value.country !== undefined) updateData.country = value.country;
      if (value.isDefault !== undefined) updateData.isDefault = value.isDefault;
      if (value.longitude !== undefined) updateData.longitude = value.longitude;
      if (value.latitude !== undefined) updateData.latitude = value.latitude;

      const address = await prisma.address.update({
        where: { id },
        data: updateData
      });

      res
        .status(200)
        .json(ResponseHelper.success(formatAddress(address), "Address updated successfully"));
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

      const existingAddress = await prisma.address.findFirst({
        where: { id, userId: req.user.id }
      });

      if (!existingAddress) {
        res.status(404).json(ResponseHelper.error("Address not found"));
        return;
      }

      await prisma.address.delete({
        where: { id }
      });

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

      const existingAddress = await prisma.address.findFirst({
        where: { id, userId: req.user.id }
      });

      if (!existingAddress) {
        res.status(404).json(ResponseHelper.error("Address not found"));
        return;
      }

      // First, unset all default addresses for this user
      await prisma.address.updateMany({
        where: { userId: req.user.id },
        data: { isDefault: false }
      });

      // Then set the specified address as default
      const address = await prisma.address.update({
        where: { id },
        data: { isDefault: true }
      });

      res
        .status(200)
        .json(
          ResponseHelper.success(formatAddress(address), "Default address set successfully")
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

      const address = await prisma.address.findFirst({
        where: {
          userId: req.user.id,
          isDefault: true,
        }
      });

      if (!address) {
        res.status(404).json(ResponseHelper.error("No default address found"));
        return;
      }

      res
        .status(200)
        .json(
          ResponseHelper.success(
            formatAddress(address),
            "Default address retrieved successfully"
          )
        );
    } catch (error) {
      console.error("Get default address error:", error);
      res.status(500).json(ResponseHelper.error("Internal server error"));
    }
  }
}

