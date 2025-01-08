import supertest from "supertest"
import app from "../app.js"
import mongoose from "mongoose";
import { cleanUpDatabase } from "./utils.js";
import User from "../models/user.js";
import Bar from "../models/bar.js";
import dotenv from 'dotenv';
import bcrypt from "bcrypt";

beforeEach(cleanUpDatabase);

afterAll(async () => {
  await mongoose.disconnect();
});

describe('POST /api/bars', function() {
  it('should allow a manager or admin to create a new bar', async function() {
    const hashedPassword = await bcrypt.hash("ManagerPassword-123", 12);

    const manager = new User({
      username: "ManagerUser",
      email: "manager@exemple.com",
      password: hashedPassword,
      role: "manager",
    });
    await manager.save();

    const loginRes = await supertest(app)
      .post("/api/users/login")
      .send({
        email: "manager@exemple.com",
        password: "ManagerPassword-123",
      })
      .expect(200);

    const token = loginRes.body.token;

    const res = await supertest(app)
      .post("/api/bars")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Le Bar Sympa",
        description: "Un bar sympa dans le quartier",
        image_url: "http://example.com/bar.jpg",
        location: {
          type: "Point",
          coordinates: [-73.856077, 40.848447]
        }
      })
      .expect(201)
      .expect("Content-Type", /json/);

    expect(res.body).toEqual(
      expect.objectContaining({
        message: "Bar créé avec succès",
        bar: expect.objectContaining({
          name: "Le Bar Sympa",
          description: "Un bar sympa dans le quartier",
          image_url: "http://example.com/bar.jpg",
          location: expect.objectContaining({
            type: "Point",
            coordinates: [-73.856077, 40.848447]
          }),
          manager: manager._id.toString()
        })
      })
    );
  });
});

describe('GET /api/bars', function() {
  it('should retrieve a list of bars with filtering, sorting, and pagination', async function() {
    const user = new User({
      username: 'JaneDoe',
      email: 'janedoe@exemple.com',
      password: await bcrypt.hash('Password-123', 12)
    });
    await user.save();

    const bars = [
      new Bar({
        name: 'Le Bar Moderne',
        description: 'Un bar branché pour les amateurs de cocktails.',
        image_url: 'https://example.com/images/bar.jpg',
        location: {
          type: 'Point',
          coordinates: [2.3522, 48.8566]
        },
        manager: user._id
      }),
      new Bar({
        name: 'Le Bar Classique',
        description: 'Un bar classique pour les amateurs de cocktails.',
        image_url: 'https://example.com/images/bar2.jpg',
        location: {
          type: 'Point',
          coordinates: [2.3522, 48.8566]
        },
        manager: user._id
      })
    ];
    await Bar.insertMany(bars);

    const res = await supertest(app)
      .get('/api/bars?lat=48.8566&lng=2.3522&radius=10000')
      .expect(200)
      .expect('Content-Type', /json/);

    expect(res.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Le Bar Moderne',
          description: 'Un bar branché pour les amateurs de cocktails.',
          image_url: 'https://example.com/images/bar.jpg',
          location: expect.objectContaining({
            type: 'Point',
            coordinates: [2.3522, 48.8566]
          })
        }),
        expect.objectContaining({
          name: 'Le Bar Classique',
          description: 'Un bar classique pour les amateurs de cocktails.',
          image_url: 'https://example.com/images/bar2.jpg',
          location: expect.objectContaining({
            type: 'Point',
            coordinates: [2.3522, 48.8566]
          })
        })
      ])
    );
  });
});