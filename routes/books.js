import express from 'express';
import Book from '../models/book.js'; // Importer le modèle Book

const router = express.Router();

// Route pour obtenir un livre par son ID
router.get('/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const book = await Book.findOne({ id: id });
        if (!book) {
            return res.status(404).send(`No book found with ID ${id}.`);
        }
        res.json(book);
    } catch (error) {
        res.status(500).send('An error occurred while retrieving the book.');
    }
});

// Route pour ajouter un nouveau livre
router.post('/', async (req, res) => {
    const { id, title, author, publication } = req.body;

    const newBook = new Book({
        id,
        title,
        author,
        publication
    });

    try {
        const savedBook = await newBook.save();
        res.status(201).json(savedBook);
    } catch (error) {
        res.status(400).send('An error occurred while saving the book.');
    }
});

export default router;
