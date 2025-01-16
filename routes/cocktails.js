import express from "express";
import Cocktail from "../models/cocktail.js";
import verifyRole from "../middlewares/verifyRole.js";
import verifyToken from "../middlewares/verifyToken.js";
import verifyCreator from "../middlewares/verifyCreator.js";
import { body, validationResult, param } from "express-validator";
import mongoose from "mongoose";

const router = express.Router();

/**
 * @api {get} /cocktails Obtenir une liste de cocktails
 * @apiName GetCocktails
 * @apiGroup Cocktails
 * @apiDescription Récupère une liste de cocktails avec des options de filtrage, tri et pagination.
 * La réponse inclut uniquement les informations essentielles pour chaque cocktail.
 *
 * @apiQuery {String} [name] Filtrer par nom de cocktail (recherche insensible à la casse).
 * @apiQuery {String} [ingredients] Filtrer par liste d'ingrédients (séparés par des virgules).
 * @apiQuery {String="name","rank","createdAt"} [sort="rank"] Tri des résultats par nom, popularité ou date de création.
 * @apiQuery {String="asc","desc"} [order="desc"] Ordre de tri (ascendant ou descendant).
 * @apiQuery {Number} [page=1] Numéro de la page (pour la pagination).
 *
 * @apiExample {curl} Exemple de requête :
 *    curl -X GET "https://elixir-api-st9s.onrender.com/api/cocktails?name=moji&ingredients=rhum,menthe&sort=rank&order=desc&page=1"
 *
 * @apiSuccess {Object[]} cocktails Liste des cocktails trouvés.
 * @apiSuccess {String} cocktails._id Identifiant unique du cocktail.
 * @apiSuccess {String} cocktails.name Nom du cocktail.
 * @apiSuccess {String} cocktails.image_url URL de l'image du cocktail.
 * @apiSuccess {Number} cocktails.rank Rang/popularité du cocktail.
 * @apiSuccess {Number} cocktails.ratingsCount Nombre total d'évaluations pour ce cocktail.
 *
 * @apiSuccess {Object} pagination Informations de pagination.
 * @apiSuccess {Number} pagination.page Numéro de la page actuelle.
 * @apiSuccess {Number} pagination.totalPages Nombre total de pages disponibles.
 * @apiSuccess {Number} pagination.totalItems Nombre total de cocktails correspondant.
 * @apiSuccess {Number} pagination.itemsPerPage Nombre de cocktails par page.
 *
 * @apiSuccessExample {json} Réponse en cas de succès :
 *     HTTP/1.1 200 OK
 *     Content-Type: application/json
 *     Link: <https://elixir-api-st9s.onrender.com/api/cocktails?name=a&ingredients=eau,sucre&sort=rank&order=desc&page=2>; rel="next"
 *
 *     {
 *       "cocktails": [
 *         {
 *           "_id": "6777aa843cd16a9da2b9fb5a",
 *           "name": "Margarita",
 *           "image_url": "https://example.com/image.jpg",
 *           "rank": 4.5,
 *           "ratingsCount": 3
 *         },
 *         {
 *           "_id": "6777a99ed6a0deaa1226e08a",
 *           "name": "Old Fashioned",
 *           "image_url": "https://images.immediate.co.uk/production/volatile/sites/30/2020/08/old-fashioned-5a4bab5.jpg",
 *           "rank": 0,
 *           "ratingsCount": 0
 *         }
 *       ],
 *       "pagination": {
 *         "page": 2,
 *         "totalPages": 3,
 *         "totalItems": 6,
 *         "itemsPerPage": 2
 *       }
 *     }
 */
router.get("/", async (req, res) => {
  try {
    const {
      name,
      ingredients,
      sort = "rank",
      order = "desc",
      page = 1,
    } = req.query;
    const limit = 12; 
    const skip = (page - 1) * limit;

    let query = {};

    if (name) {
      query.name = { $regex: name, $options: "i" };
    }

    if (ingredients) {
      const ingredientsArray = ingredients
        .split(",")
        .map((ing) => new RegExp(ing.trim(), "i"));
      query["ingredients.name"] = { $all: ingredientsArray };
    }

    const sortOption = {};
    const sortOrder = order === "asc" ? 1 : -1; 
    if (sort === "name") {
      sortOption.name = sortOrder;
    } else if (sort === "rank") {
      sortOption.rank = sortOrder;
    } else if (sort === "createdAt") {
      sortOption.createdAt = sortOrder;
    }

    const total = await Cocktail.countDocuments(query);

    const cocktails = await Cocktail.find(query)
      .select("name rank image_url ratings")
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .lean()
      .exec();

    const cocktailsWithRatingsCount = cocktails.map((cocktail) => ({
      ...cocktail,
      ratingsCount: cocktail.ratings ? cocktail.ratings.length : 0,
    }));

    res.status(200).json({
      cocktails: cocktailsWithRatingsCount.map(({ ratings, ...rest }) => rest),
      pagination: {
        page: parseInt(page, 10),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: limit,
      },
    });
  } catch (error) {
    res.status(500).json({ errors: [{ msg: error.message }] });
  }
});

/**
 * @api {get} /cocktails/:id Obtenir les détails d'un cocktail
 * @apiName GetCocktailById
 * @apiGroup Cocktails
 * @apiDescription Permet de récupérer les informations détaillées d'un cocktail spécifique par son ID.
 *
 * @apiParam {String} id Identifiant unique du cocktail.
 *
 * @apiExample {curl} Exemple de requête :
 *     curl -X GET "https://elixir-api-st9s.onrender.com/api/cocktails/12345abcd"
 *
 * @apiSuccess {String} _id Identifiant unique du cocktail.
 * @apiSuccess {String} name Nom du cocktail.
 * @apiSuccess {String} description Description du cocktail.
 * @apiSuccess {String[]} instructions Instructions de préparation du cocktail.
 * @apiSuccess {String} image_url URL de l'image du cocktail.
 * @apiSuccess {Object[]} ingredients Liste des ingrédients.
 * @apiSuccess {String} ingredients.name Nom de l'ingrédient.
 * @apiSuccess {Number} ingredients.quantity Quantité de l'ingrédient.
 * @apiSuccess {String} ingredients.unit Unité de mesure de l'ingrédient.
 * @apiSuccess {Number} rank Rang/popularité du cocktail.
 * @apiSuccess {Number} ratingsCount Nombre total d'évaluations pour ce cocktail.
 *
 *
 * @apiSuccessExample {json} Réponse en cas de succès :
 *     HTTP/1.1 200 OK
 *     Content-Type: application/json
 *
 *     {
 *       "_id": "12345abcd",
 *       "name": "Mojito",
 *       "description": "Un cocktail classique au rhum, menthe et citron vert.",
 *       "instructions": ["Écraser la menthe...", "Ajouter le rhum...", "Servir."],
 *       "image_url": "https://example.com/image.jpg",
 *       "ingredients": [
 *         { "name": "Rhum", "quantity": 50, "unit": "ml" },
 *         { "name": "Menthe", "quantity": 10, "unit": "feuilles" }
 *       ],
 *       "rank": 5,
 *       "ratingsCount": 2
 *     }
 *
 * @apiError (400) {Object[]} errors Liste des erreurs de validation.
 * @apiErrorExample {json} Erreur 400 (ID invalide) :
 *     HTTP/1.1 400 Bad Request
 *     Content-Type: application/json
 *
 *     {
 *       "errors": [
 *         { "msg": "ID de cocktail invalide", "param": "id" }
 *       ]
 *     }
 *
 * @apiError (404) {Object[]} errors Cocktail non trouvé.
 * @apiErrorExample {json} Erreur 404 (Cocktail non trouvé) :
 *     HTTP/1.1 404 Not Found
 *     Content-Type: application/json
 *
 *     {
 *       "errors": [
 *         { "msg": "Cocktail non trouvé", "param": "id" }
 *       ]
 *     }
 */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        errors: [{ msg: "ID de cocktail invalide", param: "id" }],
      });
    }

    const cocktail = await Cocktail.findById(id)
      .select(
        "name description instructions image_url ingredients rank ratings"
      ) 
      .lean()
      .exec();

    if (!cocktail) {
      return res.status(404).json({
        errors: [{ msg: "Cocktail non trouvé", param: "id" }],
      });
    }

    const { ratings, ...rest } = cocktail;
    const cocktailWithRatingsCount = {
      ...rest,
      ratingsCount: ratings ? ratings.length : 0,
    };

    res.status(200).json(cocktailWithRatingsCount);
  } catch (err) {
    res.status(500).json({
      errors: [{ msg: "Erreur interne du serveur" }],
    });
  }
});

/**
 * @api {post} /cocktails Créer un nouveau cocktail
 * @apiName CreateCocktail
 * @apiGroup Cocktails
 * @apiDescription Permet aux utilisateurs ayant les rôles `manager` ou `admin` de créer un nouveau cocktail.
 *
 * @apiHeader {String} Authorization Bearer <token>
 * @apiHeaderExample {json} Exemple d'en-tête :
 *
 *     {
 *       "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *     }
 *
 * @apiBody {String} name Nom du cocktail (3-100 caractères, obligatoire).
 * @apiBody {String} description Description du cocktail (10-1000 caractères, obligatoire).
 * @apiBody {String[]} instructions Liste des étapes de préparation (au moins une étape, obligatoire).
 * @apiBody {String} image_url URL valide de l'image du cocktail (obligatoire).
 * @apiBody {Object[]} ingredients Liste des ingrédients (au moins un ingrédient requis).
 * @apiBody {String} ingredients.name Nom de l'ingrédient (obligatoire).
 * @apiBody {Number} ingredients.quantity Quantité de l'ingrédient (doit être un nombre positif, obligatoire).
 * @apiBody {String} [ingredients.unit] Unité facultative de mesure (par exemple `ml`, `g`).
 *
 * @apiExample {json} Exemple de requête :
 *     POST /api/cocktails
 *     Content-Type: application/json
 *
 *     {
 *       "name": "Margarita",
 *       "description": "Un cocktail classique à base de tequila, de citron vert et de triple sec.",
 *       "instructions": ["Mélanger les ingrédients", "Servir dans un verre"],
 *       "image_url": "https://example.com/image.jpg",
 *       "ingredients": [
 *         { "name": "Tequila", "quantity": 50, "unit": "ml" },
 *         { "name": "Citron vert", "quantity": 25, "unit": "ml" }
 *       ]
 *     }
 *
 * @apiSuccess {String} message Message de succès.
 * @apiSuccess {Object} cocktail Détails du cocktail créé.
 * @apiSuccess {String} cocktail._id Identifiant unique du cocktail.
 * @apiSuccess {String} cocktail.name Nom du cocktail.
 * @apiSuccess {String} cocktail.description Description du cocktail.
 * @apiSuccess {String[]} cocktail.instructions Instructions de préparation.
 * @apiSuccess {String} cocktail.image_url URL de l'image.
 * @apiSuccess {Object[]} cocktail.ingredients Liste des ingrédients.
 * @apiSuccess {String} cocktail.ingredients.name Nom de l'ingrédient.
 * @apiSuccess {Number} cocktail.ingredients.quantity Quantité de l'ingrédient.
 * @apiSuccess {String} [cocktail.ingredients.unit] Unité de l'ingrédient.
 * @apiSuccess {Number} cocktail.rank Rang calculé (moyenne des évaluations).
 * @apiSuccess {String} cocktail.createdBy ID de l'utilisateur ayant créé le cocktail.
 * @apiSuccess {String} cocktail.createdAt Date de création du cocktail.
 * @apiSuccess {String} cocktail.updatedAt Date de mise à jour du cocktail.
 * @apiSuccess {Number} cocktail.__v Version du document.
 *
 * @apiSuccessExample {json} Réponse en cas de succès :
 *     HTTP/1.1 201 Created
 *     Content-Type: application/json
 *     Location: /api/cocktails/12345abcd
 *
 *     {
 *       "message": "Cocktail créé avec succès",
 *       "cocktail": {
 *         "_id": "12345abcd",
 *         "name": "Margarita",
 *         "description": "Un cocktail classique à base de tequila, de citron vert et de triple sec.",
 *         "instructions": ["Mélanger les ingrédients", "Servir dans un verre"],
 *         "image_url": "https://example.com/image.jpg",
 *         "ingredients": [
 *           { "name": "Tequila", "quantity": 50, "unit": "ml" },
 *           { "name": "Citron vert", "quantity": 25, "unit": "ml" }
 *         ],
 *         "rank": 0
 *         "createdBy": "12345abc"
 *         "createdAt": "2021-07-01T12:00:00.000Z",
 *         "updatedAt": "2021-07-01T12:00:00.000Z"
 *         "__v": 0
 *       }
 *     }
 *
 * @apiError (400) {Object[]} errors Liste des erreurs de validation des champs.
 * @apiErrorExample {json} Erreur 400 (erreurs de validation) :
 *     HTTP/1.1 400 Bad Request
 *     Content-Type: application/json
 *
 *     {
 *       "errors": [
 *         { "msg": "Le nom doit contenir entre 3 et 100 caractères", "field": "name" },
 *         { "msg": "La quantité de l'ingrédient doit être un nombre positif", "field": "ingredients.*.quantity" }
 *       ]
 *     }
 *
 * @apiError (401) {Object[]} errors Aucun token n'a été fourni.
 * @apiErrorExample {json} Erreur 401 (token absent) :
 *     HTTP/1.1 401 Unauthorized
 *     Content-Type: application/json
 *
 *     {
 *       "errors": [
 *         { "msg": "Accès refusé. Aucun token fourni." }
 *       ]
 *     }
 *
 * @apiError (403) {Object[]} errors Accès refusé en raison du rôle insuffisant ou d'un token invalide/expiré.
 * @apiErrorExample {json} Erreur 403 (rôle insuffisant) :
 *     HTTP/1.1 403 Forbidden
 *     Content-Type: application/json
 *
 *     {
 *       "errors": [
 *         { "msg": "Accès refusé, rôle insuffisant." }
 *       ]
 *     }
 * @apiErrorExample {json} Erreur 403 (token invalide ou expiré) :
 *     HTTP/1.1 403 Forbidden
 *     Content-Type: application/json
 *
 *     {
 *       "errors": [
 *         { "msg": "Token invalide ou expiré." }
 *       ]
 *     }
 */
router.post(
  "/",
  verifyToken,
  verifyRole("manager", "admin"),
  [
    body("name")
      .isLength({ min: 3, max: 100 })
      .withMessage("Le nom doit contenir entre 3 et 100 caractères"),
    body("description")
      .isLength({ min: 10, max: 1000 })
      .withMessage("La description doit contenir entre 10 et 1000 caractères"),
    body("instructions")
      .isArray({ min: 1 })
      .withMessage("Les instructions doivent contenir au moins une étape"),
    body("image_url").isURL().withMessage("L'URL de l'image n'est pas valide"),
    body("ingredients")
      .isArray({ min: 1 })
      .withMessage("Les ingrédients doivent contenir au moins un élément"),
    body("ingredients.*.name")
      .notEmpty()
      .withMessage("Le nom de l'ingrédient est obligatoire"),
    body("ingredients.*.quantity")
      .isFloat({ min: 0.1 })
      .withMessage("La quantité de l'ingrédient doit être un nombre positif"),
    body("ingredients.*.unit")
      .optional()
      .isString()
      .withMessage("L'unité doit être une chaîne de caractères"),
  ],

  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        errors: errors.array().map((err) => ({
          msg: err.msg,
          field: err.path,
        })),
      });
    }

    const { name, description, instructions, image_url, ingredients } =
      req.body;
    const createdBy = req.user.id;

    try {
      const cocktail = new Cocktail({
        name,
        description,
        instructions,
        image_url,
        ingredients,
        createdBy,
      });

      await cocktail.save();

      const orderedResponse = {
        _id: cocktail._id,
        name: cocktail.name,
        description: cocktail.description,
        instructions: cocktail.instructions,
        image_url: cocktail.image_url,
        ingredients: cocktail.ingredients,
        rank: cocktail.rank,
        createdBy: cocktail.createdBy,
        createdAt: cocktail.createdAt,
        updatedAt: cocktail.updatedAt,
        __v: cocktail.__v,
      };

      res.status(201).json({
        message: "Cocktail créé avec succès",
        cocktail: orderedResponse,
      });
    } catch (err) {
      res.status(500).json({
        errors: [{ msg: "Erreur interne du serveur" }],
      });
    }
  }
);

/**
 * @api {patch} /cocktails/:id Mettre à jour un cocktail
 * @apiName UpdateCocktail
 * @apiGroup Cocktails
 * @apiDescription Met à jour les informations d'un cocktail spécifique. Accessible uniquement aux utilisateurs ayant les rôles `manager` ou `admin`, et uniquement pour les cocktails qu'ils ont créés (sauf pour les administrateurs).
 *
 * @apiHeader {String} Authorization Bearer <token>
 * @apiHeaderExample {Header} Exemple d'en-tête :
 *     Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *
 * @apiParam {String} id ID unique du cocktail (doit être un ObjectId MongoDB valide).
 *
 * @apiBody {String} [name] Nom du cocktail (entre 3 et 100 caractères).
 * @apiBody {String} [description] Description du cocktail (entre 10 et 1000 caractères).
 * @apiBody {String[]} [instructions] Instructions de préparation (chaque étape doit être une chaîne non vide).
 * @apiBody {String} [image_url] URL de l'image (doit être valide).
 * @apiBody {Object[]} [ingredients] Liste des ingrédients.
 * @apiBody {String} ingredients.name Nom de l'ingrédient.
 * @apiBody {Number} ingredients.quantity Quantité de l'ingrédient (doit être un nombre positif).
 * @apiBody {String} [ingredients.unit] Unité optionnelle de l'ingrédient (par exemple `ml`, `g`).
 * @apiBody {Boolean} [replaceIngredients=false] Si vrai, remplace entièrement la liste des ingrédients existants. Sinon, ajoute les nouveaux ingrédients.
 *
 * @apiExample {json} Exemple de requête :
 *     PATCH /api/cocktails/12345abcd
 *     Content-Type: application/json
 *
 *     {
 *       "name": "Updated Margarita",
 *       "description": "Une version améliorée du classique.",
 *       "instructions": ["Mélanger les ingrédients", "Servir frais"],
 *       "image_url": "https://example.com/margarita.jpg",
 *       "ingredients": [
 *         { "name": "Tequila", "quantity": 50, "unit": "ml" },
 *         { "name": "Triple Sec", "quantity": 20, "unit": "ml" }
 *       ],
 *       "replaceIngredients": true
 *     }
 *
 * @apiSuccess {String} message Message confirmant la mise à jour réussie.
 * @apiSuccess {Object} cocktail Détails complets du cocktail mis à jour.
 * @apiSuccess {String} cocktail._id ID du cocktail.
 * @apiSuccess {String} cocktail.name Nom du cocktail.
 * @apiSuccess {String} cocktail.description Description du cocktail.
 * @apiSuccess {String[]} cocktail.instructions Instructions de préparation.
 * @apiSuccess {String} cocktail.image_url URL de l'image du cocktail.
 * @apiSuccess {Object[]} cocktail.ingredients Liste mise à jour des ingrédients.
 *
 * @apiSuccessExample {json} Réponse en cas de succès :
 *     HTTP/1.1 200 OK
 *     Content-Type: application/json
 *
 *     {
 *       "message": "Cocktail mis à jour avec succès",
 *       "cocktail": {
 *         "_id": "12345abcd",
 *         "name": "Updated Margarita",
 *         "description": "Une version améliorée du classique.",
 *         "instructions": ["Mélanger les ingrédients", "Servir frais"],
 *         "image_url": "https://example.com/margarita.jpg",
 *         "ingredients": [
 *           { "name": "Tequila", "quantity": 50, "unit": "ml" },
 *           { "name": "Triple Sec", "quantity": 20, "unit": "ml" }
 *         ],
 *         "rank": 0
 *         "createdBy": "12345abc"
 *         "createdAt": "2021-07-01T12:00:00.000Z",
 *         "updatedAt": "2021-07-01T12:00:00.000Z"
 *         "__v": 0
 *       }
 *     }
 *
 * @apiError (400) {Object[]} errors Liste des erreurs de validation ou ID invalide.
 * @apiErrorExample {json} Erreur 400 (ID ou données invalides) :
 *     HTTP/1.1 400 Bad Request
 *     Content-Type: application/json
 *
 *     {
 *       "errors": [
 *         { "msg": "ID de cocktail invalide", "param": "id" },
 *         { "msg": "Le nom du cocktail doit avoir entre 3 et 100 caractères", "field": "name" }
 *       ]
 *     }
 *
 * @apiError (404) {Object[]} errors Cocktail non trouvé.
 * @apiErrorExample {json} Erreur 404 (cocktail introuvable) :
 *     HTTP/1.1 404 Not Found
 *     Content-Type: application/json
 *
 *     {
 *       "errors": [
 *         { "msg": "Cocktail non trouvé", "param": "id" }
 *       ]
 *     }
 *
 * @apiError (401) {Object[]} errors Token non fourni ou invalide.
 * @apiErrorExample {json} Erreur 401 (token invalide ou absent) :
 *     HTTP/1.1 401 Unauthorized
 *     Content-Type: application/json
 *
 *     {
 *       "errors": [
 *         { "msg": "Accès refusé. Aucun token fourni." }
 *       ]
 *     }
 *
 * @apiError (403) {Object[]} errors Accès refusé (rôle insuffisant ou non créateur).
 * @apiErrorExample {json} Erreur 403 (rôle insuffisant) :
 *     HTTP/1.1 403 Forbidden
 *     Content-Type: application/json
 *
 *     {
 *       "errors": [
 *         { "msg": "Accès refusé, rôle insuffisant." }
 *       ]
 *     }
 */
router.patch(
  "/:id",
  verifyToken,
  verifyRole("manager", "admin"),
  verifyCreator("cocktail"),
  [
    body("name")
      .optional()
      .isLength({ min: 3, max: 100 })
      .withMessage("Le nom du cocktail doit avoir entre 3 et 100 caractères"),
    body("description")
      .optional()
      .isLength({ min: 10, max: 1000 })
      .withMessage("La description doit avoir entre 10 et 1000 caractères"),
    body("instructions")
      .optional()
      .isArray({ min: 1 })
      .withMessage(
        "Les instructions doivent être un tableau de chaînes de caractères"
      ),
    body("image_url")
      .optional()
      .isURL()
      .withMessage("L'URL de l'image n'est pas valide"),
    body("ingredients")
      .optional()
      .isArray({ min: 1 })
      .withMessage(
        "Les ingrédients doivent être un tableau contenant au moins un élément"
      ),
    body("ingredients.*.name")
      .optional({ checkFalsy: true })
      .notEmpty()
      .withMessage("Le nom de l'ingrédient est obligatoire"),
    body("ingredients.*.quantity")
      .optional({ checkFalsy: true })
      .isFloat({ min: 0.1 })
      .withMessage("La quantité de l'ingrédient doit être un nombre positif"),
    body("replaceIngredients")
      .optional()
      .isBoolean()
      .withMessage("Le paramètre replaceIngredients doit être un booléen"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          errors: errors.array().map((err) => ({
            msg: err.msg,
            field: err.param,
          })),
        });
      }

      const { id } = req.params;
      const cocktail = await Cocktail.findById(id);
      if (!cocktail) {
        return res.status(404).json({
          errors: [{ msg: "Cocktail non trouvé", param: "id" }],
        });
      }

      const {
        name,
        description,
        instructions,
        image_url,
        ingredients,
        replaceIngredients,
      } = req.body;

      if (name) cocktail.name = name;
      if (description) cocktail.description = description;
      if (instructions) cocktail.instructions = instructions;
      if (image_url) cocktail.image_url = image_url;

      if (ingredients) {
        if (replaceIngredients) {
          cocktail.ingredients = ingredients;
        } else {
          cocktail.ingredients.push(...ingredients);
        }
      }

      await cocktail.save();

      const orderedResponse = {
        _id: cocktail._id,
        name: cocktail.name,
        description: cocktail.description,
        instructions: cocktail.instructions,
        image_url: cocktail.image_url,
        ingredients: cocktail.ingredients,
        rank: cocktail.rank,
        createdBy: cocktail.createdBy,
        createdAt: cocktail.createdAt,
        updatedAt: cocktail.updatedAt,
        __v: cocktail.__v,
      };

      res.status(200).json({
        message: "Cocktail mis à jour avec succès",
        cocktail: orderedResponse,
      });
    } catch (err) {
      res.status(500).json({
        errors: [{ msg: "Erreur interne du serveur" }],
      });
    }
  }
);

/**
 * @api {delete} /cocktails/:id Supprimer un cocktail
 * @apiName DeleteCocktail
 * @apiGroup Cocktails
 * @apiDescription Supprime un cocktail spécifique. Accessible uniquement aux utilisateurs ayant les rôles `manager` ou `admin`. Les managers ne peuvent supprimer que leurs propres cocktails.
 *
 * @apiHeader {String} Authorization Bearer <token>
 * @apiHeaderExample {Header} Exemple d'en-tête :
 *     Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *
 * @apiParam {String} id ID unique du cocktail à supprimer (ObjectId MongoDB valide).
 *
 * @apiExample {curl} Exemple de requête :
 *     curl -X DELETE "https://api.example.com/api/cocktails/63cf9b1cfa8a3c0012345678" \
 *          -H "Authorization: Bearer <token>"
 *
 * @apiSuccess {String} message Message confirmant la suppression réussie.
 *
 * @apiSuccessExample {json} Réponse en cas de succès :
 *     HTTP/1.1 200 OK
 *     Content-Type: application/json
 *
 *     {
 *       "message": "Cocktail supprimé avec succès"
 *     }
 *
 * @apiError (400) {Object[]} errors Liste des erreurs de validation ou ID invalide.
 * @apiErrorExample {json} Erreur 400 (ID invalide) :
 *     HTTP/1.1 400 Bad Request
 *     Content-Type: application/json
 *
 *     {
 *       "errors": [
 *         { "msg": "ID de cocktail invalide.", "param": "id" }
 *       ]
 *     }
 *
 * @apiError (404) {Object[]} errors Cocktail non trouvé.
 * @apiErrorExample {json} Erreur 404 :
 *     HTTP/1.1 404 Not Found
 *     Content-Type: application/json
 *
 *     {
 *       "errors": [
 *         { "msg": "Cocktail non trouvé.", "param": "id" }
 *       ]
 *     }
 *
 * @apiError (401) {Object[]} errors Aucun token fourni ou invalide.
 * @apiErrorExample {json} Erreur 401 (token absent ou invalide) :
 *     HTTP/1.1 401 Unauthorized
 *     Content-Type: application/json
 *
 *     {
 *       "errors": [
 *         { "msg": "Accès refusé. Aucun token fourni." }
 *       ]
 *     }
 *
 * @apiError (403) {Object[]} errors Accès refusé (rôle insuffisant ou non créateur).
 * @apiErrorExample {json} Erreur 403 (rôle insuffisant) :
 *     HTTP/1.1 403 Forbidden
 *     Content-Type: application/json
 *
 *     {
 *       "errors": [
 *         { "msg": "Accès refusé, rôle insuffisant." }
 *       ]
 *     }
 *
 */
router.delete(
  "/:id",
  verifyToken,
  verifyRole("manager", "admin"),
  verifyCreator("cocktail"),
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          errors: [{ msg: "ID de cocktail invalide.", param: "id" }],
        });
      }

      const deletedCocktail = await Cocktail.findByIdAndDelete(id);
      if (!deletedCocktail) {
        return res.status(404).json({
          errors: [{ msg: "Cocktail non trouvé.", param: "id" }],
        });
      }

      res.status(200).json({ message: "Cocktail supprimé avec succès." });
    } catch (err) {
      res.status(500).json({
        errors: [{ msg: "Erreur interne du serveur." }],
      });
    }
  }
);

/**
 * @api {put} /cocktails/:id/ratings Noter un cocktail
 * @apiName RateCocktail
 * @apiGroup Cocktails
 * @apiDescription Permet à un utilisateur authentifié de noter un cocktail spécifique sur une échelle de 1 à 5.
 *
 * @apiHeader {String} Authorization Bearer <token>
 * @apiHeaderExample {Header} Exemple d'en-tête :
 *     {
 *       "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *     }
 *
 * @apiParam {String} id ID unique du cocktail à noter (ObjectId MongoDB valide).
 *
 * @apiBody {Number} rating Note entre 1 et 5.
 *
 * @apiExample {json} Exemple de requête :
 *     PUT /api/cocktails/63cf9b1cfa8a3c0012345678/ratings
 *     Content-Type: application/json
 *
 *     { "rating": 4 }
 *
 * @apiSuccess {String} message Message confirmant l'ajout ou la mise à jour de la note.
 *
 * @apiSuccessExample {json} Réponse en cas de succès :
 *     HTTP/1.1 200 OK
 *     Content-Type: application/json
 *
 *     {
 *       "message": "Note prise en compte avec succès.",
 *       "rating": 4
 *     }
 *
 * @apiError (400) {Object[]} errors Erreur de validation de l'ID ou de la note.
 * @apiErrorExample {json} Erreur 400 (ID ou note invalide) :
 *     HTTP/1.1 400 Bad Request
 *     Content-Type: application/json
 *
 *     {
 *       "errors": [
 *         { "msg": "ID de cocktail invalide.", "param": "id" },
 *         { "msg": "La note doit être un nombre entre 1 et 5.", "param": "rating" }
 *       ]
 *     }
 *
 * @apiError (401) {Object[]} errors Aucun token fourni ou invalide.
 * @apiErrorExample {json} Erreur 401 (token absent ou invalide) :
 *     HTTP/1.1 401 Unauthorized
 *     Content-Type: application/json
 *
 *     {
 *       "errors": [
 *         { "msg": "Accès refusé. Aucun token fourni." }
 *       ]
 *     }
 *
 * @apiError (403) {Object[]} errors Token invalide ou expiré.
 * @apiErrorExample {json} Erreur 403 (token invalide ou expiré) :
 *     HTTP/1.1 403 Forbidden
 *     Content-Type: application/json
 *
 *     {
 *       "errors": [
 *         { "msg": "Token invalide ou expiré." }
 *       ]
 *     }
 *
 * @apiError (404) {Object[]} errors Cocktail non trouvé.
 * @apiErrorExample {json} Erreur 404 (Cocktail non trouvé) :
 *     HTTP/1.1 404 Not Found
 *     Content-Type: application/json
 *
 *     {
 *       "errors": [
 *         { "msg": "Cocktail non trouvé.", "param": "id" }
 *       ]
 *     }
 */
router.put("/:id/ratings", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { rating } = req.body;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        errors: [{ msg: "ID de cocktail invalide.", param: "id" }],
      });
    }

    if (!rating || typeof rating !== "number" || rating < 1 || rating > 5) {
      return res.status(400).json({
        errors: [
          { msg: "La note doit être un nombre entre 1 et 5.", param: "rating" },
        ],
      });
    }

    const cocktail = await Cocktail.findById(id);
    if (!cocktail) {
      return res.status(404).json({
        errors: [{ msg: "Cocktail non trouvé.", param: "id" }],
      });
    }

    const existingRating = cocktail.ratings.find(
      (r) => r.user.toString() === userId
    );
    if (existingRating) {
      existingRating.rating = rating;
    } else {
      cocktail.ratings.push({ user: userId, rating });
    }

    cocktail.calculateRank();

    await cocktail.save();

    res
      .status(200)
      .json({ message: "Note prise en compte avec succès.", rating: rating });
  } catch (err) {
    res.status(500).json({
      errors: [{ msg: "Erreur interne du serveur." }],
    });
  }
});

export default router;
