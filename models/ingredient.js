import mongoose from 'mongoose';

// Schéma pour les ingrédients
const ingredientSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true } // Optionnel, pour des informations supplémentaires
});

export default mongoose.model('Ingredient', ingredientSchema);