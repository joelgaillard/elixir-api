import express from 'express';
import CocktailRecipe from '../models/cocktailRecipe.js';
import { body, validationResult, query } from 'express-validator';
import verifyToken from '../middlewares/verifyToken.js';
import verifyRole from '../middlewares/verifyRole.js';

const router = express.Router();

/**
 * @api {post} /cocktails Ajouter une nouvelle recette de cocktail
 * @apiName AddCocktail
 * @apiGroup Cocktails
 * @apiPermission manager, admin
 *
 * @apiHeader {String} Authorization Token JWT de l'utilisateur.
 *
 * @apiBody {String} name Nom du cocktail.
 * @apiBody {String[]} ingredients Liste des ingrédients.
 * @apiBody {String} instructions Instructions pour préparer le cocktail.
 * @apiBody {String} alcoholType Type d'alcool (vodka, gin, whiskey, etc.).
 * @apiBody {Number} [rating] Note du cocktail (entre 1 et 5).
 *
 * @apiSuccess {String} message Message de succès.
 * @apiSuccess {Object} recipe Objet de la recette ajoutée.
 *
 * @apiError {String} message Message d'erreur.
 */

router.post('/',
  verifyToken,
  verifyRole('manager', 'admin'),
  [
    body('name').notEmpty().withMessage('Le nom du cocktail est obligatoire'),
    body('ingredients').isArray({ min: 1 }).withMessage('Au moins un ingrédient est requis'),
    body('instructions').notEmpty().withMessage('Les instructions sont obligatoires'),
    body('alcoholType').notEmpty().withMessage('Le type d\'alcool est requis'),
    body('rating').optional().isInt({ min: 1, max: 5 }).withMessage('La note doit être entre 1 et 5')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, ingredients, instructions, alcoholType, rating } = req.body;
    try {
      const recipe = new CocktailRecipe({
        name,
        ingredients,
        instructions,
        alcoholType,
        rating,
        createdBy: req.user.id
      });
      await recipe.save();
      res.status(201).json({ message: 'Recette ajoutée avec succès', recipe });
    } catch (err) {
      console.error('Erreur lors de l\'ajout de la recette:', err);
      res.status(500).json({ message: 'Erreur interne du serveur' });
    }
  }
);

/**
 * @api {get} /cocktails Lister les recettes de cocktails
 * @apiName GetCocktails
 * @apiGroup Cocktails
 *
 * @apiQuery {String} [alcoholType] Type d'alcool pour filtrer les recettes.
 * @apiQuery {String} [name] Nom du cocktail pour la recherche partielle.
 * @apiQuery {Number} [rating] Note de la recette pour filtrer.
 * @apiQuery {Number} [page=1] Numéro de la page pour la pagination.
 * @apiQuery {Number} [limit=10] Limite d'éléments par page.
 *
 * @apiSuccess {Object[]} recipes Liste des recettes.
 * @apiSuccess {Number} total Nombre total de recettes trouvées.
 * @apiSuccess {Number} page Page actuelle.
 * @apiSuccess {Number} totalPages Nombre total de pages.
 *
 * @apiError {String} message Message d'erreur.
 */
router.get('/', [
    query('alcoholType').optional().isString(),
    query('name').optional().isString(),
    query('rating').optional().isInt({ min: 1, max: 5 }),
    query('page').optional().isInt({ min: 1 }).withMessage('La page doit être supérieure ou égale à 1'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('La limite doit être entre 1 et 100')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { alcoholType, name, rating, page = 1, limit = 10 } = req.query;
    const filters = {};
    if (alcoholType) filters.alcoholType = alcoholType;
    if (name) filters.name = new RegExp(name, 'i'); // recherche partielle insensible à la casse
    if (rating) filters.rating = rating;

    try {
      const recipes = await CocktailRecipe.find(filters)
        .skip((page - 1) * limit)
        .limit(Number(limit));

      const total = await CocktailRecipe.countDocuments(filters);
      res.json({ recipes, total, page: Number(page), totalPages: Math.ceil(total / limit) });
    } catch (err) {
      console.error('Erreur lors de la récupération des recettes:', err);
      res.status(500).json({ message: 'Erreur interne du serveur' });
    }
  }
);

/**
 * @api {get} /cocktails/:id Consulter une recette de cocktail par ID
 * @apiName GetCocktailById
 * @apiGroup Cocktails
 *
 * @apiParam {String} id ID unique de la recette.
 *
 * @apiSuccess {Object} recipe Détails de la recette.
 *
 * @apiError {String} message Message d'erreur.
 */
router.get('/:id', async (req, res) => {
  try {
    const recipe = await CocktailRecipe.findById(req.params.id);
    if (!recipe) return res.status(404).json({ message: 'Recette non trouvée' });
    res.json(recipe);
  } catch (err) {
    console.error('Erreur lors de la récupération de la recette:', err);
    res.status(500).json({ message: 'Erreur interne du serveur' });
  }
});

/**
 * @api {put} /cocktails/:id Modifier une recette de cocktail
 * @apiName UpdateCocktail
 * @apiGroup Cocktails
 * @apiPermission user
 *
 * @apiHeader {String} Authorization Token JWT de l'utilisateur.
 *
 * @apiParam {String} id ID unique de la recette.
 *
 * @apiBody {String} [name] Nom du cocktail.
 * @apiBody {String[]} [ingredients] Liste des ingrédients.
 * @apiBody {String} [instructions] Instructions pour préparer le cocktail.
 * @apiBody {String} [alcoholType] Type d'alcool.
 * @apiBody {Number} [rating] Note du cocktail.
 *
 * @apiSuccess {String} message Message de succès.
 * @apiSuccess {Object} recipe Objet de la recette mise à jour.
 *
 * @apiError {String} message Message d'erreur.
 */
router.put('/:id',
  verifyToken,
  verifyRole('manager', 'admin'),
  [
    body('name').optional().notEmpty().withMessage('Le nom du cocktail est obligatoire'),
    body('ingredients').optional().isArray({ min: 1 }).withMessage('Au moins un ingrédient est requis'),
    body('instructions').optional().notEmpty().withMessage('Les instructions sont obligatoires'),
    body('alcoholType').optional().notEmpty().withMessage('Le type d\'alcool est requis'),
    body('rating').optional().isInt({ min: 1, max: 5 }).withMessage('La note doit être entre 1 et 5')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const recipe = await CocktailRecipe.findOneAndUpdate(
        { _id: req.params.id, createdBy: req.user.id },
        { ...req.body },
        { new: true }
      );
      if (!recipe) return res.status(404).json({ message: 'Recette non trouvée ou non autorisée' });
      res.json({ message: 'Recette modifiée avec succès', recipe });
    } catch (err) {
      console.error('Erreur lors de la mise à jour de la recette:', err);
      res.status(500).json({ message: 'Erreur interne du serveur' });
    }
  }
);

/**
 * @api {delete} /cocktails/:id Supprimer une recette de cocktail
 * @apiName DeleteCocktail
 * @apiGroup Cocktails
 * @apiPermission user
 *
 * @apiHeader {String} Authorization Token JWT de l'utilisateur.
 *
 * @apiParam {String} id ID unique de la recette.
 *
 * @apiSuccess {String} message Message de succès.
 *
 * @apiError {String} message Message d'erreur.
 */
router.delete('/:id', verifyToken, verifyRole('manager', 'admin'), async (req, res) => {
  try {
    const recipe = await CocktailRecipe.findOneAndDelete({ _id: req.params.id, createdBy: req.user.id });
    if (!recipe) return res.status(404).json({ message: 'Recette non trouvée ou non autorisée' });
    res.json({ message: 'Recette supprimée avec succès' });
  } catch (err) {
    console.error('Erreur lors de la suppression de la recette:', err);
    res.status(500).json({ message: 'Erreur interne du serveur' });
  }
});

export default router;
