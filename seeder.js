import mongoose from 'mongoose';
import User from './models/user.js';
import Bar from './models/bar.js';
import Cocktail from './models/cocktail.js';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import fs from 'fs';
import { faker } from '@faker-js/faker';

dotenv.config();


// Connexion à la base de données MongoDB
mongoose.connect(process.env.DATABASE_URL).then(() => {
  console.log('Connected to MongoDB');
}).catch((error) => {
  console.error('Error connecting to MongoDB:', error);
});

// Fonction pour créer les données de seed
async function seedDatabase() {
  try {
    // Supprimer les anciennes données
    await User.deleteMany({});
    await Bar.deleteMany({});
    await Cocktail.deleteMany({});

    // Hacher les mots de passe
    const adminPassword = await bcrypt.hash('Admin123!', 10);
    const managerPassword = await bcrypt.hash('Manager123!', 10);
    const userPassword = await bcrypt.hash('User123!', 10);

    // Créer les utilisateurs
    const admin = new User({ username: 'admin', email: 'admin@elixir.ch', password: adminPassword, role: 'admin' });
    const manager = new User({ username: 'manager', email: 'manager@elixir.ch', password: managerPassword, role: 'manager' });
    const user = new User({ username: 'user', email: 'user@elixir.ch', password: userPassword, role: 'user' });
    
    await admin.save();
    await manager.save();
    await user.save();

    const fakeUsers = await Promise.all(
      Array.from({ length: 100 }).map(async () => {
        const password = await bcrypt.hash(faker.internet.password(), 10);
        const user = new User({
          username: faker.internet.username().replace(/\./g, '_').replace(/\-/g, '_').slice(0, 30),
          email: faker.internet.email(),
          password,
          role: 'user'
        });
        return user.save();
      })
    );


    // Charger et créer les cocktails
    const cocktailsData = JSON.parse(fs.readFileSync('./data/cocktails.json', 'utf8'));
    
    const cocktails = await Promise.all(
      cocktailsData.map(async (cocktailData) => {
        const cocktail = new Cocktail({
          ...cocktailData,
          createdBy: admin._id
        });
        return cocktail.save();
      })
    );

    // Ajouter des cocktails en favoris pour l'utilisateur
    user.favorites.push(cocktails[0]._id, cocktails[1]._id, cocktails[2]._id);
    await user.save();

    // Créer un bar pour le manager
    const bar = new Bar({
      name: 'Bar de la HEIG',
      description: 'Magnifique bar étudiant',
      image_url: 'https://www.shutterstock.com/image-vector/night-bar-club-high-chair-600nw-2304087951.jpg',
      location: {
        type: 'Point',
        coordinates: [6.6473526004547905, 46.78151750065407]
      }
    });
    bar.manager = manager._id;
    await bar.save();

    const allUsers = [admin, manager, user, ...fakeUsers];
    await Promise.all(
      cocktails.map(async (cocktail) => {
        const randomReviews = Array.from({ length: faker.number.int({ min: 1, max: 100 }) }).map(() => ({
          user: faker.helpers.arrayElement(allUsers)._id,
          rating: faker.helpers.weightedArrayElement([
            { weight: 0.1, value: 1 },
            { weight: 0.1, value: 2 },
            { weight: 0.3, value: 3 },
            { weight: 0.4, value: 4 },
            { weight: 1, value: 5 }
          ])
        }));
        cocktail.ratings.push(...randomReviews);
        cocktail.calculateRank();
        return cocktail.save();
      })
    );

    console.log('Database seeded successfully');
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    mongoose.connection.close();
  }
}

// Exécuter la fonction de seed
seedDatabase();