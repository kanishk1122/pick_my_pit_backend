import mongoose, { Document, Model } from 'mongoose';

interface IAddress extends Document {
  userId: mongoose.Types.ObjectId;
  street: string;
  city: string;
  state: string;
  latitude?: number;
  longitude?: number;
  landmark?: string;
  postalCode: string;
  country: string;
  isDefault?: boolean;
}

const addressSchema = new mongoose.Schema<IAddress>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    street: {
      type: String,
      required: true,
    },
    city: {
      type: String,
      required: true,
    },
    state: {
      type: String,
      required: true,
    },
    latitude: {
      type: Number,
    },
    longitude: {
      type: Number,
    },
    landmark: {
      type: String,
    },
    postalCode: {
      type: String,
      required: true,
      validate: {
        validator(v:string) {
          return /^\d{6}$/.test(v);
        },
        message(props) {
          return `${props.value} is not a valid postal code!`;
        },
      },
    },
    country: {
      type: String,
      required: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

addressSchema.pre<IAddress>("save", async function (next) {
  if (this.isModified("isDefault") && this.isDefault) {
    await (this.constructor as Model<IAddress>).updateMany(
      {
        userId:this.userId,
        _id:{ $ne:this._id},
       }, 
       { isDefault:false }
     );
   }
   next();
});

const AddressModel : Model<IAddress> = mongoose.model<IAddress>("Address", addressSchema);

export default AddressModel;