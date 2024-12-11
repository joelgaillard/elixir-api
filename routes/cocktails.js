import express from "express";
import Cocktail from "../models/cocktail.js";
import verifyRole from "../middlewares/verifyRole.js";
import verifyToken from "../middlewares/verifyToken.js";
import verifyCreator from "../middlewares/verifyCreator.js";
import { body, validationResult } from 'express-validator';
import mongoose from 'mongoose';


const router = express.Router();

/**
 * @api {get} /cocktails Liste tous les cocktails
 * @apiName GetCocktails
 * @apiGroup Cocktails
 * 
 * @apiQuery {String} [name] Filtrer par nom
 * @apiQuery {String} [ingredient] Filtrer par ingrédient
 * @apiQuery {String} [sort=rank] Trier par (name, rank)
 *
 * @apiSuccess {Object[]} cocktails Liste des cocktails
 * @apiSuccess {String} cocktails._id Identifiant unique
 * @apiSuccess {String} cocktails.name Nom du cocktail
 * @apiSuccess {String} cocktails.description Description du cocktail
 * @apiSuccess {String[]} cocktails.instructions Liste des étapes de préparation
 * @apiSuccess {String} cocktails.image_url URL de l'image
 * @apiSuccess {Object[]} cocktails.ingredients Liste des ingrédients
 * @apiSuccess {Number} cocktails.rank Note moyenne
 * 
 * @apiSuccessExample {json} Success-Response:
 *     HTTP/1.1 200 OK
 *     [{
 *       "_id": "64e6f2f01ab9c8e1a42c3f01",
 *       "name": "Mojito",
 *       "description": "Cocktail cubain rafraîchissant",
 *       "instructions": ["Écraser les feuilles de menthe...", "Ajouter le rhum..."],
 *       "image_url": "https://example.com/mojito.jpg",
 *       "ingredients": [
 *         {
 *           "ingredient": "Rhum blanc",
 *           "quantity": 50,
 *           "unit": "ml"
 *         }
 *       ],
 *       "rank": 4.5
 *     }]
 */
router.get('/', async (req, res) => {
  try {
    const { name, ingredient, sort = 'rank', page = 1 } = req.query;
    const limit = 5;
    const skip = (page - 1) * limit;
    let query = {};

    // Filtrer par nom (recherche insensible à la casse)
    if (name) {
      query.name = { $regex: name, $options: 'i' };
    }

    // Filtrer par ingrédient
    if (ingredient) {
      query['ingredients.name'] = { $regex: ingredient, $options: 'i' };
    }

    // Définir l'ordre de tri
    const sortOption = {};
    if (sort === 'name') {
      sortOption.name = 1;
    } else if (sort === 'rank') {
      sortOption.rank = -1;
    }

    // Compter le nombre total de cocktails pour la pagination
    const total = await Cocktail.countDocuments(query);
    
    // Récupérer les cocktails paginés
    const cocktails = await Cocktail.find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .exec();

    res.json({
      cocktails,
      pagination: {
        page: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: limit
      }
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * @api {get} /cocktails/:id Récupère un cocktail
 * @apiName GetCocktail
 * @apiGroup Cocktails
 *
 * @apiParam {String} id Identifiant unique du cocktail
 *
 * @apiSuccess {String} _id Identifiant unique
 * @apiSuccess {String} name Nom du cocktail
 * @apiSuccess {String} description Description du cocktail
 * @apiSuccess {String[]} instructions Liste des étapes de préparation
 * @apiSuccess {String} image_url URL de l'image
 * @apiSuccess {Object[]} ingredients Liste des ingrédients
 * @apiSuccess {Number} rank Note moyenne
 *
 * @apiError (404) {String} message Cocktail non trouvé
 * 
 * @apiErrorExample {json} Error-Response:
 *     HTTP/1.1 404 Not Found
 *     {
 *       "message": "Cocktail non trouvé"
 *     }
 */
router.get("/:id", async (req, res) => {
  try {
    const cocktail = await Cocktail.findById(req.params.id)
    .select("name description instructions image_url ingredients rank")
          .exec();

    if (!cocktail) {
      return res.status(404).json({ message: "Cocktail non trouvé" });
    }
    res.status(200).json(cocktail);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @api {post} /cocktails Créer un cocktail
 * @apiName CreateCocktail
 * @apiGroup Cocktails
 * 
 * @apiPermission admin, manager
 * 
 * @apiHeader {String} Authorization Token JWT (Bearer token)
 *
 * @apiBody {String} name Nom du cocktail (3-100 caractères)
 * @apiBody {String} description Description du cocktail (10-500 caractères)
 * @apiBody {String[]} instructions Liste des étapes de préparation
 * @apiBody {String} image_url URL de l'image
 * @apiBody {Object[]} ingredients Liste des ingrédients
 * @apiBody {String} ingredients.ingredient Nom de l'ingrédient
 * @apiBody {Number} ingredients.quantity Quantité de l'ingrédient
 * @apiBody {String} [ingredients.unit] Unité de mesure (optionnelle)
 *
 * @apiSuccess {String} _id Identifiant unique
 * @apiSuccess {String} name Nom du cocktail
 * @apiSuccess {String} description Description du cocktail
 * @apiSuccess {String[]} instructions Liste des étapes de préparation
 * @apiSuccess {String} image_url URL de l'image
 * @apiSuccess {Object[]} ingredients Liste des ingrédients
 * @apiSuccess {String} createdBy ID du créateur
 * @apiSuccess {Date} createdAt Date de création
 *
 * @apiError (400) {Object[]} errors Liste des erreurs de validation
 * @apiError (401) {String} message Token manquant ou invalide
 * @apiError (403) {String} message Rôle insuffisant (manager ou admin requis)
 *
 * @apiSuccessExample {json} Success-Response:
 *     HTTP/1.1 201 Created
 *     {
 *       "_id": "64e6f2f01ab9c8e1a42c3f01",
 *       "name": "Mojito",
 *       "description": "Cocktail cubain rafraîchissant",
 *       "instructions": ["Écraser les feuilles de menthe...", "Ajouter le rhum..."],
 *       "image_url": "https://example.com/mojito.jpg",
 *       "ingredients": [
 *         {
 *           "ingredient": "Rhum blanc",
 *           "quantity": 50,
 *           "unit": "ml"
 *         }
 *       ],
 *       "createdBy": "64e6f2f01ab9c8e1a42c3f00",
 *       "createdAt": "2024-03-14T12:00:00.000Z"
 *     }
 *
 * @apiErrorExample {json} Error-Response:
 *     HTTP/1.1 400 Bad Request
 *     {
 *       "errors": [{
 *         "msg": "Le nom du cocktail est obligatoire",
 *         "param": "name",
 *         "location": "body"
 *       }]
 *     }
 */
router.post(
  '/',
  verifyToken,
  verifyRole('manager', 'admin'),
  [
    body('name')
      .isLength({ min: 3, max: 100 })
      .withMessage('Le nom doit contenir entre 3 et 100 caractères'),
    body('description')
      .isLength({ min: 10, max: 1000 })
      .withMessage('La description doit contenir entre 10 et 1000 caractères'),
    body('instructions')
      .isArray({ min: 1 })
      .withMessage('Les instructions doivent contenir au moins une étape'),
    body('image_url')
      .isURL()
      .withMessage('L\'URL de l\'image n\'est pas valide'),
    body('ingredients')
      .isArray({ min: 1 })
      .withMessage('Les ingrédients doivent contenir au moins un élément'),
    body('ingredients.*.name')
      .notEmpty()
      .withMessage('Le nom de l\'ingrédient est obligatoire'),
    body('ingredients.*.quantity')
      .notEmpty()
      .withMessage('La quantité de l\'ingrédient est obligatoire')
  ],

  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, instructions, image_url, ingredients } = req.body;
    const createdBy = req.user.id;

    try {
      const newCocktail = new Cocktail({
        name,
        description,
        instructions,
        image_url,
        ingredients,
        createdBy
      });

      await newCocktail.save();
      res.status(201).json(newCocktail);
    } catch (err) {
      console.error('Erreur lors de la création du cocktail:', err);
      res.status(500).json({ message: 'Erreur interne du serveur' });
    }
  }
);

/**
 * @api {patch} /cocktails/:id Modifier un cocktail
 * @apiName UpdateCocktail
 * @apiGroup Cocktails
 * @apiPermission admin, manager (créateur du cocktail uniquement)
 *
 * @apiHeader {String} Authorization Token JWT (Bearer token)
 * 
 * @apiParam {String} id Identifiant unique du cocktail
 *
 * @apiBody {String} [name] Nom du cocktail (3-100 caractères)
 * @apiBody {String} [description] Description du cocktail (10-500 caractères)
 * @apiBody {String[]} [instructions] Liste des étapes de préparation
 * @apiBody {String} [image_url] URL de l'image
 * @apiBody {Object[]} [ingredients] Liste des ingrédients
 * @apiBody {Boolean} [replaceIngredients] Remplacer (true) ou ajouter (false) les ingrédients
 *
 * @apiSuccess {String} _id Identifiant unique
 * @apiSuccess {String} name Nom du cocktail
 * @apiSuccess {String} description Description du cocktail
 * @apiSuccess {String[]} instructions Liste des étapes de préparation
 * @apiSuccess {String} image_url URL de l'image
 * @apiSuccess {Object[]} ingredients Liste des ingrédients mise à jour
 *
 * @apiError (400) {Object[]} errors Liste des erreurs de validation
 * @apiError (401) {String} message Token manquant ou invalide
 * @apiError (403) {String} message Accès refusé (créateur ou admin uniquement)
 * @apiError (404) {String} message Cocktail non trouvé
 *
 * @apiErrorExample {json} Error-Response:
 *     HTTP/1.1 403 Forbidden
 *     {
 *       "message": "Accès refusé : vous n'êtes pas le créateur de ce cocktail"
 *     }
 */
router.patch(
  '/:id',
  verifyToken, // Middleware pour vérifier le token JWT
  verifyRole('manager', 'admin'), // Middleware pour vérifier le rôle de l'utilisateur
  verifyCreator('cocktail'), // Middleware pour vérifier le créateur du cocktail
  [
    body('name').optional().isLength({ min: 3, max: 100 }).withMessage('Le nom du cocktail doit avoir entre 3 et 100 caractères'),
    body('description').optional().isLength({ min: 10, max: 500 }).withMessage('La description doit avoir entre 10 et 500 caractères'),
    body('instructions').optional().isArray({ min: 1 }).withMessage('Les instructions doivent être un tableau de chaînes de caractères'),
    body('image_url').optional().isURL().withMessage('URL de l\'image invalide'),
    body('ingredients').optional().isArray({ min: 1 }).withMessage('Les ingrédients doivent être un tableau contenant au moins un élément'),
    body('ingredients.*.ingredient').optional().notEmpty().withMessage('Le nom de l\'ingrédient est obligatoire'),
    body('ingredients.*.quantity').optional().notEmpty().withMessage('La quantité de l\'ingrédient est obligatoire'),
    body('replaceIngredients').optional().isBoolean().withMessage('Le paramètre replaceIngredients doit être un booléen')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const updateData = {};
    const { name, description, instructions, image_url, ingredients, replaceIngredients } = req.body;

    if (name) updateData.name = name;
    if (description) updateData.description = description;
    if (instructions) updateData.instructions = instructions;
    if (image_url) updateData.image_url = image_url;

    try {
      const cocktail = await Cocktail.findById(req.params.id);
      if (!cocktail) {
        return res.status(404).json({ message: "Cocktail non trouvé" });
      }

      if (ingredients) {
        if (!!replaceIngredients) {
          cocktail.ingredients = ingredients; // Remplacer le tableau d'ingrédients
        } else {
          cocktail.ingredients.push(...ingredients); // Ajouter les nouveaux ingrédients au tableau existant
        }
      }

      Object.assign(cocktail, updateData);

      await cocktail.save();

      res.status(200).json(cocktail);
    } catch (err) {
      console.error('Erreur lors de la mise à jour du cocktail:', err);
      res.status(500).json({ message: 'Erreur interne du serveur' });
    }
  }
);


/**
 * @api {delete} /cocktails/:id Supprimer un cocktail
 * @apiName DeleteCocktail
 * @apiGroup Cocktails
 *
 * @apiHeader {String} Authorization Token JWT (Bearer token)
 * 
 * @apiParam {String} id Identifiant unique du cocktail
 *
 * @apiSuccess {String} message Message de confirmation
 *
 * @apiError (401) {String} message Token manquant ou invalide
 * @apiError (403) {String} message Accès refusé (créateur ou admin uniquement)
 * @apiError (404) {String} message Cocktail non trouvé
 *
 * @apiSuccessExample {json} Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *       "message": "Cocktail supprimé avec succès"
 *     }
 */
router.delete("/:id",
  verifyToken, // Middleware pour vérifier le token JWT
  verifyRole('manager', 'admin'), // Middleware pour vérifier le rôle de l'utilisateur
  verifyCreator('cocktail'), // Middleware pour vérifier le créateur du cocktail
 async (req, res) => {
  try {
    const deletedCocktail = await Cocktail.findByIdAndDelete(req.params.id);

    if (!deletedCocktail) {
      return res.status(404).json({ message: "Cocktail non trouvé" });
    }
    res.status(200).json({ message: "Cocktail supprimé avec succès" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @api {post} /cocktails/:id/rate Noter un cocktail
 * @apiName RateCocktail
 * @apiGroup Cocktails
 * @apiDescription Permet de noter un cocktail par son ID.
 *
 * @apiParam {String} id ID unique du cocktail.
 * @apiBody {Number} rating Note du cocktail (1-5).
 *
 * @apiSuccess {String} message "Note ajoutée avec succès".
 * @apiSuccess {Object} cocktail Détails du cocktail noté.
 *
 * @apiSuccessExample {json} Réponse en cas de succès :
 *     HTTP/1.1 200 OK
 *     {
 *       "message": "Note ajoutée avec succès",
 *       "cocktail": {
 *         "_id": "60c72b2f9b1d8c001c8e4b8a",
 *         "name": "Mojito",
 *         "rank": 4.5,
 *         // autres champs du cocktail
 *       }
 *     }
 */
router.post('/:id/rate', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { rating } = req.body;
    const userId = req.user.id; // Assurez-vous que l'ID de l'utilisateur est disponible dans req.user

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'ID de cocktail invalide.' });
    }

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'La note doit être un nombre entre 1 et 5.' });
    }

    const cocktail = await Cocktail.findById(id);
    if (!cocktail) {
      return res.status(404).json({ message: 'Cocktail non trouvé.' });
    }

    // Vérifier si l'utilisateur a déjà noté ce cocktail
    const existingRatingIndex = cocktail.ratings.findIndex(r => r.user.toString() === userId);
    if (existingRatingIndex !== -1) {
      // Remplacer la note existante
      cocktail.ratings[existingRatingIndex].rating = rating;
    } else {
      // Ajouter une nouvelle note
      const newRating = {
        user: userId,
        rating
      };
      cocktail.ratings.push(newRating);
    }

    // Recalculer le rang
    cocktail.calculateRank();

    // Sauvegarder le cocktail mis à jour
    await cocktail.save();

    res.status(200).json({ message: 'Note ajoutée avec succès', cocktail });
  } catch (err) {
    console.error('Erreur lors de la notation du cocktail:', err);
    res.status(500).json({ message: 'Erreur interne du serveur' });
  }
});


export default router;