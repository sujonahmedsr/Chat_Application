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

const app = express();
const server = http.createServer(app);

// Cross-Origin Resource Sharing configuration
app.use(
  cors({
    origin: [CLIENT_URL, 'http://localhost:3000', 'http://127.0.0.1:3000'],
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

// Error Handling Middlewares
app.use(notFound);
app.use(errorHandler);

// Initialize Socket.io
initSocket(server, CLIENT_URL);

const { seedInitialData } = require('./utils/seed');

// Start Server & Connect to DB
const startServer = async () => {
  try {
    await connectDB();
    await seedInitialData();
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
