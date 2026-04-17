import mongoose from "mongoose";

const connectDB = async () => {
  // Validar que la URI existe ANTES de intentar conectar
  if (!process.env.MONGO_URI) {
    console.error("❌ MONGO_URI no está definida en las variables de entorno");
    if (process.env.NODE_ENV === "production") {
      // En producción, reintentamos cada 5 segundos en vez de morir
      setTimeout(connectDB, 5000);
      return;
    } else {
      process.exit(1);
    }
  }

  // Opciones recomendadas para producción y desarrollo
  const options = {
    serverSelectionTimeoutMS: 5000, // Tiempo máximo para seleccionar servidor (5s)
    socketTimeoutMS: 45000, // Cerrar sockets inactivos después de 45s
    family: 4, // Usar IPv4, evita problemas en algunos hosts
    retryWrites: true, // Recomendado para clusters Atlas
    // autoIndex: process.env.NODE_ENV !== 'production', // Desactivar autoIndex en producción
  };

  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, options);
    console.log(
      `✅ MongoDB conectado: ${conn.connection.host} (entorno: ${process.env.NODE_ENV})`,
    );

    // --- Manejo de eventos después de la conexión inicial ---
    mongoose.connection.on("disconnected", () => {
      console.warn("⚠️ MongoDB se desconectó. Intentando reconectar...");
      // No llamamos a connectDB() directamente para evitar bucles infinitos,
      // mongoose internamente reintentará, pero forzamos un intento manual más rápido
      setTimeout(() => {
        if (mongoose.connection.readyState === 0) {
          connectDB();
        }
      }, 3000);
    });

    mongoose.connection.on("error", (err) => {
      console.error(`❌ Error en la conexión MongoDB: ${err.message}`);
      // No salimos del proceso, solo logueamos
    });

    mongoose.connection.on("reconnected", () => {
      console.log("🔄 MongoDB reconectado exitosamente");
    });
  } catch (error) {
    console.error(`❌ Error al conectar a MongoDB: ${error.message}`);

    if (process.env.NODE_ENV === "production") {
      // En producción no matamos el proceso, reintentamos después de un tiempo
      console.log("🔄 Reintentando conexión en 5 segundos...");
      setTimeout(connectDB, 5000);
    } else {
      // En desarrollo es preferible fallar rápido para corregir la configuración
      process.exit(1);
    }
  }
};

// Capturar cierre limpio de la aplicación
const gracefulShutdown = async () => {
  console.log("🛑 Cerrando conexión a MongoDB...");
  try {
    await mongoose.disconnect();
    console.log("👋 MongoDB desconectado correctamente");
  } catch (err) {
    console.error("Error al desconectar MongoDB:", err);
  }
};

// Registrar hooks para señales de terminación
process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);

export default connectDB;
