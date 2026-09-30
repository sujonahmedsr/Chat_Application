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

interface UseWebRTCOptions {
  onCallEndedLog?: (callLog: {
    peerId: string;
    callType: 'audio' | 'video';
    duration: number;
    status: 'completed' | 'missed' | 'rejected';
  }) => void;
}

export const useWebRTC = (options?: UseWebRTCOptions) => {
  const { socket } = useSocket();
  const [callStatus, setCallStatus] = useState<CallState>('idle');
  const [callType, setCallType] = useState<'audio' | 'video'>('audio');
  const [peerUser, setPeerUser] = useState<{ id: string; name: string; avatar?: string } | null>(null);
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isCameraOff, setIsCameraOff] = useState<boolean>(false);
  const [isMirrored, setIsMirrored] = useState<boolean>(false); // default: false (natural unmirrored view)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
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
  const durationRef = useRef<number>(0);

  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

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

      // Send local ICE candidates to remote peer via socket
      pc.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit('call:ice-candidate', {
            to: targetUserId,
            candidate: event.candidate,
          });
        }
      };

      // Receive remote stream
      pc.ontrack = (event) => {
        const stream = event.streams[0];
        setRemoteStream(stream);

        if (callTypeRef.current === 'video') {
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = stream;
          }
        }
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = stream;
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
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

        // Get user media
        const constraints = {
          audio: true,
          video:
            type === 'video'
              ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
              : false,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        localStreamRef.current = stream;
        setLocalStream(stream);

        const pc = createPeerConnection(targetUser.id);

        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

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

      const constraints = {
        audio: true,
        video:
          type === 'video'
            ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
            : false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setLocalStream(stream);

      const pc = createPeerConnection(incomingCall.from);

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));

      while (pendingCandidatesRef.current.length > 0) {
        const candidate = pendingCandidatesRef.current.shift();
        if (candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.error);
        }
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit('call:answer', {
        to: incomingCall.from,
        answer,
      });

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
    const callerId = incomingCall?.from;
    if (socket && incomingCall) {
      socket.emit('call:rejected', {
        to: incomingCall.from,
        callType: incomingCall.callType,
      });
    }
    if (callerId && options?.onCallEndedLog) {
      options.onCallEndedLog({
        peerId: callerId,
        callType: callTypeRef.current,
        duration: 0,
        status: 'rejected',
      });
    }
    sounds.playCallEndSound();
    cleanupCall();
  }, [socket, incomingCall, options, cleanupCall]);

  // End active call or cancel outgoing call
  const endCall = useCallback(() => {
    const targetId = targetUserIdRef.current || incomingCall?.from || peerUser?.id;
    const finalDuration = durationRef.current;
    if (socket && targetId) {
      socket.emit('call:ended', {
        to: targetId,
        duration: finalDuration,
        callType: callTypeRef.current,
      });
    }
    if (targetId && options?.onCallEndedLog) {
      options.onCallEndedLog({
        peerId: targetId,
        callType: callTypeRef.current,
        duration: finalDuration,
        status: finalDuration > 0 ? 'completed' : 'missed',
      });
    }
    sounds.playCallEndSound();
    cleanupCall();
  }, [socket, incomingCall, peerUser, options, cleanupCall]);

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

  // Toggle camera mirroring (natural vs mirror)
  const toggleMirror = useCallback(() => {
    setIsMirrored((prev) => !prev);
  }, []);

  // Switch between front and back camera (facingMode: user vs environment)
  const switchCamera = useCallback(async () => {
    if (!localStreamRef.current || callTypeRef.current !== 'video') return;
    const nextMode = facingMode === 'user' ? 'environment' : 'user';

    try {
      // Find available video input devices
      let videoDevices: MediaDeviceInfo[] = [];
      try {
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        videoDevices = allDevices.filter((d) => d.kind === 'videoinput');
      } catch (e) {
        console.warn('Could not enumerate video devices:', e);
      }

      const oldVideoTrack = localStreamRef.current.getVideoTracks()[0];
      const currentDeviceId = oldVideoTrack?.getSettings()?.deviceId;

      // Find alternative device ID if available
      let targetDeviceId: string | undefined;
      if (videoDevices.length > 1) {
        const altDevice = videoDevices.find((d) => d.deviceId && d.deviceId !== currentDeviceId);
        if (altDevice) {
          targetDeviceId = altDevice.deviceId;
        }
      }

      // Stop old video track first so mobile camera lock is released
      if (oldVideoTrack) {
        oldVideoTrack.stop();
        localStreamRef.current.removeTrack(oldVideoTrack);
      }

      let newStream: MediaStream | null = null;

      // Try 1: with exact deviceId if found
      if (targetDeviceId) {
        try {
          newStream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: targetDeviceId } },
            audio: false,
          });
        } catch {}
      }

      // Try 2: with facingMode ideal
      if (!newStream) {
        try {
          newStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: nextMode } },
            audio: false,
          });
        } catch {
          // Try 3: generic fallback
          newStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }
      }

      if (newStream) {
        const newVideoTrack = newStream.getVideoTracks()[0];
        if (newVideoTrack) {
          if (pcRef.current) {
            const senders = pcRef.current.getSenders();
            const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
            if (videoSender) {
              await videoSender.replaceTrack(newVideoTrack);
            }
          }

          localStreamRef.current.addTrack(newVideoTrack);

          const updatedStream = new MediaStream(localStreamRef.current.getTracks());
          localStreamRef.current = updatedStream;
          setLocalStream(updatedStream);

          if (localVideoRef.current) {
            localVideoRef.current.srcObject = updatedStream;
            localVideoRef.current.play().catch(() => {});
          }

          setFacingMode(nextMode);
        }
      }
    } catch (err) {
      console.error('Failed to switch camera:', err);
    }
  }, [facingMode]);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

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

    const handleIceCandidate = async ({ candidate }: { from?: string; candidate: RTCIceCandidateInit }) => {
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
    isMirrored,
    facingMode,
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
    toggleMirror,
    switchCamera,
  };
};
