import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "./config/db.js";
import errorHandler from "./middleware/errorHandler.js";
import authRoutes from "./routes/authRoutes.js";
import documentRoutes from "./routes/documentRoutes.js";
import flashcardRoutes from "./routes/flashcardRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import mongoose from "mongoose";

// Validación crítica de variables
const requiredEnv = ["MONGO_URI", "JWT_SECRET"];
for (const env of requiredEnv) {
  if (!process.env[env]) {
    console.error(`Falta variable de entorno: ${env}`);
    process.exit(1);
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const isProduction = process.env.NODE_ENV === "production";

// Conexión a MongoDB con opciones robustas
connectDB();

// Seguridad: Helmet configura headers HTTP seguros
app.use(helmet());

// Compresión gzip (útil en producción)
app.use(compression());

// Logging: en desarrollo formato corto, en producción formato combinado (o usar winston)
if (!isProduction) {
  app.use(morgan("dev"));
} else {
  app.use(morgan("combined"));
}

// CORS dinámico según entorno
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim())
  : ["http://localhost:3000"];

app.use(
  cors({
    origin: function (origin, callback) {
      // Permitir peticiones sin origen (como mobile apps o Postman)
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1 || !isProduction) {
        callback(null, true);
      } else {
        callback(new Error("Origen no permitido por CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Archivos estáticos (en producción se recomienda servir desde CDN o Nginx)
// Pero para subidas locales funciona bien si el directorio persiste.
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Rutas
app.use("/api/auth", authRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/flashcard", flashcardRoutes);
app.use("/api/ai", aiRoutes);

// En tu archivo principal (server.js o app.js)
app.get("/health/db", async (req, res) => {
  const state = mongoose.connection.readyState;
  // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
  const status = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  };
  res.json({
    mongodb: status[state],
    readyState: state,
    host: mongoose.connection.host || null,
  });
});

// Health check para Hostinger (útil para monitoreo)
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", environment: process.env.NODE_ENV });
});

// Error handler personalizado
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Route not found",
    statusCode: 404,
  });
});

// Servidor
const PORT = process.env.PORT || 8000;
const server = app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

// Graceful shutdown
const shutdown = async () => {
  console.log("Cerrando servidor...");
  server.close(async () => {
    console.log("Servidor HTTP cerrado");
    // Cerrar conexión MongoDB (si tienes mongoose)
    try {
      const mongoose = await import("mongoose");
      await mongoose.disconnect();
      console.log("MongoDB desconectado");
    } catch (err) {
      console.error("Error al cerrar MongoDB", err);
    }
    process.exit(0);
  });
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// Manejo de promesas no controladas
process.on("unhandledRejection", (err) => {
  console.error("Unhandled Rejection:", err);
  shutdown();
});
