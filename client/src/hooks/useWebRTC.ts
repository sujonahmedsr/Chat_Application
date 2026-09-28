'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from '@/context/SocketContext';
import { CallState, IncomingCallData, User } from '@/types';
import { sounds } from '@/lib/sound';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export const useWebRTC = () => {
  const { socket } = useSocket();
  const [callStatus, setCallStatus] = useState<CallState>('idle');
  const [callType, setCallType] = useState<'audio' | 'video'>('audio');
  const [peerUser, setPeerUser] = useState<{ id: string; name: string; avatar?: string } | null>(null);
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isCameraOff, setIsCameraOff] = useState<boolean>(false);
  const [duration, setDuration] = useState<number>(0);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const durationTimerRef = useRef<any>(null);
  const stopSoundRef = useRef<(() => void) | null>(null);
  const targetUserIdRef = useRef<string | null>(null);
  const callTypeRef = useRef<'audio' | 'video'>('audio');

  // Synchronize stream with video elements whenever streams update
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Clean up media and peer connection
  const cleanupCall = useCallback(() => {
    if (stopSoundRef.current) {
      stopSoundRef.current();
      stopSoundRef.current = null;
    }

    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    if (pcRef.current) {
      pcRef.current.onicecandidate = null;
      pcRef.current.ontrack = null;
      pcRef.current.close();
      pcRef.current = null;
    }

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    pendingCandidatesRef.current = [];
    setLocalStream(null);
    setRemoteStream(null);
    setCallStatus('idle');
    setPeerUser(null);
    setIncomingCall(null);
    setIsMuted(false);
    setIsCameraOff(false);
    setDuration(0);
    targetUserIdRef.current = null;
  }, []);

  // Initialize a fresh RTCPeerConnection
  const createPeerConnection = useCallback(
    (targetUserId: string) => {
      if (pcRef.current) {
        pcRef.current.close();
      }

      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit('call:ice-candidate', {
            to: targetUserId,
            candidate: event.candidate,
          });
        }
      };

      // Handle incoming remote media stream
      pc.ontrack = (event) => {
        console.log('[WebRTC] Received remote stream:', event.streams);
        if (event.streams && event.streams[0]) {
          const stream = event.streams[0];
          setRemoteStream(stream);

          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = stream;
            remoteVideoRef.current.play().catch(console.warn);
          }

          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = stream;
            remoteAudioRef.current.play().catch(console.warn);
          }
        }
      };

      // Handle connection state changes
      pc.onconnectionstatechange = () => {
        console.log('[WebRTC] Connection state:', pc.connectionState);
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          sounds.playCallEndSound();
          cleanupCall();
        }
      };

      return pc;
    },
    [socket, cleanupCall]
  );

  // Start outgoing call (audio or video)
  const startCall = useCallback(
    async (targetUser: User, type: 'audio' | 'video' = 'audio') => {
      if (!socket) {
        alert('Socket connection not established. Please check your network.');
        return;
      }

      try {
        setCallType(type);
        callTypeRef.current = type;
        setCallStatus('calling');
        setPeerUser({ id: targetUser.id, name: targetUser.name, avatar: targetUser.avatar });
        targetUserIdRef.current = targetUser.id;

        stopSoundRef.current = sounds.playOutgoingRingtone();

        // 1. Get user media (mic + camera if video call)
        const constraints = {
          audio: true,
          video: type === 'video' ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } : false,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        localStreamRef.current = stream;
        setLocalStream(stream);

        // 2. Create peer connection
        const pc = createPeerConnection(targetUser.id);

        // 3. Add tracks to peer connection
        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });

        // 4. Create and set local offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        // 5. Emit call:start to server
        socket.emit('call:start', {
          to: targetUser.id,
          offer,
          callType: type,
        });
      } catch (err: any) {
        console.error('[WebRTC] Error initiating call:', err);
        alert(
          err.name === 'NotAllowedError'
            ? 'Media permissions (microphone/camera) are required to place this call.'
            : `Call failed: ${err.message}`
        );
        cleanupCall();
      }
    },
    [socket, createPeerConnection, cleanupCall]
  );

  // Accept incoming call
  const answerCall = useCallback(async () => {
    if (!socket || !incomingCall) return;

    try {
      if (stopSoundRef.current) {
        stopSoundRef.current();
        stopSoundRef.current = null;
      }

      const type = incomingCall.callType || 'audio';
      setCallType(type);
      callTypeRef.current = type;
      setCallStatus('connected');
      setPeerUser({
        id: incomingCall.from,
        name: incomingCall.callerName,
        avatar: incomingCall.callerAvatar,
      });
      targetUserIdRef.current = incomingCall.from;

      // 1. Get media
      const constraints = {
        audio: true,
        video: type === 'video' ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } : false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setLocalStream(stream);

      // 2. Create peer connection
      const pc = createPeerConnection(incomingCall.from);

      // 3. Add tracks
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // 4. Set remote description with offer
      await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));

      // 5. Add any queued ICE candidates
      while (pendingCandidatesRef.current.length > 0) {
        const candidate = pendingCandidatesRef.current.shift();
        if (candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.error);
        }
      }

      // 6. Create SDP answer and set local description
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // 7. Emit call:answer
      socket.emit('call:answer', {
        to: incomingCall.from,
        answer,
      });

      // Start call duration timer
      durationTimerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('[WebRTC] Error answering call:', err);
      alert(
        err.name === 'NotAllowedError'
          ? 'Microphone/camera access is required to accept call.'
          : `Failed to answer call: ${err.message}`
      );
      cleanupCall();
    }
  }, [socket, incomingCall, createPeerConnection, cleanupCall]);

  // Reject incoming call
  const rejectCall = useCallback(() => {
    if (socket && incomingCall) {
      socket.emit('call:rejected', {
        to: incomingCall.from,
        callType: incomingCall.callType,
      });
    }
    sounds.playCallEndSound();
    cleanupCall();
  }, [socket, incomingCall, cleanupCall]);

  // End active call or cancel outgoing call
  const endCall = useCallback(() => {
    const targetId = targetUserIdRef.current || incomingCall?.from || peerUser?.id;
    if (socket && targetId) {
      socket.emit('call:ended', {
        to: targetId,
        duration,
        callType: callTypeRef.current,
      });
    }
    sounds.playCallEndSound();
    cleanupCall();
  }, [socket, incomingCall, peerUser, duration, cleanupCall]);

  // Toggle microphone mute/unmute
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      if (audioTracks.length > 0) {
        const newMuted = !isMuted;
        audioTracks[0].enabled = !newMuted;
        setIsMuted(newMuted);
      }
    }
  }, [isMuted]);

  // Toggle camera on/off
  const toggleCamera = useCallback(() => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      if (videoTracks.length > 0) {
        const newCameraOff = !isCameraOff;
        videoTracks[0].enabled = !newCameraOff;
        setIsCameraOff(newCameraOff);
      }
    }
  }, [isCameraOff]);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    // Incoming call received
    const handleIncomingCall = (data: IncomingCallData) => {
      console.log(`[WebRTC] Incoming ${data.callType || 'audio'} call from:`, data.callerName);
      if (callStatus !== 'idle') {
        socket.emit('call:rejected', { to: data.from, callType: data.callType });
        return;
      }

      setIncomingCall(data);
      setCallType(data.callType || 'audio');
      callTypeRef.current = data.callType || 'audio';
      setCallStatus('incoming');
      setPeerUser({
        id: data.from,
        name: data.callerName,
        avatar: data.callerAvatar,
      });
      targetUserIdRef.current = data.from;

      stopSoundRef.current = sounds.playIncomingRingtone();
    };

    // Caller receives SDP answer from callee
    const handleCallAnswer = async ({ from, answer }: { from: string; answer: RTCSessionDescriptionInit }) => {
      console.log('[WebRTC] Received call:answer from:', from);
      if (stopSoundRef.current) {
        stopSoundRef.current();
        stopSoundRef.current = null;
      }

      if (pcRef.current) {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));

        while (pendingCandidatesRef.current.length > 0) {
          const candidate = pendingCandidatesRef.current.shift();
          if (candidate) {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.error);
          }
        }

        setCallStatus('connected');

        durationTimerRef.current = setInterval(() => {
          setDuration((prev) => prev + 1);
        }, 1000);
      }
    };

    // ICE candidate exchange
    const handleIceCandidate = async ({ from, candidate }: { from: string; candidate: RTCIceCandidateInit }) => {
      if (pcRef.current && pcRef.current.remoteDescription && pcRef.current.remoteDescription.type) {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.error);
      } else {
        pendingCandidatesRef.current.push(candidate);
      }
    };

    const handleCallRejected = ({ from }: { from: string }) => {
      console.log('[WebRTC] Call rejected by:', from);
      sounds.playCallEndSound();
      cleanupCall();
    };

    const handleCallEnded = ({ from }: { from: string }) => {
      console.log('[WebRTC] Call ended by:', from);
      sounds.playCallEndSound();
      cleanupCall();
    };

    socket.on('call:incoming', handleIncomingCall);
    socket.on('call:answer', handleCallAnswer);
    socket.on('call:ice-candidate', handleIceCandidate);
    socket.on('call:rejected', handleCallRejected);
    socket.on('call:ended', handleCallEnded);

    return () => {
      socket.off('call:incoming', handleIncomingCall);
      socket.off('call:answer', handleCallAnswer);
      socket.off('call:ice-candidate', handleIceCandidate);
      socket.off('call:rejected', handleCallRejected);
      socket.off('call:ended', handleCallEnded);
    };
  }, [socket, callStatus, cleanupCall]);

  return {
    callStatus,
    callType,
    peerUser,
    incomingCall,
    isMuted,
    isCameraOff,
    duration,
    localStream,
    remoteStream,
    remoteAudioRef,
    localVideoRef,
    remoteVideoRef,
    startCall,
    answerCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera,
  };
};
