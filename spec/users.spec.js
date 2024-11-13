import supertest from "supertest"
import app from "../app"

describe('POST /users', function() {
  it('should create a user', async function() {
    const res = await supertest(app)
    .post('/users')
    .send({
      username: 'JohnDoe',
      email: 'johndoe@exemple.com',
      password: '123456789'
    })
    .expect(200)
    .expect('Content-Type', /json/);
    

  });
});
