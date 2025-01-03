import mongoose from 'mongoose';
import User from './models/user.js';
import Bar from './models/bar.js';
import Cocktail from './models/cocktail.js';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';

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

    // Créer les cocktails
    const cocktailsData = [
      { name: 'Mojito', description: 'Un cocktail rafraîchissant à base de rhum, de menthe, de citron vert et de soda.', instructions: ['Mélanger la menthe et le citron vert', 'Ajouter le rhum et le soda'], image_url: 'https://t4.ftcdn.net/jpg/01/60/44/93/360_F_160449396_E2yxHeN892NeSK41yuNu8ewxgCF3siGw.jpg', ingredients: [{ name: 'Rhum', quantity: 50, unit: 'ml' }, { name: 'Menthe', quantity: 10, unit: 'feuilles' }, { name: 'Citron vert', quantity: 1, unit: 'pièce' }, { name: 'Soda', quantity: 100, unit: 'ml' }] },
      { name: 'Margarita', description: 'Un cocktail classique à base de tequila, de triple sec et de jus de citron vert.', instructions: ['Mélanger la tequila, le triple sec et le jus de citron vert', 'Servir avec du sel sur le bord du verre'], image_url: 'https://kitchenswagger.com/wp-content/uploads/2019/06/classic-margarita-1.jpg', ingredients: [{ name: 'Tequila', quantity: 50, unit: 'ml' }, { name: 'Triple sec', quantity: 25, unit: 'ml' }, { name: 'Jus de citron vert', quantity: 25, unit: 'ml' }] },
      { name: 'Cosmopolitan', description: 'Un cocktail élégant à base de vodka, de triple sec, de jus de cranberry et de jus de citron vert.', instructions: ['Mélanger la vodka, le triple sec, le jus de cranberry et le jus de citron vert', 'Servir avec une tranche de citron vert'], image_url: 'https://toriavey.com/images/2011/03/The-Kosher-Cosmo-1.jpeg', ingredients: [{ name: 'Vodka', quantity: 40, unit: 'ml' }, { name: 'Triple sec', quantity: 15, unit: 'ml' }, { name: 'Jus de cranberry', quantity: 30, unit: 'ml' }, { name: 'Jus de citron vert', quantity: 10, unit: 'ml' }] },
      { name: 'Piña Colada', description: 'Un cocktail tropical à base de rhum, de crème de coco et de jus d\'ananas.', instructions: ['Mélanger le rhum, la crème de coco et le jus d\'ananas', 'Servir avec une tranche d\'ananas'], image_url: 'https://cocktailcorner.fr/wp-content/uploads/2021/03/Pina-Colada.jpg', ingredients: [{ name: 'Rhum', quantity: 50, unit: 'ml' }, { name: 'Crème de coco', quantity: 30, unit: 'ml' }, { name: 'Jus d\'ananas', quantity: 90, unit: 'ml' }] },
      { name: 'Daiquiri', description: 'Un cocktail simple et rafraîchissant à base de rhum, de jus de citron vert et de sucre.', instructions: ['Mélanger le rhum, le jus de citron vert et le sucre', 'Servir avec une tranche de citron vert'], image_url: 'https://cocktailcorner.fr/wp-content/uploads/Photos_Cocktails/Daiquiri-classique.jpg', ingredients: [{ name: 'Rhum', quantity: 50, unit: 'ml' }, { name: 'Jus de citron vert', quantity: 25, unit: 'ml' }, { name: 'Sucre', quantity: 10, unit: 'g' }] },
      { name: 'Old Fashioned', description: 'Un cocktail classique à base de whisky, de sucre, d\'eau et d\'amers.', instructions: ['Mélanger le whisky, le sucre, l\'eau et les amers', 'Servir avec une tranche d\'orange'], image_url: 'https://images.immediate.co.uk/production/volatile/sites/30/2020/08/old-fashioned-5a4bab5.jpg', ingredients: [{ name: 'Whisky', quantity: 50, unit: 'ml' }, { name: 'Sucre', quantity: 1, unit: 'morceau' }, { name: 'Eau', quantity: 10, unit: 'ml' }, { name: 'Amers', quantity: 2, unit: 'traits' }] },
      { name: 'Martini', description: 'Un cocktail élégant à base de gin et de vermouth sec.', instructions: ['Mélanger le gin et le vermouth sec', 'Servir avec une olive'], image_url: 'https://www.1001cocktails.com/wp-content/uploads/1001cocktails/2023/03/81970_origin-2048x1365.jpg', ingredients: [{ name: 'Gin', quantity: 60, unit: 'ml' }, { name: 'Vermouth sec', quantity: 10, unit: 'ml' }] },
      { name: 'Bloody Mary', description: 'Un cocktail épicé à base de vodka, de jus de tomate, de jus de citron et d\'épices.', instructions: ['Mélanger la vodka, le jus de tomate, le jus de citron et les épices', 'Servir avec une branche de céleri'], image_url: 'https://www.foodandwine.com/thmb/YsCok7ipLhhNLAjQ4yRknEoF3z0=/1500x0/filters:no_upscale():max_bytes(150000):strip_icc()/Classic-Bloody-Mary-FT-RECIPE0823-36946b1bc498416284504d5f68dc12a5.jpg', ingredients: [{ name: 'Vodka', quantity: 50, unit: 'ml' }, { name: 'Jus de tomate', quantity: 100, unit: 'ml' }, { name: 'Jus de citron', quantity: 10, unit: 'ml' }, { name: 'Épices', quantity: 1, unit: 'pincée' }] },
      { name: 'Mai Tai', description: 'Un cocktail exotique à base de rhum, de curaçao orange, de sirop d\'orgeat et de jus de citron vert.', instructions: ['Mélanger le rhum, le curaçao orange, le sirop d\'orgeat et le jus de citron vert', 'Servir avec une tranche de citron vert'], image_url: 'https://www.cocktail.fr/wp-content/uploads/2017/05/mai-tai.jpg', ingredients: [{ name: 'Rhum', quantity: 40, unit: 'ml' }, { name: 'Curaçao orange', quantity: 15, unit: 'ml' }, { name: 'Sirop d\'orgeat', quantity: 10, unit: 'ml' }, { name: 'Jus de citron vert', quantity: 10, unit: 'ml' }] },
      { name: 'Negroni', description: 'Un cocktail italien à base de gin, de vermouth rouge et de Campari.', instructions: ['Mélanger le gin, le vermouth rouge et le Campari', 'Servir avec une tranche d\'orange'], image_url: 'https://ginsiders.com/wp-content/uploads/2023/07/negroni-1200-630.png', ingredients: [{ name: 'Gin', quantity: 30, unit: 'ml' }, { name: 'Vermouth rouge', quantity: 30, unit: 'ml' }, { name: 'Campari', quantity: 30, unit: 'ml' }] }
    ];

    const cocktails = [];
    for (const cocktailData of cocktailsData) {
      const cocktail = new Cocktail({
        name: cocktailData.name,
        description: cocktailData.description,
        instructions: cocktailData.instructions,
        image_url: cocktailData.image_url,
        ingredients: cocktailData.ingredients,
        createdBy: admin._id
      });
      await cocktail.save();
      cocktails.push(cocktail);
    }

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

    console.log('Database seeded successfully');
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    mongoose.connection.close();
  }
}

// Exécuter la fonction de seed
seedDatabase();