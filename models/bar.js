import mongoose from "mongoose";
import validator from "validator";

const barSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Le nom est requis'],
      trim: true,
      minlength: [3, 'Le nom doit contenir au moins 3 caractères'],
      maxlength: [100, 'Le nom ne doit pas dépasser 100 caractères']
    },
    description: {
      type: String,
      required: [true, 'La description est requise'],
      trim: true,
      minlength: [10, 'La description doit contenir au moins 10 caractères'],
      maxlength: [1000, 'La description ne doit pas dépasser 1000 caractères']
    },
    image_url: {
      type: String,
      required: [true, 'L\'URL de l\'image est requise'],
      validate: {
        validator: (v) => validator.isURL(v),
        message: 'L\'URL de l\'image n\'est pas valide'
      }
    },
    longitude: {
      type: Number,
      required: [true, 'La longitude est requise'],
      min: [-180, 'La longitude doit être comprise entre -180 et 180'],
      max: [180, 'La longitude doit être comprise entre -180 et 180']
    },
    latitude: {
      type: Number,
      required: [true, 'La latitude est requise'],
      min: [-90, 'La latitude doit être comprise entre -90 et 90'],
      max: [90, 'La latitude doit être comprise entre -90 et 90']
    },
    manager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, 'Le manager est requis']
    },
    cocktails: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Cocktail"
      }
    ]
  },
  { timestamps: true }
);

export default mongoose.model("Bar", barSchema);