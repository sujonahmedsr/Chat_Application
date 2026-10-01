'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from '@/context/SocketContext';
import { CallState, IncomingCallData, User } from '@/types';
import { sounds } from '@/lib/sound';
import { getWebRtcConfiguration, DEFAULT_ICE_SERVERS } from '@/lib/webrtc';

/**
 * Universal ID extractor for MongoDB / Frontend User objects
 */
const extractId = (val: any): string => {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object') return String(val._id || val.id || '');
  return String(val);
};

/**
 * Robust multi-tier media acquisition with fallback for mobile and desktop
 */
const acquireUserMedia = async (type: 'audio' | 'video'): Promise<MediaStream> => {
  // Tier 1: Optimal HD constraints
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
    console.warn('[WebRTC] Tier 1 HD constraints failed, trying Tier 2 standard:', err1);
  }

  // Tier 2: Standard mobile friendly constraints
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: type === 'video' ? { facingMode: 'user' } : false,
    });
  } catch (err2) {
    console.warn('[WebRTC] Tier 2 media constraints failed, trying Tier 3 fallback:', err2);
  }

  // Tier 3: Minimal fallback (guarantees camera/mic capture if permitted)
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

  // Background dedicated audio element for continuous media playback in audio calls
  const internalAudioRef = useRef<HTMLAudioElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const durationTimerRef = useRef<any>(null);
  const stopSoundRef = useRef<(() => void) | null>(null);
  const targetUserIdRef = useRef<string | null>(null);
  const callTypeRef = useRef<'audio' | 'video'>('audio');
  const durationRef = useRef<number>(0);
  const callStatusRef = useRef<CallState>('idle');

  // Keep references in sync with latest state
  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  useEffect(() => {
    callStatusRef.current = callStatus;
  }, [callStatus]);

  // Synchronously unlock audio playback on user gesture
  const unlockAudioPipeline = useCallback(() => {
    try {
      if (internalAudioRef.current) {
        internalAudioRef.current.play().catch(() => {});
      }
      if (remoteAudioRef.current) {
        remoteAudioRef.current.play().catch(() => {});
      }
      if (remoteVideoRef.current) {
        remoteVideoRef.current.muted = false;
        remoteVideoRef.current.volume = 1.0;
        remoteVideoRef.current.play().catch(() => {});
      }
      setIsAudioBlocked(false);
    } catch (e) {
      console.warn('[WebRTC] unlockAudioPipeline note:', e);
    }
  }, []);

  // Background audio element for clean, uninterrupted audio calls
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

  // Synchronize playback of stream across HTML5 Video & Audio elements without audio collisions
  const syncStreamPlayback = useCallback((stream: MediaStream | null) => {
    if (!stream) return;

    const isVideo = callTypeRef.current === 'video';

    if (isVideo) {
      // IN VIDEO CALLS: The remote <video> element acts as the single master for both picture and audio
      if (remoteVideoRef.current) {
        try {
          if (remoteVideoRef.current.srcObject !== stream) {
            remoteVideoRef.current.srcObject = stream;
          }
          remoteVideoRef.current.muted = false;
          remoteVideoRef.current.volume = 1.0;
          (remoteVideoRef.current as any).playsInline = true;
          remoteVideoRef.current.setAttribute('playsinline', '');
          remoteVideoRef.current.setAttribute('webkit-playsinline', '');

          const playPromise = remoteVideoRef.current.play();
          if (playPromise !== undefined) {
            playPromise.catch((err) => {
              console.warn('[WebRTC] Unmuted video play blocked by browser policy:', err);
              // Fallback to muted video + prompt banner so user can tap to unmute
              if (remoteVideoRef.current) {
                remoteVideoRef.current.muted = true;
                remoteVideoRef.current.play().catch(() => {});
              }
              setIsAudioBlocked(true);
            });
          }
        } catch (e) {
          console.warn('[WebRTC] Video element binding error:', e);
        }
      }

      // Detach audio elements in video calls to prevent WebKit Bug 179363 (audio cancellation / echo)
      if (internalAudioRef.current) {
        internalAudioRef.current.srcObject = null;
      }
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = null;
      }
    } else {
      // IN AUDIO CALLS: Play through dedicated background & modal audio elements
      if (internalAudioRef.current) {
        try {
          if (internalAudioRef.current.srcObject !== stream) {
            internalAudioRef.current.srcObject = stream;
          }
          internalAudioRef.current.muted = false;
          internalAudioRef.current.volume = 1.0;
          const p = internalAudioRef.current.play();
          if (p !== undefined) {
            p.catch((err) => {
              console.warn('[WebRTC] Internal audio play blocked:', err);
              setIsAudioBlocked(true);
            });
          }
        } catch (err) {
          console.warn('[WebRTC] Internal audio error:', err);
        }
      }

      if (remoteAudioRef.current) {
        try {
          if (remoteAudioRef.current.srcObject !== stream) {
            remoteAudioRef.current.srcObject = stream;
          }
          remoteAudioRef.current.muted = false;
          remoteAudioRef.current.volume = 1.0;
          const p = remoteAudioRef.current.play();
          if (p !== undefined) {
            p.catch((err) => {
              console.warn('[WebRTC] Remote audio play blocked:', err);
              setIsAudioBlocked(true);
            });
          }
        } catch {}
      }
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

  // Synchronize local preview video
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      if (localVideoRef.current.srcObject !== localStream) {
        localVideoRef.current.srcObject = localStream;
      }
      localVideoRef.current.play().catch(() => {});
    }
  }, [localStream]);

  // Synchronize remote media playback whenever remoteStream updates
  useEffect(() => {
    if (remoteStream) {
      syncStreamPlayback(remoteStream);
    }
  }, [remoteStream, syncStreamPlayback]);

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

  // Initialize a fresh RTCPeerConnection with dynamic ICE & TURN configuration
  const createPeerConnection = useCallback(
    async (targetUserId: string) => {
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }

      const rtcConfig = await getWebRtcConfiguration();
      const pc = new RTCPeerConnection(rtcConfig);
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

      // Persistent multi-track handler: combines audio & video cleanly
      pc.ontrack = (event) => {
        console.log('[WebRTC] ontrack received:', event.track.kind, event.track.id, 'streamCount:', event.streams?.length);

        let stream: MediaStream;
        if (event.streams && event.streams[0]) {
          stream = event.streams[0];
          remoteMediaStreamRef.current = stream;
        } else {
          if (!remoteMediaStreamRef.current) {
            remoteMediaStreamRef.current = new MediaStream();
          }
          if (!remoteMediaStreamRef.current.getTracks().some((t) => t.id === event.track.id)) {
            remoteMediaStreamRef.current.addTrack(event.track);
          }
          stream = remoteMediaStreamRef.current;
        }

        // Generate a fresh MediaStream reference with all tracks so React re-renders and re-binds
        const activeStream = new MediaStream(stream.getTracks());
        setRemoteStream(activeStream);
        syncStreamPlayback(activeStream);

        event.track.onunmute = () => {
          console.log('[WebRTC] Track unmuted:', event.track.kind);
          const updated = new MediaStream(stream.getTracks());
          setRemoteStream(updated);
          syncStreamPlayback(updated);
        };

        stream.onaddtrack = (e) => {
          console.log('[WebRTC] Stream track added dynamically:', e.track.kind);
          const updated = new MediaStream(stream.getTracks());
          setRemoteStream(updated);
          syncStreamPlayback(updated);
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
    [socket, cleanupCall, syncStreamPlayback]
  );

  // Start outgoing call (audio or video)
  const startCall = useCallback(
    async (targetUser: User, type: 'audio' | 'video' = 'audio') => {
      if (!socket) {
        console.warn('Socket connection not established. Please check your network.');
        return;
      }

      const targetId = extractId(targetUser);
      if (!targetId) {
        console.error('[WebRTC] Cannot start call: target user ID is invalid', targetUser);
        return;
      }

      try {
        unlockAudioPipeline();
        setCallType(type);
        callTypeRef.current = type;
        setCallStatus('calling');
        setPeerUser({ id: targetId, name: targetUser.name || 'User', avatar: targetUser.avatar });
        targetUserIdRef.current = targetId;
        pendingCandidatesRef.current = [];

        stopSoundRef.current = sounds.playOutgoingRingtone();

        const stream = await acquireUserMedia(type);
        stream.getAudioTracks().forEach((track) => {
          track.enabled = true;
        });
        localStreamRef.current = stream;
        setLocalStream(stream);
        setIsMuted(false);

        const pc = await createPeerConnection(targetId);

        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });

        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: type === 'video',
        });
        await pc.setLocalDescription(offer);

        socket.emit('call:start', {
          to: targetId,
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

    const callerFrom = extractId(incomingCall.from);
    if (!callerFrom) {
      console.error('[WebRTC] Cannot answer call: caller ID is invalid', incomingCall);
      return;
    }

    try {
      unlockAudioPipeline();

      if (stopSoundRef.current) {
        stopSoundRef.current();
        stopSoundRef.current = null;
      }

      const type = incomingCall.callType || 'audio';
      const peer = {
        id: callerFrom,
        name: incomingCall.callerName || 'User',
        avatar: incomingCall.callerAvatar,
      };
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

      const pc = await createPeerConnection(callerFrom);

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
    const callerId = extractId(incomingCall?.from);
    if (socket && callerId) {
      socket.emit('call:rejected', {
        to: callerId,
        callType: incomingCall?.callType,
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
    const targetId = extractId(targetUserIdRef.current || incomingCall?.from || peerUser?.id);
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
      unlockAudioPipeline();

      if (callTypeRef.current === 'video' && remoteVideoRef.current) {
        remoteVideoRef.current.muted = false;
        remoteVideoRef.current.volume = 1.0;
        await remoteVideoRef.current.play();
      }

      if (callTypeRef.current === 'audio') {
        if (internalAudioRef.current) {
          internalAudioRef.current.muted = false;
          internalAudioRef.current.volume = 1.0;
          await internalAudioRef.current.play();
        }
        if (remoteAudioRef.current) {
          remoteAudioRef.current.muted = false;
          remoteAudioRef.current.volume = 1.0;
          await remoteAudioRef.current.play();
        }
      }

      setIsAudioBlocked(false);
    } catch (e) {
      console.warn('[WebRTC] Manual resume caught:', e);
    }
  }, [unlockAudioPipeline]);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    const handleIncomingCall = (data: IncomingCallData) => {
      console.log(`[WebRTC] Incoming ${data.callType || 'audio'} call from:`, data.callerName);
      const callerId = extractId(data.from);

      if (callStatusRef.current !== 'idle') {
        socket.emit('call:rejected', { to: callerId, callType: data.callType });
        return;
      }

      setIncomingCall(data);
      setCallType(data.callType || 'audio');
      callTypeRef.current = data.callType || 'audio';
      setCallStatus('incoming');
      setPeerUser({
        id: callerId,
        name: data.callerName,
        avatar: data.callerAvatar,
      });
      targetUserIdRef.current = callerId;

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

        // Flush all pending candidates that arrived early
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
