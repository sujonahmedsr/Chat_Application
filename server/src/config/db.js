const mongoose = require('mongoose');
const { MONGO_URI } = require('./config');

let mongod = null;

const maskUri = (uri) => {
  return uri ? uri.replace(/:([^:@]+)@/, ':****@') : '';
};

const connectDB = async () => {
  const isCloudUri = MONGO_URI.includes('mongodb+srv://') || !MONGO_URI.includes('localhost');
  const timeoutMs = isCloudUri ? 12000 : 2500;

  try {
    mongoose.set('strictQuery', false);
    console.log(`[Database] Connecting to MongoDB: ${maskUri(MONGO_URI)}...`);

    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: timeoutMs,
    });
    console.log(`[Database] MongoDB connected successfully to ${mongoose.connection.host} (DB: ${mongoose.connection.name})`);
  } catch (err) {
    console.warn(`[Database] Connection to configured MongoDB failed: ${err.message}`);

    // If cloud URI failed, show warning
    if (isCloudUri) {
      console.warn('[Database] Note: Ensure your IP is whitelisted in MongoDB Atlas Network Access (0.0.0.0/0).');
    }

    console.log('[Database] Starting built-in fallback instance (MongoMemoryServer)...');
    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      mongod = await MongoMemoryServer.create();
      const uri = mongod.getUri();
      await mongoose.connect(uri);
      console.log(`[Database] Connected to In-Memory MongoDB at ${uri}`);
    } catch (memErr) {
      console.error('[Database] Failed to initialize in-memory MongoDB:', memErr);
      process.exit(1);
    }
  }
};

const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    if (mongod) {
      await mongod.stop();
    }
    console.log('[Database] Disconnected successfully');
  } catch (err) {
    console.error('[Database] Error disconnecting:', err);
  }
};

module.exports = { connectDB, disconnectDB };
