'use client';

import React from 'react';
import { Phone, PhoneOff, Users } from 'lucide-react';
import { IncomingGroupCallData } from '@/hooks/useGroupCall';
import { Avatar } from '../ui/Avatar';

interface GroupIncomingCallModalProps {
  incomingCall: IncomingGroupCallData | null;
  onAccept: () => void;
  onReject: () => void;
}

export const GroupIncomingCallModal: React.FC<GroupIncomingCallModalProps> = ({
  incomingCall,
  onAccept,
  onReject,
}) => {
  if (!incomingCall) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md animate-in fade-in duration-200 p-4">
      <div className="w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-3xl p-6 text-center shadow-2xl relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-44 h-44 bg-emerald-500/15 rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col items-center mt-2">
          {/* Animated pulsing group icon */}
          <div className="relative mb-4">
            <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping duration-1000" />
            <div className="w-20 h-20 rounded-full bg-emerald-600/20 border-2 border-emerald-500/50 flex items-center justify-center text-emerald-400 relative shadow-xl">
              <Users className="w-10 h-10" />
            </div>
          </div>

          <h3 className="text-xl font-bold text-white tracking-tight">
            {incomingCall.groupName}
          </h3>
          <p className="text-xs text-neutral-300 mt-1">
            <span className="font-semibold text-emerald-400">{incomingCall.callerName}</span> started a group audio call
          </p>

          <div className="flex items-center gap-1.5 mt-2 text-emerald-400 font-medium text-xs animate-pulse">
            <Phone className="w-3.5 h-3.5" />
            <span>Group Audio Call Ringing...</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-center gap-10 mt-8">
          {/* Reject */}
          <button
            onClick={onReject}
            className="flex flex-col items-center gap-1.5 group transition-transform active:scale-95"
            title="Decline"
          >
            <div className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-500 flex items-center justify-center text-white shadow-lg shadow-rose-600/30 transition-all group-hover:scale-105">
              <PhoneOff className="w-6 h-6" />
            </div>
            <span className="text-xs text-neutral-400 group-hover:text-white font-medium">Decline</span>
          </button>

          {/* Accept */}
          <button
            onClick={onAccept}
            className="flex flex-col items-center gap-1.5 group transition-transform active:scale-95"
            title="Join Call"
          >
            <div className="w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-600/30 transition-all group-hover:scale-105 animate-bounce">
              <Phone className="w-6 h-6" />
            </div>
            <span className="text-xs text-neutral-400 group-hover:text-white font-medium">Join Call</span>
          </button>
        </div>
      </div>
    </div>
  );
};
