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
 * @api {post} /users Create a new user or manager
 * @apiName CreateUserOrManager
 * @apiGroup Users
 * @apiDescription Crée un nouvel utilisateur. Si un token JWT est fourni et que l'utilisateur connecté est un admin, crée un manager.
 *
 * @apiHeader {String} [authorization] Token d'authentification JWT (facultatif).
 * @apiBody {String} username Nom d'utilisateur.
 * @apiBody {String} email Adresse e-mail.
 * @apiBody {String} password Mot de passe (min. 8 caractères).
 *
 * @apiSuccess {String} message Succès de la création de l'utilisateur ou du manager.
 * @apiSuccess {String} token JWT pour l'utilisateur créé.
 *
 * @apiParamExample {json} Request-Example (User):
 *     {
 *       "username": "john_doe",
 *       "email": "john.doe@example.com",
 *       "password": "password123"
 *     }
 *
 * @apiParamExample {json} Request-Example (Manager):
 *     {
 *       "username": "manager_user",
 *       "email": "manager@example.com",
 *       "password": "password123"
 *     }
 *
 * @apiSuccessExample {json} Success-Response (User):
 *     HTTP/1.1 201 Created
 *     {
 *       "message": "Utilisateur créé avec succès",
 *       "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *     }
 *
 * @apiSuccessExample {json} Success-Response (Manager):
 *     HTTP/1.1 201 Created
 *     {
 *       "message": "Manager créé avec succès"
 *     }
 *
 * @apiError BadRequest Erreur lors de la création de l'utilisateur/manager.
 *
 * @apiErrorExample {json} Error-Response:
 *     HTTP/1.1 400 Bad Request
 *     {
 *       "message": "Cette adresse e-mail est déjà utilisée"
 *     }
 *
 * @apiError Unauthorized Accès refusé si le rôle du token JWT n'est pas "admin".
 *
 * @apiErrorExample {json} Error-Response:
 *     HTTP/1.1 401 Unauthorized
 *     {
 *       "message": "Accès refusé"
 *     }
 */
router.post(
  '/',
  optionalAuth, // Middleware pour vérification optionnelle du token JWT
  [
    body('username').notEmpty().withMessage('Le nom d\'utilisateur est obligatoire').isLength({ min: 3, max: 30 }),
    body('email').isEmail().withMessage('Adresse e-mail invalide').normalizeEmail(),
    body('password').isLength({ min: 6 }).withMessage('Mot de passe trop court')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password } = req.body;

    // Déterminer le rôle : "manager" si admin connecté, sinon "user"
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
 * @api {post} /users/login Login a user
 * @apiName LoginUser
 * @apiGroup Users
 * @apiDescription Connecte un utilisateur existant.
 *
 * @apiBody {String} email Adresse e-mail.
 * @apiBody {String} password Mot de passe.
 *
 * @apiSuccess {String} message Succès de la connexion de l'utilisateur.
 * @apiSuccess {String} token JWT pour l'utilisateur connecté.
 *
 * @apiParamExample {json} Request-Example:
 *     {
 *       "email": "john.doe@example.com",
 *       "password": "password123"
 *     }
 *
 * @apiSuccessExample {json} Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *       "message": "Connexion réussie",
 *       "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *     }
 *
 * @apiError InvalidCredentials Identifiants invalides.
 *
 * @apiErrorExample {json} Error-Response:
 *     HTTP/1.1 400 Bad Request
 *     {
 *       "message": "Identifiants invalides",
 *       "details": "Le mot de passe fourni ne correspond pas au mot de passe stocké."
 *     }
 *
 * @apiError InternalServerError Erreur interne du serveur.
 *
 * @apiErrorExample {json} Error-Response:
 *     HTTP/1.1 500 Internal Server Error
 *     {
 *       "message": "Erreur interne du serveur",
 *       "details": "Détails de l'erreur..."
 *     }
 */
router.post('/login', [
  body('email').isEmail().withMessage('Adresse e-mail invalide').normalizeEmail(),
  body('password').notEmpty().withMessage('Le mot de passe est requis').isLength({ min: 8 }).withMessage('Le mot de passe doit contenir au moins 8 caractères'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
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
 * @api {put} /users/me Update user password and favorites
 * @apiName UpdateUser
 * @apiGroup Users
 * @apiDescription Permet à un utilisateur identifié de modifier son mot de passe et ses cocktails favoris.
 *
 * @apiHeader {String} authorization Token d'authentification JWT.
 * @apiBody {String} [password] Nouveau mot de passe (min. 8 caractères).
 * @apiBody {Array} [favorites] Liste des IDs des cocktails favoris.
 *
 * @apiSuccess {String} message Succès de la mise à jour de l'utilisateur.
 *
 * @apiParamExample {json} Request-Example:
 *     {
 *       "password": "newpassword123",
 *       "favorites": ["60d21b4667d0d8992e610c85", "60d21b4667d0d8992e610c86"]
 *     }
 *
 * @apiSuccessExample {json} Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *       "message": "Utilisateur mis à jour avec succès"
 *     }
 *
 * @apiError BadRequest Erreur lors de la mise à jour de l'utilisateur.
 *
 * @apiErrorExample {json} Error-Response:
 *     HTTP/1.1 400 Bad Request
 *     {
 *       "message": "Erreur lors de la mise à jour de l'utilisateur"
 *     }
 */
router.put('/me', verifyToken, [
  body('password').optional().isLength({ min: 8 }).withMessage('Le mot de passe doit contenir au moins 8 caractères'),
  body('favorites').optional().isArray().withMessage('Les favoris doivent être une liste d\'IDs de cocktails')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { password, favorites } = req.body;
  const updates = {};

  if (password) {
    updates.password = await bcrypt.hash(password, 12);
  }

  if (favorites) {
    updates.favorites = favorites;
  }

  console.log('User ID:', req.user.id);
  console.log('Updates:', updates);

  try {
    const updatedUser = await User.findByIdAndUpdate(req.user.id, updates, { new: true, runValidators: true });
    if (!updatedUser) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }
    res.status(200).json({ message: 'Utilisateur mis à jour avec succès', user: updatedUser });
  } catch (err) {
    console.error('Erreur lors de la mise à jour de l\'utilisateur:', err);
    res.status(400).json({ message: 'Erreur lors de la mise à jour de l\'utilisateur' });
  }
});

/**
* @api {delete} /users/me Delete user account
* @apiName DeleteUser
* @apiGroup Users
* @apiDescription Permet à un utilisateur identifié de supprimer son compte.
*
* @apiHeader {String} authorization Token d'authentification JWT.
*
* @apiSuccess {String} message Succès de la suppression de l'utilisateur.
*
* @apiSuccessExample {json} Success-Response:
*     HTTP/1.1 200 OK
*     {
*       "message": "Utilisateur supprimé avec succès"
*     }
*
* @apiError BadRequest Erreur lors de la suppression de l'utilisateur.
*
* @apiErrorExample {json} Error-Response:
*     HTTP/1.1 400 Bad Request
*     {
*       "message": "Erreur lors de la suppression de l'utilisateur"
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
 * @api {delete} /users/:id Delete user by ID
 * @apiName DeleteUserById
 * @apiGroup Users
 * @apiPermission admin
 * @apiDescription Permet à un administrateur de supprimer un utilisateur par son ID.
 *
 * @apiHeader {String} authorization Token d'authentification JWT.
 *
 * @apiParam {String} id ID de l'utilisateur à supprimer.
 *
 * @apiSuccess {String} message Succès de la suppression de l'utilisateur.
 *
 * @apiSuccessExample {json} Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *       "message": "Utilisateur supprimé avec succès"
 *     }
 *
 * @apiError BadRequest Erreur lors de la suppression de l'utilisateur.
 *
 * @apiErrorExample {json} Error-Response:
 *     HTTP/1.1 400 Bad Request
 *     {
 *       "message": "Erreur lors de la suppression de l'utilisateur"
 *     }
 *
 * @apiError Unauthorized Accès refusé si l'utilisateur n'est pas un administrateur.
 *
 * @apiErrorExample {json} Error-Response:
 *     HTTP/1.1 401 Unauthorized
 *     {
 *       "message": "Accès refusé"
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

export default router;