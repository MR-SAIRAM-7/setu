const mongoose = require('mongoose');
const config = require('./index');

let isConnected = false;
let connectionPromise = null;

async function connectDB() {
  if (isConnected) return mongoose.connection;
  if (connectionPromise) return connectionPromise;

  const mongoUri = config.mongoUri;
  if (!mongoUri) {
    console.log('  [MongoDB] No MONGODB_URI configured. Operating in local in-memory/browser fallback mode.');
    return null;
  }

  mongoose.connection.on('connected', () => {
    isConnected = true;
    console.log('  [MongoDB] Connected successfully to database');
  });

  mongoose.connection.on('error', (err) => {
    isConnected = false;
    console.warn('  [MongoDB] Connection error:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    isConnected = false;
    console.log('  [MongoDB] Disconnected from database');
  });

  connectionPromise = mongoose
    .connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000
    })
    .then((conn) => {
      isConnected = true;
      return conn;
    })
    .catch((err) => {
      isConnected = false;
      console.warn(`  [MongoDB] Could not connect to ${mongoUri}: ${err.message}`);
      console.log('  [MongoDB] Server will continue running with client-side storage fallback.');
      return null;
    });

  return connectionPromise;
}

function getStatus() {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  const stateCode = mongoose.connection.readyState;
  return {
    configured: Boolean(config.mongoUri),
    connected: isConnected && stateCode === 1,
    state: states[stateCode] || 'unknown',
    uri: config.mongoUri ? config.mongoUri.replace(/:\/\/[^@]+@/, '://***:***@') : null
  };
}

async function closeDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
    isConnected = false;
  }
}

module.exports = {
  connectDB,
  getStatus,
  closeDB,
  mongoose
};
