import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Récupère le token après "Bearer"

  if (!token) {
    return res.status(401).json({
      errors: [{ msg : "Accès refusé. Aucun token fourni." }]
    }

    );
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json(
        { errors: [{ msg: "Token invalide ou expiré." }] }
      );
    }

    req.user = user; // Attache les informations du token (user) à la requête
    next(); // Passe au middleware suivant ou à la route
  });
}

export default verifyToken;
