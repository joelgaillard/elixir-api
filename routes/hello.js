import express from 'express';
const router = express.Router();

router.get('/', (req, res) => {
  const name = req.query.name;

  if (name) {
    res.send(`Hello, ${name}!`);
  } else {
    res.send('Hello, World!');
  }
});

export default router;
