'use client';

import React, { useEffect, useState } from 'react';
import { X, Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, PhoneOff } from 'lucide-react';
import { CallLog, User } from '@/types';
import { apiRequest } from '@/lib/api';
import { Avatar } from '../ui/Avatar';

interface CallLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId?: string;
  onStartCall: (targetUser: User) => void;
}

export const CallLogsModal: React.FC<CallLogsModalProps> = ({
  isOpen,
  onClose,
  currentUserId,
  onStartCall,
}) => {
  const [logs, setLogs] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      apiRequest('/calls/logs')
        .then((data) => setLogs(data.callLogs || []))
        .catch((err) => console.error('Failed to load call logs:', err))
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const formatDuration = (seconds: number) => {
    if (!seconds || seconds <= 0) return '0s';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const getStatusIcon = (log: CallLog, isOutgoing: boolean) => {
    if (log.status === 'missed') {
      return <PhoneMissed className="w-4 h-4 text-red-400" />;
    }
    if (log.status === 'rejected') {
      return <PhoneOff className="w-4 h-4 text-amber-400" />;
    }
    return isOutgoing ? (
      <PhoneOutgoing className="w-4 h-4 text-emerald-400" />
    ) : (
      <PhoneIncoming className="w-4 h-4 text-teal-400" />
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-lg mx-4 bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-2xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <Phone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Call History</h3>
              <p className="text-xs text-neutral-400">Recent WebRTC audio calls</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto py-3 space-y-2 mt-2">
          {loading ? (
            <div className="py-12 text-center text-sm text-neutral-400">
              Loading call logs...
            </div>
          ) : logs.length === 0 ? (
            <div className="py-12 text-center text-sm text-neutral-400">
              No calls yet. Click the call button on any chat to start an audio call!
            </div>
          ) : (
            logs.map((log) => {
              const isOutgoing = (log.callerId as any)?._id === currentUserId || log.callerId?.id === currentUserId;
              const peer = isOutgoing ? log.receiverId : log.callerId;
              if (!peer) return null;

              return (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-3 rounded-2xl bg-neutral-900 hover:bg-neutral-800/80 border border-neutral-800/60 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Avatar name={peer.name} avatar={peer.avatar} size="md" />

                    <div>
                      <h4 className="text-sm font-medium text-neutral-100">{peer.name}</h4>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-neutral-400">
                        {getStatusIcon(log, isOutgoing)}
                        <span className="capitalize">{log.status}</span>
                        {log.duration > 0 && <span>• {formatDuration(log.duration)}</span>}
                        <span>
                          • {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      onClose();
                      onStartCall(peer);
                    }}
                    className="p-2.5 rounded-full bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white transition-colors"
                    title={`Call ${peer.name}`}
                  >
                    <Phone className="w-4 h-4" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
