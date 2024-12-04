import supertest from "supertest"
import app from "../app"
import mongoose from "mongoose";
import { cleanUpDatabase } from "./utils.js";
import User from "../models/user";
import dotenv from 'dotenv';

beforeEach(cleanUpDatabase);

afterAll(async () => {
  await mongoose.disconnect();
});

describe('POST /api/users', function() {
  it('should create a user', async function() {
    const res = await supertest(app)
    .post('/api/users')
    .send({
      username: 'JohnDoe',
      email: 'johndoe@exemple.com',
      password: 'Password-123'
    })
    .expect(201)
    .expect('Content-Type', /json/);
  
    expect(res.body).toEqual(
      expect.objectContaining({
        message: 'Utilisateur créé avec succès',
        token: expect.any(String) // Vérifier que la réponse contient un token
      })
    );
  });
});


