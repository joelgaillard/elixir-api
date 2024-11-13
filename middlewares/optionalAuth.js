import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const optionalAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return next(); // Pas de token, continuer la requête sans vérification
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Token invalide' });
    }
    req.user = user; // Ajouter l'utilisateur au requête pour accès dans la logique de la route
    next();
  });
};

export default optionalAuth;
