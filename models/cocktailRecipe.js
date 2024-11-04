import mongoose from 'mongoose';

const cocktailRecipeSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  ingredients: [{ type: String, required: true }],
  instructions: { type: String, required: true },
  alcoholType: { type: String, required: true, enum: ['vodka', 'gin', 'whiskey', 'rum', 'tequila', 'other'] },
  rating: { type: Number, min: 1, max: 5 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

export default mongoose.model('CocktailRecipe', cocktailRecipeSchema);
