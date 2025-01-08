import supertest from "supertest";
import app from "../app";
import mongoose from "mongoose";
import { cleanUpDatabase } from "./utils.js";
import User from "../models/user";
import bcrypt from "bcrypt"; 
import Cocktail from "../models/cocktail";

beforeEach(cleanUpDatabase);

afterAll(async () => {
  await mongoose.disconnect();
});

describe("POST /api/cocktails", function () {
  it("should allow a manager or admin to create a new cocktail", async function () {
    
    const hashedPassword = await bcrypt.hash("ManagerPassword-123", 12);  

    const manager = new User({
      username: "ManagerUser",
      email: "manager@exemple.com",
      password: hashedPassword,  
      role: "manager",
    });
    await manager.save();

    const createdManager = await User.findOne({ email: "manager@exemple.com" });

    const loginRes = await supertest(app)
      .post("/api/users/login")
      .send({
        email: "manager@exemple.com",
        password: "ManagerPassword-123", 
      })
      .expect(200);


    const token = loginRes.body.token;

    const res = await supertest(app)
      .post("/api/cocktails")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Mojito",
        description: "A refreshing cocktail with mint and lime",
        instructions: ["Muddle mint leaves with sugar and lime juice.", "Add rum and top with soda water."],
        image_url: "http://example.com/mojito.jpg",
        ingredients: [
          { name: "Mint", quantity: 10, unit: "leaves" },
          { name: "Lime", quantity: 1, unit: "piece" },
          { name: "Rum", quantity: 50, unit: "ml" },
          { name: "Soda Water", quantity: 100, unit: "ml" },
          { name: "Sugar", quantity: 2, unit: "tsp" }
        ]
      })
      .expect(201)
      .expect("Content-Type", /json/);

    expect(res.body).toEqual(
      expect.objectContaining({
        message: "Cocktail créé avec succès",
        cocktail: expect.objectContaining({
          name: "Mojito",
          description: "A refreshing cocktail with mint and lime",
          instructions: ["Muddle mint leaves with sugar and lime juice.", "Add rum and top with soda water."],
          image_url: "http://example.com/mojito.jpg",
          ingredients: expect.arrayContaining([
            expect.objectContaining({ name: "Mint", quantity: 10, unit: "leaves" }),
            expect.objectContaining({ name: "Lime", quantity: 1, unit: "piece" }),
            expect.objectContaining({ name: "Rum", quantity: 50, unit: "ml" }),
            expect.objectContaining({ name: "Soda Water", quantity: 100, unit: "ml" }),
            expect.objectContaining({ name: "Sugar", quantity: 2, unit: "tsp" })
          ]),
          createdBy: manager._id.toString()
        })
      })
    );
  });
});

describe('DELETE /api/cocktails/:id', function() {
  it('should delete a specific cocktail', async function() {
    const manager = new User({
      username: 'ManagerUser',
      email: 'manager@exemple.com',
      password: await bcrypt.hash('ManagerPassword-123', 12),
      role: 'manager'
    });
    await manager.save();

    const cocktail = new Cocktail({
      name: 'Margarita',
      description: 'Un cocktail classique à base de tequila, de citron vert et de triple sec.',
      instructions: ['Mélanger les ingrédients', 'Servir dans un verre'],
      image_url: 'https://example.com/image.jpg',
      ingredients: [
        { name: 'Tequila', quantity: 50, unit: 'ml' },
        { name: 'Citron vert', quantity: 25, unit: 'ml' }
      ],
      createdBy: manager._id
    });
    await cocktail.save();

    const loginRes = await supertest(app)
      .post('/api/users/login')
      .send({
        email: 'manager@exemple.com',
        password: 'ManagerPassword-123'
      })
      .expect(200);

    const token = loginRes.body.token;

    const res = await supertest(app)
      .delete(`/api/cocktails/${cocktail._id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect('Content-Type', /json/);

    expect(res.body).toEqual(
      expect.objectContaining({
        message: 'Cocktail supprimé avec succès.'
      })
    );

    const deletedCocktail = await Cocktail.findById(cocktail._id);
    expect(deletedCocktail).toBeNull();
  });
}); 

describe('GET /api/cocktails', function() {
  it('should retrieve a list of cocktails with filtering, sorting, and pagination', async function() {
    const user = new User({
      username: 'JaneDoe',
      email: 'janedoe@exemple.com',
      password: await bcrypt.hash('Password-123', 12)
    });
    await user.save();

    const cocktails = [
      new Cocktail({
        name: 'Margarita',
        description: 'Un cocktail classique à base de tequila, de citron vert et de triple sec.',
        instructions: ['Mélanger les ingrédients', 'Servir dans un verre'],
        image_url: 'https://example.com/image.jpg',
        ingredients: [
          { name: 'Tequila', quantity: 50, unit: 'ml' },
          { name: 'Citron vert', quantity: 25, unit: 'ml' }
        ],
        createdBy: user._id
      }),
      new Cocktail({
        name: 'Mojito',
        description: 'Un cocktail rafraîchissant à base de rhum, de menthe et de citron vert.',
        instructions: ['Écraser la menthe', 'Ajouter le rhum', 'Servir avec de la glace'],
        image_url: 'https://example.com/mojito.jpg',
        ingredients: [
          { name: 'Rhum', quantity: 50, unit: 'ml' },
          { name: 'Menthe', quantity: 10, unit: 'feuilles' }
        ],
        createdBy: user._id
      })
    ];
    await Cocktail.insertMany(cocktails);

    const res = await supertest(app)
      .get('/api/cocktails?name=moj&sort=rank&order=desc&page=1')
      .expect(200)
      .expect('Content-Type', /json/);

    expect(res.body).toEqual(
      expect.objectContaining({
        cocktails: expect.arrayContaining([
          expect.objectContaining({
            name: 'Mojito',
            image_url: 'https://example.com/mojito.jpg',
            rank: 0,
            ratingsCount: 0
          })
        ]),
        pagination: expect.objectContaining({
          page: 1,
          totalPages: 1,
          totalItems: 1,
          itemsPerPage: 12
        })
      })
    );
  });
}); 