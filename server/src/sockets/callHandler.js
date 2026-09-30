const CallLog = require('../models/CallLog');
const User = require('../models/User');

// Active group calls in memory: groupId -> { callId, initiatorId, groupName, participants: Map<userId, { id, name, avatar }> }
const activeGroupCalls = new Map();

const registerCallHandlers = (io, socket) => {
  // --- 1-to-1 Calls ---

  // Initiate 1-to-1 call: caller sends SDP offer with callType ('audio' | 'video')
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

  // --- Multi-Party Group Audio Conference Handlers ---

  socket.on('group:call:start', async ({ groupId, targetMemberIds = [], groupName = 'Group' }) => {
    try {
      const from = socket.userId;
      if (!from || !groupId) return;

      const caller = await User.findById(from);
      if (!caller) return;

      const callId = `grp_call_${Date.now()}`;
      const participantsMap = new Map();
      participantsMap.set(String(from), {
        id: String(from),
        name: caller.name,
        avatar: caller.avatar,
      });

      activeGroupCalls.set(String(groupId), {
        callId,
        initiatorId: String(from),
        groupName,
        participants: participantsMap,
      });

      socket.join(`group-call:${groupId}`);

      // Ring all selected target members
      targetMemberIds.forEach((targetId) => {
        if (String(targetId) !== String(from)) {
          io.to(`user:${targetId}`).emit('group:call:incoming', {
            groupId: String(groupId),
            callId,
            callerName: caller.name,
            callerAvatar: caller.avatar,
            groupName,
            participants: Array.from(participantsMap.values()),
          });
        }
      });

      socket.emit('group:call:started', {
        groupId: String(groupId),
        callId,
        participants: Array.from(participantsMap.values()),
      });
    } catch (err) {
      console.error('[CallHandler] Error starting group call:', err);
    }
  });

  socket.on('group:call:join', async ({ groupId, callId }) => {
    try {
      const from = socket.userId;
      if (!from || !groupId) return;

      const user = await User.findById(from);
      if (!user) return;

      let session = activeGroupCalls.get(String(groupId));
      if (!session) {
        session = {
          callId: callId || `grp_call_${Date.now()}`,
          initiatorId: String(from),
          groupName: 'Group',
          participants: new Map(),
        };
        activeGroupCalls.set(String(groupId), session);
      }

      session.participants.set(String(from), {
        id: String(from),
        name: user.name,
        avatar: user.avatar,
      });

      socket.join(`group-call:${groupId}`);

      const participantsList = Array.from(session.participants.values());

      // Notify other participants in the room that a new user joined
      socket.to(`group-call:${groupId}`).emit('group:call:user-joined', {
        user: { id: String(from), name: user.name, avatar: user.avatar },
        participants: participantsList,
      });

      // Send the current list of participants to the joining user
      socket.emit('group:call:connected', {
        groupId: String(groupId),
        callId: session.callId,
        participants: participantsList,
      });
    } catch (err) {
      console.error('[CallHandler] Error joining group call:', err);
    }
  });

  // Mesh signaling between participants in group call
  socket.on('group:call:signal', ({ to, signal, type, groupId }) => {
    try {
      const from = socket.userId;
      if (!from || !to || !signal) return;

      io.to(`user:${to}`).emit('group:call:signal', {
        from,
        signal,
        type,
        groupId,
      });
    } catch (err) {
      console.error('[CallHandler] Error relaying group call signal:', err);
    }
  });

  // Invite additional members to active group call
  socket.on('group:call:invite', async ({ groupId, memberIds = [], groupName = 'Group' }) => {
    try {
      const from = socket.userId;
      if (!from || !groupId) return;

      const caller = await User.findById(from);
      const session = activeGroupCalls.get(String(groupId));
      const callId = session?.callId || `grp_call_${Date.now()}`;
      const participants = session ? Array.from(session.participants.values()) : [];

      memberIds.forEach((targetId) => {
        if (String(targetId) !== String(from)) {
          io.to(`user:${targetId}`).emit('group:call:incoming', {
            groupId: String(groupId),
            callId,
            callerName: caller ? caller.name : 'Group Member',
            callerAvatar: caller?.avatar,
            groupName: session?.groupName || groupName,
            participants,
          });
        }
      });
    } catch (err) {
      console.error('[CallHandler] Error inviting to group call:', err);
    }
  });

  // Leave active group call
  socket.on('group:call:leave', ({ groupId }) => {
    try {
      const from = socket.userId;
      if (!from || !groupId) return;

      const session = activeGroupCalls.get(String(groupId));
      if (session) {
        session.participants.delete(String(from));
        socket.leave(`group-call:${groupId}`);

        const remaining = Array.from(session.participants.values());
        socket.to(`group-call:${groupId}`).emit('group:call:user-left', {
          userId: String(from),
          participants: remaining,
        });

        if (session.participants.size === 0) {
          activeGroupCalls.delete(String(groupId));
        }
      }
    } catch (err) {
      console.error('[CallHandler] Error leaving group call:', err);
    }
  });

  // Handle socket disconnect for group calls
  socket.on('disconnect', () => {
    try {
      const from = socket.userId;
      if (!from) return;

      activeGroupCalls.forEach((session, groupId) => {
        if (session.participants.has(String(from))) {
          session.participants.delete(String(from));
          const remaining = Array.from(session.participants.values());
          io.to(`group-call:${groupId}`).emit('group:call:user-left', {
            userId: String(from),
            participants: remaining,
          });
          if (session.participants.size === 0) {
            activeGroupCalls.delete(groupId);
          }
        }
      });
    } catch (err) {
      console.error('[CallHandler] Error on group call disconnect cleanup:', err);
    }
  });
};

module.exports = { registerCallHandlers };
