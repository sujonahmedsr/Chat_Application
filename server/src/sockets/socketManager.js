const { Server } = require('socket.io');
const { verifyToken } = require('../utils/token');
const { handleUserConnected, handleUserDisconnected } = require('./presenceHandler');
const { registerChatHandlers } = require('./chatHandler');
const { registerCallHandlers } = require('./callHandler');

let ioInstance = null;

const initSocket = (httpServer, clientUrl) => {
  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        callback(null, true);
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 30000,
    pingInterval: 25000,
  });

  ioInstance = io;

  // Socket middleware for authentication
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      const userId = socket.handshake.auth?.userId || socket.handshake.query?.userId;

      if (token) {
        try {
          const decoded = verifyToken(token);
          socket.userId = decoded.id;
          return next();
        } catch (err) {
          console.warn('[Socket] Token verification failed:', err.message);
        }
      }

      if (userId) {
        socket.userId = String(userId);
        return next();
      }

      return next(new Error('Authentication error: Token or userId required'));
    } catch (err) {
      return next(new Error('Socket authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.userId;
    console.log(`[Socket] Client connected: ${socket.id} (User: ${userId})`);

    // Handle user connection / presence
    handleUserConnected(io, socket, userId);

    // Register modules
    registerChatHandlers(io, socket);
    registerCallHandlers(io, socket);

    // Listen for manual presence events if triggered by client
    socket.on('user:connect', ({ userId: uid }) => {
      if (uid && uid !== socket.userId) {
        handleUserConnected(io, socket, uid);
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`[Socket] Client disconnected: ${socket.id} (User: ${userId})`);
      handleUserDisconnected(io, socket);
    });
  });

  return io;
};

const getIO = () => {
  if (!ioInstance) {
    throw new Error('Socket.io has not been initialized!');
  }
  return ioInstance;
};

module.exports = { initSocket, getIO };
