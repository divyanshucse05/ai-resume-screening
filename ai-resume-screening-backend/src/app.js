import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import jobRoutes from "./routes/jobRoutes.js";
import candidateRoutes from "./routes/candidateRoutes.js";

const app = express();

const allowedOrigins = (process.env.CLIENT_ORIGIN || "*")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins.includes("*") ? true : allowedOrigins,
    credentials: true,
  })
);
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/api/health", (_req, res) => {
  const dbState = mongoose.connection.readyState;
  res.json({
    status: "ok",
    database: dbState === 1 ? "connected" : "disconnected",
    llmProvider: process.env.GEMINI_API_KEY
      ? "gemini"
      : process.env.OPENAI_API_KEY
      ? "openai"
      : "keyword-fallback",
  });
});

app.use(["/api/jobs", "/api/candidates"], (_req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      error: "MongoDB is not connected. Add MONGODB_URI to .env and restart the backend.",
    });
  }
  next();
});

app.use("/api/jobs", jobRoutes);
app.use("/api/candidates", candidateRoutes);

app.use((_req, res) => {
  res.status(404).json({ error: "Route not found." });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  const status = err.status || (err.name === "MulterError" ? 400 : 500);
  res.status(status).json({ error: err.message || "Internal server error" });
});

export default app;
