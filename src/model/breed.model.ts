import mongoose, { Document, Model, Schema } from "mongoose";

export interface IBreed extends Document {
  name: string;
  species: mongoose.Types.ObjectId;
  speciesName: string;
  description: string;
  characteristics: string[];
  active: boolean;
  popularity: number;
  createdAt: Date;
}

export interface IBreedModel extends Model<IBreed> {
  findBySpecies(speciesId: string): Promise<IBreed[]>;
  findByName(name: string, speciesId?: string): Promise<IBreed | null>;
  findActiveBySpecies(speciesId: string): Promise<IBreed[]>;
  incrementPopularity(breedId: string): Promise<IBreed | null>;
}

const breedSchema = new Schema<IBreed, IBreedModel>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    species: {
      type: Schema.Types.ObjectId,
      ref: "Species",
      required: true,
    },
    speciesName: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    characteristics: [
      {
        type: String,
      },
    ],
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
breedSchema.statics.findBySpecies = function (speciesId: string) {
  return this.find({ species: speciesId }).populate("species");
};

breedSchema.statics.findByName = function (name: string, speciesId?: string) {
  const query: any = { name: name.toLowerCase() };
  if (speciesId) {
    query.species = speciesId;
  }
  return this.findOne(query).populate("species");
};

breedSchema.statics.findActiveBySpecies = function (speciesId: string) {
  return this.find({ species: speciesId, active: true })
    .populate("species")
    .sort({ popularity: -1, name: 1 });
};

breedSchema.statics.incrementPopularity = function (breedId: string) {
  return this.findByIdAndUpdate(
    breedId,
    { $inc: { popularity: 1 } },
    { new: true }
  ).populate("species");
};

// Create compound index for efficient querying
breedSchema.index({ species: 1, name: 1 }, { unique: true });
breedSchema.index({ active: 1 });
breedSchema.index({ popularity: -1 });

const BreedModel = mongoose.model<IBreed, IBreedModel>("Breed", breedSchema);

export default BreedModel;
