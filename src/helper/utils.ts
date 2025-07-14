import CryptoJS from "crypto-js";
import { config } from "../config/index.js";

export class CryptoHelper {
  private static readonly cryptoKey = config.cryptoKey;

  static encrypt(data: string): string {
    return CryptoJS.AES.encrypt(data, this.cryptoKey).toString();
  }

  static decrypt(encryptedData: string): string {
    const bytes = CryptoJS.AES.decrypt(encryptedData, this.cryptoKey);
    return bytes.toString(CryptoJS.enc.Utf8);
  }

  static generateRandomString(length: number = 32): string {
    return CryptoJS.lib.WordArray.random(length).toString();
  }

  static hashPassword(password: string): string {
    return CryptoJS.SHA256(password).toString();
  }
}

export class StringHelper {
  static slugify(text: string): string {
    if (!text) return "";
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-") // Replace spaces with -
      .replace(/[^\w\-]+/g, "") // Remove all non-word chars
      .replace(/\-\-+/g, "-") // Replace multiple - with single -
      .replace(/^-+/, "") // Trim - from start of text
      .replace(/-+$/, ""); // Trim - from end of text
  }

  static capitalizeFirst(str: string): string {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  static generateRandomId(prefix: string = "", length: number = 8): string {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = prefix;
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}

export class DateHelper {
  static isExpired(date: Date): boolean {
    return new Date() > date;
  }

  static addMinutes(date: Date, minutes: number): Date {
    return new Date(date.getTime() + minutes * 60000);
  }

  static addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  static formatAge(age: { value: number; unit: string }): string {
    if (!age || !age.value) return "";

    const { value, unit } = age;
    const unitStr = value === 1 ? unit.slice(0, -1) : unit;
    return `${value} ${unitStr} old`;
  }
}

export class ValidationHelper {
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static isValidPhone(phone: string): boolean {
    const phoneRegex = /^[0-9]{10}$/;
    return phoneRegex.test(phone);
  }

  static isValidPassword(password: string): boolean {
    // At least 6 characters, max 20
    return password.length >= 6 && password.length <= 20;
  }

  static sanitizeInput(input: string): string {
    return input.trim().replace(/[<>]/g, "");
  }
}

export class ResponseHelper {
  static success(
    data: any = null,
    message: string = "Success",
    meta: any = null
  ) {
    const response: any = {
      success: true,
      message,
      data,
    };

    if (meta) {
      response.meta = meta;
    }

    return response;
  }

  static error(message: string = "An error occurred", errors: any = null) {
    const response: any = {
      success: false,
      message,
    };

    if (errors) {
      response.errors = errors;
    }

    return response;
  }

  static paginated(
    data: any[],
    total: number,
    page: number,
    limit: number,
    message: string = "Success"
  ) {
    const totalPages = Math.ceil(total / limit);

    return {
      success: true,
      message,
      data,
      meta: {
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      },
    };
  }
}
