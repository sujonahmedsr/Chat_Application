'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from '@/context/SocketContext';
import { CallState, IncomingCallData, User } from '@/types';
import { sounds } from '@/lib/sound';

export const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    // Top-tier Google STUN servers (Fast, worldwide, reliable)
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    // Cloudflare STUN
    { urls: 'stun:stun.cloudflare.com:3478' },
    // Twilio STUN
    { urls: 'stun:global.stun.twilio.com:3478' },
    // ExpressTURN Relay servers (Handles Symmetric NAT / 4G / 5G / CGNAT mobile carriers)
    {
      urls: [
        'turn:relay1.expressturn.com:3478',
        'turn:relay1.expressturn.com:3478?transport=udp',
        'turn:relay1.expressturn.com:3478?transport=tcp',
      ],
      username: 'efPGGD7Y4BSTGSXFHJ',
      credential: 'Bj8bZ0sXfnqJRlUb',
    },
  ],
  iceCandidatePoolSize: 10,
};

// Resilient media acquisition with graceful fallback for all mobile & desktop hardware
const acquireUserMedia = async (type: 'audio' | 'video'): Promise<MediaStream> => {
  // Tier 1: Optimal constraints for HD voice and video
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video:
        type === 'video'
          ? {
              width: { ideal: 1280, max: 1920 },
              height: { ideal: 720, max: 1080 },
              facingMode: 'user',
            }
          : false,
    });
  } catch (err1) {
    console.warn('[WebRTC] Tier 1 media constraints failed, trying Tier 2:', err1);
  }

  // Tier 2: Standard mobile friendly constraints
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: type === 'video' ? { facingMode: 'user' } : false,
    });
  } catch (err2) {
    console.warn('[WebRTC] Tier 2 media constraints failed, trying basic fallback:', err2);
  }

  // Tier 3: Minimal fallback (guarantees device capture if permitted)
  return await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: type === 'video',
  });
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
  const [isMirrored, setIsMirrored] = useState<boolean>(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [duration, setDuration] = useState<number>(0);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isAudioBlocked, setIsAudioBlocked] = useState<boolean>(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteMediaStreamRef = useRef<MediaStream | null>(null);

  // Background dedicated audio element for continuous media playback
  const internalAudioRef = useRef<HTMLAudioElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  // Persistent Web Audio context pipeline for mobile audio amplification & stability
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const audioGainNodeRef = useRef<GainNode | null>(null);

  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const durationTimerRef = useRef<any>(null);
  const stopSoundRef = useRef<(() => void) | null>(null);
  const targetUserIdRef = useRef<string | null>(null);
  const callTypeRef = useRef<'audio' | 'video'>('audio');
  const durationRef = useRef<number>(0);
  const callStatusRef = useRef<CallState>('idle');

  // Synchronously initialize or resume AudioContext on user gesture
  const unlockAudioPipeline = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
          audioContextRef.current = new AudioCtx();
        }
        if (audioContextRef.current.state === 'suspended') {
          audioContextRef.current.resume().catch(() => {});
        }
      }
      if (internalAudioRef.current) {
        internalAudioRef.current.play().catch(() => {});
      }
      setIsAudioBlocked(false);
    } catch (e) {
      console.warn('[WebRTC] unlockAudioPipeline:', e);
    }
  }, []);

  // Dedicated background audio element created once
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const audio = document.createElement('audio');
      audio.autoplay = true;
      audio.volume = 1.0;
      audio.muted = false;
      (audio as any).playsInline = true;
      audio.setAttribute('playsinline', '');
      audio.setAttribute('webkit-playsinline', '');
      audio.style.position = 'fixed';
      audio.style.opacity = '0.001';
      audio.style.pointerEvents = 'none';
      audio.style.width = '1px';
      audio.style.height = '1px';
      audio.style.bottom = '0';
      audio.style.right = '0';
      audio.style.zIndex = '-999';
      document.body.appendChild(audio);
      internalAudioRef.current = audio;

      return () => {
        audio.srcObject = null;
        audio.remove();
        internalAudioRef.current = null;
      };
    }
  }, []);

  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  useEffect(() => {
    callStatusRef.current = callStatus;
  }, [callStatus]);

  // Route remote stream to AudioContext & HTMLAudioElement cleanly without tearing down
  const attachAndPlayAudio = useCallback((stream: MediaStream) => {
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) return;

    // 1. Web Audio API pipeline
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
          audioContextRef.current = new AudioCtx();
        }
        const ctx = audioContextRef.current;
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {
            setIsAudioBlocked(true);
          });
        }

        if (audioSourceNodeRef.current) {
          try {
            audioSourceNodeRef.current.disconnect();
          } catch {}
          audioSourceNodeRef.current = null;
        }
        if (audioGainNodeRef.current) {
          try {
            audioGainNodeRef.current.disconnect();
          } catch {}
          audioGainNodeRef.current = null;
        }

        const source = ctx.createMediaStreamSource(stream);
        const gainNode = ctx.createGain();
        gainNode.gain.value = 1.0;
        source.connect(gainNode);
        gainNode.connect(ctx.destination);

        audioSourceNodeRef.current = source;
        audioGainNodeRef.current = gainNode;
      }
    } catch (err) {
      console.warn('[WebRTC] Web Audio route note:', err);
    }

    // 2. Play through background HTML Audio element
    if (internalAudioRef.current) {
      try {
        if (internalAudioRef.current.srcObject !== stream) {
          internalAudioRef.current.srcObject = stream;
        }
        internalAudioRef.current.volume = 1.0;
        internalAudioRef.current.muted = false;
        const p = internalAudioRef.current.play();
        if (p !== undefined) {
          p.catch((err) => {
            console.warn('[WebRTC] Audio autoplay held by browser:', err);
            setIsAudioBlocked(true);
          });
        }
      } catch (err) {
        console.warn('[WebRTC] Internal audio play error:', err);
      }
    }

    // 3. Play through modal remoteAudioRef if attached
    if (remoteAudioRef.current) {
      try {
        if (remoteAudioRef.current.srcObject !== stream) {
          remoteAudioRef.current.srcObject = stream;
        }
        remoteAudioRef.current.volume = 1.0;
        remoteAudioRef.current.muted = false;
        remoteAudioRef.current.play().catch(() => {});
      } catch {}
    }
  }, []);

  // Safe ICE Candidate addition with error resilience
  const addCandidateSafely = async (pc: RTCPeerConnection, candidate: RTCIceCandidateInit) => {
    try {
      if (!candidate || !candidate.candidate) return;
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.warn('[WebRTC] addIceCandidate failed:', err);
    }
  };

  // Synchronize stream with video & audio elements whenever streams update
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      if (localVideoRef.current.srcObject !== localStream) {
        localVideoRef.current.srcObject = localStream;
      }
      localVideoRef.current.play().catch(() => {});
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteStream) {
      attachAndPlayAudio(remoteStream);

      // In video calls, sync remote video element with muted=true to prevent autoplay blocks
      if (callTypeRef.current === 'video' && remoteVideoRef.current) {
        if (remoteVideoRef.current.srcObject !== remoteStream) {
          remoteVideoRef.current.srcObject = remoteStream;
        }
        remoteVideoRef.current.muted = true;
        (remoteVideoRef.current as any).playsInline = true;
        remoteVideoRef.current.setAttribute('playsinline', '');
        remoteVideoRef.current.setAttribute('webkit-playsinline', '');
        remoteVideoRef.current.play().catch((err) => {
          console.warn('[WebRTC] remoteVideo play caught:', err);
        });
      }
    }
  }, [remoteStream, attachAndPlayAudio]);

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

    if (remoteMediaStreamRef.current) {
      remoteMediaStreamRef.current.getTracks().forEach((track) => track.stop());
      remoteMediaStreamRef.current = null;
    }

    if (pcRef.current) {
      pcRef.current.onicecandidate = null;
      pcRef.current.ontrack = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.oniceconnectionstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }

    // Teardown Web Audio pipeline cleanly
    if (audioSourceNodeRef.current) {
      try {
        audioSourceNodeRef.current.disconnect();
      } catch {}
      audioSourceNodeRef.current = null;
    }
    if (audioGainNodeRef.current) {
      try {
        audioGainNodeRef.current.disconnect();
      } catch {}
      audioGainNodeRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
    }

    if (internalAudioRef.current) {
      internalAudioRef.current.srcObject = null;
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
    setIsAudioBlocked(false);
    setDuration(0);
    targetUserIdRef.current = null;
  }, []);

  // Initialize a fresh RTCPeerConnection with persistent stream handling
  const createPeerConnection = useCallback(
    (targetUserId: string) => {
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }

      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;

      // Reset persistent remote stream
      remoteMediaStreamRef.current = new MediaStream();

      // Send local ICE candidates to remote peer via socket
      pc.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit('call:ice-candidate', {
            to: targetUserId,
            candidate: event.candidate.toJSON ? event.candidate.toJSON() : event.candidate,
          });
        }
      };

      // Persistent multi-track handler: combines audio & video into one stable stream
      pc.ontrack = (event) => {
        console.log('[WebRTC] ontrack received:', event.track.kind, event.track.id);

        if (!remoteMediaStreamRef.current) {
          remoteMediaStreamRef.current = new MediaStream();
        }

        const stream = remoteMediaStreamRef.current;

        // Replace any existing track of same kind with updated one
        const oldTracks = stream.getTracks().filter((t) => t.kind === event.track.kind);
        oldTracks.forEach((t) => {
          if (t.id !== event.track.id) {
            stream.removeTrack(t);
          }
        });

        if (!stream.getTracks().some((t) => t.id === event.track.id)) {
          stream.addTrack(event.track);
        }

        const freshStream = new MediaStream(stream.getTracks());
        setRemoteStream(freshStream);

        // Ensure audio plays
        attachAndPlayAudio(stream);

        // Ensure video plays
        if (callTypeRef.current === 'video' && remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = freshStream;
          remoteVideoRef.current.muted = true;
          (remoteVideoRef.current as any).playsInline = true;
          remoteVideoRef.current.setAttribute('playsinline', '');
          remoteVideoRef.current.setAttribute('webkit-playsinline', '');
          remoteVideoRef.current.play().catch((err) => {
            console.warn('[WebRTC] Remote video play caught in ontrack:', err);
          });
        }

        event.track.onunmute = () => {
          console.log('[WebRTC] Track unmuted:', event.track.kind);
          attachAndPlayAudio(stream);
          if (callTypeRef.current === 'video' && remoteVideoRef.current) {
            remoteVideoRef.current.play().catch(() => {});
          }
        };
      };

      pc.onconnectionstatechange = () => {
        console.log('[WebRTC] Connection state:', pc.connectionState);
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          cleanupCall();
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log('[WebRTC] ICE connection state:', pc.iceConnectionState);
        if (pc.iceConnectionState === 'failed') {
          console.log('[WebRTC] ICE failed — attempting restart...');
          if (typeof (pc as any).restartIce === 'function') {
            (pc as any).restartIce();
          }
        }
      };

      return pc;
    },
    [socket, cleanupCall, attachAndPlayAudio]
  );

  // Start outgoing call (audio or video)
  const startCall = useCallback(
    async (targetUser: User, type: 'audio' | 'video' = 'audio') => {
      if (!socket) {
        console.warn('Socket connection not established. Please check your network.');
        return;
      }

      try {
        unlockAudioPipeline();
        setCallType(type);
        callTypeRef.current = type;
        setCallStatus('calling');
        setPeerUser({ id: targetUser.id, name: targetUser.name, avatar: targetUser.avatar });
        targetUserIdRef.current = targetUser.id;
        pendingCandidatesRef.current = [];

        stopSoundRef.current = sounds.playOutgoingRingtone();

        const stream = await acquireUserMedia(type);
        stream.getAudioTracks().forEach((track) => {
          track.enabled = true;
        });
        localStreamRef.current = stream;
        setLocalStream(stream);
        setIsMuted(false);

        const pc = createPeerConnection(targetUser.id);

        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });

        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: type === 'video',
        });
        await pc.setLocalDescription(offer);

        socket.emit('call:start', {
          to: targetUser.id,
          offer,
          callType: type,
        });
      } catch (err: any) {
        console.warn('[WebRTC] Call initiation error/permission denied:', err);
        cleanupCall();
      }
    },
    [socket, createPeerConnection, cleanupCall, unlockAudioPipeline]
  );

  // Accept incoming call
  const answerCall = useCallback(async () => {
    if (!socket || !incomingCall) return;

    try {
      unlockAudioPipeline();

      if (stopSoundRef.current) {
        stopSoundRef.current();
        stopSoundRef.current = null;
      }

      const type = incomingCall.callType || 'audio';
      const peer = {
        id: incomingCall.from,
        name: incomingCall.callerName,
        avatar: incomingCall.callerAvatar,
      };
      const callerFrom = incomingCall.from;
      const callerOffer = incomingCall.offer;

      setIncomingCall(null);
      setCallType(type);
      callTypeRef.current = type;
      setCallStatus('connected');
      setPeerUser(peer);
      targetUserIdRef.current = callerFrom;

      const stream = await acquireUserMedia(type);
      stream.getAudioTracks().forEach((track) => {
        track.enabled = true;
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      setIsMuted(false);

      const pc = createPeerConnection(callerFrom);

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      await pc.setRemoteDescription(new RTCSessionDescription(callerOffer));

      // Flush all candidates that arrived before remoteDescription was set
      const queuedCandidates = [...pendingCandidatesRef.current];
      pendingCandidatesRef.current = [];
      for (const cand of queuedCandidates) {
        await addCandidateSafely(pc, cand);
      }

      const answer = await pc.createAnswer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: type === 'video',
      });
      await pc.setLocalDescription(answer);

      socket.emit('call:answer', {
        to: callerFrom,
        answer,
      });

      durationTimerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.warn('[WebRTC] Error answering call:', err);
      cleanupCall();
    }
  }, [socket, incomingCall, createPeerConnection, cleanupCall, unlockAudioPipeline]);

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
        audioTracks.forEach((t) => {
          t.enabled = !newMuted;
        });
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
        videoTracks.forEach((t) => {
          t.enabled = !newCameraOff;
        });
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
      let videoDevices: MediaDeviceInfo[] = [];
      try {
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        videoDevices = allDevices.filter((d) => d.kind === 'videoinput');
      } catch (e) {
        console.warn('Could not enumerate video devices:', e);
      }

      const oldVideoTrack = localStreamRef.current.getVideoTracks()[0];
      const currentDeviceId = oldVideoTrack?.getSettings()?.deviceId;

      let targetDeviceId: string | undefined;
      if (videoDevices.length > 1) {
        const altDevice = videoDevices.find((d) => d.deviceId && d.deviceId !== currentDeviceId);
        if (altDevice) {
          targetDeviceId = altDevice.deviceId;
        }
      }

      if (oldVideoTrack) {
        oldVideoTrack.stop();
        localStreamRef.current.removeTrack(oldVideoTrack);
      }

      let newStream: MediaStream | null = null;
      if (targetDeviceId) {
        try {
          newStream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: targetDeviceId } },
            audio: false,
          });
        } catch {}
      }

      if (!newStream) {
        try {
          newStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: nextMode } },
            audio: false,
          });
        } catch {
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

  // Manual gesture resume for audio autoplay restriction recovery
  const resumeAudio = useCallback(async () => {
    try {
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      if (internalAudioRef.current) {
        await internalAudioRef.current.play();
      }
      if (remoteAudioRef.current) {
        await remoteAudioRef.current.play();
      }
      setIsAudioBlocked(false);
    } catch (e) {
      console.warn('[WebRTC] Manual resume caught:', e);
    }
  }, []);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    const handleIncomingCall = (data: IncomingCallData) => {
      console.log(`[WebRTC] Incoming ${data.callType || 'audio'} call from:`, data.callerName);
      if (callStatusRef.current !== 'idle') {
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
      pendingCandidatesRef.current = [];

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

        // Flush all pending candidates
        const queuedCandidates = [...pendingCandidatesRef.current];
        pendingCandidatesRef.current = [];
        for (const cand of queuedCandidates) {
          await addCandidateSafely(pcRef.current, cand);
        }

        setCallStatus('connected');

        durationTimerRef.current = setInterval(() => {
          setDuration((prev) => prev + 1);
        }, 1000);
      }
    };

    const handleIceCandidate = async ({ candidate }: { from?: string; candidate: RTCIceCandidateInit }) => {
      if (!candidate) return;
      if (pcRef.current && pcRef.current.remoteDescription && pcRef.current.remoteDescription.type) {
        await addCandidateSafely(pcRef.current, candidate);
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
  }, [socket, cleanupCall]);

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
    isAudioBlocked,
    resumeAudio,
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
