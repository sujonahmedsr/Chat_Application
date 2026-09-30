'use client';

import React, { useState } from 'react';
import {
  Mic,
  MicOff,
  PhoneOff,
  UserPlus,
  Users,
  Minimize2,
  Maximize2,
  X,
  Volume2,
} from 'lucide-react';
import { GroupCallParticipant } from '@/hooks/useGroupCall';
import { User } from '@/types';
import { Avatar } from '../ui/Avatar';

interface ActiveGroupCallModalProps {
  isOpen: boolean;
  groupName: string;
  duration: number;
  participants: GroupCallParticipant[];
  availableGroupMembers?: User[];
  isMuted: boolean;
  onToggleMute: () => void;
  onInviteMembers: (memberIds: string[]) => void;
  onLeaveCall: () => void;
}

export const ActiveGroupCallModal: React.FC<ActiveGroupCallModalProps> = ({
  isOpen,
  groupName,
  duration,
  participants,
  availableGroupMembers = [],
  isMuted,
  onToggleMute,
  onInviteMembers,
  onLeaveCall,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [selectedToAdd, setSelectedToAdd] = useState<string[]>([]);

  if (!isOpen) return null;

  const formatDuration = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSendInvites = () => {
    if (selectedToAdd.length > 0) {
      onInviteMembers(selectedToAdd);
      setSelectedToAdd([]);
      setShowAddMembers(false);
    }
  };

  // Filter members who are not yet in the call
  const activeIds = new Set(participants.map((p) => String(p.id)));
  const membersCanAdd = availableGroupMembers.filter(
    (m) => !activeIds.has(String(m.id || (m as any)._id))
  );

  if (isMinimized) {
    return (
      <div className="fixed bottom-5 right-5 z-50 bg-neutral-900 border border-neutral-800 rounded-2xl p-3 shadow-2xl flex items-center gap-3 animate-in fade-in duration-150">
        <div className="w-10 h-10 rounded-xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center">
          <Users className="w-5 h-5 animate-pulse" />
        </div>
        <div>
          <h4 className="text-xs font-semibold text-white">{groupName}</h4>
          <p className="text-[11px] text-emerald-400 font-mono">
            {formatDuration(duration)} • {participants.length} connected
          </p>
        </div>
        <div className="flex items-center gap-1.5 ml-2">
          <button
            onClick={onToggleMute}
            className={`p-2 rounded-xl transition-colors ${
              isMuted ? 'bg-red-500/20 text-red-400' : 'bg-neutral-800 text-neutral-300'
            }`}
          >
            {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setIsMinimized(false)}
            className="p-2 rounded-xl bg-neutral-800 text-neutral-300 hover:text-white"
            title="Maximize"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            onClick={onLeaveCall}
            className="p-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white"
            title="Leave"
          >
            <PhoneOff className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col relative">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-white">{groupName}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs text-emerald-400 font-mono font-medium">
                  {formatDuration(duration)}
                </span>
                <span className="text-xs text-neutral-400">• {participants.length} connected</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsMinimized(true)}
              className="p-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              title="Minimize"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Participants Grid */}
        <div className="p-6 overflow-y-auto max-h-[50vh] custom-scrollbar">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {participants.map((participant) => (
              <div
                key={participant.id}
                className="bg-neutral-800/50 border border-neutral-800 rounded-2xl p-3.5 flex flex-col items-center text-center relative overflow-hidden group hover:border-emerald-500/40 transition-all shadow-sm"
              >
                <div className="relative mb-2">
                  <Avatar
                    name={participant.name}
                    avatar={participant.avatar}
                    size="lg"
                  />
                  <div className="absolute -bottom-1 -right-1 p-1 rounded-full bg-neutral-900 border border-neutral-700 text-emerald-400 shadow">
                    <Volume2 className="w-3 h-3 animate-pulse" />
                  </div>
                </div>
                <span className="text-xs font-semibold text-white truncate max-w-full">
                  {participant.name}
                </span>
                <span className="text-[10px] text-emerald-400 mt-0.5">Connected</span>
              </div>
            ))}
          </div>
        </div>

        {/* Action Controls Toolbar */}
        <div className="px-6 py-4 border-t border-neutral-800 bg-neutral-900/90 flex items-center justify-between">
          {/* Add member button */}
          <button
            onClick={() => setShowAddMembers((prev) => !prev)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white text-xs font-semibold transition-all border border-neutral-700 active:scale-95"
            title="Invite more group members"
          >
            <UserPlus className="w-4 h-4 text-emerald-400" />
            <span>Add to Call</span>
          </button>

          <div className="flex items-center gap-3">
            {/* Mute button */}
            <button
              onClick={onToggleMute}
              className={`p-3 rounded-full transition-all active:scale-95 shadow-md ${
                isMuted
                  ? 'bg-rose-600/20 text-rose-400 border border-rose-500/40 hover:bg-rose-600 hover:text-white'
                  : 'bg-neutral-800 text-white hover:bg-neutral-700 border border-neutral-700'
              }`}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            {/* Leave call button */}
            <button
              onClick={onLeaveCall}
              className="px-5 py-2.5 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-rose-600/30 transition-all active:scale-95"
              title="Leave Call"
            >
              <PhoneOff className="w-4 h-4" />
              <span>Leave</span>
            </button>
          </div>
        </div>

        {/* Add Members Drawer / Popover */}
        {showAddMembers && (
          <div className="absolute inset-x-0 bottom-0 bg-neutral-900 border-t border-neutral-800 p-4 rounded-b-3xl shadow-2xl z-20 animate-in fade-in slide-in-from-bottom-4 duration-150">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold text-white">Invite Group Members to Call</h4>
              <button
                onClick={() => setShowAddMembers(false)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {membersCanAdd.length === 0 ? (
              <p className="text-xs text-neutral-500 text-center py-4">
                All group members are already in this call.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-44 overflow-y-auto custom-scrollbar mb-3">
                {membersCanAdd.map((member) => {
                  const mId = String(member.id || (member as any)._id);
                  const isSelected = selectedToAdd.includes(mId);
                  return (
                    <div
                      key={mId}
                      onClick={() => {
                        setSelectedToAdd((prev) =>
                          prev.includes(mId) ? prev.filter((id) => id !== mId) : [...prev, mId]
                        );
                      }}
                      className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-colors ${
                        isSelected ? 'bg-emerald-950/60 border border-emerald-800/60' : 'bg-neutral-800/40 hover:bg-neutral-800'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Avatar name={member.name} avatar={member.avatar} size="sm" />
                        <span className="text-xs font-medium text-white">{member.name}</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="rounded border-neutral-700 text-emerald-600 focus:ring-emerald-500"
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {membersCanAdd.length > 0 && (
              <button
                onClick={handleSendInvites}
                disabled={selectedToAdd.length === 0}
                className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
              >
                <UserPlus className="w-4 h-4" />
                <span>Ring Selected ({selectedToAdd.length})</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
