import express from 'express';
const router = express.Router();

router.post('/', (req, res) => {
    const { numbers } = req.body;
  
    if (!Array.isArray(numbers) || numbers.some(num => typeof num !== 'number')) {
      return res.status(422).send("The request body must contain a list of numbers.");
    }
  
    const total = numbers.reduce((sum, num) => sum + num, 0);
    const average = total / numbers.length;
  
    res.json({
      average: average,
      total: total
    });
  });
export default router;