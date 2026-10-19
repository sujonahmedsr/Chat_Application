const express = require('express');
const cors = require('cors');
const http = require('http');
const { initSocket } = require('../src/sockets/socketManager');

const authRoutes = require('../src/routes/authRoutes');
const userRoutes = require('../src/routes/userRoutes');
const messageRoutes = require('../src/routes/messageRoutes');
const callRoutes = require('../src/routes/callRoutes');
const groupRoutes = require('../src/routes/groupRoutes');
const friendRoutes = require('../src/routes/friendRoutes');
const adminRoutes = require('../src/routes/adminRoutes');
const { notFound, errorHandler } = require('../src/middleware/errorHandler');

const createTestApp = () => {
  const app = express();
  const server = http.createServer(app);

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/messages', messageRoutes);
  app.use('/api/calls', callRoutes);
  app.use('/api/groups', groupRoutes);
  app.use('/api/friends', friendRoutes);
  app.use('/api/admin', adminRoutes);

  app.use(notFound);
  app.use(errorHandler);

  const io = initSocket(server, 'http://localhost:3000');

  return { app, server, io };
};

module.exports = { createTestApp };
