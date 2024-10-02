import express from "express";
import createError from "http-errors";
import logger from "morgan";
import mongoose from 'mongoose';


import indexRouter from "./routes/index.js";
import usersRouter from "./routes/users.js";
import helloRouter from "./routes/hello.js";
import computationsRouter from "./routes/computations.js";
import booksRouter from "./routes/books.js";

const app = express();

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/books')
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch((err) => {
    console.error('Error connecting to MongoDB:', err);
  });

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use("/", indexRouter);
app.use("/users", usersRouter);
app.use("/hello", helloRouter);
app.use("/computations", computationsRouter);
app.use("/books", booksRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  res.status(err.status || 500);
  res.send(err.message);
});

export default app;
