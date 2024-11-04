import express from 'express';
import User from '../models/user.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import dotenv from 'dotenv';

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

// Middleware pour vérifier le token JWT
function verifyToken(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'Aucun token fourni' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: 'Token invalide' });
    }
    req.user = decoded;
    next();
  });
}

/**
 * @api {post} /users/register Register a new user
 * @apiName CreateUser
 * @apiGroup Users
 * @apiDescription Crée un nouvel utilisateur.
 *
 * @apiBody {String} username Nom d'utilisateur.
 * @apiBody {String} email Adresse e-mail.
 * @apiBody {String} password Mot de passe (min. 8 caractères).
 *
 * @apiSuccess {String} message Succès de la création de l'utilisateur.
 * @apiSuccess {String} token JWT pour l'utilisateur créé.
 */
router.post('/register', [
  body('username').notEmpty().withMessage('Le nom d\'utilisateur est obligatoire').isLength({ min: 3, max: 30 }),
  body('email').isEmail().withMessage('Adresse e-mail invalide').normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Mot de passe trop court'),
  body('role').optional().isIn(['user', 'manager', 'admin']).withMessage('Rôle non valide') // Vérifiez que le rôle est optionnel ici
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { username, email, password, role } = req.body; // Récupérez le rôle ici

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Cette adresse e-mail est déjà utilisée' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const newUser = new User({ username, email, password: hashedPassword, role: role || 'user' }); // Assurez-vous de définir le rôle ici
    await newUser.save();
    
    const token = generateToken(newUser);

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 15 * 60 * 1000 // 15 minutes
    });

    res.status(201).json({ message: 'Utilisateur créé avec succès', token });
  } catch (err) {
    console.error('Erreur lors de l\'inscription:', err);
    res.status(500).json({ message: 'Erreur interne du serveur' });
  }
});


/**
 * @api {post} /users/login Login to an existing account
 * @apiName LoginUser
 * @apiGroup Users
 * @apiDescription Connecte un utilisateur existant.
 *
 * @apiBody {String} email Adresse e-mail de l'utilisateur.
 * @apiBody {String} password Mot de passe de l'utilisateur.
 *
 * @apiSuccess {String} message Message de succès.
 * @apiSuccess {String} token JWT pour la session de l'utilisateur.
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
 * @api {post} /users/create-manager Create a new manager
 * @apiName CreateManager
 * @apiGroup Users
 * @apiDescription Crée un nouvel utilisateur avec un rôle de manager.
 *
 * @apiHeader {String} authorization Token d'authentification JWT.
 * @apiBody {String} username Nom d'utilisateur.
 * @apiBody {String} email Adresse e-mail.
 * @apiBody {String} password Mot de passe (min. 8 caractères).
 * @apiBody {String="manager"} role Le rôle de l'utilisateur (doit être "manager").
 *
 * @apiSuccess {String} message Succès de la création du manager.
 * @apiSuccess {String} token JWT pour le manager créé.
 */
router.post('/create-manager', [
  body('username').notEmpty().withMessage('Le nom d\'utilisateur est requis').isLength({ min: 3, max: 30 }),
  body('email').isEmail().withMessage('Adresse e-mail invalide').normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Mot de passe trop court'),
  body('role').equals('manager').withMessage('Le rôle doit être "manager"'),
], verifyToken, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { username, email, password, role } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Cette adresse e-mail est déjà utilisée' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const newManager = new User({ username, email, password: hashedPassword, role });
    await newManager.save();

    const token = generateToken(newManager);

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 15 * 60 * 1000 // 15 minutes
    });

    res.status(201).json({ message: 'Manager créé avec succès', token });
  } catch (err) {
    console.error('Erreur lors de la création du manager:', err);
    res.status(500).json({ message: 'Erreur interne du serveur' });
  }
});

// Exporter le router
export default router;
