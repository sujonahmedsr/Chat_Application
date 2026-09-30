require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const { PORT, CLIENT_URL } = require('./config/config');
const { connectDB } = require('./config/db');
const { initSocket } = require('./sockets/socketManager');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const messageRoutes = require('./routes/messageRoutes');
const callRoutes = require('./routes/callRoutes');
const groupRoutes = require('./routes/groupRoutes');
const friendRoutes = require('./routes/friendRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
const server = http.createServer(app);

// Cross-Origin Resource Sharing configuration (reads strictly from CLIENT_URL in .env)
const allowedOrigins = (CLIENT_URL || 'http://localhost:3000')
  .split(',')
  .map((url) => url.trim().replace(/\/+$/, ''))
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, server-to-server, curl)
      if (!origin) return callback(null, true);

      const isAllowed = allowedOrigins.some((allowed) => {
        return origin === allowed || origin.startsWith(allowed);
      });

      if (isAllowed || process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/admin', adminRoutes);

// Error Handling Middlewares
app.use(notFound);
app.use(errorHandler);

// Initialize Socket.io
initSocket(server, CLIENT_URL);

const { seedInitialData } = require('./utils/seed');
const { startMessageCleanupScheduler } = require('./utils/cleanupJob');

// Start Server & Connect to DB
const startServer = async () => {
  try {
    await connectDB();
    await seedInitialData();
    startMessageCleanupScheduler();
    server.listen(PORT, () => {
      console.log(`=========================================`);
      console.log(`🚀 Chat & WebRTC Server running on port ${PORT}`);
      console.log(`📡 Client origin: ${CLIENT_URL}`);
      console.log(`⚡ Socket.io enabled & listening`);
      console.log(`=========================================`);
    });
  } catch (error) {
    console.error('Fatal Server startup error:', error);
    process.exit(1);
  }
};

startServer();

module.exports = { app, server };
