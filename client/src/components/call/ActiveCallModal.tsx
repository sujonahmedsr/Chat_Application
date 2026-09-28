'use client';

import React from 'react';
import {
  Mic,
  MicOff,
  PhoneOff,
  Video,
  VideoOff,
  RefreshCw,
  FlipHorizontal,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      {/* Hidden audio element receiving remote stream */}
      <audio
        ref={remoteAudioRef as any}
        autoPlay
        playsInline
        className="hidden"
      />

      <div
        className={`w-full ${
          isVideo ? 'max-w-3xl h-[85vh]' : 'max-w-sm'
        } mx-4 bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl relative overflow-hidden flex flex-col`}
      >
        {/* VIDEO CALL VIEWPORT */}
        {isVideo ? (
          <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
            {/* Remote Video Stream */}
            <video
              ref={remoteVideoRef as any}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />

            {/* If remote video not yet connected, show placeholder avatar */}
            {callStatus === 'calling' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-950/80 backdrop-blur-sm z-10">
                <Avatar name={peerUser?.name || 'User'} avatar={peerUser?.avatar} size="xl" />
                <h3 className="text-xl font-semibold text-white mt-4">{peerUser?.name}</h3>
                <p className="text-sm text-emerald-400 animate-pulse mt-1">Calling Video...</p>
              </div>
            )}

            {/* Local Video Stream (Picture-in-Picture floating) */}
            <div className="absolute top-4 right-4 w-32 h-44 sm:w-40 sm:h-52 bg-neutral-900 rounded-2xl overflow-hidden border-2 border-emerald-500/80 shadow-2xl z-20">
              <video
                ref={localVideoRef as any}
                autoPlay
                playsInline
                muted
                style={{ transform: isMirrored ? 'scaleX(-1)' : 'scaleX(1)' }}
                className={`w-full h-full object-cover transition-transform duration-300 ${
                  isCameraOff ? 'hidden' : 'block'
                }`}
              />
              {isCameraOff && (
                <div className="w-full h-full flex flex-col items-center justify-center bg-neutral-900 text-neutral-400 text-xs">
                  <VideoOff className="w-6 h-6 mb-1 text-neutral-500" />
                  <span>Camera off</span>
                </div>
              )}

              {/* In-PiP quick actions */}
              <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-auto">
                <button
                  onClick={onToggleMirror}
                  className="p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white text-[10px] backdrop-blur-sm transition-colors flex items-center gap-1"
                  title={isMirrored ? 'Unmirror View (Natural Real Look)' : 'Mirror View'}
                >
                  <FlipHorizontal className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{isMirrored ? 'Mirrored' : 'Natural'}</span>
                </button>

                <button
                  onClick={onSwitchCamera}
                  className="p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white backdrop-blur-sm transition-colors"
                  title="Switch Front / Back Camera"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* In-Video Header Info */}
            <div className="absolute top-4 left-4 z-20 bg-black/60 backdrop-blur-md px-3.5 py-1.5 rounded-full flex items-center gap-2 border border-white/10">
              <span className="font-semibold text-white text-xs">{peerUser?.name}</span>
              <span className="text-neutral-400 text-xs">•</span>
              <span className="text-emerald-400 font-mono text-xs font-semibold">
                {callStatus === 'calling' ? 'Calling...' : formatDuration(duration)}
              </span>
            </div>
          </div>
        ) : (
          /* AUDIO CALL VIEWPORT */
          <div className="p-8 text-center relative overflow-hidden flex flex-col items-center">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative mb-4 mt-2">
              {callStatus === 'connected' && (
                <div className="absolute -inset-2 rounded-full bg-emerald-500/20 animate-pulse" />
              )}
              <Avatar
                name={peerUser?.name || 'User'}
                avatar={peerUser?.avatar}
                size="xl"
              />
            </div>

            <h3 className="text-xl font-semibold text-white tracking-tight">
              {peerUser?.name || 'Unknown User'}
            </h3>

            <div className="mt-1 flex items-center gap-2">
              {callStatus === 'calling' ? (
                <span className="text-sm text-neutral-400 font-medium animate-pulse">
                  Calling Audio...
                </span>
              ) : (
                <div className="flex items-center gap-1.5 text-emerald-400 font-mono text-sm font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
                  <span>{formatDuration(duration)}</span>
                </div>
              )}
            </div>

            {callStatus === 'connected' && (
              <div className="flex items-center justify-center gap-1 h-8 mt-5">
                <span className="w-1 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.3s] h-4" />
                <span className="w-1 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.15s] h-6" />
                <span className="w-1 bg-teal-400 rounded-full animate-bounce [animation-delay:0s] h-8" />
                <span className="w-1 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.15s] h-5" />
                <span className="w-1 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.3s] h-3" />
              </div>
            )}
          </div>
        )}

        {/* CONTROLS BAR */}
        <div className="p-4 bg-neutral-950/95 border-t border-neutral-800 flex items-center justify-center gap-4 sm:gap-6">
          {/* Mute toggle */}
          <button
            onClick={onToggleMute}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
              isMuted
                ? 'bg-amber-600/20 border border-amber-500 text-amber-400'
                : 'bg-neutral-800 border border-neutral-700 text-neutral-200 hover:bg-neutral-700'
            }`}
            title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* Camera toggle (available in video calls) */}
          {isVideo && (
            <>
              <button
                onClick={onToggleCamera}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                  isCameraOff
                    ? 'bg-amber-600/20 border border-amber-500 text-amber-400'
                    : 'bg-neutral-800 border border-neutral-700 text-neutral-200 hover:bg-neutral-700'
                }`}
                title={isCameraOff ? 'Turn camera on' : 'Turn camera off'}
              >
                {isCameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
              </button>

              {/* Switch Camera (Front / Back) */}
              <button
                onClick={onSwitchCamera}
                className="w-12 h-12 rounded-full bg-neutral-800 border border-neutral-700 text-neutral-200 hover:bg-neutral-700 flex items-center justify-center transition-all"
                title={`Switch Camera (Currently ${facingMode === 'user' ? 'Front' : 'Back'})`}
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </>
          )}

          {/* End Call */}
          <button
            onClick={onEndCall}
            className="w-13 h-13 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-600/30 transition-transform active:scale-95"
            title="End Call"
          >
            <PhoneOff className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
};
