import express from "express";
import { body, validationResult, param } from "express-validator";
import verifyToken from "../middlewares/verifyToken.js";
import verifyRole from "../middlewares/verifyRole.js";
import verifyCreator from "../middlewares/verifyCreator.js";
import Bar from "../models/bar.js";
import Message from "../models/message.js";
import mongoose from "mongoose";

const router = express.Router();

/**
 * @api {get} /bars Obtenir une liste de bars
 * @apiName GetBars
 * @apiGroup Bars
 * @apiDescription Récupère une liste de bars avec des options de filtrage géospatiales et par cocktail.
 *
 * @apiQuery {Number} [lat] Latitude pour la recherche géospatiale.
 * @apiQuery {Number} [lng] Longitude pour la recherche géospatiale.
 * @apiQuery {Number} [radius=5000] Rayon de recherche en mètres (par défaut : 5000m).
 * @apiQuery {String} [cocktailId] ID d'un cocktail pour filtrer les bars qui le proposent.
 *
 * @apiExample {curl} Exemple de requête :
 *    curl -X GET "https://elixir-api-st9s.onrender.com/api/bars?lat=48.8566&lng=2.3522&radius=10000&cocktailId=64d2c4c4c4f5e52a0d2b9f5a"
 *
 * @apiSuccess {Object[]} bars Liste des bars correspondants.
 * @apiSuccess {String} bars._id Identifiant unique du bar.
 * @apiSuccess {String} bars.name Nom du bar.
 * @apiSuccess {String} bars.description Description du bar.
 * @apiSuccess {String} bars.image_url URL de l'image du bar.
 * @apiSuccess {Object} bars.location Localisation du bar.
 * @apiSuccess {String} bars.location.type Type de localisation (toujours "Point").
 * @apiSuccess {Number[]} bars.location.coordinates Coordonnées de localisation [longitude, latitude].
 *
 * @apiSuccessExample {json} Réponse en cas de succès :
 *     HTTP/1.1 200 OK
 *     [
 *       {
 *         "_id": "64d2c4c4c4f5e52a0d2b9f5a",
 *         "name": "Le Bar Moderne",
 *         "description": "Un bar branché pour les amateurs de cocktails.",
 *         "image_url": "https://example.com/images/bar.jpg",
 *         "location": {
 *           "type": "Point",
 *           "coordinates": [2.3522, 48.8566]
 *         }
 *       }
 *     ]
 *
 */
router.get("/", async (req, res) => {
  try {
    const { lat, lng, radius = 5000, cocktailId } = req.query;
    const query = {};

    if (lat && lng) {
      const latitude = parseFloat(lat);
      const longitude = parseFloat(lng);
      const radianRadius = radius / 6378100;

      query.location = {
        $geoWithin: {
          $centerSphere: [[longitude, latitude], radianRadius],
        },
      };
    }

    if (cocktailId) {
      if (!mongoose.Types.ObjectId.isValid(cocktailId)) {
        return res.status(400).json({
          errors: [
            {
              msg: "L'ID de cocktail fourni est invalide.",
              param: "cocktailId",
            },
          ],
        });
      }
      query.cocktails = mongoose.Types.ObjectId(cocktailId);
    }

    const bars = await Bar.find(query)
      .select("_id name description image_url location")
      .lean();

    res.status(200).json(bars);
  } catch (error) {
    res.status(500).json({ errors: [{ msg: "Erreur interne du serveur" }] });
  }
});

/**
 * @api {get} /bars/:id Obtenir les détails d'un bar
 * @apiName GetBarById
 * @apiGroup Bars
 * @apiDescription Permet de récupérer les informations détaillées d'un bar spécifique par son ID.
 *
 * @apiParam {String} id Identifiant unique du bar.
 *
 * @apiExample {curl} Exemple de requête :
 *     curl -X GET "https://elixir-api-st9s.onrender.com/api/bars/12345abcd"
 *
 * @apiSuccess {String} _id Identifiant unique du bar.
 * @apiSuccess {String} name Nom du bar.
 * @apiSuccess {String} description Description du bar.
 * @apiSuccess {String} image_url URL de l'image du bar.
 * @apiSuccess {Object} location Localisation du bar.
 * @apiSuccess {String} location.type Type de localisation (toujours "Point").
 * @apiSuccess {Number[]} location.coordinates Coordonnées de localisation [longitude, latitude].
 * @apiSuccess {String[]} cocktails Liste des IDs de cocktails disponibles dans ce bar.
 *
 * @apiSuccessExample {json} Réponse en cas de succès :
 *     HTTP/1.1 200 OK
 *     Content-Type: application/json
 *
 *     {
 *       "_id": "64d2c4c4c4f5e52a0d2b9f5a",
 *       "name": "Le Bar Moderne",
 *       "description": "Un bar branché pour les amateurs de cocktails.",
 *       "image_url": "https://example.com/images/bar.jpg",
 *       "cocktails": [
 *         "64d2c4c4c4f5e52a0d2b9f5b",
 *         "64d2c4c4c4f5e52a0d2b9f5c"
 *       ],
 *       "location": {
 *         "type": "Point",
 *         "coordinates": [2.3522, 48.8566]
 *       }
 *     }
 *
 * @apiError (400) {Object[]} errors Liste des erreurs de validation.
 * @apiErrorExample {json} Erreur 400 (ID invalide) :
 *     HTTP/1.1 400 Bad Request
 *     Content-Type: application/json
 *
 *     {
 *       "errors": [
 *         { "msg": "ID de bar invalide", "param": "id" }
 *       ]
 *     }
 *
 * @apiError (404) {Object[]} errors Bar non trouvé.
 * @apiErrorExample {json} Erreur 404 (Bar non trouvé) :
 *     HTTP/1.1 404 Not Found
 *     Content-Type: application/json
 *
 *     {
 *       "errors": [
 *         { "msg": "Bar non trouvé", "param": "id" }
 *       ]
 *     }
 */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        errors: [{ msg: "ID de bar invalide", param: "id" }],
      });
    }

    const bar = await Bar.findById(id)
      .select("name description image_url location cocktails") 
      .lean()
      .exec();

    if (!bar) {
      return res.status(404).json({
        errors: [{ msg: "Bar non trouvé", param: "id" }],
      });
    }

    res.status(200).json(bar);
  } catch (err) {
    console.error("Erreur lors de la récupération du bar :", err);
    res.status(500).json({
      errors: [{ msg: "Erreur interne du serveur" }],
    });
  }
});

/**
 * @api {post} /bars Créer un nouveau bar
 * @apiName CreateBar
 * @apiGroup Bars
 * @apiDescription Permet aux utilisateurs ayant les rôles manager ou admin de créer un nouveau bar.
 *
 * @apiHeader {String} Authorization Bearer <token>
 * @apiHeaderExample {json} Exemple d'en-tête :
 *
 *     {
 *       "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *     }
 *
 * @apiBody {String} name Nom du bar (3-100 caractères, obligatoire).
 * @apiBody {String} description Description du bar (10-1000 caractères, obligatoire).
 * @apiBody {String} image_url URL valide de l'image du bar (obligatoire).
 * @apiBody {Object} location Coordonnées géospatiales du bar (obligatoire).
 * @apiBody {String} location.type Type de l'objet géospatial (doit être "Point").
 * @apiBody {Number[]} location.coordinates Coordonnées [longitude, latitude] (obligatoire).
 *
 * @apiExample {json} Exemple de requête :
 *     POST /api/bars
 *     Content-Type: application/json
 *
 *     {
 *       "name": "Le Bar Sympa",
 *       "description": "Un bar sympa dans le quartier",
 *       "image_url": "http://example.com/bar.jpg",
 *       "location": {
 *         "type": "Point",
 *         "coordinates": [-73.856077, 40.848447]
 *       }
 *     }
 *
 * @apiSuccess {String} message Message de succès.
 * @apiSuccess {Object} bar Détails du bar créé.
 * @apiSuccess {String} bar._id Identifiant unique du bar.
 * @apiSuccess {String} bar.name Nom du bar.
 * @apiSuccess {String} bar.description Description du bar.
 * @apiSuccess {String} bar.image_url URL de l'image.
 * @apiSuccess {Object} bar.location Coordonnées géospatiales du bar.
 * @apiSuccess {String} bar.location.type Type géospatial.
 * @apiSuccess {Number[]} bar.location.coordinates Coordonnées géospatiales [longitude, latitude].
 * @apiSuccess {String} bar.manager ID du gestionnaire qui a créé le bar.
 * @apiSuccess {String} bar.createdAt Date de création du bar.
 * @apiSuccess {String} bar.updatedAt Date de mise à jour du bar.
 *
 * @apiSuccessExample {json} Réponse en cas de succès :
 *     HTTP/1.1 201 Created
 *     Content-Type: application/json
 *
 *     {
 *       "message": "Bar créé avec succès",
 *       "bar": {
 *         "name": "Le Bar Sympa",
 *         "description": "Un bar sympa dans le quartier",
 *         "image_url": "http://example.com/bar.jpg",
 *         "location": {
 *           "type": "Point",
 *           "coordinates": [-73.856077, 40.848447]
 *         },
 *         "manager": "67890efgh",
 *         "createdAt": "2025-01-03T12:00:00.000Z",
 *         "updatedAt": "2025-01-03T12:00:00.000Z",
 *         "_id": "12345abcd",
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
 *         { "msg": "Les coordonnées doivent être valides", "field": "location.coordinates" }
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
    body("image_url").isURL().withMessage("L'URL de l'image n'est pas valide"),
    body("location.type")
      .equals("Point")
      .withMessage('Le type de localisation doit être "Point"'),
    body("location.coordinates")
      .isArray({ min: 2, max: 2 })
      .withMessage(
        "Les coordonnées doivent être un tableau contenant exactement deux éléments"
      ),
    body("location.coordinates[0]")
      .isFloat({ min: -180, max: 180 })
      .withMessage("La longitude doit être comprise entre -180 et 180"),
    body("location.coordinates[1]")
      .isFloat({ min: -90, max: 90 })
      .withMessage("La latitude doit être comprise entre -90 et 90"),
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

    const { name, description, image_url, location } = req.body;
    const manager = req.user.id;

    try {
      const bar = new Bar({
        name,
        description,
        image_url,
        location,
        manager,
      });

      await bar.save();

      res.status(201).json({
        message: "Bar créé avec succès",
        bar,
      });
    } catch (err) {
      res.status(500).json({
        errors: [{ msg: "Erreur interne du serveur" }],
      });
    }
  }
);

/**
 * @api {patch} /bars/:id Mettre à jour un bar
 * @apiName PatchBar
 * @apiGroup Bars
 * @apiDescription Met à jour les informations d'un bar existant. Accessible uniquement aux managers et aux administrateurs.
 *
 * @apiHeader {String} Authorization Bearer <token>.
 *
 * @apiParam {String} id ID unique du bar à modifier (doit être un ObjectId MongoDB valide).
 *
 * @apiBody {String} [name] Nom du bar (3-100 caractères).
 * @apiBody {String} [description] Description du bar (10-1000 caractères).
 * @apiBody {String} [image_url] URL de l'image du bar.
 * @apiBody {Object} [location] Coordonnées géospatiales du bar.
 * @apiBody {String} location.type Type de l'objet géospatial (doit être "Point").
 * @apiBody {Number[]} location.coordinates Coordonnées [longitude, latitude].
 *
 * @apiExample {json} Exemple de requête :
 *     PATCH /bars/12345abcd
 *     Content-Type: application/json
 *
 *     {
 *       "name": "Le Bar Sympa",
 *       "description": "Un bar sympa revisité",
 *       "image_url": "http://example.com/bar-sympa.jpg",
 *       "location": {
 *         "type": "Point",
 *         "coordinates": [-73.856077, 40.848447]
 *       }
 *     }
 *
 * @apiSuccess {String} message Message confirmant la mise à jour réussie.
 * @apiSuccess {Object} bar Détails complets du bar mis à jour.
 * @apiSuccess {String} bar._id ID unique du bar.
 * @apiSuccess {String} bar.name Nom du bar.
 * @apiSuccess {String} bar.description Description du bar.
 * @apiSuccess {String} bar.image_url URL de l'image.
 * @apiSuccess {Object} bar.location Coordonnées géospatiales.
 * @apiSuccess {String} bar.location.type Type géospatial (Point).
 * @apiSuccess {Number[]} bar.location.coordinates Coordonnées géospatiales [longitude, latitude].
 * @apiSuccess {String} bar.manager ID de l'utilisateur ayant créé ou géré le bar.
 * @apiSuccess {String} bar.createdAt Date de création du bar.
 * @apiSuccess {String} bar.updatedAt Date de mise à jour du bar.
 *
 * @apiSuccessExample {json} Réponse en cas de succès :
 *     HTTP/1.1 200 OK
 *     Content-Type: application/json
 *
 *     {
 *       "message": "Bar mis à jour avec succès",
 *       "bar": {
 *         "name": "Le Bar Sympa",
 *         "description": "Un bar sympa revisité",
 *         "image_url": "http://example.com/bar-sympa.jpg",
 *         "location": {
 *           "type": "Point",
 *           "coordinates": [-73.856077, 40.848447]
 *         },
 *         "manager": "67890efgh",
 *         "createdAt": "2021-07-01T12:00:00.000Z",
 *         "updatedAt": "2021-07-02T12:00:00.000Z"
 *         "_id": "12345abcd",
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
 *         { "msg": "Le nom doit contenir entre 3 et 100 caractères", "field": "name" },
 *         { "msg": "Les coordonnées doivent être un tableau valide", "field": "location.coordinates" }
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
 *
 * @apiError (404) {Object[]} errors Bar non trouvé.
 * @apiErrorExample {json} Erreur 404 (bar non trouvé) :
 *     HTTP/1.1 404 Not Found
 *     Content-Type: application/json
 *
 *     {
 *       "errors": [
 *         { "msg": "Bar non trouvé", "param": "id" }
 *       ]
 *     }
 *
 */
router.patch(
  "/:id",
  verifyToken,
  verifyRole("manager", "admin"),
  verifyCreator("bar"),
  [
    body("name")
      .optional()
      .isLength({ min: 3, max: 100 })
      .withMessage("Le nom doit contenir entre 3 et 100 caractères"),
    body("description")
      .optional()
      .isLength({ min: 10, max: 1000 })
      .withMessage("La description doit contenir entre 10 et 1000 caractères"),
    body("image_url")
      .optional()
      .isURL()
      .withMessage("L'URL de l'image n'est pas valide"),
    body("location.type")
      .optional()
      .equals("Point")
      .withMessage('Le type de localisation doit être "Point"'),
    body("location.coordinates")
      .optional()
      .isArray({ min: 2, max: 2 })
      .withMessage("Les coordonnées doivent être un tableau de deux éléments"),
    body("location.coordinates[0]")
      .optional()
      .isFloat({ min: -180, max: 180 })
      .withMessage("La longitude doit être comprise entre -180 et 180"),
    body("location.coordinates[1]")
      .optional()
      .isFloat({ min: -90, max: 90 })
      .withMessage("La latitude doit être comprise entre -90 et 90"),
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
      const updatedData = req.body;

      const updatedBar = await Bar.findByIdAndUpdate(
        id,
        { $set: updatedData },
        { new: true, runValidators: true }
      );

      if (!updatedBar) {
        return res.status(404).json({
          errors: [{ msg: "Bar non trouvé", param: "id" }],
        });
      }

      res.status(200).json({
        message: "Bar mis à jour avec succès",
        bar: updatedBar,
      });
    } catch (err) {
      res.status(500).json({
        errors: [{ msg: "Erreur interne du serveur" }],
      });
    }
  }
);

/**
 * @api {delete} /bars/:id Supprimer un bar
 * @apiName DeleteBar
 * @apiGroup Bars
 * @apiDescription Supprime un bar spécifique. Accessible uniquement aux utilisateurs ayant les rôles `manager` ou `admin`. Les managers ne peuvent supprimer que leurs propres bars.
 *
 * @apiHeader {String} Authorization Bearer <token>
 * @apiHeaderExample {Header} Exemple d'en-tête :
 *     Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *
 * @apiParam {String} id ID unique du bar à supprimer (ObjectId MongoDB valide).
 *
 * @apiExample {curl} Exemple de requête :
 *     curl -X DELETE "https://api.example.com/api/bars/63cf9b1cfa8a3c0012345678" \
 *          -H "Authorization: Bearer <token>"
 *
 * @apiSuccess {String} message Message confirmant la suppression réussie.
 *
 * @apiSuccessExample {json} Réponse en cas de succès :
 *     HTTP/1.1 200 OK
 *     Content-Type: application/json
 *
 *     {
 *       "message": "Bar supprimé avec succès"
 *     }
 *
 * @apiError (400) {Object[]} errors Liste des erreurs de validation ou ID invalide.
 * @apiErrorExample {json} Erreur 400 (ID invalide) :
 *     HTTP/1.1 400 Bad Request
 *     Content-Type: application/json
 *
 *     {
 *       "errors": [
 *         { "msg": "ID de bar invalide.", "param": "id" }
 *       ]
 *     }
 *
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
 * @apiError (404) {Object[]} errors Bar non trouvé.
 * @apiErrorExample {json} Erreur 404 (Bar non trouvé) :
 *     HTTP/1.1 404 Not Found
 *     Content-Type: application/json
 *
 *     {
 *       "errors": [
 *         { "msg": "Bar non trouvé.", "param": "id" }
 *       ]
 *     }
 */
router.delete(
  "/:id",
  verifyToken,
  verifyRole("manager", "admin"),
  verifyCreator("bar"),
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          errors: [{ msg: "ID de bar invalide.", param: "id" }],
        });
      }

      const deletedBar = await Bar.findByIdAndDelete(id);
      if (!deletedBar) {
        return res.status(404).json({
          errors: [{ msg: "Bar non trouvé.", param: "id" }],
        });
      }

      res.status(200).json({ message: "Bar supprimé avec succès." });
    } catch (err) {
      res.status(500).json({
        errors: [{ msg: "Erreur interne du serveur." }],
      });
    }
  }
);

/**
 * @api {get} /bars/:id/messages Obtenir les messages d'un bar
 * @apiName GetBarMessages
 * @apiGroup Bars
 * @apiDescription Récupère les messages d'un bar spécifique par son ID. L'utilisateur doit se trouver à moins de 100 mètres du bar pour accéder aux messages.
 *
 * @apiHeader {String} Authorization Bearer <token>
 * @apiHeaderExample {Header} Exemple d'en-tête :
 *     Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *
 * @apiParam {String} id ID unique du bar (ObjectId MongoDB valide).
 * @apiQuery {Number} lat Latitude actuelle de l'utilisateur.
 * @apiQuery {Number} lng Longitude actuelle de l'utilisateur.
 *
 * @apiExample {curl} Exemple de requête :
 *     curl -X GET "https://api.example.com/bars/63cf9b1cfa8a3c0012345678/messages?lat=48.8566&lng=2.3522" \
 *          -H "Authorization: Bearer <token>"
 *
 * @apiSuccess {Object[]} messages Liste des messages du bar.
 * @apiSuccess {String} messages._id ID unique du message.
 * @apiSuccess {String} messages.barId ID unique du bar associé.
 * @apiSuccess {String} messages.userId ID de l'utilisateur ayant envoyé le message.
 * @apiSuccess {String} messages.username Nom d'utilisateur.
 * @apiSuccess {String} messages.content Contenu du message.
 * @apiSuccess {String} messages.timestamp Horodatage du message.
 *
 * @apiSuccessExample {json} Réponse en cas de succès :
 *     HTTP/1.1 200 OK
 *     Content-Type: application/json
 *     [
 *       {
 *         "_id": "12345abcd",
 *         "barId": "67890efgh",
 *         "userId": "13579wxyz",
 *         "username": "johndoe",
 *         "content": "Hello, world!",
 *         "timestamp": "2023-10-01T12:34:56.789Z"
 *       }
 *     ]
 *
 * @apiError (400) {Object[]} errors Liste des erreurs de validation ou de requête.
 * @apiErrorExample {json} Erreur 400 :
 *     HTTP/1.1 400 Bad Request
 *     Content-Type: application/json
 *     {
 *       "errors": [
 *         { "msg": "Latitude et longitude sont requises.", "param": "query" }
 *       ]
 *     }
 *
 * @apiError (403) {Object[]} errors Liste des erreurs d'autorisation.
 * @apiErrorExample {json} Erreur 403 :
 *     HTTP/1.1 403 Forbidden
 *     {
 *       "errors": [
 *         { "msg": "Vous devez être à moins de 100m du bar pour accéder aux messages.", "param": "distance.*" }
 *       ]
 *     }
 *
 * @apiError (404) {Object[]} errors Liste des erreurs liées à la ressource.
 * @apiError (404) {String} errors.*.msg Bar non trouvé.
 * @apiError (404) {String} errors.*.param Contexte de l'erreur (par exemple `id.*`).
 * @apiErrorExample {json} Erreur 404 :
 *     HTTP/1.1 404 Not Found
 *     {
 *       "errors": [
 *         { "msg": "Bar non trouvé.", "param": "id.*" }
 *       ]
 *     }
 */
router.get("/:id/messages", verifyToken, async (req, res) => {
  try {
    const { lat, lng } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        errors: [
          { msg: "Latitude et longitude sont requises.", param: "query" },
        ],
      });
    }

    const bar = await Bar.findById(req.params.id);
    if (!bar) {
      return res.status(404).json({
        errors: [{ msg: "Bar non trouvé.", param: "id" }],
      });
    }

    const distance = calculateDistance(
      { lat: parseFloat(lat), lng: parseFloat(lng) },
      { lat: bar.location.coordinates[1], lng: bar.location.coordinates[0] }
    );

    if (distance > 0.1) {
      return res.status(403).json({
        errors: [
          {
            msg: "Vous devez être à moins de 100m du bar pour accéder aux messages.",
            param: "distance",
          },
        ],
      });
    }

    const messages = await Message.find({ barId: req.params.id }).sort({
      timestamp: 1,
    });
    res.status(200).json(messages);
  } catch (error) {
    res.status(500).json({
      errors: [{ msg: "Erreur interne du serveur." }],
    });
  }
});

function calculateDistance(coord1, coord2) {
  const R = 6371;
  const dLat = (coord2.lat - coord1.lat) * (Math.PI / 180);
  const dLng = (coord2.lng - coord1.lng) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(coord1.lat * (Math.PI / 180)) *
      Math.cos(coord2.lat * (Math.PI / 180)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return distance;
}

export default router;
