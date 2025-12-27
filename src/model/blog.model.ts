import mongoose, { Document, Model, Schema } from "mongoose";
import slugify from "slugify";

export interface IBlog extends Document {
  title: string;
  content: object; // For Lexical editor state
  author: mongoose.Types.ObjectId;
  category: string;
  coverImage?: string;
  slug: string;
  status: "draft" | "published";
  createdAt: Date;
  updatedAt: Date;
}

const blogSchema = new Schema<IBlog>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    content: {
      type: Object,
      required: true,
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    coverImage: {
      type: String,
      trim: true,
    },
    slug: {
      type: String,
      unique: true,
    },
    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
    },
  },
  { timestamps: true }
);

// Pre-save hook to generate slug from title
blogSchema.pre<IBlog>("save", function (next) {
  if (this.isModified("title")) {
    this.slug = slugify(this.title, { lower: true, strict: true });
  }
  next();
});

const BlogModel = mongoose.model<IBlog>("Blog", blogSchema);

export default BlogModel;
