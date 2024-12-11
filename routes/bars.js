import express from 'express';
import { body, validationResult } from 'express-validator';
import verifyToken from '../middlewares/verifyToken.js';
import verifyRole from '../middlewares/verifyRole.js';
import verifyCreator from '../middlewares/verifyCreator.js';
import Bar from '../models/bar.js';

const router = express.Router();

/**
 * @api {get} /bars Liste tous les bars
 * @apiName GetBars
 * @apiGroup Bars
 * 
 * @apiQuery {Number} [lat] Latitude pour la recherche géospatiale
 * @apiQuery {Number} [lng] Longitude pour la recherche géospatiale
 * @apiQuery {Number} [radius=5000] Rayon de recherche en mètres
 *
 * @apiSuccess {Object[]} bars Liste des bars
 * @apiSuccess {String} bars._id Identifiant unique
 * @apiSuccess {String} bars.name Nom du bar
 * @apiSuccess {String} bars.description Description du bar
 * @apiSuccess {String} bars.image_url URL de l'image
 * @apiSuccess {Object} bars.location Localisation du bar
 * @apiSuccess {String} bars.location.type Type de la localisation (Point)
 * @apiSuccess {Number[]} bars.location.coordinates Coordonnées de la localisation [longitude, latitude]
 * @apiSuccess {Object} bars.manager Informations du manager
 * @apiSuccess {String} bars.manager._id Identifiant unique du manager
 * @apiSuccess {String} bars.manager.username Nom d'utilisateur du manager
 * @apiSuccess {String} bars.manager.email Email du manager
 * @apiSuccess {String} bars.manager.role Rôle du manager
 * 
 * @apiSuccessExample {json} Réponse en cas de succès :
 *     HTTP/1.1 200 OK
 *     [
 *       {
 *         "_id": "12345abcd",
 *         "name": "Le Bar Sympa",
 *         "description": "Un bar sympa",
 *         "image_url": "http://example.com/image.jpg",
 *         "location": {
 *           "type": "Point",
 *           "coordinates": [-73.856077, 40.848447]
 *         },
 *         "manager": {
 *           "_id": "67890efgh",
 *           "username": "manager1",
 *           "email": "manager1@example.com",
 *           "role": "manager"
 *         }
 *       }
 *     ]
 *
 * @apiError (500) {String} message Erreur interne du serveur.
 */
router.get('/', async (req, res) => {
  try {
    const { lat, lng, radius = 100 } = req.query;
    let query = {};

    // Filtrer par localisation si les paramètres sont fournis
    if (lat && lng) {
      query.location = {
        $geoWithin: {
          $centerSphere: [
            [parseFloat(lng), parseFloat(lat)],
            radius / 6378100 // Convertir le rayon en radians (la Terre a un rayon moyen de 6378100 mètres)
          ]
        }
      };
    }

    const bars = await Bar.find(query).populate('manager', 'username email role');
    res.json(bars);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * @api {get} /bars/:id Obtenir un bar spécifique
 * @apiName GetBar
 * @apiGroup Bars
 * @apiDescription Récupère les détails d'un bar spécifique par son ID.
 *
 * @apiParam {String} id ID du bar à récupérer.
 *
 * @apiSuccess {Object} bar Informations détaillées du bar.
 *
 * @apiSuccessExample {json} Réponse en cas de succès :
 *     HTTP/1.1 200 OK
 *     {
 *       "_id": "12345abcd",
 *       "name": "Le Bar Sympa",
 *       "description": "Un bar sympa",
 *       "image_url": "http://example.com/image.jpg",
 *       "location": {
 *         "type": "Point",
 *         "coordinates": [-73.856077, 40.848447]
 *       },
 *       "manager": {
 *         "_id": "67890efgh",
 *         "username": "manager1",
 *         "email": "manager1@example.com",
 *         "role": "manager"
 *       }
 *     }
 *
 * @apiError (404) {String} message Bar non trouvé.
 * @apiError (500) {String} message Erreur interne du serveur.
 */
router.get('/:id', async (req, res) => {
  try {
    const bar = await Bar.findById(req.params.id).populate('manager', 'username email role');
    if (!bar) {
      return res.status(404).json({ message: 'Bar non trouvé' });
    }
    res.json(bar);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * @api {post} /bars Créer un nouveau bar
 * @apiName CreateBar
 * @apiGroup Bars
 * @apiDescription Crée un nouveau bar. Accessible uniquement aux managers et aux administrateurs.
 *
 * @apiHeader {String} Authorization Bearer <token>.
 *
 * @apiBody {String} name Nom du bar (3-100 caractères).
 * @apiBody {String} description Description du bar (10-1000 caractères).
 * @apiBody {String} image_url URL de l'image du bar.
 * @apiBody {Object} location Coordonnées géospatiales du bar.
 * @apiBody {String} location.type Type de l'objet géospatial (doit être "Point").
 * @apiBody {Number[]} location.coordinates Coordonnées [longitude, latitude].
 *
 * @apiExample {json} Exemple de requête :
 *     {
 *       "name": "Le Bar Sympa",
 *       "description": "Un bar sympa",
 *       "image_url": "http://example.com/image.jpg",
 *       "location": {
 *         "type": "Point",
 *         "coordinates": [-73.856077, 40.848447]
 *       }
 *     }
 *
 * @apiSuccess {Object} bar Bar créé.
 *
 * @apiSuccessExample {json} Réponse en cas de succès :
 *     HTTP/1.1 201 Created
 *     {
 *       "_id": "12345abcd",
 *       "name": "Le Bar Sympa",
 *       "description": "Un bar sympa",
 *       "image_url": "http://example.com/image.jpg",
 *       "location": {
 *         "type": "Point",
 *         "coordinates": [-73.856077, 40.848447]
 *       },
 *       "manager": "67890efgh"
 *     }
 *
 * @apiError (400) {String} message Erreur de validation.
 * @apiError (500) {String} message Erreur interne du serveur.
 */
router.post(
  '/',
  verifyToken,
  verifyRole('manager', 'admin'),
  [
    body('name').isLength({ min: 3, max: 100 }).withMessage('Le nom doit contenir entre 3 et 100 caractères'),
    body('description').isLength({ min: 10, max: 1000 }).withMessage('La description doit contenir entre 10 et 1000 caractères'),
    body('image_url').isURL().withMessage('L\'URL de l\'image n\'est pas valide'),
    body('location.type').equals('Point').withMessage('Le type de localisation doit être "Point"'),
    body('location.coordinates').isArray({ min: 2, max: 3 }).withMessage('Les coordonnées doivent être un tableau de 2 ou 3 éléments'),
    body('location.coordinates[0]').isFloat({ min: -180, max: 180 }).withMessage('La longitude doit être comprise entre -180 et 180'),
    body('location.coordinates[1]').isFloat({ min: -90, max: 90 }).withMessage('La latitude doit être comprise entre -90 et 90')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, image_url, location } = req.body;
    const bar = new Bar({
      name,
      description,
      image_url,
      location: {
        type: 'Point',
        coordinates: location.coordinates
      },
      manager: req.user.id
    });
    try {
      await bar.save();
      res.status(201).json(bar);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
);

/**
 * @api {put} /bars/:id Modifier complètement un bar
 * @apiName UpdateBar
 * @apiGroup Bars
 * @apiDescription Modifie complètement un bar existant. Accessible uniquement aux managers et aux administrateurs.
 *
 * @apiHeader {String} Authorization Bearer <token>.
 *
 * @apiParam {String} id ID du bar à modifier.
 *
 * @apiBody {String} name Nom du bar (3-100 caractères).
 * @apiBody {String} description Description du bar (10-1000 caractères).
 * @apiBody {String} image_url URL de l'image du bar.
 * @apiBody {Object} location Coordonnées géospatiales du bar.
 * @apiBody {String} location.type Type de l'objet géospatial (doit être "Point").
 * @apiBody {Number[]} location.coordinates Coordonnées [longitude, latitude].
 *
 * @apiExample {json} Exemple de requête :
 *     {
 *       "name": "Le Bar Sympa",
 *       "description": "Un bar sympa",
 *       "image_url": "http://example.com/image.jpg",
 *       "location": {
 *         "type": "Point",
 *         "coordinates": [-73.856077, 40.848447]
 *       }
 *     }
 *
 * @apiSuccess {Object} bar Bar modifié.
 *
 * @apiSuccessExample {json} Réponse en cas de succès :
 *     HTTP/1.1 200 OK
 *     {
 *       "_id": "12345abcd",
 *       "name": "Le Bar Sympa",
 *       "description": "Un bar sympa",
 *       "image_url": "http://example.com/image.jpg",
 *       "location": {
 *         "type": "Point",
 *         "coordinates": [-73.856077, 40.848447]
 *       },
 *       "manager": "67890efgh"
 *     }
 *
 * @apiError (400) {String} message Erreur de validation.
 * @apiError (404) {String} message Bar non trouvé.
 * @apiError (500) {String} message Erreur interne du serveur.
 */
router.put(
  '/:id',
  verifyToken,
  verifyCreator('bar'),
  [
    body('name').isLength({ min: 3, max: 100 }).withMessage('Le nom doit contenir entre 3 et 100 caractères'),
    body('description').isLength({ min: 10, max: 1000 }).withMessage('La description doit contenir entre 10 et 1000 caractères'),
    body('image_url').isURL().withMessage('L\'URL de l\'image n\'est pas valide'),
    body('location.type').equals('Point').withMessage('Le type de localisation doit être "Point"'),
    body('location.coordinates').isArray({ min: 2, max: 3 }).withMessage('Les coordonnées doivent être un tableau de 2 ou 3 éléments'),
    body('location.coordinates[0]').isFloat({ min: -180, max: 180 }).withMessage('La longitude doit être comprise entre -180 et 180'),
    body('location.coordinates[1]').isFloat({ min: -90, max: 90 }).withMessage('La latitude doit être comprise entre -90 et 90')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, image_url, location } = req.body;
    try {
      const updatedBar = await Bar.findByIdAndUpdate(
        req.params.id,
        {
          name,
          description,
          image_url,
          location: {
            type: 'Point',
            coordinates: location.coordinates
          }
        },
        { new: true, runValidators: true }
      );
      if (!updatedBar) {
        return res.status(404).json({ message: 'Bar non trouvé' });
      }
      res.json(updatedBar);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
);

/**
 * @api {patch} /bars/:id Modifier partiellement un bar
 * @apiName PatchBar
 * @apiGroup Bars
 * @apiDescription Modifie partiellement un bar existant. Accessible uniquement aux managers et aux administrateurs.
 *
 * @apiHeader {String} Authorization Bearer <token>.
 *
 * @apiParam {String} id ID du bar à modifier.
 *
 * @apiBody {String} [name] Nom du bar (3-100 caractères).
 * @apiBody {String} [description] Description du bar (10-1000 caractères).
 * @apiBody {String} [image_url] URL de l'image du bar.
 * @apiBody {Object} [location] Coordonnées géospatiales du bar.
 * @apiBody {String} [location.type] Type de l'objet géospatial (doit être "Point").
 * @apiBody {Number[]} [location.coordinates] Coordonnées [longitude, latitude].
 *
 * @apiExample {json} Exemple de requête :
 *     {
 *       "name": "Le Bar Sympa",
 *       "description": "Un bar sympa",
 *       "image_url": "http://example.com/image.jpg",
 *       "location": {
 *         "type": "Point",
 *         "coordinates": [-73.856077, 40.848447]
 *       }
 *     }
 *
 * @apiSuccess {Object} bar Bar modifié.
 *
 * @apiSuccessExample {json} Réponse en cas de succès :
 *     HTTP/1.1 200 OK
 *     {
 *       "_id": "12345abcd",
 *       "name": "Le Bar Sympa",
 *       "description": "Un bar sympa",
 *       "image_url": "http://example.com/image.jpg",
 *       "location": {
 *         "type": "Point",
 *         "coordinates": [-73.856077, 40.848447]
 *       },
 *       "manager": "67890efgh"
 *     }
 *
 * @apiError (400) {String} message Erreur de validation.
 * @apiError (404) {String} message Bar non trouvé.
 * @apiError (500) {String} message Erreur interne du serveur.
 */
router.patch(
  '/:id',
  verifyToken,
  verifyCreator('bar'),
  [
    body('name').optional().isLength({ min: 3, max: 100 }).withMessage('Le nom doit contenir entre 3 et 100 caractères'),
    body('description').optional().isLength({ min: 10, max: 1000 }).withMessage('La description doit contenir entre 10 et 1000 caractères'),
    body('image_url').optional().isURL().withMessage('L\'URL de l\'image n\'est pas valide'),
    body('location.type').optional().equals('Point').withMessage('Le type de localisation doit être "Point"'),
    body('location.coordinates').optional().isArray({ min: 2, max: 3 }).withMessage('Les coordonnées doivent être un tableau de 2 ou 3 éléments'),
    body('location.coordinates[0]').optional().isFloat({ min: -180, max: 180 }).withMessage('La longitude doit être comprise entre -180 et 180'),
    body('location.coordinates[1]').optional().isFloat({ min: -90, max: 90 }).withMessage('La latitude doit être comprise entre -90 et 90')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, image_url, location } = req.body;
    const updatedFields = {};
    if (name !== undefined) updatedFields.name = name;
    if (description !== undefined) updatedFields.description = description;
    if (image_url !== undefined) updatedFields.image_url = image_url;
    if (location !== undefined) {
      updatedFields.location = {
        type: 'Point',
        coordinates: location.coordinates
      };
    }
    try {
      const updatedBar = await Bar.findByIdAndUpdate(
        req.params.id,
        updatedFields,
        { new: true, runValidators: true }
      );
      if (!updatedBar) {
        return res.status(404).json({ message: 'Bar non trouvé' });
      }
      res.json(updatedBar);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
);

/**
 * @api {delete} /bars/:id Supprimer un bar
 * @apiName DeleteBar
 * @apiGroup Bars
 * @apiDescription Supprime un bar existant. Accessible uniquement aux managers et aux administrateurs.
 *
 * @apiHeader {String} Authorization Bearer <token>.
 *
 * @apiParam {String} id ID du bar à supprimer.
 *
 * @apiSuccess {String} message Confirmation de la suppression du bar.
 *
 * @apiSuccessExample {json} Réponse en cas de succès :
 *     HTTP/1.1 200 OK
 *     {
 *       "message": "Bar supprimé avec succès"
 *     }
 *
 * @apiError (404) {String} message Bar non trouvé.
import express from 'express';
import { body, validationResult } from 'express-validator';
import verifyToken from '../middlewares/verifyToken.js';
import verifyRole from '../middlewares/verifyRole.js';
import verifyCreator from '../middlewares/verifyCreator.js';
import Bar from '../models/bar.js';

const router = express.Router();

/**
 * @api {get} /bars Obtenir tous les bars
 * @apiName GetBars
 * @apiGroup Bars
 * @apiDescription Récupère la liste de tous les bars.
 *
 * @apiSuccess {Object[]} bars Liste des bars.
 *
 * @apiSuccessExample {json} Réponse en cas de succès :
 *     HTTP/1.1 200 OK
 *     [
 *       {
 *         "_id": "12345abcd",
 *         "name": "Le Bar Sympa",
 *         "description": "Un bar sympa",
 *         "image_url": "http://example.com/image.jpg",
 *         "location": {
 *           "type": "Point",
 *           "coordinates": [-73.856077, 40.848447]
 *         },
 *         "manager": {
 *           "_id": "67890efgh",
 *           "username": "manager1",
 *           "email": "manager1@example.com",
 *           "role": "manager"
 *         }
 *       }
 *     ]
 *
 * @apiError (500) {String} message Erreur interne du serveur.
 */
router.get('/', async (req, res) => {
  try {
    const bars = await Bar.find().populate('manager', 'username email role');
    res.json(bars);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * @api {get} /bars/:id Obtenir un bar spécifique
 * @apiName GetBar
 * @apiGroup Bars
 * @apiDescription Récupère les détails d'un bar spécifique par son ID.
 *
 * @apiParam {String} id ID du bar à récupérer.
 *
 * @apiSuccess {Object} bar Informations détaillées du bar.
 *
 * @apiSuccessExample {json} Réponse en cas de succès :
 *     HTTP/1.1 200 OK
 *     {
 *       "_id": "12345abcd",
 *       "name": "Le Bar Sympa",
 *       "description": "Un bar sympa",
 *       "image_url": "http://example.com/image.jpg",
 *       "location": {
 *         "type": "Point",
 *         "coordinates": [-73.856077, 40.848447]
 *       },
 *       "manager": {
 *         "_id": "67890efgh",
 *         "username": "manager1",
 *         "email": "manager1@example.com",
 *         "role": "manager"
 *       }
 *     }
 *
 * @apiError (404) {String} message Bar non trouvé.
 * @apiError (500) {String} message Erreur interne du serveur.
 */
router.get('/:id', async (req, res) => {
  try {
    const bar = await Bar.findById(req.params.id).populate('manager', 'username email role');
    if (!bar) {
      return res.status(404).json({ message: 'Bar non trouvé' });
    }
    res.json(bar);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * @api {post} /bars Créer un nouveau bar
 * @apiName CreateBar
 * @apiGroup Bars
 * @apiDescription Crée un nouveau bar. Accessible uniquement aux managers et aux administrateurs.
 *
 * @apiHeader {String} Authorization Bearer <token>.
 *
 *apiBody {String} name Nom du bar (3-100 caractères).
 * @apiBody {String} description Description du bar (10-1000 caractères).
 * @apiBody {String} image_url URL de l'image du bar.
 * @apiBody {Object} location Coordonnées géospatiales du bar.
 * @apiBody {String} location.type Type de l'objet géospatial (doit être "Point").
 * @apiBody {Number[]} location.coordinates Coordonnées [longitude, latitude].
 *
 * @apiExample {json} Exemple de requête :
 *     {
 *       "name": "Le Bar Sympa",
 *       "description": "Un bar sympa",
 *       "image_url": "http://example.com/image.jpg",
 *       "location": {
 *         "type": "Point",
 *         "coordinates": [-73.856077, 40.848447]
 *       }
 *     }
 *
 * @apiSuccess {Object} bar Bar créé.
 *
 * @apiSuccessExample {json} Réponse en cas de succès :
 *     HTTP/1.1 201 Created
 *     {
 *       "_id": "12345abcd",
 *       "name": "Le Bar Sympa",
 *       "description": "Un bar sympa",
 *       "image_url": "http://example.com/image.jpg",
 *       "location": {
 *         "type": "Point",
 *         "coordinates": [-73.856077, 40.848447]
 *       },
 *       "manager": "67890efgh"
 *     }
 *
 * @apiError (400) {String} message Erreur de validation.
 * @apiError (500) {String} message Erreur interne du serveur.
 */
router.post(
  '/',
  verifyToken,
  verifyRole('manager', 'admin'),
  [
    body('name').isLength({ min: 3, max: 100 }).withMessage('Le nom doit contenir entre 3 et 100 caractères'),
    body('description').isLength({ min: 10, max: 1000 }).withMessage('La description doit contenir entre 10 et 1000 caractères'),
    body('image_url').isURL().withMessage('L\'URL de l\'image n\'est pas valide'),
    body('location.type').equals('Point').withMessage('Le type de localisation doit être "Point"'),
    body('location.coordinates').isArray({ min: 2, max: 3 }).withMessage('Les coordonnées doivent être un tableau de 2 ou 3 éléments'),
    body('location.coordinates[0]').isFloat({ min: -180, max: 180 }).withMessage('La longitude doit être comprise entre -180 et 180'),
    body('location.coordinates[1]').isFloat({ min: -90, max: 90 }).withMessage('La latitude doit être comprise entre -90 et 90')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, image_url, location } = req.body;
    const bar = new Bar({
      name,
      description,
      image_url,
      location: {
        type: 'Point',
        coordinates: location.coordinates
      },
      manager: req.user.id // Le créateur devient automatiquement le manager
    });
    try {
      await bar.save();
      res.status(201).json(bar);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
);

/**
 * @api {put} /bars/:id Modifier complètement un bar
 * @apiName UpdateBar
 * @apiGroup Bars
 * @apiDescription Modifie complètement un bar existant. Accessible uniquement aux managers et aux administrateurs.
 *
 * @apiHeader {String} Authorization Bearer <token>.
 *
 * @apiParam {String} id ID du bar à modifier.
 *
 * @apiBody {String} name Nom du bar (3-100 caractères).
 * @apiBody {String} description Description du bar (10-1000 caractères).
 * @apiBody {String} image_url URL de l'image du bar.
 * @apiBody {Object} location Coordonnées géospatiales du bar.
 * @apiBody {String} location.type Type de l'objet géospatial (doit être "Point").
 * @apiBody {Number[]} location.coordinates Coordonnées [longitude, latitude].
 *
 * @apiExample {json} Exemple de requête :
 *     {
 *       "name": "Le Bar Sympa",
 *       "description": "Un bar sympa",
 *       "image_url": "http://example.com/image.jpg",
 *       "location": {
 *         "type": "Point",
 *         "coordinates": [-73.856077, 40.848447]
 *       }
 *     }
 *
 * @apiSuccess {Object} bar Bar modifié.
 *
 * @apiSuccessExample {json} Réponse en cas de succès :
 *     HTTP/1.1 200 OK
 *     {
 *       "_id": "12345abcd",
 *       "name": "Le Bar Sympa",
 *       "description": "Un bar sympa",
 *       "image_url": "http://example.com/image.jpg",
 *       "location": {
 *         "type": "Point",
 *         "coordinates": [-73.856077, 40.848447]
 *       },
 *       "manager": "67890efgh"
 *     }
 *
 * @apiError (400) {String} message Erreur de validation.
 * @apiError (404) {String} message Bar non trouvé.
 * @apiError (500) {String} message Erreur interne du serveur.
 */
router.put(
  '/:id',
  verifyToken,
  verifyCreator('bar'),
  [
    body('name').isLength({ min: 3, max: 100 }).withMessage('Le nom doit contenir entre 3 et 100 caractères'),
    body('description').isLength({ min: 10, max: 1000 }).withMessage('La description doit contenir entre 10 et 1000 caractères'),
    body('image_url').isURL().withMessage('L\'URL de l\'image n\'est pas valide'),
    body('location.type').equals('Point').withMessage('Le type de localisation doit être "Point"'),
    body('location.coordinates').isArray({ min: 2, max: 3 }).withMessage('Les coordonnées doivent être un tableau de 2 ou 3 éléments'),
    body('location.coordinates[0]').isFloat({ min: -180, max: 180 }).withMessage('La longitude doit être comprise entre -180 et 180'),
    body('location.coordinates[1]').isFloat({ min: -90, max: 90 }).withMessage('La latitude doit être comprise entre -90 et 90')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, image_url, location } = req.body;
    try {
      const updatedBar = await Bar.findByIdAndUpdate(
        req.params.id,
        {
          name,
          description,
          image_url,
          location: {
            type: 'Point',
            coordinates: location.coordinates
          }
        },
        { new: true, runValidators: true }
      );
      if (!updatedBar) {
        return res.status(404).json({ message: 'Bar non trouvé' });
      }
      res.json(updatedBar);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
);

/**
 * @api {patch} /bars/:id Modifier partiellement un bar
 * @apiName PatchBar
 * @apiGroup Bars
 * @apiDescription Modifie partiellement un bar existant. Accessible uniquement aux managers et aux administrateurs.
 *
 * @apiHeader {String} Authorization Bearer <token>.
 *
 * @apiParam {String} id ID du bar à modifier.
 *
 * @apiBody {String} [name] Nom du bar (3-100 caractères).
 * @apiBody {String} [description] Description du bar (10-1000 caractères).
 * @apiBody {String} [image_url] URL de l'image du bar.
 * @apiBody {Object} [location] Coordonnées géospatiales du bar.
 * @apiBody {String} [location.type] Type de l'objet géospatial (doit être "Point").
 * @apiBody {Number[]} [location.coordinates] Coordonnées [longitude, latitude].
 *
 * @apiExample {json} Exemple de requête :
 *     {
 *       "name": "Le Bar Sympa",
 *       "description": "Un bar sympa",
 *       "image_url": "http://example.com/image.jpg",
 *       "location": {
 *         "type": "Point",
 *         "coordinates": [-73.856077, 40.848447]
 *       }
 *     }
 *
 * @apiSuccess {Object} bar Bar modifié.
 *
 * @apiSuccessExample {json} Réponse en cas de succès :
 *     HTTP/1.1 200 OK
 *     {
 *       "_id": "12345abcd",
 *       "name": "Le Bar Sympa",
 *       "description": "Un bar sympa",
 *       "image_url": "http://example.com/image.jpg",
 *       "location": {
 *         "type": "Point",
 *         "coordinates": [-73.856077, 40.848447]
 *       },
 *       "manager": "67890efgh"
 *     }
 *
 * @apiError (400) {String} message Erreur de validation.
 * @apiError (404) {String} message Bar non trouvé.
 * @apiError (500) {String} message Erreur interne du serveur.
 */
router.patch(
  '/:id',
  verifyToken,
  verifyCreator('bar'),
  [
    body('name').optional().isLength({ min: 3, max: 100 }).withMessage('Le nom doit contenir entre 3 et 100 caractères'),
    body('description').optional().isLength({ min: 10, max: 1000 }).withMessage('La description doit contenir entre 10 et 1000 caractères'),
    body('image_url').optional().isURL().withMessage('L\'URL de l\'image n\'est pas valide'),
    body('location.type').optional().equals('Point').withMessage('Le type de localisation doit être "Point"'),
    body('location.coordinates').optional().isArray({ min: 2, max: 3 }).withMessage('Les coordonnées doivent être un tableau de 2 ou 3 éléments'),
    body('location.coordinates[0]').optional().isFloat({ min: -180, max: 180 }).withMessage('La longitude doit être comprise entre -180 et 180'),
    body('location.coordinates[1]').optional().isFloat({ min: -90, max: 90 }).withMessage('La latitude doit être comprise entre -90 et 90')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, image_url, location } = req.body;
    const updatedFields = {};
    if (name !== undefined) updatedFields.name = name;
    if (description !== undefined) updatedFields.description = description;
    if (image_url !== undefined) updatedFields.image_url = image_url;
    if (location !== undefined) {
      updatedFields.location = {
        type: 'Point',
        coordinates: location.coordinates
      };
    }
    try {
      const updatedBar = await Bar.findByIdAndUpdate(
        req.params.id,
        updatedFields,
        { new: true, runValidators: true }
      );
      if (!updatedBar) {
        return res.status(404).json({ message: 'Bar non trouvé' });
      }
      res.json(updatedBar);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
);

/**
 * @api {delete} /bars/:id Supprimer un bar
 * @apiName DeleteBar
 * @apiGroup Bars
 * @apiDescription Supprime un bar existant. Accessible uniquement aux managers et aux administrateurs.
 *
 * @apiHeader {String} Authorization Bearer <token>.
 *
 * @apiParam {String} id ID du bar à supprimer.
 *
 * @apiSuccess {String} message Confirmation de la suppression du bar.
 *
 * @apiSuccessExample {json} Réponse en cas de succès :
 *     HTTP/1.1 200 OK
 *     {
 *       "message": "Bar supprimé avec succès"
 *     }
 *
 * @apiError (404) {String} message Bar non trouvé.
 * @apiError (500) {String} message Erreur interne du serveur.
 */
router.delete('/:id', verifyToken, verifyCreator('bar'), async (req, res) => {
  try {
    const bar = await Bar.findById(req.params.id);
    if (!bar) {
      return res.status(404).json({ message: 'Bar non trouvé' });
    }
    await Bar.deleteOne({ _id: req.params.id });
    res.status(200).json({ message: 'Bar supprimé avec succès' });
  } catch (error) {
    console.error('Erreur lors de la suppression du bar:', error);
    res.status(500).json({ message: 'Erreur interne du serveur' });
  }
});

export default router;