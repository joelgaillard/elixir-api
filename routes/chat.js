import express from 'express';
import Message from '../models/message.js';
import ChatRoom from '../models/chatRoom.js';

const router = express.Router();

// Route pour envoyer un message
router.post('/send', async (req, res) => {
  const { chatRoomId, userId, content } = req.body;

  try {
    const chatRoom = await ChatRoom.findById(chatRoomId);
    if (!chatRoom) {
      return res.status(404).json({ error: 'Chat room not found' });
    }

    const newMessage = new Message({ chatRoomId, userId, content });
    await newMessage.save();

    // Envoyer le message à tous les utilisateurs dans le salon via WebSocket
    req.app.get('wsServer').channels.get(chatRoomId).forEach(client => {
      if (client.readyState === client.OPEN) {
        client.send(JSON.stringify({ chatRoomId, userId, content }));
      }
    });

    res.status(201).json(newMessage);
  } catch (error) {
    res.status(500).json({ error: 'Failed to send message' });
  }
});

export default router;