import jwt from 'jsonwebtoken';
import Bar from '../models/bar.js';
import { WebSocketServer } from 'ws';
import Message from '../models/message.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';


dotenv.config();

mongoose.connect(process.env.DATABASE_URL)
  .then(() => console.log('MongoDB connecté'))
  .catch(err => console.error('Erreur connexion MongoDB:', err));

const wsServer = new WebSocketServer({ noServer: true });

const chatRooms = new Map();

wsServer.on('connection', async (ws, request) => {
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
      console.error('Erreur JWT:', err);
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
  

  if (!chatRooms.has(chatRoomId)) {
    chatRooms.set(chatRoomId, new Set());
  }
  chatRooms.get(chatRoomId).add(ws);

  ws.on('message', async (data) => {
    try {
      const parsedData = JSON.parse(data);
      console.log('Message reçu:', parsedData); // Debug log 1
  
      // Préparer les données du message
      const messageData = {
        barId: chatRoomId,
        userId: userId,
        username: parsedData.username,
        content: parsedData.content
      };
      console.log('Données du message à créer:', messageData); // Debug log 2
  
      // Vérifier l'état de la connexion MongoDB
      console.log('État MongoDB:', mongoose.connection.readyState); // Debug log 3
  
      const newMessage = await Message.create(messageData);
      console.log('Message créé:', newMessage); // Debug log 4
  
      const broadcastMessage = JSON.stringify({
        type: 'message',
        data: {
          messageId: newMessage._id,
          userId: userId,
          username: messageData.username,
          content: messageData.content,
          timestamp: newMessage.timestamp.toISOString(), // Ajout du timestamp formaté
        },
      });
      
      console.log('Message à envoyer:', broadcastMessage);
      
      chatRooms.get(chatRoomId).forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(broadcastMessage);
        }
      });
       } catch (error) {
      console.error('Erreur détaillée:', error.stack); // Debug log 5
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Erreur enregistrement message'
      }));
    }
  });
  ws.on('close', () => {
    chatRooms.get(chatRoomId).delete(ws);
    if (chatRooms.get(chatRoomId).size === 0) {
      chatRooms.delete(chatRoomId);
    }
    console.log(`Utilisateur ${userId} déconnecté du chatRoom ${chatRoomId}`);
  });
});

function calculateDistance(lat1, lng1, lat2, lng2) {
  const toRad = (value) => (value * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default wsServer;
