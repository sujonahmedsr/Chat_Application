'use client';

import React from 'react';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { IncomingCallData } from '@/types';
import { Avatar } from '../ui/Avatar';

interface IncomingCallModalProps {
  incomingCall: IncomingCallData | null;
  onAccept: () => void;
  onReject: () => void;
}

export const IncomingCallModal: React.FC<IncomingCallModalProps> = ({
  incomingCall,
  onAccept,
  onReject,
}) => {
  if (!incomingCall) return null;

  const isVideo = incomingCall.callType === 'video';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-sm mx-4 bg-neutral-900 border border-neutral-800 rounded-3xl p-6 text-center shadow-2xl relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-40 h-40 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col items-center mt-2">
          {/* Animated pulsing avatar */}
          <div className="relative mb-4">
            <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping duration-1000" />
            <div className="relative">
              <Avatar
                name={incomingCall.callerName}
                avatar={incomingCall.callerAvatar}
                size="xl"
              />
            </div>
          </div>

          <h3 className="text-xl font-semibold text-white tracking-tight">
            {incomingCall.callerName}
          </h3>
          <div className="flex items-center gap-1.5 mt-1 text-emerald-400 font-medium text-sm animate-pulse">
            {isVideo ? <Video className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
            <span>Incoming {isVideo ? 'Video' : 'Audio'} Call...</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-center gap-10 mt-8">
          {/* Reject button */}
          <button
            onClick={onReject}
            className="flex flex-col items-center gap-2 group transition-transform active:scale-95"
            title="Decline"
          >
            <div className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center text-white shadow-lg shadow-red-600/30 transition-all group-hover:scale-105">
              <PhoneOff className="w-6 h-6" />
            </div>
            <span className="text-xs text-neutral-400 group-hover:text-neutral-200">Decline</span>
          </button>

          {/* Accept button */}
          <button
            onClick={onAccept}
            className="flex flex-col items-center gap-2 group transition-transform active:scale-95"
            title="Accept"
          >
            <div className="w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-600/30 transition-all group-hover:scale-105 animate-bounce">
              {isVideo ? <Video className="w-6 h-6" /> : <Phone className="w-6 h-6" />}
            </div>
            <span className="text-xs text-neutral-400 group-hover:text-neutral-200">Accept</span>
          </button>
        </div>
      </div>
    </div>
  );
};
