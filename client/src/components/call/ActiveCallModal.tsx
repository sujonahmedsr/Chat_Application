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
}) => {
  // Draggable position state
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isMinimized, setIsMinimized] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize position on bottom-right of viewport on call start
  useEffect(() => {
    if (callStatus === 'calling' || callStatus === 'connected') {
      if (typeof window !== 'undefined' && position === null) {
        const defaultWidth = 360;
        const defaultHeight = callType === 'video' ? 320 : 180;
        const initialX = Math.max(16, window.innerWidth - defaultWidth - 24);
        const initialY = Math.max(16, window.innerHeight - defaultHeight - 24);
        setPosition({ x: initialX, y: initialY });
      }
    } else {
      setPosition(null);
      setIsMinimized(false);
    }
  }, [callStatus, callType, position]);

  // Pointer drag event handlers
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

  // Always render hidden audio element for WebRTC audio playback
  if (callStatus !== 'calling' && callStatus !== 'connected') {
    return (
      <audio
        ref={remoteAudioRef as any}
        autoPlay
        playsInline
        className="hidden"
      />
    );
  }

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

  const isVideo = callType === 'video';

  return (
    <>
      {/* Remote Audio Track (always present) */}
      <audio
        ref={remoteAudioRef as any}
        autoPlay
        playsInline
        className="hidden"
      />

      {/* NON-BLOCKING FLOATING CALL WINDOW */}
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
              {/* Minimize / Expand Toggle */}
              <button
                type="button"
                onClick={() => setIsMinimized((prev) => !prev)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
                title={isMinimized ? 'Expand Call Window' : 'Minimize Call Window'}
              >
                {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
              </button>

              {/* Quick End Call in header */}
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
              {/* EXPANDED VIEWPORT */}
              {isVideo ? (
                /* VIDEO CALL VIEWPORT */
                <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
                  {/* Remote Video Stream */}
                  <video
                    ref={remoteVideoRef as any}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />

                  {/* Calling state placeholder */}
                  {callStatus === 'calling' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-950/80 backdrop-blur-sm z-10">
                      <Avatar name={peerUser?.name || 'User'} avatar={peerUser?.avatar} size="lg" />
                      <h4 className="text-sm font-semibold text-white mt-3">{peerUser?.name}</h4>
                      <p className="text-xs text-emerald-400 animate-pulse mt-1">Calling Video...</p>
                    </div>
                  )}

                  {/* Local Video Stream (Picture-in-Picture floating) */}
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

                    {/* In-PiP actions: Mirror & Camera Flip */}
                    <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between pointer-events-auto">
                      <button
                        type="button"
                        onClick={onToggleMirror}
                        className="p-1 rounded bg-black/60 hover:bg-black/80 text-white text-[9px] backdrop-blur-sm transition-colors"
                        title={isMirrored ? 'Unmirror (Natural View)' : 'Mirror View'}
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
                {/* Mute button */}
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

                {/* Video controls */}
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
                      title={`Switch Camera (Currently ${facingMode === 'user' ? 'Front' : 'Back'})`}
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </>
                )}

                {/* End Call */}
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
    </>
  );
};
