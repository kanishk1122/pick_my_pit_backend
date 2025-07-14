import mongoose, { Document, Model, Schema } from "mongoose";
import bcrypt from "bcrypt";

export interface IAdmin extends Document {
  firstname: string;
  lastname: string;
  email: string;
  password: string;
  role: "admin" | "superadmin";
  status: "active" | "inactive";
  gender?: "male" | "female" | "other";
  emailConfirm: boolean;
  sessionToken?: string;
  userpic: string;
  createdAt: Date;
  updatedAt: Date;
  // Instance methods
  comparePassword(candidatePassword: string): Promise<boolean>;
  generateSessionToken(): string;
}

export interface IAdminMethods {
  comparePassword(candidatePassword: string): Promise<boolean>;
  generateSessionToken(): string;
}

export interface IAdminModel extends Model<IAdmin, {}, IAdminMethods> {
  findByEmail(email: string): Promise<IAdmin | null>;
  findActiveAdmins(): Promise<IAdmin[]>;
  findSuperAdmins(): Promise<IAdmin[]>;
}

const adminSchema = new Schema<IAdmin, IAdminModel, IAdminMethods>(
  {
    firstname: {
      type: String,
      required: true,
      trim: true,
    },
    lastname: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["admin", "superadmin"],
      default: "admin",
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    gender: {
      type: String,
      enum: ["male", "female", "other"],
    },
    emailConfirm: {
      type: Boolean,
      default: true,
    },
    sessionToken: String,
    userpic: {
      type: String,
      default:
        "https://i.pinimg.com/564x/d8/2c/87/d82c87e21e84a3e7649d16c968105553.jpg",
    },
  },
  { timestamps: true }
);

// Instance methods
adminSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

adminSchema.methods.generateSessionToken = function (): string {
  return `admin_${this._id}_${Date.now()}`;
};

// Static methods
adminSchema.statics.findByEmail = function (email: string) {
  return this.findOne({ email: email.toLowerCase() });
};

adminSchema.statics.findActiveAdmins = function () {
  return this.find({ status: "active" });
};

adminSchema.statics.findSuperAdmins = function () {
  return this.find({ role: "superadmin", status: "active" });
};

// Pre-save hooks
adminSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Indexes
adminSchema.index({ email: 1 });
adminSchema.index({ status: 1 });
adminSchema.index({ role: 1 });

const AdminModel = mongoose.model<IAdmin, IAdminModel>("Admin", adminSchema);

export default AdminModel;
