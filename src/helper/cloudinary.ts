import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export class CloudinaryHelper {
  /**
   * Upload a base64 image string to Cloudinary
   * @param base64Image - Base64 image string (e.g., from FileReader.readAsDataURL())
   * @param folder - Folder path in Cloudinary (default: "pickmypit")
   * @returns Promise with secure_url of uploaded image
   */
  static async uploadBase64Image(
    base64Image: string,
    folder: string = "pickmypit"
  ): Promise<string> {
    try {
      if (!base64Image) {
        throw new Error("Base64 image string is empty");
      }

      const result = await cloudinary.uploader.upload(base64Image, {
        folder,
        resource_type: "auto",
        overwrite: false,
      });

      return result.secure_url;
    } catch (error: any) {
      console.error("Cloudinary upload error:", error.message);
      throw new Error(`Failed to upload image: ${error.message}`);
    }
  }

  /**
   * Delete an image from Cloudinary by public_id
   * @param publicId - Public ID of the image in Cloudinary
   */
  static async deleteImage(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId);
    } catch (error: any) {
      console.error("Cloudinary delete error:", error.message);
      throw new Error(`Failed to delete image: ${error.message}`);
    }
  }
}
