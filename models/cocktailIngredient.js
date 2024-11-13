const cocktailIngredientSchema = new mongoose.Schema({
    cocktailId: { type: mongoose.Schema.Types.ObjectId, ref: 'CocktailRecipe', required: true },
    ingredientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ingredient', required: true },
    quantity: { type: String, required: true } // La quantité peut être en grammes, ml, ou autre unité
  });
  
  export default mongoose.model('CocktailIngredient', cocktailIngredientSchema);