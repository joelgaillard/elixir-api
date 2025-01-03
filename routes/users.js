import express from 'express';
import User from '../models/user.js';
import Cocktail from '../models/cocktail.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import dotenv from 'dotenv';
import verifyToken from '../middlewares/verifyToken.js';
import optionalAuth from '../middlewares/optionalAuth.js';
import verifyRole from '../middlewares/verifyRole.js';
import mongoose from 'mongoose';

dotenv.config();

const router = express.Router();

function generateToken(user) {
  return jwt.sign({
    id: user._id,
    username: user.username,
    role: user.role
  }, process.env.JWT_SECRET, { expiresIn: '15m' });
}

/**
 * @api {post} /users Créer un utilisateur
 * @apiName CreateUser
 * @apiGroup Utilisateurs
 * @apiDescription Crée un nouvel utilisateur avec un rôle par défaut `user`, ou `manager` si l'utilisateur connecté est un administrateur.
 *
 * @apiHeader {String} [Authorization] Bearer <token> (optionnel)
 * @apiHeaderExample {json} Exemple d'en-tête :
 *     {
 *       "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *     }
 * 
 * @apiBody {String} username Nom d'utilisateur (3-30 caractères, uniquement lettres, chiffres, underscores).
 * @apiBody {String} email Adresse e-mail valide.
 * @apiBody {String} password Mot de passe (min 8 caractères, inclut une majuscule, une minuscule, un chiffre et un caractère spécial).
 *
 * @apiExample {json} Exemple de requête :
 *     POST api/users HTTP/1.1
 *     Content-Type: application/json
 * 
 *     {
 *       "username": "monNomUtilisateur",
 *       "email": "exemple@email.com",
 *       "password": "Password@123"
 *     }
 *
 * @apiSuccess {String} message Message de succès (par exemple, "Utilisateur créé avec succès").
 * @apiSuccess {Object} user Informations de l'utilisateur créé.
 * @apiSuccess {String} user.username Nom d'utilisateur
 * @apiSuccess {String} user.email Adresse email
 * @apiSuccess {String} [token] Jeton JWT de connexion (uniquement pour les utilisateurs).
 *
 * @apiSuccessExample {json} Réponse en cas de succès (utilisateur):
 *     HTTP/1.1 201 Created
 *     Content-Type: application/json
 * 
 *     {
 *       "message": "Utilisateur créé avec succès",
 *       "user": {
 *         "username": "user",
 *         "email": "user@example.com",
 *       },
 *       "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *     }
 * @apiSuccessExample {json} Réponse en cas de succès (manager):
 *     HTTP/1.1 201 Created
 *     Content-Type: application/json
 *
 *     {
 *       "message": "Manager créé avec succès",
 *       "user": {
 *         "username": "manager",
 *         "email": "manager@example.com",
 *       }
 *     }
 *
 * @apiError (400) {Object[]} errors Erreurs de validation des champs envoyés.
 * @apiErrorExample {json} Erreur 400 (erreurs de validation) :
 *     HTTP/1.1 400 Bad Request
 *     Content-Type: application/json
 * 
 *     {
 *       "errors": [
 *         { "msg": "Le nom d'utilisateur doit contenir entre 3 et 30 caractères", "field": "username" },
 *         { "msg": "Le nom d'utilisateur ne doit contenir que des lettres, des chiffres et des underscores", "field": "username" },
 *         { "msg": "Le mot de passe doit contenir au moins une lettre minuscule, une lettre majuscule, un chiffre et un caractère spécial", "field": "password" }
 *       ]
 *     }
 */
router.post(
  '/',
  optionalAuth,
  [
    body('username')
      .isLength({ min: 3, max: 30 })
      .withMessage('Le nom d\'utilisateur doit contenir entre 3 et 30 caractères')
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('Le nom d\'utilisateur ne doit contenir que des lettres, des chiffres et des underscores'),
    body('email')
      .isEmail()
      .withMessage('Adresse e-mail invalide')
      .normalizeEmail(),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Le mot de passe doit contenir au moins 8 caractères')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).+$/)
      .withMessage('Le mot de passe doit contenir au moins une lettre minuscule, une lettre majuscule, un chiffre et un caractère spécial')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array().map(error => ({ msg: error.msg, field: error.path })) });
    }

    const { username, email, password } = req.body;

    const role = req.user && req.user.role === 'admin' ? 'manager' : 'user';

    try {
      const existingUserByEmail = await User.findOne({ email });
      if (existingUserByEmail) {
        return res.status(400).json({ errors: [{ msg: 'Cette adresse e-mail est déjà utilisée', field: 'email' }] });
      }

      const existingUserByUsername = await User.findOne({ username });
      if (existingUserByUsername) {
        return res.status(400).json({ errors: [{ msg: 'Ce nom d\'utilisateur est déjà pris', field: 'username' }] });
      }

      const hashedPassword = await bcrypt.hash(password, 12);
      const newUser = new User({
        username,
        email,
        password: hashedPassword,
        role
      });

      await newUser.save();

      const token = generateToken(newUser);

      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 15 * 60 * 1000 // 15 minutes
      });

      if (role === 'manager') {
        return res.status(201).json({
          message: 'Manager créé avec succès',
          user: {
            username: newUser.username,
            email: newUser.email,
          }
        });
      }

      res.status(201).json({
        message: 'Utilisateur créé avec succès',
        user: {
          username: newUser.username,
          email: newUser.email,
        },
        token
      });

    } catch (err) {
      console.error('Erreur lors de la création:', err);
      res.status(500).json({ message: 'Erreur interne du serveur' });
    }
  }
);

/**
 * @api {post} /users/login Connexion utilisateur
 * @apiName LoginUser
 * @apiGroup Utilisateurs
 * @apiDescription Permet à un utilisateur de se connecter avec son e-mail et son mot de passe.
 *
 * @apiBody {String} email Adresse e-mail de l'utilisateur (doit être valide).
 * @apiBody {String} password Mot de passe de l'utilisateur (requis).
 *
 * @apiExample {json} Exemple de requête :
 *     POST api/users/login HTTP/1.1
 *     Content-Type: application/json
 * 
 *     {
 *       "email": "exemple@email.com",
 *       "password": "Password@123"
 *     }
 *
 * @apiSuccess {String} message "Connexion réussie".
 * @apiSuccess {String} token Jeton JWT pour les sessions.
 *
 * @apiSuccessExample {json} Réponse en cas de succès :
 *     HTTP/1.1 200 OK
 *     Content-Type: application/json
 * 
 *     {
 *       "message": "Connexion réussie",
 *       "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *     }
 *
 * @apiError (400) {Object[]} errors Erreurs de validation des champs envoyés ou identifiants invalides.
 * @apiErrorExample {json} Erreur 400 (erreurs de validation ou identifiants invalides) :
 *     HTTP/1.1 400 Bad Request
 *     Content-Type: application/json
 * 
 *     {
 *       "errors": [
 *         { "msg": "Adresse e-mail invalide", "field": "email" },
 *         { "msg": "Le mot de passe est requis", "field": "password" },
 *         { "msg": "Identifiants invalides", "field": "email" },
 *         { "msg": "Identifiants invalides", "field": "password" }
 *       ]
 *     }
 *
 */
router.post('/login', [
  body('email').isEmail().withMessage('Adresse e-mail invalide').normalizeEmail(),
  body('password').isLength({ min: 1 }).withMessage('Le mot de passe est requis'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array().map(error => ({ msg: error.msg, field: error.path })) });
  }

  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({ errors: [{ msg: 'Identifiants invalides', field: 'email' }, { msg: 'Identifiants invalides', field: 'password' }] });
    }

    const token = generateToken(user);

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 15 * 60 * 1000 // 15 minutes
    });

    res.status(200).json({ message: 'Connexion réussie', token });
  } catch (error) {
    console.error('Login error:', error.message || error);
    res.status(500).json({ message: 'Erreur interne du serveur' });
  }
});

/**
 * @api {get} /users/me Obtenir le profil de l'utilisateur connecté
 * @apiName GetUserProfile
 * @apiGroup Utilisateurs
 * @apiDescription Récupère les informations de l'utilisateur actuellement connecté grâce à son jeton JWT.
 * 
 * @apiHeader {String} Authorization Bearer <token> 
 * @apiHeaderExample {json} Exemple d'en-tête :
 *     {
 *       "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *     }
 * 
 * @apiExample {curl} Exemple de requête :
 *    curl -X GET "https://elixir-api-st9s.onrender.com/api/users/me" \
 *        -H "Authorization: Bearer <token>"
 *
 * @apiSuccess {String} _id Identifiant unique de l'utilisateur.
 * @apiSuccess {String} username Nom d'utilisateur.
 * @apiSuccess {String} email Adresse e-mail de l'utilisateur.
 * @apiSuccess {Object[]} favorites Liste des cocktails favoris avec leurs détails complets.
 * @apiSuccess {String} favorites._id Identifiant unique du cocktail.
 * @apiSuccess {String} favorites.name Nom du cocktail.
 * @apiSuccess {String} favorites.description Description du cocktail.
 * @apiSuccess {String[]} favorites.instructions Instructions de préparation.
 * @apiSuccess {String} favorites.image_url URL de l'image du cocktail.
 * @apiSuccess {Object[]} favorites.ingredients Liste des ingrédients du cocktail.
 *
 * @apiSuccessExample {json} Réponse en cas de succès :
 *     HTTP/1.1 200 OK
 *     Content-Type: application/json
 *     Location: /api/users/me
 * 
 *     {
 *       "_id": "12345abcd",
 *       "username": "johndoe",
 *       "email": "john@example.com",
 *       "favorites": [
 *         {
 *           "_id": "67890efgh",
 *           "name": "Old Fashioned",
 *           "description": "Un cocktail classique...",
 *           "instructions": ["Mélanger...", "Servir..."],
 *           "image_url": "https://example.com/image.jpg",
 *           "ingredients": [
 *             { "name": "Whisky", "quantity": 50, "unit": "ml" }
 *           ]
 *         }
 *       ]
 *     }
 *
 * @apiError (401) {Object[]} message Aucun token n'a été fourni.
 * @apiErrorExample {json} Erreur 401 (token absent) :
 *     HTTP/1.1 401 Unauthorized
 *     Content-Type: application/json
 * 
 *     {
 *       "errors": [
 *         { "msg": "Accès refusé : Aucun token fourni" }
 *       ]
 *     }
 *
 * @apiError (403) {Object[]} message Token invalide ou expiré.
 * @apiErrorExample {json} Erreur 403 (token invalide ou expiré) :
 *     HTTP/1.1 403 Forbidden
 *     Content-Type: application/json
 * 
 *     {
 *       "errors": [
 *         { "msg": "Token invalide ou expiré" }
 *       ]
 *     }
 *
 * @apiError (404) {Object[]} errors L'utilisateur connecté n'a pas été trouvé dans la base de données.
 * @apiErrorExample {json} Réponse en cas d'utilisateur non trouvé :
 *     HTTP/1.1 404 Not Found
 *     Content-Type: application/json
 * 
 *     {
 *       "errors": [
 *         { "msg": "Utilisateur non trouvé", "field": "user" }
 *       ]
 *     }
 */
router.get('/me', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password -role')
      .populate('favorites');

    if (!user) {
      return res.status(404).json({
        errors: [{ msg: 'Utilisateur non trouvé', field: 'user' }]
      });
    }

    res.json(user);
  } catch (error) {
    console.error('Erreur lors de la récupération du profil:', error);
    res.status(500).json({
      errors: [{ msg: 'Erreur interne du serveur', field: 'server' }]
    });
  }
});

/**
 * @api {patch} /me Met à jour les informations de l'utilisateur connecté
 * @apiName UpdateUser
 * @apiGroup Utilisateurs
 * @apiDescription Met à jour les informations de l'utilisateur connecté.
 *
 * @apiHeader {String} Authorization Bearer <token> 
 * @apiHeaderExample {json} Exemple d'en-tête :
 *     {
 *       "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *     }
 *
 * @apiBody {String} [username] Nouveau nom d'utilisateur.
 * @apiBody {String} [email] Nouvelle adresse email.
 * @apiBody {String} [password] Nouveau mot de passe.
 *
 * @apiExample {json} Exemple de requête :
 *     PATCH api/users/me HTTP/1.1
 *     Content-Type: application/json
 * 
 *     {
 *       "username": "nouveauNom",
 *       "email": "nouveau@email.com",
 *       "password": "NewPass@123"
 *     }
 *
 * @apiSuccess {String} message "Utilisateur mis à jour avec succès".
 *
 * @apiSuccessExample {json} Réponse en cas de succès :
 *     HTTP/1.1 200 OK
 *     Content-Type: application/json
 * 
 *     {
 *       "message": "Utilisateur mis à jour avec succès",
 *       "user": {
 *         "username": "nouveauNom",
 *         "email": "nouveau@email.com",
 *       },
 *     }
 *
 * @apiError (400) {Object[]} errors Liste des erreurs de validation.
 * @apiErrorExample {json} Erreur 400 (erreurs de validation) :
 *     HTTP/1.1 400 Bad Request
 *     Content-Type: application/json
 * 
 *     {
 *       "errors": [
 *         { "msg": "Ce nom d'utilisateur est déjà pris.", "field": "username" },
 *         { "msg": "Cette adresse e-mail est déjà utilisée.", "field": "email" }
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
 *         { "msg": "Accès refusé : Aucun token fourni" }
 *       ]
 *     }
 *
 * @apiError (403) {Object[]} message Token invalide ou expiré.
 * @apiErrorExample {json} Erreur 403 (token invalide ou expiré) :
 *     HTTP/1.1 403 Forbidden
 *     Content-Type: application/json
 *     {
 *       "errors": [
 *         { "msg": "Token invalide ou expiré" }
 *       ]
 *     }
 *
 */
router.patch(
  '/me',
  verifyToken,
  [
    body('username')
      .optional()
      .isLength({ min: 3, max: 30 })
      .withMessage('Le nom d\'utilisateur doit contenir entre 3 et 30 caractères')
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('Le nom d\'utilisateur ne doit contenir que des lettres, des chiffres et des underscores'),
    body('email')
      .optional()
      .isEmail()
      .withMessage('Adresse e-mail invalide')
      .normalizeEmail(),
    body('password')
      .optional()
      .isLength({ min: 8 })
      .withMessage('Le mot de passe doit contenir au moins 8 caractères')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).+$/)
      .withMessage('Le mot de passe doit contenir au moins une lettre minuscule, une lettre majuscule, un chiffre et un caractère spécial')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array().map(error => ({ msg: error.msg, field: error.path })) });
    }

    const { username, email, password } = req.body;
    const updates = {};

    if (username) {
      const existingUserByUsername = await User.findOne({ username });
      if (existingUserByUsername && existingUserByUsername._id.toString() !== req.user.id) {
        return res.status(400).json({ errors: [{ msg: 'Ce nom d\'utilisateur est déjà pris', field: 'username' }] });
      }
      updates.username = username;
    }

    if (email) {
      const existingUserByEmail = await User.findOne({ email });
      if (existingUserByEmail && existingUserByEmail._id.toString() !== req.user.id) {
        return res.status(400).json({ errors: [{ msg: 'Cette adresse e-mail est déjà utilisée', field: 'email' }] });
      }
      updates.email = email;
    }

    if (password) {
      updates.password = await bcrypt.hash(password, 12);
    }

    try {
      await User.findByIdAndUpdate(req.user.id, updates, { new: true });

      res.status(200).json({
        message: 'Utilisateur mis à jour avec succès',
        user: {
          username: updates.username,
          email: updates.email,
        }
      });
    } catch (err) {
      console.error('Erreur lors de la mise à jour:', err);
      res.status(500).json({ message: 'Erreur interne du serveur' });
    }
  }
);

/**
 * @api {delete} /me Supprimer son propre compte
 * @apiName DeleteMyAccount
 * @apiGroup Utilisateurs
 * @apiDescription Permet à un utilisateur connecté de supprimer définitivement son compte.
 *
 * @apiHeader {String} Authorization Bearer <token> 
 * @apiHeaderExample {Header} Exemple d'en-tête:
 *     Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 * 
 *
 * @apiExample {curl} Exemple de requête :
 *     curl -X DELETE "https://elixir-api-st9s.onrender.com/api/users/me" \
 *          -H "Authorization: Bearer <token>"
 *
 * @apiSuccess {String} message Confirmation de la suppression du compte.
 *
 * @apiSuccessExample {json} Réponse en cas de succès :
 *     HTTP/1.1 200 OK
 *     Content-Type: application/json
 * 
 *     {
 *       "message": "Utilisateur supprimé avec succès"
 *     }
 * 
 * @apiError (400) {String} message Erreur lors de la suppression de l'utilisateur.
 * @apiErrorExample {json} Erreur 400 (suppression échouée) :
 *     HTTP/1.1 400 Bad Request
 *     Content-Type: application/json
 * 
 *     {
 *       "errors": [
 *         { "msg": "Erreur lors de la suppression de l'utilisateur" }
 *       ]
 *     }
 * 
 * @apiError (401) {Object[]} message Aucun token n'a été fourni.
 * @apiErrorExample {json} Erreur 401 (token absent) :
 *     HTTP/1.1 401 Unauthorized
 *     Content-Type: application/json
 * 
 *     {
 *       "errors": [
 *         { "msg": "Accès refusé : Aucun token fourni" }
 *       ]
 *     }
 *
 * @apiError (403) {Object[]} message Token invalide ou expiré.
 * @apiErrorExample {json} Erreur 403 (token invalide ou expiré) :
 *     HTTP/1.1 403 Forbidden
 *     Content-Type: application/json
 * 
 *     {
 *       "errors": [
 *         { "msg": "Token invalide ou expiré" }
 *       ]
 *     }
 *
 * @apiError (404) {Object[]} message Utilisateur non trouvé.
 * @apiErrorExample {json} Erreur 404 (utilisateur non trouvé) :
 *     HTTP/1.1 404 Not Found
 *     Content-Type: application/json
 * 
 *     {
 *       "errors": [
 *         { "msg": "Utilisateur non trouvé" }
 *       ]
 *     }
 */
router.delete('/me', verifyToken, async (req, res) => {
  try {
    const deletedUser = await User.findByIdAndDelete(req.user.id);
    if (!deletedUser) {
      return res.status(404).json({
        errors: [{ msg: 'Utilisateur non trouvé', field: 'user' }]
      }
      );
    }
    res.status(200).json({ message: 'Utilisateur supprimé avec succès' });
  } catch (err) {
    console.error('Erreur lors de la suppression de l\'utilisateur:', err);
    res.status(400).json({ errors: [{ msg: 'Erreur lors de la suppression de l\'utilisateur' }] });
  }
});

/**
 * @api {delete} /users/:id Supprimer un utilisateur (par un administrateur)
 * @apiName DeleteUserByAdmin
 * @apiGroup Utilisateurs
 * @apiDescription Permet à un administrateur de supprimer un utilisateur spécifique par son ID.
 *
 * @apiHeader {String} Authorization Bearer <token> 
 * @apiHeaderExample {Header} Exemple d'en-tête:
 *     Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 * 
 * @apiParam {String} id ID de l'utilisateur à supprimer.
 *
 * @apiExample {curl} Exemple de requête :
 *     curl -X DELETE "https://elixir-api-st9s.onrender.com/api/users/:id" \
 *          -H "Authorization: Bearer <token>"
 *
 * @apiSuccess {String} message Confirmation de la suppression de l'utilisateur.
 *
 * @apiSuccessExample {json} Réponse en cas de succès :
 *     HTTP/1.1 200 OK
 *     Content-Type: application/json
 * 
 *     {
 *       "message": "Utilisateur supprimé avec succès"
 *     }
 *
 * @apiError (400) {String} message Erreur lors de la suppression de l'utilisateur.
 * @apiErrorExample {json} Erreur 400 (suppression échouée) :
 *     HTTP/1.1 400 Bad Request
 *     Content-Type: application/json
 * 
 *     {
 *       "errors": [
 *         { "msg": "Erreur lors de la suppression de l'utilisateur"
 *       ]
 *     }
 * 
 * @apiError (401) {Object[]} message Aucun token n'a été fourni.
 * @apiErrorExample {json} Erreur 401 (token absent) :
 *     HTTP/1.1 401 Unauthorized
 *     Content-Type: application/json
 * 
 *     {
 *       "errors": [
 *         { "msg": "Accès refusé : Aucun token fourni" }
 *       ]
 *     }
 *
 * @apiError (403) {Object[]} message Token invalide ou expiré, ou rôle insuffisant.
 * @apiErrorExample {json} Erreur 403 (token invalide ou expiré) :
 *     HTTP/1.1 403 Forbidden
 *     Content-Type: application/json
 * 
 *     {
 *       "errors": [
 *         { "msg": "Token invalide ou expiré" }
 *       ]
 *     }
 * 
 * @apiError (403) {Object[]} message Accès refusé : rôle insuffisant.
 * @apiErrorExample {json} Erreur 403 (rôle insuffisant) :
 *     HTTP/1.1 403 Forbidden
 *     Content-Type: application/json
 * 
 *     {
 *       "errors": [
 *         { "msg": "Accès refusé : rôle insuffisant" }
 *       ]
 *     }
 *
 * @apiError (404) {Object[]} message Utilisateur non trouvé.
 * @apiErrorExample {json} Erreur 404 (utilisateur non trouvé) :
 *     HTTP/1.1 404 Not Found
 *     Content-Type: application/json
 * 
 *     {
 *       "errors": [
 *         { "msg": "Utilisateur non trouvé" }
 *       ]
 *     }
 * 
 */
router.delete('/:id', verifyToken, verifyRole("admin"), async (req, res) => {
  try {
    const deletedUser = await User.findByIdAndDelete(req.params.id);
    if (!deletedUser) {
      return res.status(404).json({ errors: [{ msg: 'Utilisateur non trouvé' }] });
    }
    res.status(200).json({ message: 'Utilisateur supprimé avec succès' });
  } catch (err) {
    console.error('Erreur lors de la suppression de l\'utilisateur:', err);
    res.status(400).json({ errors: [{ msg: 'Erreur lors de la suppression de l\'utilisateur' }] });
  }
});


/**
 * @api {post} /users/me/favorites Ajouter un favori
 * @apiName AddFavorite
 * @apiGroup Utilisateurs
 * @apiDescription Ajoute un cocktail aux favoris de l'utilisateur connecté.
 *
 * @apiHeader {String} Authorization Bearer <token>.
 * @apiHeaderExample {json} Exemple d'en-tête :
 *     Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *
 * @apiBody {String} cocktail_id ID du cocktail à ajouter.
 *
 * @apiExample {json} Exemple de requête :
 *     POST api/users/me/favorites HTTP/1.1
 *     Content-Type: application/json
 * 
 *     {
 *       "cocktail_id": "12345abcd"
 *     }
 *
 * @apiSuccess {String[]} favorites Liste des ids des cocktails favoris mise à jour.
 *
 * @apiSuccessExample {json} Réponse en cas de succès :
 *     HTTP/1.1 200 OK
 *     Content-Type: application/json
 * 
 *     [
 *       "12345abcd",
 *       "67890efgh"
 *     ]
 *
 * @apiError (400) {Object[]} errors Erreurs de validation des champs envoyés.
 * @apiErrorExample {json} Erreur 400 (erreurs de validation) :
 *     HTTP/1.1 400 Bad Request
 *     Content-Type: application/json
 * 
 *     {
 *       "errors": [
 *         { "msg": "L'ID du cocktail est requis", "field": "cocktail_id" }
 *       ]
 *     }
 * 
 * @apiError (401) {Object[]} message Aucun token n'a été fourni.
 * @apiErrorExample {json} Erreur 401 (token absent) :
 *     HTTP/1.1 401 Unauthorized
 *     Content-Type: application/json
 * 
 *     {
 *       "errors": [
 *         { "msg": "Accès refusé : Aucun token fourni" }
 *       ]
 *     }
 *
 * @apiError (403) {Object[]} message Token invalide ou expiré.
 * @apiErrorExample {json} Erreur 403 (token invalide ou expiré) :
 *     HTTP/1.1 403 Forbidden
 *     Content-Type: application/json
 * 
 *     {
 *       "errors": [
 *         { "msg": "Token invalide ou expiré" }
 *       ]
 *     }
 * 
 * @apiError (404) {Object[]} message Utilisateur ou cocktail non trouvé.
 * @apiErrorExample {json} Erreur 404 (utilisateur non trouvé) :
 *     HTTP/1.1 404 Not Found
 *     Content-Type: application/json
 * 
 *     {
 *       "errors": [
 *         { "msg": "Utilisateur non trouvé" }
 *       ]
 *     }
 * 
 * @apiError (404) {Object[]} message Cocktail non trouvé.
 * @apiErrorExample {json} Erreur 404 (cocktail non trouvé) :
 *     HTTP/1.1 404 Not Found
 *     Content-Type: application/json
 * 
 *     {
 *       "errors": [
 *         { "msg": "Cocktail non trouvé", "field": "cocktail_id" }
 *       ]
 *     }
 * 
 */
router.post('/me/favorites', verifyToken, async (req, res) => {
  try {
    const { cocktail_id } = req.body;

    if (!cocktail_id) {
      return res.status(400).json({
        errors: [{
          msg: 'L\'ID du cocktail est requis',
          field: 'cocktail_id'
        }]
      });
    }

    if (!mongoose.Types.ObjectId.isValid(cocktail_id)) {
      return res.status(400).json({
        errors: [{
          msg: 'ID de cocktail invalide',
          field: 'cocktail_id'
        }]
      });
    }

    const cocktail = await Cocktail.findById(cocktail_id);
    if (!cocktail) {
      return res.status(404).json({
        errors: [{
          msg: 'Cocktail non trouvé',
          field: 'cocktail_id'
        }]
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({
      errors: [{
        msg: 'Utilisateur non trouvé'
      }]
    });

    if (user.favorites.includes(cocktail_id)) {
      return res.status(400).json({
        errors: [{
          msg: 'Ce cocktail est déjà dans vos favoris',
          field: 'cocktail_id'
        }]
      });
    }

    user.favorites.push(cocktail_id);
    await user.save();

    res.status(200).json(user.favorites);
  } catch (error) {
    res.status(500).json({
      errors: [
        { msg: error.message }]
    }
    );
  }
});

/**
 * @api {delete} /users/me/favorites/:cocktailId Supprimer un cocktail des favoris
 * @apiName RemoveFavorite
 * @apiGroup Utilisateurs
 * @apiDescription Permet à un utilisateur de retirer un cocktail de ses favoris
 *
 * @apiParam {String} cocktailId ID du cocktail à retirer des favoris
 *
 * @apiHeader {String} Authorization Bearer <token>
 * @apiHeaderExample {Header} En-tête de requête:
 *     Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *
 * @apiSuccess {String[]} favorites Liste mise à jour des IDs de cocktails favoris
 *
 * @apiSuccessExample {json} Réponse en cas de succès:
 *     HTTP/1.1 200 OK
 *     Content-Type: application/json
 * 
 *     ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012"]
 *
 * @apiError (400) {Object[]} errors Erreur de validation
 * @apiErrorExample {json} Erreur 400 (ID invalide) :
 *     HTTP/1.1 400 Bad Request
 *     Content-Type: application/json
 *     {
 *       "errors": [{
 *         "msg": "ID de cocktail invalide",
 *         "param": "cocktailId"
 *       }]
 *     }
 * @apiError (401) {Object[]} message Aucun token n'a été fourni.
 * @apiErrorExample {json} Erreur 401 (token absent) :
 *     HTTP/1.1 401 Unauthorized
 *     Content-Type: application/json
 * 
 *     {
 *       "errors": [
 *         { "msg": "Accès refusé : Aucun token fourni" }
 *       ]
 *     }
 *
 * @apiError (403) {Object[]} message Token invalide ou expiré.
 * @apiErrorExample {json} Erreur 403 (token invalide ou expiré) :
 *     HTTP/1.1 403 Forbidden
 *     Content-Type: application/json
 * 
 *     {
 *       "errors": [
 *         { "msg": "Token invalide ou expiré" }
 *       ]
 *     }
 *
 * @apiError (404) {Object[]} errors Ressource non trouvée
 * @apiErrorExample {json} Erreur 404 (Cocktail ou utilisateur non trouvé):
 *     HTTP/1.1 404 Not Found
 *     Content-Type: application/json
 * 
 *     {
 *       "errors": [{
 *         "msg": "Cocktail non trouvé",
 *         "param": "cocktailId"
 *       }]
 *     }
 *
 */
router.delete('/me/favorites/:cocktailId', verifyToken, async (req, res) => {
  try {
    const { cocktailId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(cocktailId)) {
      return res.status(400).json({
        errors: [{
          msg: 'ID de cocktail invalide',
          param: 'cocktailId'
        }]
      });
    }

    const cocktail = await Cocktail.findById(cocktailId);
    if (!cocktail) {
      return res.status(404).json({
        errors: [{
          msg: 'Cocktail non trouvé',
          param: 'cocktailId'
        }]
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        errors: [{
          msg: 'Utilisateur non trouvé',
        }]
      });
    }

    const index = user.favorites.indexOf(cocktailId);
    if (index === -1) {
      return res.status(400).json({
        errors: [{
          msg: 'Ce cocktail n\'est pas dans vos favoris',
          param: 'cocktailId'
        }]
      });
    }

    user.favorites.splice(index, 1);
    await user.save();

    res.status(200).json(user.favorites);
  } catch (error) {
    console.error('Erreur suppression favori:', error);
    res.status(500).json({
      errors: [{
        msg: 'Erreur interne du serveur',
            }]
    });
  }
});

/**
 * @api {get} /users/me/favorites Liste des favoris
 * @apiName GetFavorites
 * @apiGroup Utilisateurs
 * @apiDescription Récupère la liste complète des favoris de l'utilisateur connecté.
 *
 * @apiHeader {String} Authorization Bearer <token> 
 * @apiHeaderExample {Header} Exemple d'en-tête:
 *     Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *
 * @apiExample {curl} Exemple de requête :
 *     curl -X GET "https://elixir-api-st9s.onrender.com/api/users/me/favorites" \
 *          -H "Authorization: Bearer <token>"
 *
 * @apiSuccess {Object[]} favorites Liste des favoris.
 *
 * @apiSuccessExample {json} Réponse en cas de succès :
 *     HTTP/1.1 200 OK
 *     Content-Type: application/json
 * 
 *     [
 *       {
 *         "_id": "67767c8452c62cf285c32325",
 *         "name": "Old Fashioned",
 *         "description": "Un cocktail classique à base de whisky, de sucre, d'eau et d'amers.",
 *         "instructions": [
 *           "Mélanger le whisky, le sucre, l'eau et les amers",
 *           "Servir avec une tranche d'orange"
 *         ],
 *         "image_url": "https://images.immediate.co.uk/production/volatile/sites/30/2020/08/old-fashioned-5a4bab5.jpg",
 *         "ingredients": [
 *           {
 *             "name": "Whisky",
 *             "quantity": 50,
 *             "unit": "ml"
 *           },
 *           {
 *             "name": "Sucre",
 *             "quantity": 1,
 *             "unit": "morceau"
 *           },
 *           {
 *             "name": "Eau",
 *             "quantity": 10,
 *             "unit": "ml"
 *           },
 *           {
 *             "name": "Amers",
 *             "quantity": 2,
 *             "unit": "traits"
 *           }
 *         ]
 *       }
 *     ]
 *
 * @apiError (401) {Object[]} message Aucun token n'a été fourni.
 * @apiErrorExample {json} Erreur 401 (token absent) :
 *     HTTP/1.1 401 Unauthorized
 *     Content-Type: application/json
 * 
 *     {
 *       "errors": [
 *         { "msg": "Accès refusé : Aucun token fourni" }
 *       ]
 *     }
 *
 * @apiError (403) {Object[]} message Token invalide ou expiré.
 * @apiErrorExample {json} Erreur 403 (token invalide ou expiré) :
 *     HTTP/1.1 403 Forbidden
 *     Content-Type: application/json
 * 
 *     {
 *       "errors": [
 *         { "msg": "Token invalide ou expiré" }
 *       ]
 *     }
 *
 * @apiError (404) {Object[]} errors Utilisateur non trouvé
 * @apiErrorExample {json} Erreur 404 (Utilisateur non trouvé):
 *     HTTP/1.1 404 Not Found
 *     Content-Type: application/json
 * 
 *     {
 *       "errors": [{
 *         "msg": "Utilisateur non trouvé",
 *       }]
 *     }
 */
router.get('/me/favorites', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('favorites');
    if (!user) return res.status(404).json({ errors: [{ msg: 'Utilisateur non trouvé' }] });

    res.status(200).json(user.favorites);
  } catch (error) {
    res.status(500).json({
      errors: [{
        msg: 'Erreur interne du serveur',
            }]
    });
  }
});

 /**
 * @api {get} /users/me/favorites/:cocktailId/check Vérifier si un cocktail est dans les favoris
 * @apiName CheckFavorite
 * @apiGroup Utilisateurs
 * @apiDescription Vérifie si un cocktail spécifique est dans les favoris de l'utilisateur connecté.
 *
 * @apiHeader {String} Authorization Bearer <token> 
 * @apiHeaderExample {Header} Exemple d'en-tête:
 *     Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *
 * @apiParam {String} cocktailId ID du cocktail à vérifier.
 *
 * @apiExample {curl} Exemple de requête :
 *     curl -X GET "https://elixir-api-st9s.onrender.com/api/users/me/favorites/12345abcd/check" \
 *          -H "Authorization: Bearer <token>"
 *
 * @apiSuccess {Boolean} isFavorite Indique si le cocktail est dans les favoris.
 *
 * @apiSuccessExample {json} Réponse en cas de succès :
 *     HTTP/1.1 200 OK
 *     Content-Type: application/json
 * 
 *     {
 *       "isFavorite": true
 *     }
 *
 * @apiError (400) {Object[]} errors Liste des erreurs de validation, y compris un ID de cocktail invalide.
 * @apiErrorExample {json} Erreur 400 (réponse pour un ID invalide) :
 *     HTTP/1.1 400 Bad Request
 *     Content-Type: application/json
 * 
 *     {
 *       "errors": [
 *         { "msg": "ID de cocktail invalide", "param": "cocktailId" }
 *       ]
 *     }
 *
 * @apiError (401) {Object[]} message Aucun token n'a été fourni.
 * @apiErrorExample {json} Erreur 401 (token absent) :
 *     HTTP/1.1 401 Unauthorized
 *     Content-Type: application/json
 * 
 *     {
 *       "errors": [
 *         { "msg": "Accès refusé : Aucun token fourni" }
 *       ]
 *     }
 *
 * @apiError (403) {Object[]} message Token invalide ou expiré.
 * @apiErrorExample {json} Erreur 403 (token invalide ou expiré) :
 *     HTTP/1.1 403 Forbidden
 *     Content-Type: application/json
 * 
 *     {
 *       "errors": [
 *         { "msg": "Token invalide ou expiré" }
 *       ]
 *     }
 *
 * @apiError (404) {Object[]} errors Cocktail ou utilisateur non trouvé.
 * @apiErrorExample {json} Erreur 404 (réponse si le cocktail n'existe pas) :
 *     HTTP/1.1 404 Not Found
 *     Content-Type: application/json
 * 
 *     {
 *       "errors": [
 *         { "msg": "Cocktail non trouvé", "param": "cocktailId" }
 *       ]
 *     }
 * 
 *
 */
router.get('/me/favorites/:cocktailId/check', verifyToken, async (req, res) => {
  try {
    const { cocktailId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(cocktailId)) {
      return res.status(400).json({
        errors: [{
          msg: 'ID de cocktail invalide',
          param: 'cocktailId'
        }]
      });
    }

    const cocktail = await Cocktail.findById(cocktailId);
    if (!cocktail) {
      return res.status(404).json({
        errors: [{
          msg: 'Cocktail non trouvé',
          param: 'cocktailId'
        }]
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        errors: [{
          msg: 'Utilisateur non trouvé',
        }]
      });
    }


    const isFavorite = user.favorites.includes(req.params.cocktailId);
    res.status(200).json({ isFavorite });
  } catch (error) {
    res.status(500).json({
      errors: [{
        msg: 'Erreur interne du serveur',
            }]
    });
  }
});

export default router;