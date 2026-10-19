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

  // Socket middleware for authentication (Strict JWT token verification)
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;

      if (!token) {
        return next(new Error('Authentication error: JWT token required'));
      }

      try {
        const decoded = verifyToken(token);
        socket.userId = decoded.id;
        return next();
      } catch (err) {
        return next(new Error('Authentication error: Invalid or expired token'));
      }
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

    // Listen for manual presence events if triggered by client (e.g. on reconnect or screen wake)
    socket.on('user:connect', ({ userId: uid }) => {
      if (uid) {
        handleUserConnected(io, socket, String(uid));
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
