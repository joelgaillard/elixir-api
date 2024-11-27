import mongoose from 'mongoose';
import validator from 'validator';

const ingredientSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  quantity: { type: String, required: true, trim: true }
}, { _id: false });

const ratingSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, trim: true }
}, { _id: false });

const cocktailSchema = new mongoose.Schema(
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
    instructions: {
      type: [String],
      required: [true, 'Les instructions sont requises'],
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: 'Les instructions doivent contenir au moins une étape'
      }
    },
    image_url: {
      type: String,
      required: [true, 'L\'URL de l\'image est requise'],
      validate: {
        validator: (v) => validator.isURL(v),
        message: 'L\'URL de l\'image n\'est pas valide'
      }
    },
    ingredients: {
      type: [ingredientSchema],
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: 'Les ingrédients doivent contenir au moins un élément'
      }
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    ratings: {
      type: [ratingSchema],
      validate: {
        validator: (v) => Array.isArray(v),
        message: 'Les évaluations doivent être un tableau'
      }
    },
    rank: {
      type: Number,
      default: 0,
      min: [0, 'Le rang ne peut pas être inférieur à 0'],
      max: [5, 'Le rang ne peut pas être supérieur à 5']
    }
  },
  { timestamps: true }
);

cocktailSchema.methods.calculateRank = function () {
  if (this.ratings.length === 0) {
    this.rank = 0;
  } else {
    const sum = this.ratings.reduce((acc, rating) => acc + rating.rating, 0);
    this.rank = sum / this.ratings.length;
  }
};

export default mongoose.model('Cocktail', cocktailSchema);