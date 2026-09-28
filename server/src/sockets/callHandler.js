const CallLog = require('../models/CallLog');
const User = require('../models/User');

const registerCallHandlers = (io, socket) => {
  // Initiate call: caller sends SDP offer with callType ('audio' | 'video')
  socket.on('call:start', async ({ to, offer, callType = 'audio' }) => {
    try {
      const from = socket.userId;
      if (!from || !to || !offer) return;

      const caller = await User.findById(from);
      const recipient = await User.findById(to);
      if (!caller || !recipient) return;

      // Check if blocked
      if (
        recipient.blockedUsers?.some((id) => String(id) === String(from)) ||
        caller.blockedUsers?.some((id) => String(id) === String(to))
      ) {
        socket.emit('call:rejected', { from: to, reason: 'blocked' });
        return;
      }

      console.log(`[Call] ${callType.toUpperCase()} call initiated from ${caller.name} (${from}) to ${to}`);

      io.to(`user:${to}`).emit('call:incoming', {
        from,
        callerName: caller.name,
        callerAvatar: caller.avatar,
        callType,
        offer,
      });
    } catch (err) {
      console.error('[CallHandler] Error starting call:', err);
    }
  });

  // Callee answers with SDP answer
  socket.on('call:answer', ({ to, answer }) => {
    try {
      const from = socket.userId;
      if (!from || !to || !answer) return;

      console.log(`[Call] Call answered by ${from} to ${to}`);

      io.to(`user:${to}`).emit('call:answer', {
        from,
        answer,
      });
    } catch (err) {
      console.error('[CallHandler] Error answering call:', err);
    }
  });

  // ICE candidates exchange
  socket.on('call:ice-candidate', ({ to, candidate }) => {
    try {
      const from = socket.userId;
      if (!from || !to || !candidate) return;

      io.to(`user:${to}`).emit('call:ice-candidate', {
        from,
        candidate,
      });
    } catch (err) {
      console.error('[CallHandler] Error forwarding ICE candidate:', err);
    }
  });

  // Callee rejects call
  socket.on('call:rejected', async ({ to, callType = 'audio' }) => {
    try {
      const from = socket.userId;
      if (!from || !to) return;

      console.log(`[Call] Call rejected by ${from} from caller ${to}`);

      // Record call log
      await CallLog.create({
        callerId: to,
        receiverId: from,
        callType,
        status: 'rejected',
        duration: 0,
        timestamp: new Date(),
      });

      io.to(`user:${to}`).emit('call:rejected', { from });
    } catch (err) {
      console.error('[CallHandler] Error handling call rejection:', err);
    }
  });

  // Either party ends call
  socket.on('call:ended', async ({ to, duration = 0, callType = 'audio' }) => {
    try {
      const from = socket.userId;
      if (!from || !to) return;

      console.log(`[Call] Call ended between ${from} and ${to}. Duration: ${duration}s, Type: ${callType}`);

      const status = duration > 0 ? 'completed' : 'missed';

      await CallLog.create({
        callerId: from,
        receiverId: to,
        callType,
        status,
        duration: Math.round(duration),
        timestamp: new Date(),
      });

      io.to(`user:${to}`).emit('call:ended', { from });
    } catch (err) {
      console.error('[CallHandler] Error ending call:', err);
    }
  });
};

module.exports = { registerCallHandlers };
