import express from 'express';
import Bar from '../models/bar.js';
import verifyToken from '../middlewares/verifyToken.js';
import verifyRole from '../middlewares/verifyRole.js';
import verifyCreator from '../middlewares/verifyCreator.js';

const router = express.Router();

// GET /bars - Obtenir tous les bars
router.get('/', async (req, res) => {
  try {
    const bars = await Bar.find().populate('manager', 'username email role');
    res.json(bars);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /bars/:id - Obtenir un bar spécifique
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

// POST /bars - Créer un nouveau bar (manager ou admin)
router.post('/', verifyToken, verifyRole('manager', 'admin'), async (req, res) => {
  try {
    const bar = new Bar({
      ...req.body,
      manager: req.user.id // Le créateur devient automatiquement le manager
    });
    const newBar = await bar.save();
    res.status(201).json(newBar);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// PATCH /bars/:id - Modifier partiellement un bar
router.patch('/:id', verifyToken, verifyCreator('bar'), async (req, res) => {
  try {
    const updatedBar = await Bar.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );
    res.json(updatedBar);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// PUT /bars/:id - Modifier complètement un bar
router.put('/:id', verifyToken, verifyCreator('bar'), async (req, res) => {
  try {
    const updatedBar = await Bar.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    res.json(updatedBar);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// DELETE /bars/:id - Supprimer un bar
router.delete('/:id', verifyToken, verifyCreator('bar'), async (req, res) => {
  try {
    await req.bar.remove();
    res.json({ message: 'Bar supprimé avec succès' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;