import mongoose from 'mongoose';

// Définir le schéma du livre
const bookSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  author: { type: String, required: true },
  publication: { type: Number, required: true }
});

// Créer et exporter le modèle 'Book'
const Book = mongoose.model('Book', bookSchema);

export default Book;