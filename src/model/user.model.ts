import mongoose, { Document, Model, Schema } from "mongoose";
import bcrypt from "bcrypt";

export interface IUser extends Document {
  firstname: string;
  lastname: string;
  email: string;
  password?: string;
  role: "user" | "admin" | "superadmin";
  status: "active" | "inactive" | "blocked";
  gender: "male" | "female" | "other";
  userpic: string;
  emailConfirm: boolean;
  emailConfirmToken?: string;
  emailConfirmExpires?: Date;
  sessionToken?: string;
  phone?: string;
  phoneNumber?: string;
  about?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  referralCode?: string;
  referredBy?: mongoose.Types.ObjectId;
  coins: number;
  ownedPets: mongoose.Types.ObjectId[];
  purchasedPets: mongoose.Types.ObjectId[];
  addresses: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
  // Instance methods
  comparePassword(candidatePassword: string): Promise<boolean>;
  generateReferralCode(): string;
}

export interface IUserMethods {
  comparePassword(candidatePassword: string): Promise<boolean>;
  generateReferralCode(): string;
}

export interface IUserModel extends Model<IUser, {}, IUserMethods> {
  findByEmail(email: string): Promise<IUser | null>;
  findActiveUsers(): Promise<IUser[]>;
}

const userSchema = new Schema<IUser, IUserModel, IUserMethods>(
  {
    firstname: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
    },
    lastname: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      lowercase: true,
    },
    password: {
      type: String,
      trim: true,
    },
    role: {
      type: String,
      enum: ["user", "admin", "superadmin"],
      default: "user",
    },
    status: {
      type: String,
      enum: ["active", "inactive", "blocked"],
      default: "inactive",
    },
    gender: {
      type: String,
      enum: ["male", "female", "other"],
      default: "other",
    },
    userpic: {
      type: String,
      default:
        "https://i.pinimg.com/564x/d8/2c/87/d82c87e21e84a3e7649d16c968105553.jpg",
    },
    emailConfirm: {
      type: Boolean,
      default: false,
    },
    emailConfirmToken: String,
    emailConfirmExpires: Date,
    sessionToken: String,
    phone: String,
    phoneNumber: String,
    about: String,
    address: String,
    city: String,
    state: String,
    zipCode: String,
    country: String,
    referralCode: {
      type: String,
      unique: true,
      sparse: true,
    },
    referredBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    coins: {
      type: Number,
      default: 0,
    },
    ownedPets: [
      {
        type: Schema.Types.ObjectId,
        ref: "Post",
      },
    ],
    purchasedPets: [
      {
        type: Schema.Types.ObjectId,
        ref: "Post",
      },
    ],
    addresses: [
      {
        type: Schema.Types.ObjectId,
        ref: "Address",
      },
    ],
  },
  { timestamps: true }
);

// Instance methods
userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.generateReferralCode = function (): string {
  return `${this.firstname.substring(0, 3).toUpperCase()}${Date.now()
    .toString()
    .slice(-6)}`;
};

// Static methods
userSchema.statics.findByEmail = function (email: string) {
  return this.findOne({ email: email.toLowerCase() });
};

userSchema.statics.findActiveUsers = function () {
  return this.find({ status: "active" });
};

// Pre-save hooks
userSchema.pre("save", async function (next) {
  if (this.isModified("addresses")) {
    const defaultAddr = await mongoose.model("Address").findOne({
      _id: { $in: this.addresses },
      isDefault: true,
    });
    if (defaultAddr) {
      // Handle default address logic here if needed
    }
  }
  next();
});

userSchema.pre("save", async function (next) {
  if (!this.isModified("password") || !this.password) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Create and export the model
const UserModel = mongoose.model<IUser, IUserModel>("User", userSchema);

export default UserModel;
