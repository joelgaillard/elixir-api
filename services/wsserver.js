import jwt from 'jsonwebtoken';
import Bar from '../models/bar.js';
import { WebSocketServer } from 'ws';
import Message from '../models/message.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Chargement des variables d'environnement
dotenv.config();

// Vérification des variables d'environnement nécessaires
['DATABASE_URL', 'JWT_SECRET', 'BASE_URL'].forEach((key) => {
  if (!process.env[key]) {
    console.error(`Variable d'environnement manquante : ${key}`);
    process.exit(1);
  }
});

// Connexion à MongoDB
mongoose.connect(process.env.DATABASE_URL)
  .then(() => console.log('MongoDB connecté'))
  .catch(err => {
    console.error('Erreur connexion MongoDB:', err);
    process.exit(1);
  });

const wsServer = new WebSocketServer({ noServer: true });
const chatRooms = new Map();

// Fonction pour calculer la distance entre deux points géographiques
function calculateDistance(lat1, lng1, lat2, lng2) {
  if (isNaN(lat1) || isNaN(lng1) || isNaN(lat2) || isNaN(lng2)) {
    throw new Error('Coordonnées invalides');
  }
  const toRad = (value) => (value * Math.PI) / 180;
  const R = 6371; // Rayon de la Terre en km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Gestion des connexions WebSocket
wsServer.on('connection', async (ws, request) => {
  try {
    // Analyse des paramètres de l'URL
    const { searchParams } = new URL(request.url, process.env.BASE_URL);
    const chatRoomId = searchParams.get('barId');
    const userId = searchParams.get('userId');
    const token = searchParams.get('token');
    const userLat = parseFloat(searchParams.get('lat'));
    const userLng = parseFloat(searchParams.get('lng'));

    // Vérification des paramètres obligatoires
    if (!chatRoomId || !userId || !token || isNaN(userLat) || isNaN(userLng)) {
      ws.send(JSON.stringify({ error: 'Paramètres manquants ou invalides.' }));
      ws.close();
      return;
    }

    // Vérification du token JWT
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.id !== userId) {
        ws.send(JSON.stringify({ error: 'Token JWT invalide ou utilisateur non autorisé.' }));
        ws.close();
        return;
      }
    } catch (err) {
      console.error('Erreur JWT:', err.message);
      ws.send(JSON.stringify({ error: 'Échec de l\'authentification.' }));
      ws.close();
      return;
    }

    // Vérification de la distance entre l'utilisateur et le bar
    const bar = await Bar.findById(chatRoomId);
    if (!bar) {
      ws.send(JSON.stringify({ error: 'Bar introuvable.' }));
      ws.close();
      return;
    }

    const distance = calculateDistance(userLat, userLng, bar.location.coordinates[1], bar.location.coordinates[0]);
    if (distance > 0.1) {
      ws.send(JSON.stringify({ error: 'Vous êtes trop loin du bar pour rejoindre ce chat.' }));
      ws.close();
      return;
    }

    // Gestion des salles de chat
    if (!chatRooms.has(chatRoomId)) {
      chatRooms.set(chatRoomId, new Set());
    }
    chatRooms.get(chatRoomId).add(ws);

    // Gestion des messages envoyés par le client
    ws.on('message', async (data) => {
      try {
        const parsedData = JSON.parse(data);

        if (!parsedData.username || !parsedData.content) {
          ws.send(JSON.stringify({ error: 'Données de message invalides.' }));
          return;
        }

        const messageData = {
          barId: chatRoomId,
          userId,
          username: parsedData.username,
          content: parsedData.content,
        };

        // Vérifier l'état de la connexion MongoDB
        if (mongoose.connection.readyState !== 1) {
          console.error('MongoDB non connecté');
          ws.send(JSON.stringify({ error: 'Problème de connexion à la base de données.' }));
          return;
        }

        const newMessage = await Message.create(messageData);

        const broadcastMessage = JSON.stringify({
          type: 'message',
          data: {
            messageId: newMessage._id,
            userId,
            username: messageData.username,
            content: messageData.content,
            timestamp: newMessage.timestamp.toISOString(),
          },
        });

        chatRooms.get(chatRoomId).forEach((client) => {
          if (client.readyState === ws.OPEN) {
            client.send(broadcastMessage);
          }
        });
      } catch (error) {
        console.error('Erreur lors de l\'envoi du message:', error.stack);
        ws.send(JSON.stringify({ error: 'Erreur lors de l\'enregistrement du message.' }));
      }
    });

    // Gestion de la fermeture de la connexion
    ws.on('close', () => {
      const room = chatRooms.get(chatRoomId);
      if (room) {
        room.delete(ws);
        if (room.size === 0) {
          chatRooms.delete(chatRoomId);
        }
      }
      console.log(`Utilisateur ${userId} déconnecté du chatRoom ${chatRoomId}`);
    });

    // Gestion des erreurs WebSocket
    ws.on('error', (err) => {
      console.error(`Erreur WebSocket pour utilisateur ${userId}:`, err.message);
      ws.close();
    });
  } catch (err) {
    console.error('Erreur inattendue:', err.stack);
    ws.send(JSON.stringify({ error: 'Erreur interne du serveur.' }));
    ws.close();
  }
});

export default wsServer;
