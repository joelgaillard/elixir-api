import express from 'express';
import User from '../models/user.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import dotenv from 'dotenv';
import verifyToken from '../middlewares/verifyToken.js';
import optionalAuth from '../middlewares/optionalAuth.js';

dotenv.config();

const router = express.Router();

// Fonction pour générer un token JWT
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
 * @apiBody {String} username Nom d'utilisateur (3-30 caractères, uniquement lettres, chiffres, underscores).
 * @apiBody {String} email Adresse e-mail valide.
 * @apiBody {String} password Mot de passe (min 8 caractères, inclut une majuscule, une minuscule, un chiffre et un caractère spécial).
 *
 * @apiExample {json} Exemple de requête :
 *     {
 *       "username": "monNomUtilisateur",
 *       "email": "exemple@email.com",
 *       "password": "Password@123"
 *     }
 *
 * @apiSuccess {String} message Message de succès (par exemple, "Utilisateur créé avec succès").
 * @apiSuccess {String} [token] Jeton JWT (uniquement pour les utilisateurs non-admins).
 *
 * @apiSuccessExample {json} Réponse en cas de succès (utilisateur):
 *     HTTP/1.1 201 Created
 *     {
 *       "message": "Utilisateur créé avec succès",
 *       "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *     }
 * @apiSuccessExample {json} Réponse en cas de succès (manager):
 *     HTTP/1.1 201 Created
 *     {
 *       "message": "Manager créé avec succès"
 *     }
 *
 * @apiError (400) {String} message Cette adresse e-mail est déjà utilisée.
 * @apiErrorExample {json} Réponse si l'e-mail est déjà utilisé :
 *     HTTP/1.1 400 Bad Request
 *     {
 *       "message": "Cette adresse e-mail est déjà utilisée"
 *     }
 *
 * @apiError (400) {String} message Ce nom d'utilisateur est déjà pris.
 * @apiErrorExample {json} Réponse si le nom d'utilisateur est déjà utilisé :
 *     HTTP/1.1 400 Bad Request
 *     {
 *       "message": "Ce nom d'utilisateur est déjà pris"
 *     }
 *
 * @apiError (400) {Object[]} errors Erreurs de validation des champs envoyés.
 * @apiErrorExample {json} Erreurs de validation :
 *     HTTP/1.1 400 Bad Request
 *     {
 *       "errors": [
 *         { "msg": "Le nom d'utilisateur doit contenir entre 3 et 30 caractères", "param": "username", "location": "body" },
 *         { "msg": "Adresse e-mail invalide", "param": "email", "location": "body" }
 *       ]
 *     }
 */

router.post(
  '/',
  optionalAuth,
  [
    body('username').isLength({ min: 3, max: 30 }).withMessage('Le nom d\'utilisateur doit contenir entre 3 et 30 caractères').matches(/^[a-zA-Z0-9_]+$/).withMessage('Le nom d\'utilisateur ne doit contenir que des lettres, des chiffres et des underscores'),
    body('email').isEmail().withMessage('Adresse e-mail invalide').normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Le mot de passe doit contenir au moins 8 caractères').matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).+$/).withMessage('Le mot de passe doit contenir au moins une lettre minuscule, une lettre majuscule, un chiffre et un caractère spécial')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password } = req.body;

    const role = req.user && req.user.role === 'admin' ? 'manager' : 'user';

    try {
      const existingUserByEmail = await User.findOne({ email });
      if (existingUserByEmail) {
        return res.status(400).json({ message: 'Cette adresse e-mail est déjà utilisée' });
      }

      const existingUserByUsername = await User.findOne({ username });
      if (existingUserByUsername) {
        return res.status(400).json({ message: 'Ce nom d\'utilisateur est déjà pris' });
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
        return res.status(201).json({ message: 'Manager créé avec succès' });
      }

      res.status(201).json({ message: 'Utilisateur créé avec succès', token });


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
 * @apiBody {String} email Adresse e-mail de l'utilisateur.
 * @apiBody {String} password Mot de passe de l'utilisateur.
 *
 * @apiExample {json} Exemple de requête :
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
 *     {
 *       "message": "Connexion réussie",
 *       "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *     }
 *
 * @apiError (400) {String} message Identifiants invalides ou manquants.
 * @apiErrorExample {json} Réponse en cas d'identifiants invalides :
 *     HTTP/1.1 400 Bad Request
 *     {
 *       "message": "Identifiants invalides"
 *     }
 *
 * @apiError (500) {String} message Erreur interne du serveur.
 * @apiErrorExample {json} Réponse en cas d'erreur serveur :
 *     HTTP/1.1 500 Internal Server Error
 *     {
 *       "message": "Erreur interne du serveur"
 *     }
 */

router.post('/login', [
  body('email').isEmail().withMessage('Adresse e-mail invalide').normalizeEmail(),
  body('password').isLength({ min: 1 }).withMessage('Le mot de passe est requis'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg });
  }

  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({ message: 'Identifiants invalides' });
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
 * @api {patch} /users/me Mettre à jour un utilisateur
 * @apiName UpdateUser
 * @apiGroup Utilisateurs
 * @apiDescription Met à jour les informations de l'utilisateur connecté.
 *
 * @apiHeader {String} Authorization Bearer <token>.
 *
 * @apiBody {String} [username] Nouveau nom d'utilisateur.
 * @apiBody {String} [email] Nouvelle adresse email.
 * @apiBody {String} [password] Nouveau mot de passe.
 *
 * @apiExample {json} Exemple de requête :
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
 *     {
 *       "message": "Utilisateur mis à jour avec succès"
 *     }
 *
 * @apiError (400) {Object[]} errors Liste des erreurs de validation.
 * @apiErrorExample {json} Erreurs de validation :
 *     HTTP/1.1 400 Bad Request
 *     {
 *       "errors": [
 *         { "msg": "Ce nom d'utilisateur est déjà pris.", "param": "username", "location": "body" }
 *       ]
 *     }
 *
 * @apiError (404) {String} message Utilisateur non trouvé.
 * @apiErrorExample {json} Réponse si l'utilisateur est introuvable :
 *     HTTP/1.1 404 Not Found
 *     {
 *       "message": "Utilisateur non trouvé."
 *     }
 *
 * @apiError (500) {String} message Erreur interne.
 * @apiErrorExample {json} Réponse en cas d'erreur serveur :
 *     HTTP/1.1 500 Internal Server Error
 *     {
 *       "message": "Erreur interne du serveur."
 *     }
 */

router.patch('/me', verifyToken, [
  body('username').optional().isLength({ min: 3, max: 30 }).withMessage('Le nom d\'utilisateur doit contenir entre 3 et 30 caractères').matches(/^[a-zA-Z0-9_]+$/).withMessage('Le nom d\'utilisateur ne doit contenir que des lettres, des chiffres et des underscores'),
  body('email').optional().isEmail().withMessage('Adresse e-mail invalide').normalizeEmail(),
  body('password').optional().isLength({ min: 8 }).withMessage('Le mot de passe doit contenir au moins 8 caractères').matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).+$/).withMessage('Le mot de passe doit contenir au moins une lettre minuscule, une lettre majuscule, un chiffre et un caractère spécial')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const updates = {};
    const { username, email, password } = req.body;

    if (username) {
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        return res.status(400).json({ message: "Ce nom d'utilisateur est déjà pris." });
      }
      updates.username = username;
    }

    if (email) {
      const existingEmail = await User.findOne({ email });
      if (existingEmail) {
        return res.status(400).json({ message: "Cette adresse email est déjà utilisée." });
      }
      updates.email = email;
    }

    if (password) {
      updates.password = await bcrypt.hash(password, 10);
    }

    const updatedUser = await User.findByIdAndUpdate(req.user.id, updates, { new: true });

    if (!updatedUser) {
      return res.status(404).json({ message: "Utilisateur non trouvé." });
    }

    res.status(200).json({ message: "Utilisateur mis à jour avec succès." });
  } catch (error) {
    console.error('Update error:', error.message || error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

/**
 * @api {delete} /me Supprimer son propre compte
 * @apiName DeleteMyAccount
 * @apiGroup Utilisateurs
 * @apiDescription Permet à un utilisateur connecté de supprimer définitivement son compte.
 *
 * @apiHeader {String} Authorization Bearer <token>.
 *
 * @apiExample {curl} Exemple de requête :
 *     curl -X DELETE "https://elixir-api-st9s.onrender.com/users/me" \
 *          -H "Authorization: Bearer <token>"
 *
 * @apiSuccess {String} message Confirmation de la suppression du compte.
 *
 * @apiSuccessExample {json} Réponse en cas de succès :
 *     HTTP/1.1 200 OK
 *     {
 *       "message": "Utilisateur supprimé avec succès"
 *     }
 *
 * @apiError (404) {String} message Utilisateur non trouvé.
 * @apiErrorExample {json} Réponse si l'utilisateur n'existe pas :
 *     HTTP/1.1 404 Not Found
 *     {
 *       "message": "Utilisateur non trouvé"
 *     }
 *
 * @apiError (500) {String} message Erreur interne du serveur.
 * @apiErrorExample {json} Réponse en cas d'erreur serveur :
 *     HTTP/1.1 500 Internal Server Error
 *     {
 *       "message": "Erreur interne du serveur"
 *     }
 */

router.delete('/me', verifyToken, async (req, res) => {
 try {
   const deletedUser = await User.findByIdAndDelete(req.user.id);
   if (!deletedUser) {
     return res.status(404).json({ message: 'Utilisateur non trouvé' });
   }
   res.status(200).json({ message: 'Utilisateur supprimé avec succès' });
 } catch (err) {
   console.error('Erreur lors de la suppression de l\'utilisateur:', err);
   res.status(400).json({ message: 'Erreur lors de la suppression de l\'utilisateur' });
 }
});

/**
 * @api {delete} /users/:id Supprimer un utilisateur (par un administrateur)
 * @apiName DeleteUserByAdmin
 * @apiGroup Utilisateurs
 * @apiDescription Permet à un administrateur de supprimer un utilisateur spécifique par son ID.
 *
 * @apiHeader {String} Authorization Bearer <token>.
 *
 * @apiParam {String} id ID de l'utilisateur à supprimer.
 *
 * @apiExample {curl} Exemple de requête :
 *     curl -X DELETE "https://elixir-api-st9s.onrender.com/users/:id" \
 *          -H "Authorization: Bearer <token>"
 *
 * @apiSuccess {String} message Confirmation de la suppression de l'utilisateur.
 *
 * @apiSuccessExample {json} Réponse en cas de succès :
 *     HTTP/1.1 200 OK
 *     {
 *       "message": "Utilisateur supprimé avec succès"
 *     }
 *
 * @apiError (401) {String} message Accès refusé (si le rôle n'est pas administrateur).
 * @apiErrorExample {json} Réponse en cas d'accès refusé :
 *     HTTP/1.1 401 Unauthorized
 *     {
 *       "message": "Accès refusé"
 *     }
 *
 * @apiError (404) {String} message Utilisateur non trouvé.
 * @apiErrorExample {json} Réponse si l'utilisateur n'existe pas :
 *     HTTP/1.1 404 Not Found
 *     {
 *       "message": "Utilisateur non trouvé"
 *     }
 *
 * @apiError (500) {String} message Erreur interne du serveur.
 * @apiErrorExample {json} Réponse en cas d'erreur serveur :
 *     HTTP/1.1 500 Internal Server Error
 *     {
 *       "message": "Erreur interne du serveur"
 *     }
 */

router.delete('/:id', verifyToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(401).json({ message: 'Accès refusé' });
  }

  try {
    const deletedUser = await User.findByIdAndDelete(req.params.id);
    if (!deletedUser) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    res.status(200).json({ message: 'Utilisateur supprimé avec succès' });
  } catch (err) {
    console.error('Erreur lors de la suppression de l\'utilisateur:', err);
    res.status(400).json({ message: 'Erreur lors de la suppression de l\'utilisateur' });
  }
});


/**
 * @api {post} /users/me/favorites Ajouter un favori
 * @apiName AddFavorite
 * @apiGroup Utilisateurs
 * @apiDescription Ajoute un cocktail aux favoris de l'utilisateur connecté.
 *
 * @apiHeader {String} Authorization Bearer <token>.
 *
 * @apiBody {String} cocktail_id ID du cocktail à ajouter.
 *
 * @apiExample {json} Exemple de requête :
 *     {
 *       "cocktail_id": "12345abcd"
 *     }
 *
 * @apiSuccess {String[]} favorites Liste des favoris mise à jour.
 *
 * @apiSuccessExample {json} Réponse en cas de succès :
 *     HTTP/1.1 200 OK
 *     [
 *       "12345abcd",
 *       "67890efgh"
 *     ]
 *
 * @apiError (400) {String} message Ce cocktail est déjà dans vos favoris.
 * @apiErrorExample {json} Cocktail déjà dans les favoris :
 *     HTTP/1.1 400 Bad Request
 *     {
 *       "message": "Ce cocktail est déjà dans vos favoris"
 *     }
 *
 * @apiError (500) {String} message Erreur interne du serveur.
 * @apiErrorExample {json} Réponse en cas d'erreur serveur :
 *     HTTP/1.1 500 Internal Server Error
 *     {
 *       "message": "Erreur interne du serveur"
 *     }
 */

router.post('/me/favorites', verifyToken, async (req, res) => {
  try {
    const { cocktail_id } = req.body;
    if (!cocktail_id) {
      return res.status(400).json({ message: 'L\'ID du cocktail est requis' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });

    if (user.favorites.includes(cocktail_id)) {
      return res.status(400).json({ message: 'Ce cocktail est déjà dans vos favoris' });
    }

    user.favorites.push(cocktail_id);
    await user.save();

    res.status(200).json(user.favorites);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * @api {delete} /users/me/favorites/:cocktailId Supprimer un favori
 * @apiName RemoveFavorite
 * @apiGroup Utilisateurs
 * @apiDescription Supprime un cocktail des favoris de l'utilisateur connecté.
 *
 * @apiHeader {String} Authorization Bearer <token>.
 *
 * @apiParam {String} cocktailId ID du cocktail à supprimer des favoris.
 *
 * @apiExample {curl} Exemple de requête :
 *     curl -X DELETE "https://elixir-api-st9s.onrender.com/users/me/favorites/12345abcd" \
 *          -H "Authorization: Bearer <token>"
 *
 * @apiSuccess {String[]} favorites Liste des favoris mise à jour.
 *
 * @apiSuccessExample {json} Réponse en cas de succès :
 *     HTTP/1.1 200 OK
 *     [
 *       "67890efgh"
 *     ]
 *
 * @apiError (400) {String} message Ce cocktail n'est pas dans vos favoris.
 * @apiErrorExample {json} Réponse en cas d'absence dans les favoris :
 *     HTTP/1.1 400 Bad Request
 *     {
 *       "message": "Ce cocktail n'est pas dans vos favoris"
 *     }
 *
 * @apiError (404) {String} message Utilisateur non trouvé.
 * @apiErrorExample {json} Réponse si l'utilisateur n'existe pas :
 *     HTTP/1.1 404 Not Found
 *     {
 *       "message": "Utilisateur non trouvé"
 *     }
 *
 * @apiError (500) {String} message Erreur interne du serveur.
 * @apiErrorExample {json} Réponse en cas d'erreur serveur :
 *     HTTP/1.1 500 Internal Server Error
 *     {
 *       "message": "Erreur interne du serveur"
 *     }
 */

router.delete('/me/favorites/:cocktailId', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });

    const index = user.favorites.indexOf(req.params.cocktailId);
    if (index === -1) {
      return res.status(400).json({ message: 'Ce cocktail n\'est pas dans vos favoris' });
    }

    user.favorites.splice(index, 1);
    await user.save();

    res.status(200).json(user.favorites);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * @api {get} /users/me/favorites Liste des favoris
 * @apiName GetFavorites
 * @apiGroup Utilisateurs
 * @apiDescription Récupère la liste complète des favoris de l'utilisateur connecté.
 *
 * @apiHeader {String} Authorization Bearer <token>.
 *
 * @apiExample {curl} Exemple de requête :
 *     curl -X GET "https://elixir-api-st9s.onrender.com/users/me/favorites" \
 *          -H "Authorization: Bearer <token>"
 *
 * @apiSuccess {Object[]} favorites Liste des favoris (avec détails si disponible).
 *
 * @apiSuccessExample {json} Réponse en cas de succès :
 *     HTTP/1.1 200 OK
 *     [
 *       {
 *         "_id": "12345abcd",
 *         "name": "Mojito",
 *         "ingredients": ["Rhum", "Menthe", "Citron vert"]
 *       },
 *       {
 *         "_id": "67890efgh",
 *         "name": "Daiquiri",
 *         "ingredients": ["Rhum", "Jus de citron", "Sucre"]
 *       }
 *     ]
 *
 * @apiError (404) {String} message Utilisateur non trouvé.
 * @apiErrorExample {json} Réponse si l'utilisateur n'existe pas :
 *     HTTP/1.1 404 Not Found
 *     {
 *       "message": "Utilisateur non trouvé"
 *     }
 *
 * @apiError (500) {String} message Erreur interne du serveur.
 * @apiErrorExample {json} Réponse en cas d'erreur serveur :
 *     HTTP/1.1 500 Internal Server Error
 *     {
 *       "message": "Erreur interne du serveur"
 *     }
 */

router.get('/me/favorites', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('favorites');
    if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });

    res.status(200).json(user.favorites);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * @api {get} /me/favorites/:id Obtenir un favori par ID
 * @apiName GetFavoriteById
 * @apiGroup Utilisateurs
 * @apiDescription Récupère les détails d'un cocktail spécifique dans les favoris de l'utilisateur connecté.
 *
 * @apiHeader {String} Authorization Bearer <token>.
 *
 * @apiParam {String} id ID du cocktail à récupérer dans les favoris.
 *
 * @apiExample {curl} Exemple de requête :
 *     curl -X GET "https://elixir-api-st9s.onrender.com/users/me/favorites/12345abcd" \
 *          -H "Authorization: Bearer <token>"
 *
 * @apiSuccess {Object} cocktail Informations détaillées du cocktail.
 *
 * @apiSuccessExample {json} Réponse en cas de succès :
 *     HTTP/1.1 200 OK
 *     {
 *       "_id": "12345abcd",
 *       "name": "Mojito",
 *       "ingredients": ["Rhum", "Menthe", "Citron vert"]
 *     }
 *
 * @apiError (404) {String} message Cocktail non trouvé dans vos favoris.
 * @apiErrorExample {json} Réponse si le cocktail n'existe pas :
 *     HTTP/1.1 404 Not Found
 *     {
 *       "message": "Cocktail non trouvé dans vos favoris"
 *     }
 *
 * @apiError (404) {String} message Utilisateur non trouvé.
 * @apiErrorExample {json} Réponse si l'utilisateur n'existe pas :
 *     HTTP/1.1 404 Not Found
 *     {
 *       "message": "Utilisateur non trouvé"
 *     }
 *
 * @apiError (500) {String} message Erreur interne du serveur.
 * @apiErrorExample {json} Réponse en cas d'erreur serveur :
 *     HTTP/1.1 500 Internal Server Error
 *     {
 *       "message": "Erreur interne du serveur"
 *     }
 */

router.get('/me/favorites/:id', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('favorites');
    if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });

    const cocktail = user.favorites.find(fav => fav.id === req.params.id);
    if (!cocktail) {
      return res.status(404).json({ message: 'Cocktail non trouvé dans vos favoris' });
    }

    res.status(200).json(cocktail);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;