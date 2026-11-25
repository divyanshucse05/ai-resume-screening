import dns from "dns";
import mongoose from "mongoose";

export async function connectDB(uri) {
  if (!uri) {
    throw new Error("MONGODB_URI is not defined in environment variables.");
  }

  // Force public DNS resolvers for mongodb+srv:// SRV lookups on Windows networks
  // whose local/ISP DNS proxy refuses SRV queries (querySrv ECONNREFUSED).
  if (uri.startsWith("mongodb+srv://")) {
    try {
      dns.setServers(["8.8.8.8", "1.1.1.1"]);
    } catch {
      // Ignore if environment restricts modifying DNS servers
    }
  }

  mongoose.set("strictQuery", true);

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
  });
  console.log(`MongoDB connected: ${mongoose.connection.host}`);
}
