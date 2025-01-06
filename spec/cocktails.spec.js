import supertest from "supertest";
import app from "../app";
import mongoose from "mongoose";
import { cleanUpDatabase } from "./utils.js";
import User from "../models/user";
import bcrypt from "bcrypt"; 

beforeEach(cleanUpDatabase);

afterAll(async () => {
  await mongoose.disconnect();
});

describe("POST /api/cocktails", function () {
  it("should allow a manager or admin to create a new cocktail", async function () {
    
    const hashedPassword = await bcrypt.hash("ManagerPassword-123", 12);  

    // Créez un utilisateur manager pour le test
    const manager = new User({
      username: "ManagerUser",
      email: "manager@exemple.com",
      password: hashedPassword,  
      role: "manager",
    });
    await manager.save();

    // Vérifiez si l'utilisateur est bien enregistré dans la base de données
    const createdManager = await User.findOne({ email: "manager@exemple.com" });
    console.log("Created manager: ", createdManager);  

    // Obtenez un token d'authentification pour le manager
    const loginRes = await supertest(app)
      .post("/api/users/login")
      .send({
        email: "manager@exemple.com",
        password: "ManagerPassword-123", 
      })
      .expect(200);

    console.log("Login response: ", loginRes.body);  

    const token = loginRes.body.token;

    // Créez un nouveau cocktail
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

    // Vérifiez la réponse
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
