import supertest from "supertest"
import app from "../app"
import mongoose from "mongoose";
import { cleanUpDatabase } from "./utils.js";
import User from "../models/user";
import dotenv from 'dotenv';
import bcrypt from "bcrypt";

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
        token: expect.any(String) 
      })
    );
  });
});

describe('PATCH /api/users/me', function() {
  it('should update the user information', async function() {
    const user = new User({
      username: 'JaneDoe',
      email: 'janedoe@exemple.com',
      password: await bcrypt.hash('Password-123', 12)
    });
    await user.save();

    const loginRes = await supertest(app)
      .post('/api/users/login')
      .send({
        email: 'janedoe@exemple.com',
        password: 'Password-123'
      })
      .expect(200);

    const token = loginRes.body.token;

    const res = await supertest(app)
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({
        username: 'JaneDoeUpdated',
        email: 'janedoeupdated@exemple.com',
        password: 'NewPassword-123'
      })
      .expect(200)
      .expect('Content-Type', /json/);

    expect(res.body).toEqual(
      expect.objectContaining({
        message: 'Utilisateur mis à jour avec succès.',
      })
    );

    const updatedUser = await User.findById(user._id);
    expect(updatedUser).not.toBeNull();
    expect(updatedUser.username).toBe('JaneDoeUpdated');
    expect(updatedUser.email).toBe('janedoeupdated@exemple.com');
    const isPasswordMatch = await bcrypt.compare('NewPassword-123', updatedUser.password);
    expect(isPasswordMatch).toBe(true);
  });
});

describe('POST /api/users/me/favorites', function() {
  it('should add a favorite for the user', async function() {
    const user = new User({
      username: 'JaneDoe',
      email: 'janedoe@exemple.com',
      password: await bcrypt.hash('Password-123', 12)
    });
    await user.save();

    const loginRes = await supertest(app)
      .post('/api/users/login')
      .send({
        email: 'janedoe@exemple.com',
        password: 'Password-123'
      })
      .expect(200);

    const token = loginRes.body.token;

    const favorite = {
      cocktail_id: new mongoose.Types.ObjectId().toString(),
    };
    const res = await supertest(app)
      .post('/api/users/me/favorites')
      .set('Authorization', `Bearer ${token}`)
      .send(favorite)
      .expect(200)
      .expect('Content-Type', /json/);

    expect(res.body).toEqual(
      expect.arrayContaining([favorite.cocktail_id])
    );
  });
});

  describe('DELETE /api/users/me', function() {
    it('should delete the user account', async function() {
      const user = new User({
        username: 'JaneDoe',
        email: 'janedoe@exemple.com',
        password: await bcrypt.hash('Password-123', 12)
      });
      await user.save();
  
      const loginRes = await supertest(app)
        .post('/api/users/login')
        .send({
          email: 'janedoe@exemple.com',
          password: 'Password-123'
        })
        .expect(200);
  
      const token = loginRes.body.token;
  
      const res = await supertest(app)
        .delete('/api/users/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect('Content-Type', /json/);
  
      expect(res.body).toEqual(
        expect.objectContaining({
          message: 'Utilisateur supprimé avec succès'
        })
      );
  
      const deletedUser = await User.findById(user._id);
      expect(deletedUser).toBeNull();
    });
  });

  describe('DELETE /api/users/:id', function() {
    it('should allow an admin to delete a specific user by ID', async function() {
    
      const admin = new User({
        username: 'AdminUser',
        email: 'admin@exemple.com',
        password: await bcrypt.hash('AdminPassword-123', 12),
        role: 'admin'
      });
      await admin.save();
  
      const user = new User({
        username: 'JaneDoe',
        email: 'janedoe@exemple.com',
        password: await bcrypt.hash('Password-123', 12)
      });
      await user.save();
  
      const loginRes = await supertest(app)
        .post('/api/users/login')
        .send({
          email: 'admin@exemple.com',
          password: 'AdminPassword-123'
        })
        .expect(200);
  
      const token = loginRes.body.token;
  
      const res = await supertest(app)
        .delete(`/api/users/${user._id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect('Content-Type', /json/);
  
      expect(res.body).toEqual(
        expect.objectContaining({
          message: 'Utilisateur supprimé avec succès'
        })
      );
  
      const deletedUser = await User.findById(user._id);
      expect(deletedUser).toBeNull();
    });
  });  