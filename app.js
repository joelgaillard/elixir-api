import express from "express";
import createError from "http-errors";
import logger from "morgan";
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";

import usersRouter from "./routes/users.js";
import cocktailsRouter from "./routes/cocktails.js";
import ingredientsRouter from "./routes/ingredients.js";
import barsRouter from "./routes/bars.js";

dotenv.config();

// Obtenir __dirname pour les modules ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Connect to MongoDB
mongoose
  .connect(process.env.DATABASE_URL)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("Error connecting to MongoDB:", err));

// Configuration CORS
app.use(
  cors({
    origin: "https://elixir-icgi.onrender.com",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization", "x-requested-with"],
  })
);

// Middleware
app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Configure apiDoc to serve documentation
app.use("/", express.static(path.join(__dirname, "docs")));

// API routes
app.use("/api/users", usersRouter);
app.use("/api/cocktails", cocktailsRouter);
app.use("/api/ingredients", ingredientsRouter);
app.use("/api/bars", barsRouter);

// catch 404 and forward to error handler
app.use((req, res, next) => {
  next(createError(404));
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  res.status(err.status || 500);
  res.json({ error: res.locals.message });
});

// Enable CORS
app.use(cors());

export default app;
