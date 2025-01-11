import express from "express";
import Cocktail from "../models/cocktail.js";

const router = express.Router();

/**
 * @api {get} /ingredients Obtenir la liste des ingrédients
 * @apiName GetIngredients
 * @apiGroup Ingrédients
 * @apiDescription Récupère la liste de tous les ingrédients utilisés dans les cocktails
 *
 * @apiExample {curl} Exemple de requête :
 *     curl -X GET "https://elixir-api-st9s.onrender.com/api/ingredients" \
 *
 * @apiSuccess {String[]} ingredients Liste des noms d'ingrédients uniques
 *
 * @apiSuccessExample {json} Réponse en cas de succès:
 *     HTTP/1.1 200 OK
 *     Content-Type: application/json
 *
 *     [
 *       "Whisky",
 *       "Sucre",
 *       "Eau",
 *       "Rhum",
 *       "Menthe",
 *       "Citron vert",
 *       "Soda"
 *     ]
 */
router.get("/", async (req, res) => {
  try {
    const ingredients = await Cocktail.distinct("ingredients.name");
    res.status(200).json(ingredients);
  } catch (err) {
    console.error("Erreur lors de la récupération des ingrédients:", err);
    res.status(500).json({ message: "Erreur interne du serveur" });
  }
});

export default router;
