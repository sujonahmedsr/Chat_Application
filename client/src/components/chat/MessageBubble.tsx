'use client';

import React from 'react';
import { Check, CheckCheck, Mic, PhoneCall, Video, PhoneMissed, PhoneOff } from 'lucide-react';
import { Message } from '@/types';

interface MessageBubbleProps {
  message: Message;
  isSelf: boolean;
  isGroup?: boolean;
  theme?: string;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isSelf,
  isGroup,
  theme = 'emerald',
}) => {
  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const formatDuration = (totalSeconds?: number) => {
    if (!totalSeconds) return '';
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  // Self bubble theme mapping
  const getThemeClass = () => {
    switch (theme) {
      case 'messenger':
        return 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-br-xs border border-blue-500/30';
      case 'purple':
        return 'bg-gradient-to-r from-purple-600 to-violet-600 text-white rounded-br-xs border border-purple-500/30';
      case 'sunset':
        return 'bg-gradient-to-r from-orange-500 to-amber-600 text-white rounded-br-xs border border-orange-500/30';
      case 'ruby':
        return 'bg-gradient-to-r from-rose-600 to-red-600 text-white rounded-br-xs border border-rose-500/30';
      case 'slate':
        return 'bg-neutral-800 text-white rounded-br-xs border border-neutral-700';
      case 'emerald':
      default:
        return 'bg-emerald-700/90 text-white rounded-br-xs border border-emerald-600/30';
    }
  };

  const renderStatusIcon = () => {
    if (!isSelf) return null;

    if (message.status === 'read') {
      return (
        <span title="Read">
          <CheckCheck className="w-3.5 h-3.5 text-sky-300 stroke-[2.5]" />
        </span>
      );
    }

    if (message.status === 'delivered') {
      return (
        <span title="Delivered">
          <CheckCheck className="w-3.5 h-3.5 text-neutral-300 stroke-[2]" />
        </span>
      );
    }

    return (
      <span title="Sent">
        <Check className="w-3 h-3 text-neutral-300 stroke-[2]" />
      </span>
    );
  };

  const senderName = message.sender?.name || (message as any).senderId?.name;

  // SPECIAL CALL EVENT CARD (Audio/Video Call Log inside Chat)
  if (message.messageType === 'call') {
    const isVideo = message.content?.toLowerCase().includes('video');
    const isMissed = message.callStatus === 'missed' || message.callStatus === 'rejected';

    return (
      <div className="flex w-full justify-center my-2 select-none">
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-neutral-850/80 border border-neutral-750/80 shadow-md backdrop-blur-sm max-w-sm">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
              isMissed
                ? 'bg-rose-500/20 text-rose-400'
                : 'bg-emerald-500/20 text-emerald-400'
            }`}
          >
            {isVideo ? (
              <Video className="w-4.5 h-4.5" />
            ) : isMissed ? (
              <PhoneMissed className="w-4.5 h-4.5" />
            ) : (
              <PhoneCall className="w-4.5 h-4.5" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-neutral-200">
              {isVideo ? 'Video Call' : 'Voice Call'}
            </p>
            <p className="text-[11px] text-neutral-400">
              {isMissed ? (
                <span className="text-rose-400 font-medium">
                  {message.callStatus === 'rejected' ? 'Call declined' : 'Missed call'}
                </span>
              ) : (
                <span>
                  {message.callDuration
                    ? `Duration: ${formatDuration(message.callDuration)}`
                    : 'Call ended'}
                </span>
              )}
            </p>
          </div>

          <span className="text-[10px] text-neutral-400 font-mono self-end">
            {formatTime(message.timestamp)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex w-full ${isSelf ? 'justify-end' : 'justify-start'} my-1`}>
      <div
        className={`relative max-w-[85%] sm:max-w-[70%] px-3.5 py-2 rounded-2xl shadow-sm text-sm break-words transition-all ${
          isSelf
            ? getThemeClass()
            : 'bg-neutral-800/90 text-neutral-100 rounded-bl-xs border border-neutral-750/50'
        }`}
      >
        {/* Group Sender Name */}
        {isGroup && !isSelf && senderName && (
          <p className="text-[11px] font-semibold text-emerald-400 mb-1 select-none">
            {senderName}
          </p>
        )}

        {/* AUDIO / VOICE NOTE ATTACHMENT (NO DOWNLOAD ALLOWED) */}
        {message.messageType === 'audio' && message.fileUrl && (
          <div className="mb-1 flex items-center gap-2 bg-black/25 p-2 rounded-xl border border-white/5 select-none">
            <div className="p-2 rounded-full bg-emerald-500/20 text-emerald-300">
              <Mic className="w-4 h-4" />
            </div>
            <audio
              controls
              controlsList="nodownload noplaybackrate"
              onContextMenu={(e) => e.preventDefault()}
              src={message.fileUrl}
              className="h-8 max-w-[210px] sm:max-w-[260px] custom-audio-player"
            />
          </div>
        )}

        {/* TEXT CONTENT */}
        {message.content && (
          <p className="whitespace-pre-wrap leading-relaxed text-[14px]">
            {message.content}
          </p>
        )}

        {/* TIMESTAMP & STATUS */}
        <div className="flex items-center justify-end gap-1 mt-1 select-none">
          <span className="text-[10px] text-neutral-300/80 font-mono">
            {formatTime(message.timestamp)}
          </span>
          {renderStatusIcon()}
        </div>
      </div>
    </div>
  );
};
