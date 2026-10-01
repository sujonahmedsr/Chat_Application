'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Mic,
  MicOff,
  PhoneOff,
  Video,
  VideoOff,
  RefreshCw,
  FlipHorizontal,
  Move,
  Minimize2,
  Maximize2,
  Volume2,
} from 'lucide-react';
import { CallState } from '@/types';
import { Avatar } from '../ui/Avatar';

interface ActiveCallModalProps {
  callStatus: CallState;
  callType: 'audio' | 'video';
  peerUser: { id: string; name: string; avatar?: string } | null;
  duration: number;
  isMuted: boolean;
  isCameraOff: boolean;
  isMirrored?: boolean;
  facingMode?: 'user' | 'environment';
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onToggleMirror?: () => void;
  onSwitchCamera?: () => void;
  onEndCall: () => void;
  remoteAudioRef: React.RefObject<HTMLAudioElement | null>;
  localVideoRef: React.RefObject<HTMLVideoElement | null>;
  remoteVideoRef: React.RefObject<HTMLVideoElement | null>;
  localStream?: MediaStream | null;
  remoteStream?: MediaStream | null;
  isAudioBlocked?: boolean;
  onResumeAudio?: () => void;
}

export const ActiveCallModal: React.FC<ActiveCallModalProps> = ({
  callStatus,
  callType,
  peerUser,
  duration,
  isMuted,
  isCameraOff,
  isMirrored = false,
  facingMode = 'user',
  onToggleMute,
  onToggleCamera,
  onToggleMirror,
  onSwitchCamera,
  onEndCall,
  remoteAudioRef,
  localVideoRef,
  remoteVideoRef,
  localStream,
  remoteStream,
  isAudioBlocked = false,
  onResumeAudio,
}) => {
  const isVideo = callType === 'video';

  // Video calls default to FULL SCREEN on start; user can minimize/float if desired
  const [isFullscreen, setIsFullscreen] = useState(isVideo);
  const [isMinimized, setIsMinimized] = useState(false);

  // Draggable position state for floating window mode
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);

  // Synchronize remote video element whenever stream, fullscreen state, or status changes
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream && isVideo) {
      if (remoteVideoRef.current.srcObject !== remoteStream) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
      (remoteVideoRef.current as any).playsInline = true;
      remoteVideoRef.current.setAttribute('playsinline', '');
      remoteVideoRef.current.setAttribute('webkit-playsinline', '');
      remoteVideoRef.current.muted = false;
      remoteVideoRef.current.volume = 1.0;
      remoteVideoRef.current.play().catch((err) => {
        console.warn('[ActiveCallModal] Remote video unmuted play held by browser:', err);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.muted = true;
          remoteVideoRef.current.play().catch(() => {});
        }
      });
    }
  }, [remoteStream, isFullscreen, isVideo, callStatus, remoteVideoRef]);

  // Synchronize local video element
  useEffect(() => {
    if (localVideoRef.current && localStream && isVideo) {
      if (localVideoRef.current.srcObject !== localStream) {
        localVideoRef.current.srcObject = localStream;
      }
      localVideoRef.current.muted = true;
      (localVideoRef.current as any).playsInline = true;
      localVideoRef.current.setAttribute('playsinline', '');
      localVideoRef.current.setAttribute('webkit-playsinline', '');
      localVideoRef.current.play().catch(() => {});
    }
  }, [localStream, isFullscreen, isCameraOff, isVideo, callStatus, localVideoRef]);

  // Initialize fullscreen on video call start
  useEffect(() => {
    if (callStatus === 'calling' || callStatus === 'connected') {
      if (callType === 'video') {
        setIsFullscreen(true);
      }
      if (typeof window !== 'undefined' && position === null) {
        const defaultWidth = 360;
        const defaultHeight = callType === 'video' ? 320 : 180;
        const initialX = Math.max(16, window.innerWidth - defaultWidth - 24);
        const initialY = Math.max(16, window.innerHeight - defaultHeight - 24);
        setPosition({ x: initialX, y: initialY });
      }
    } else {
      setIsFullscreen(false);
      setIsMinimized(false);
      setPosition(null);
    }
  }, [callStatus, callType]);

  // Pointer drag event handlers for floating window
  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;

    const newX = Math.max(10, Math.min(window.innerWidth - 80, e.clientX - dragOffset.x));
    const newY = Math.max(10, Math.min(window.innerHeight - 80, e.clientY - dragOffset.y));
    setPosition({ x: newX, y: newY });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging) {
      setIsDragging(false);
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  const formatDuration = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    const hours = Math.floor(mins / 60);

    if (hours > 0) {
      const remainingMins = mins % 60;
      return `${String(hours).padStart(2, '0')}:${String(remainingMins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Always render hidden audio element for WebRTC audio playback
  if (callStatus !== 'calling' && callStatus !== 'connected') {
    return (
      <audio
        ref={remoteAudioRef as any}
        autoPlay
        playsInline
        aria-hidden="true"
        style={{
          position: 'fixed',
          opacity: 0,
          pointerEvents: 'none',
          width: '1px',
          height: '1px',
          bottom: 0,
          right: 0,
        }}
      />
    );
  }

  return (
    <>
      {/* Audio Autoplay Unblock Banner for Mobile Browsers */}
      {isAudioBlocked && (
        <div
          onClick={onResumeAudio}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[120] px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs sm:text-sm rounded-full shadow-2xl cursor-pointer flex items-center gap-2 animate-bounce transition-all backdrop-blur-md border border-amber-300"
        >
          <Volume2 className="w-4 h-4 animate-pulse text-neutral-950" />
          <span>Sound paused by phone browser — Tap here to hear audio</span>
        </div>
      )}

      {/* Remote Audio Track (always present for sound) */}
      <audio
        ref={remoteAudioRef as any}
        autoPlay
        playsInline
        aria-hidden="true"
        style={{
          position: 'fixed',
          opacity: 0,
          pointerEvents: 'none',
          width: '1px',
          height: '1px',
          bottom: 0,
          right: 0,
        }}
      />

      {/* ==================================================================== */}
      {/* MODE 1: FULLSCREEN VIDEO CALL (DEFAULT FOR VIDEO CALLS)             */}
      {/* ==================================================================== */}
      {isVideo && isFullscreen ? (
        <div className="fixed inset-0 z-[100] w-screen h-[100dvh] bg-neutral-950 flex flex-col overflow-hidden select-none animate-in fade-in duration-200">
          {/* Main Remote Video Background */}
          <div className="relative flex-1 w-full h-full bg-black flex items-center justify-center overflow-hidden">
            <video
              ref={(el) => {
                (remoteVideoRef as any).current = el;
                if (el && remoteStream) {
                  if (el.srcObject !== remoteStream) {
                    el.srcObject = remoteStream;
                  }
                  el.muted = false;
                  el.volume = 1.0;
                  el.play().catch(() => {
                    el.muted = true;
                    el.play().catch(() => {});
                  });
                }
              }}
              autoPlay
              playsInline
              className="w-full h-full object-cover sm:object-contain"
            />

            {/* Calling State Overlay */}
            {callStatus === 'calling' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-950/85 backdrop-blur-md z-10">
                <div className="relative mb-4">
                  <div className="absolute -inset-3 rounded-full bg-emerald-500/20 animate-ping" />
                  <Avatar name={peerUser?.name || 'User'} avatar={peerUser?.avatar} size="lg" />
                </div>
                <h3 className="text-xl font-bold text-white mt-2">{peerUser?.name}</h3>
                <p className="text-sm text-emerald-400 animate-pulse mt-1">Calling Video...</p>
              </div>
            )}

            {/* Top Bar Overlay */}
            <div className="absolute top-0 left-0 right-0 p-4 sm:p-6 bg-gradient-to-b from-black/80 via-black/40 to-transparent flex items-center justify-between z-30 pointer-events-auto">
              <div className="flex items-center gap-3">
                <Avatar name={peerUser?.name || 'User'} avatar={peerUser?.avatar} size="sm" />
                <div>
                  <h4 className="text-sm font-bold text-white">{peerUser?.name}</h4>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-emerald-300 font-mono font-medium">
                      {callStatus === 'calling' ? 'Calling...' : formatDuration(duration)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Shrink / Exit Fullscreen Button */}
              <button
                type="button"
                onClick={() => setIsFullscreen(false)}
                className="px-3 py-2 rounded-xl bg-neutral-900/80 hover:bg-neutral-800 text-white text-xs font-semibold backdrop-blur-md border border-neutral-700/60 transition-all flex items-center gap-1.5 shadow-lg"
                title="Shrink to Floating Window"
              >
                <Minimize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Floating Window</span>
              </button>
            </div>

            {/* Local Video Stream (Picture-in-Picture) */}
            <div className="absolute bottom-24 sm:bottom-28 right-4 sm:right-6 w-32 h-44 sm:w-44 sm:h-60 bg-neutral-900 rounded-3xl overflow-hidden border-2 border-emerald-500/80 shadow-2xl z-30 pointer-events-auto">
              <video
                ref={localVideoRef as any}
                autoPlay
                playsInline
                muted
                style={{ transform: isMirrored ? 'scaleX(-1)' : 'scaleX(1)' }}
                className={`w-full h-full object-cover transition-transform duration-200 ${
                  isCameraOff ? 'hidden' : 'block'
                }`}
              />
              {isCameraOff && (
                <div className="w-full h-full flex flex-col items-center justify-center bg-neutral-900 text-neutral-400 text-xs">
                  <VideoOff className="w-6 h-6 mb-1 text-neutral-500" />
                  <span>Camera off</span>
                </div>
              )}

              {/* In-PiP actions: Mirror & Camera Flip */}
              <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-auto">
                <button
                  type="button"
                  onClick={onToggleMirror}
                  className="p-1.5 rounded-lg bg-black/70 hover:bg-black/90 text-white text-xs backdrop-blur-sm transition-colors"
                  title={isMirrored ? 'Unmirror View' : 'Mirror View'}
                >
                  <FlipHorizontal className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={onSwitchCamera}
                  className="p-1.5 rounded-lg bg-black/70 hover:bg-black/90 text-white text-xs backdrop-blur-sm transition-colors"
                  title="Switch Front / Back Camera"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Bottom Floating Glass Controls Bar */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-full bg-neutral-900/85 backdrop-blur-xl border border-neutral-700/80 shadow-2xl flex items-center gap-3 sm:gap-4 z-30 pointer-events-auto">
              {/* Mute Button */}
              <button
                type="button"
                onClick={onToggleMute}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                  isMuted
                    ? 'bg-amber-600/30 border border-amber-500 text-amber-400 shadow-md'
                    : 'bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700'
                }`}
                title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
              >
                {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>

              {/* Camera Button */}
              <button
                type="button"
                onClick={onToggleCamera}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                  isCameraOff
                    ? 'bg-amber-600/30 border border-amber-500 text-amber-400 shadow-md'
                    : 'bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700'
                }`}
                title={isCameraOff ? 'Turn camera on' : 'Turn camera off'}
              >
                {isCameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
              </button>

              {/* Switch Camera Button */}
              <button
                type="button"
                onClick={onSwitchCamera}
                className="w-12 h-12 rounded-full bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700 flex items-center justify-center transition-all"
                title={`Switch Camera (${facingMode === 'user' ? 'Front' : 'Back'})`}
              >
                <RefreshCw className="w-5 h-5" />
              </button>

              {/* End Call Button */}
              <button
                type="button"
                onClick={onEndCall}
                className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-600/40 transition-transform active:scale-95"
                title="End Call"
              >
                <PhoneOff className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* ==================================================================== */
        /* MODE 2: FLOATING / DRAGGABLE WINDOW (AUDIO CALLS OR MINIMIZED VIDEO) */
        /* ==================================================================== */
        <div
          ref={containerRef}
          style={{
            left: position ? `${position.x}px` : undefined,
            top: position ? `${position.y}px` : undefined,
            touchAction: 'none',
          }}
          className={`fixed z-50 select-none shadow-2xl transition-shadow ${
            position ? '' : 'bottom-6 right-6'
          } ${isDragging ? 'shadow-emerald-500/20 ring-2 ring-emerald-500/40 cursor-grabbing' : 'cursor-grab'}`}
        >
          <div
            className={`bg-neutral-900/95 border border-neutral-800 backdrop-blur-xl rounded-3xl overflow-hidden shadow-2xl flex flex-col transition-all duration-200 ${
              isMinimized
                ? 'w-72 sm:w-80'
                : isVideo
                ? 'w-80 sm:w-96 h-[340px] sm:h-[380px]'
                : 'w-72 sm:w-80'
            }`}
          >
            {/* DRAGGABLE HEADER BAR */}
            <div
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              className="px-3.5 py-2.5 bg-neutral-950/80 border-b border-neutral-800 flex items-center justify-between cursor-grab active:cursor-grabbing"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Move className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
                <span className="text-xs font-semibold text-white truncate">
                  {peerUser?.name || 'Call'}
                </span>
                <span className="text-neutral-500 text-xs">•</span>
                <span className="text-[11px] font-mono text-emerald-400 font-semibold flex-shrink-0">
                  {callStatus === 'calling' ? 'Calling...' : formatDuration(duration)}
                </span>
              </div>

              <div className="flex items-center gap-1">
                {/* Expand to Fullscreen for Video Call */}
                {isVideo && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsFullscreen(true);
                      setIsMinimized(false);
                    }}
                    className="p-1 rounded-lg text-emerald-400 hover:text-white hover:bg-emerald-600/30 transition-colors"
                    title="Expand to Fullscreen"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Minimize / Expand Toggle */}
                <button
                  type="button"
                  onClick={() => setIsMinimized((prev) => !prev)}
                  className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
                  title={isMinimized ? 'Expand Call Window' : 'Minimize Call Window'}
                >
                  {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
                </button>

                {/* Quick End Call */}
                <button
                  type="button"
                  onClick={onEndCall}
                  className="p-1 rounded-lg text-rose-400 hover:text-white hover:bg-rose-600 transition-colors"
                  title="End Call"
                >
                  <PhoneOff className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* COMPACT MINIMIZED VIEW */}
            {isMinimized ? (
              <div className="p-3 flex items-center justify-between bg-neutral-900/90 gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar name={peerUser?.name || 'User'} avatar={peerUser?.avatar} size="sm" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-white truncate">{peerUser?.name}</p>
                    <p className="text-[10px] text-emerald-400 font-mono">
                      {callStatus === 'calling' ? 'Calling...' : formatDuration(duration)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {isVideo && (
                    <button
                      type="button"
                      onClick={() => setIsFullscreen(true)}
                      className="p-2 rounded-xl text-xs bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30"
                      title="Fullscreen"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onToggleMute}
                    className={`p-2 rounded-xl text-xs transition-colors ${
                      isMuted ? 'bg-amber-500/20 text-amber-400' : 'bg-neutral-800 text-neutral-300'
                    }`}
                    title={isMuted ? 'Unmute' : 'Mute'}
                  >
                    {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={onEndCall}
                    className="p-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white transition-colors"
                    title="End Call"
                  >
                    <PhoneOff className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* EXPANDED FLOATING VIEWPORT */}
                {isVideo ? (
                  /* FLOATING VIDEO VIEWPORT */
                  <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
                    <video
                      ref={(el) => {
                        (remoteVideoRef as any).current = el;
                        if (el && remoteStream) {
                          if (el.srcObject !== remoteStream) {
                            el.srcObject = remoteStream;
                          }
                          el.muted = false;
                          el.volume = 1.0;
                          el.play().catch(() => {
                            el.muted = true;
                            el.play().catch(() => {});
                          });
                        }
                      }}
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover"
                    />

                    {callStatus === 'calling' && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-950/80 backdrop-blur-sm z-10">
                        <Avatar name={peerUser?.name || 'User'} avatar={peerUser?.avatar} size="lg" />
                        <h4 className="text-sm font-semibold text-white mt-3">{peerUser?.name}</h4>
                        <p className="text-xs text-emerald-400 animate-pulse mt-1">Calling Video...</p>
                      </div>
                    )}

                    {/* Local Video Stream PiP */}
                    <div className="absolute top-2.5 right-2.5 w-24 h-32 sm:w-28 sm:h-36 bg-neutral-900 rounded-2xl overflow-hidden border border-emerald-500/70 shadow-2xl z-20">
                      <video
                        ref={localVideoRef as any}
                        autoPlay
                        playsInline
                        muted
                        style={{ transform: isMirrored ? 'scaleX(-1)' : 'scaleX(1)' }}
                        className={`w-full h-full object-cover transition-transform duration-200 ${
                          isCameraOff ? 'hidden' : 'block'
                        }`}
                      />
                      {isCameraOff && (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-neutral-900 text-neutral-400 text-[10px]">
                          <VideoOff className="w-4 h-4 mb-1 text-neutral-500" />
                          <span>Camera off</span>
                        </div>
                      )}

                      <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between pointer-events-auto">
                        <button
                          type="button"
                          onClick={onToggleMirror}
                          className="p-1 rounded bg-black/60 hover:bg-black/80 text-white text-[9px] backdrop-blur-sm transition-colors"
                          title={isMirrored ? 'Unmirror View' : 'Mirror View'}
                        >
                          <FlipHorizontal className="w-3 h-3" />
                        </button>

                        <button
                          type="button"
                          onClick={onSwitchCamera}
                          className="p-1 rounded bg-black/60 hover:bg-black/80 text-white text-[9px] backdrop-blur-sm transition-colors"
                          title="Switch Front / Back Camera"
                        >
                          <RefreshCw className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* AUDIO CALL VIEWPORT */
                  <div className="p-6 text-center relative overflow-hidden flex flex-col items-center bg-neutral-900/90">
                    <div className="relative mb-3">
                      {callStatus === 'connected' && (
                        <div className="absolute -inset-2 rounded-full bg-emerald-500/20 animate-pulse" />
                      )}
                      <Avatar name={peerUser?.name || 'User'} avatar={peerUser?.avatar} size="lg" />
                    </div>

                    <h4 className="text-sm font-semibold text-white truncate max-w-[200px]">
                      {peerUser?.name || 'User'}
                    </h4>

                    <div className="mt-1 flex items-center gap-1.5 text-emerald-400 font-mono text-xs font-semibold">
                      {callStatus === 'calling' ? (
                        <span className="text-neutral-400 animate-pulse font-sans">Calling Audio...</span>
                      ) : (
                        <>
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
                          <span>{formatDuration(duration)}</span>
                        </>
                      )}
                    </div>

                    {callStatus === 'connected' && (
                      <div className="flex items-center justify-center gap-1 h-5 mt-3">
                        <span className="w-0.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.3s] h-3" />
                        <span className="w-0.5 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.15s] h-4" />
                        <span className="w-0.5 bg-teal-400 rounded-full animate-bounce [animation-delay:0s] h-5" />
                        <span className="w-0.5 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.15s] h-4" />
                        <span className="w-0.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.3s] h-2" />
                      </div>
                    )}
                  </div>
                )}

                {/* CONTROLS BAR */}
                <div className="p-3 bg-neutral-950/95 border-t border-neutral-800 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={onToggleMute}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                      isMuted
                        ? 'bg-amber-600/20 border border-amber-500 text-amber-400'
                        : 'bg-neutral-800 border border-neutral-700 text-neutral-200 hover:bg-neutral-700'
                    }`}
                    title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                  >
                    {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>

                  {isVideo && (
                    <>
                      <button
                        type="button"
                        onClick={onToggleCamera}
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                          isCameraOff
                            ? 'bg-amber-600/20 border border-amber-500 text-amber-400'
                            : 'bg-neutral-800 border border-neutral-700 text-neutral-200 hover:bg-neutral-700'
                        }`}
                        title={isCameraOff ? 'Turn camera on' : 'Turn camera off'}
                      >
                        {isCameraOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                      </button>

                      <button
                        type="button"
                        onClick={onSwitchCamera}
                        className="w-10 h-10 rounded-full bg-neutral-800 border border-neutral-700 text-neutral-200 hover:bg-neutral-700 flex items-center justify-center transition-all"
                        title={`Switch Camera (${facingMode === 'user' ? 'Front' : 'Back'})`}
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={onEndCall}
                    className="w-11 h-11 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-600/30 transition-transform active:scale-95"
                    title="End Call"
                  >
                    <PhoneOff className="w-5 h-5" />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};
