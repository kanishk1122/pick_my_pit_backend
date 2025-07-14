import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IAge {
  value: number;
  unit: "days" | "weeks" | "months" | "years";
}

export interface IPost extends Document {
  _id: Types.ObjectId;
  owner: Types.ObjectId;
  images: any[];
  title: string;
  slug: string;
  discription: string;
  date: Date;
  amount: number;
  type: "free" | "paid";
  category: string;
  species: string;
  speciesSlug: string;
  breedSlug: string;
  address: Types.ObjectId;
  age?: IAge;
  status: "available" | "sold" | "adopted" | "pending";
  createdAt: Date;
  updatedAt: Date;
  formattedAge: string;
}

export interface IPostMethods {
  updateStatus(
    newStatus: "available" | "sold" | "adopted" | "pending"
  ): Promise<IPost>;
}

export interface IPostModel extends Model<IPost, {}, IPostMethods> {
  findBySlug(slug: string): Promise<(IPost & Document) | null>;
  findAvailable(): Promise<(IPost & Document)[]>;
  findBySpecies(species: string): Promise<(IPost & Document)[]>;
  formatAge(age: IAge): string;
}

function slugify(text: string): string {
  if (!text) return "";
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

const PostSchema = new Schema<IPost, IPostModel, IPostMethods>(
  {
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
    images: { type: [Schema.Types.Mixed], default: [] },
    title: { type: String, required: true },
    slug: { type: String, index: true },
    discription: String,
    date: { type: Date, default: Date.now },
    amount: { type: Number, default: 0 },
    type: { type: String, enum: ["free", "paid"], default: "free" },
    category: String,
    species: String,
    speciesSlug: { type: String, lowercase: true },
    breedSlug: { type: String, lowercase: true },
    address: { type: Schema.Types.ObjectId, ref: "Address" },
    age: {
      value: Number,
      unit: {
        type: String,
        enum: ["days", "weeks", "months", "years"],
        default: "months",
      },
    },
    status: {
      type: String,
      enum: ["available", "sold", "adopted", "pending"],
      default: "available",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

PostSchema.pre("save", function (next) {
  if (!(this as any).slug || (this as any).isModified("title")) {
    const baseSlug = slugify((this as any).title || "pet-post");
    const uniqueId = new Date().getTime().toString().slice(-6);
    (this as any).slug = `${baseSlug}-${uniqueId}`;
  }

  if ((this as any).species && !(this as any).speciesSlug) {
    (this as any).speciesSlug = slugify((this as any).species);
  }

  if ((this as any).category && !(this as any).breedSlug) {
    (this as any).breedSlug = slugify((this as any).category);
  }

  next();
});

PostSchema.virtual("formattedAge").get(function () {
  if (!(this  as any).age || !(this  as any).age.value) return "";
  const { value, unit } = (this  as any).age;
  const unitStr = value === 1 ? unit.slice(0, -1) : unit;
  return `${value} ${unitStr} old`;
});

PostSchema.index({ species: 1 });
PostSchema.index({ category: 1 });
PostSchema.index({ breedSlug: 1 });
PostSchema.index({ type: 1 });
PostSchema.index({ slug: 1 }, { unique: true });
PostSchema.index({ status: 1 });
PostSchema.index({ owner: 1 });
PostSchema.index({ amount: 1 });

PostSchema.statics.findBySlug = function (slug: string) {
  return this.findOne({ slug: slug.toLowerCase() })
    .populate("owner", "firstname lastname userpic")
    .populate("address");
};

PostSchema.statics.findAvailable = function () {
  return this.find({ status: "available" })
    .populate("owner", "firstname lastname userpic")
    .populate("address");
};

PostSchema.statics.findBySpecies = function (species: string) {
  return this.find({ speciesSlug: slugify(species) })
    .populate("owner", "firstname lastname userpic")
    .populate("address");
};

PostSchema.statics.formatAge = function (age: IAge): string {
  if (!age || !age.value) return "";
  const { value, unit } = age;
  const unitStr = value === 1 ? unit.slice(0, -1) : unit;
  return `${value} ${unitStr} old`;
};

PostSchema.methods.updateStatus = async function (
  newStatus: "available" | "sold" | "adopted" | "pending"
): Promise<IPost> {
  (this as any).status = newStatus;
  return (await this.save()) as any;
};

const PostModel = mongoose.model<IPost, IPostModel>("Post", PostSchema);

export default PostModel;
