import mongoose from "mongoose";

const cocktailRecipeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    instructions: { type: String, required: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("CocktailRecipe", cocktailRecipeSchema);
//ingredient element a par, valeur de quantité