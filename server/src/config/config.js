require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 5000,
  CLIENT_URL: process.env.CLIENT_URL || 'https://shofichat.vercel.app',
  JWT_SECRET: process.env.JWT_SECRET || 'supersecret_jwt_key_chat_app_2026_production',
  MONGO_URI: process.env.MONGO_URI || 'mongodb://localhost:27017/chat_system',
  NODE_ENV: process.env.NODE_ENV || 'development',
};
