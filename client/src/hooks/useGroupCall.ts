'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from '@/context/SocketContext';
import { sounds } from '@/lib/sound';

export interface GroupCallParticipant {
  id: string;
  name: string;
  avatar?: string;
  isMuted?: boolean;
}

export interface IncomingGroupCallData {
  groupId: string;
  callId: string;
  callerName: string;
  callerAvatar?: string;
  groupName: string;
  participants: GroupCallParticipant[];
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    {
      urls: [
        'turn:openrelay.metered.ca:80',
        'turn:openrelay.metered.ca:443',
        'turn:openrelay.metered.ca:443?transport=tcp',
      ],
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
  iceCandidatePoolSize: 10,
};

export const useGroupCall = (currentUserId?: string) => {
  const { socket } = useSocket();
  const [callState, setCallState] = useState<'idle' | 'calling' | 'connected'>('idle');
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [activeGroupName, setActiveGroupName] = useState<string | null>(null);
  const [participants, setParticipants] = useState<GroupCallParticipant[]>([]);
  const [incomingGroupCall, setIncomingGroupCall] = useState<IncomingGroupCallData | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [duration, setDuration] = useState(0);

  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const durationTimerRef = useRef<any>(null);
  const stopRingRef = useRef<(() => void) | null>(null);
  const activeGroupIdRef = useRef<string | null>(null);

  useEffect(() => {
    activeGroupIdRef.current = activeGroupId;
  }, [activeGroupId]);

  // Clean up all media and peer connections
  const cleanupCall = useCallback(() => {
    if (stopRingRef.current) {
      stopRingRef.current();
      stopRingRef.current = null;
    }

    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    peersRef.current.forEach((pc) => {
      pc.close();
    });
    peersRef.current.clear();

    audioElementsRef.current.forEach((audio) => {
      audio.srcObject = null;
      audio.remove();
    });
    audioElementsRef.current.clear();

    setCallState('idle');
    setActiveGroupId(null);
    setActiveGroupName(null);
    setParticipants([]);
    setIncomingGroupCall(null);
    setDuration(0);
    setIsMuted(false);
  }, []);

  // Helper to attach remote audio stream
  const attachRemoteAudio = (peerId: string, stream: MediaStream) => {
    let audio = audioElementsRef.current.get(peerId);
    if (!audio) {
      audio = document.createElement('audio');
      audio.autoplay = true;
      (audio as any).playsInline = true;
      audio.style.position = 'fixed';
      audio.style.opacity = '0';
      audio.style.pointerEvents = 'none';
      audio.style.width = '1px';
      audio.style.height = '1px';
      audio.style.bottom = '0';
      audio.style.right = '0';
      audioElementsRef.current.set(peerId, audio);
      document.body.appendChild(audio);
    }
    audio.srcObject = stream;
    audio.play().catch((err) => {
      console.warn('[useGroupCall] audio play error:', err);
    });
  };

  // Helper to create and configure a peer connection
  const createPeerConnection = (targetUserId: string, groupId: string): RTCPeerConnection => {
    const existing = peersRef.current.get(targetUserId);
    if (existing) return existing;

    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Add local audio tracks to this peer connection
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    // ICE Candidate handler
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('group:call:signal', {
          to: targetUserId,
          signal: event.candidate,
          type: 'ice-candidate',
          groupId,
        });
      }
    };

    // Remote audio track handler
    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        attachRemoteAudio(targetUserId, event.streams[0]);
      }
    };

    peersRef.current.set(targetUserId, pc);
    return pc;
  };

  // Start a new group call with selected members
  const startGroupCall = async (
    groupId: string,
    groupName: string,
    targetMemberIds: string[]
  ) => {
    if (!socket || !currentUserId) return;

    try {
      cleanupCall();

      // Acquire microphone
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      stream.getAudioTracks().forEach((track) => {
        track.enabled = true;
      });
      localStreamRef.current = stream;

      setActiveGroupId(groupId);
      setActiveGroupName(groupName);
      setCallState('calling');

      stopRingRef.current = sounds.playOutgoingRingtone();

      socket.emit('group:call:start', {
        groupId,
        targetMemberIds,
        groupName,
      });
    } catch (err) {
      console.error('[useGroupCall] Failed to acquire microphone for group call:', err);
      cleanupCall();
    }
  };

  // Join incoming group call
  const joinGroupCall = async () => {
    if (!socket || !incomingGroupCall || !currentUserId) return;

    try {
      if (stopRingRef.current) {
        stopRingRef.current();
        stopRingRef.current = null;
      }

      const { groupId, callId, groupName } = incomingGroupCall;

      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      stream.getAudioTracks().forEach((track) => {
        track.enabled = true;
      });
      localStreamRef.current = stream;

      setActiveGroupId(groupId);
      setActiveGroupName(groupName);
      setIncomingGroupCall(null);
      setCallState('connected');

      // Start duration timer
      durationTimerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);

      socket.emit('group:call:join', { groupId, callId });
    } catch (err) {
      console.error('[useGroupCall] Failed to join group call:', err);
      cleanupCall();
    }
  };

  // Decline incoming group call
  const rejectGroupCall = () => {
    if (stopRingRef.current) {
      stopRingRef.current();
      stopRingRef.current = null;
    }
    setIncomingGroupCall(null);
  };

  // Invite more members while in an active group call
  const inviteMembers = (memberIds: string[]) => {
    if (!socket || !activeGroupId) return;
    socket.emit('group:call:invite', {
      groupId: activeGroupId,
      memberIds,
      groupName: activeGroupName || 'Group',
    });
  };

  // Leave active call
  const leaveGroupCall = () => {
    if (socket && activeGroupId) {
      socket.emit('group:call:leave', { groupId: activeGroupId });
    }
    cleanupCall();
  };

  // Toggle mute
  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  // Socket event listeners for Group Call
  useEffect(() => {
    if (!socket) return;

    // Incoming group call ringing
    const handleIncomingGroupCall = (data: IncomingGroupCallData) => {
      // If already in a call, ignore
      if (callState !== 'idle' || activeGroupIdRef.current) return;

      setIncomingGroupCall(data);
      stopRingRef.current = sounds.playIncomingRingtone();
    };

    // Caller received confirmation that call has started
    const handleGroupCallStarted = ({
      groupId,
      participants: initialParticipants,
    }: {
      groupId: string;
      participants: GroupCallParticipant[];
    }) => {
      setParticipants(initialParticipants || []);
    };

    // User joined event (either callee connected or another participant joined)
    const handleUserJoined = async ({
      user,
      participants: updatedParticipants,
    }: {
      user: GroupCallParticipant;
      participants: GroupCallParticipant[];
    }) => {
      // Stop outgoing ringtone if still ringing
      if (stopRingRef.current) {
        stopRingRef.current();
        stopRingRef.current = null;
      }

      setCallState('connected');
      setParticipants(updatedParticipants || []);

      if (!durationTimerRef.current) {
        durationTimerRef.current = setInterval(() => {
          setDuration((prev) => prev + 1);
        }, 1000);
      }

      // Initiate WebRTC offer to the newly joined user
      const groupId = activeGroupIdRef.current;
      if (groupId && user.id !== currentUserId) {
        try {
          const pc = createPeerConnection(user.id, groupId);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('group:call:signal', {
            to: user.id,
            signal: offer,
            type: 'offer',
            groupId,
          });
        } catch (err) {
          console.error('[useGroupCall] Error sending offer to new user:', err);
        }
      }
    };

    // Callee receives existing participants on join
    const handleGroupCallConnected = ({
      participants: currentParticipants,
    }: {
      groupId: string;
      callId: string;
      participants: GroupCallParticipant[];
    }) => {
      setParticipants(currentParticipants || []);
    };

    // Mesh signaling handler (offer / answer / ice-candidate)
    const handleGroupCallSignal = async ({
      from,
      signal,
      type,
      groupId,
    }: {
      from: string;
      signal: any;
      type: 'offer' | 'answer' | 'ice-candidate';
      groupId: string;
    }) => {
      if (!signal || !from) return;

      try {
        if (type === 'offer') {
          const pc = createPeerConnection(from, groupId);
          await pc.setRemoteDescription(new RTCSessionDescription(signal));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          socket.emit('group:call:signal', {
            to: from,
            signal: answer,
            type: 'answer',
            groupId,
          });
        } else if (type === 'answer') {
          const pc = peersRef.current.get(from);
          if (pc) {
            await pc.setRemoteDescription(new RTCSessionDescription(signal));
          }
        } else if (type === 'ice-candidate') {
          const pc = peersRef.current.get(from);
          if (pc) {
            await pc.addIceCandidate(new RTCIceCandidate(signal));
          }
        }
      } catch (err) {
        console.error('[useGroupCall] Error handling group call signal:', err);
      }
    };

    // Participant left the call
    const handleUserLeft = ({
      userId,
      participants: remainingParticipants,
    }: {
      userId: string;
      participants: GroupCallParticipant[];
    }) => {
      // Close and delete peer connection
      const pc = peersRef.current.get(userId);
      if (pc) {
        pc.close();
        peersRef.current.delete(userId);
      }

      // Remove audio element
      const audio = audioElementsRef.current.get(userId);
      if (audio) {
        audio.srcObject = null;
        audio.remove();
        audioElementsRef.current.delete(userId);
      }

      setParticipants(remainingParticipants || []);

      // If only self remains or call is empty, notify
      if (!remainingParticipants || remainingParticipants.length <= 1) {
        // Only 1 person left in group call
      }
    };

    socket.on('group:call:incoming', handleIncomingGroupCall);
    socket.on('group:call:started', handleGroupCallStarted);
    socket.on('group:call:user-joined', handleUserJoined);
    socket.on('group:call:connected', handleGroupCallConnected);
    socket.on('group:call:signal', handleGroupCallSignal);
    socket.on('group:call:user-left', handleUserLeft);

    return () => {
      socket.off('group:call:incoming', handleIncomingGroupCall);
      socket.off('group:call:started', handleGroupCallStarted);
      socket.off('group:call:user-joined', handleUserJoined);
      socket.off('group:call:connected', handleGroupCallConnected);
      socket.off('group:call:signal', handleGroupCallSignal);
      socket.off('group:call:user-left', handleUserLeft);
    };
  }, [socket, currentUserId, callState]);

  return {
    callState,
    activeGroupId,
    activeGroupName,
    participants,
    incomingGroupCall,
    isMuted,
    duration,
    startGroupCall,
    joinGroupCall,
    rejectGroupCall,
    inviteMembers,
    leaveGroupCall,
    toggleMute,
  };
};
