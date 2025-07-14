import mongoose, { Document, Model, Schema } from "mongoose";

export interface ISpecies extends Document {
  name: string;
  displayName: string;
  description: string;
  icon: string;
  active: boolean;
  popularity: number;
  createdAt: Date;
}

export interface ISpeciesModel extends Model<ISpecies> {
  findByName(name: string): Promise<ISpecies | null>;
  findActive(): Promise<ISpecies[]>;
  incrementPopularity(speciesId: string): Promise<ISpecies | null>;
}

const speciesSchema = new Schema<ISpecies, ISpeciesModel>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    icon: {
      type: String,
      default: "",
    },
    active: {
      type: Boolean,
      default: true,
    },
    popularity: {
      type: Number,
      default: 0,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Static methods
speciesSchema.statics.findByName = function (name: string) {
  return this.findOne({ name: name.toLowerCase() });
};

speciesSchema.statics.findActive = function () {
  return this.find({ active: true }).sort({ popularity: -1, displayName: 1 });
};

speciesSchema.statics.incrementPopularity = function (speciesId: string) {
  return this.findByIdAndUpdate(
    speciesId,
    { $inc: { popularity: 1 } },
    { new: true }
  );
};

// Indexes
speciesSchema.index({ name: 1 });
speciesSchema.index({ active: 1 });
speciesSchema.index({ popularity: -1 });

const SpeciesModel = mongoose.model<ISpecies, ISpeciesModel>(
  "Species",
  speciesSchema
);

export default SpeciesModel;
