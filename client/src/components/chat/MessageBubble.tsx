'use client';

import React from 'react';
import { Check, CheckCheck, FileText, Download, Play, Mic } from 'lucide-react';
import { Message } from '@/types';

interface MessageBubbleProps {
  message: Message;
  isSelf: boolean;
  isGroup?: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isSelf, isGroup }) => {
  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const renderStatusIcon = () => {
    if (!isSelf) return null;

    if (message.status === 'read') {
      return (
        <span title="Read">
          <CheckCheck className="w-3.5 h-3.5 text-sky-400 stroke-[2.5]" />
        </span>
      );
    }

    if (message.status === 'delivered') {
      return (
        <span title="Delivered">
          <CheckCheck className="w-3.5 h-3.5 text-neutral-400 stroke-[2]" />
        </span>
      );
    }

    return (
      <span title="Sent">
        <Check className="w-3 h-3 text-neutral-400 stroke-[2]" />
      </span>
    );
  };

  const senderName = message.sender?.name || (message as any).senderId?.name;

  return (
    <div className={`flex w-full ${isSelf ? 'justify-end' : 'justify-start'} my-1`}>
      <div
        className={`relative max-w-[82%] sm:max-w-[70%] px-3.5 py-2 rounded-2xl shadow-sm text-sm break-words transition-all ${
          isSelf
            ? 'bg-emerald-700/80 text-white rounded-br-xs border border-emerald-600/30'
            : 'bg-neutral-800/90 text-neutral-100 rounded-bl-xs border border-neutral-700/40'
        }`}
      >
        {/* Group Sender Name */}
        {isGroup && !isSelf && senderName && (
          <p className="text-[11px] font-semibold text-emerald-400 mb-1 select-none">
            {senderName}
          </p>
        )}

        {/* IMAGE ATTACHMENT */}
        {message.messageType === 'image' && message.fileUrl && (
          <div className="mb-1.5 rounded-xl overflow-hidden max-w-sm">
            <img
              src={message.fileUrl}
              alt={message.fileName || 'Shared image'}
              className="max-h-64 w-auto rounded-xl object-contain bg-black/20 hover:opacity-95 transition-opacity cursor-pointer"
              onClick={() => window.open(message.fileUrl, '_blank')}
            />
          </div>
        )}

        {/* AUDIO / VOICE NOTE ATTACHMENT */}
        {message.messageType === 'audio' && message.fileUrl && (
          <div className="mb-1.5 flex items-center gap-2 bg-black/20 p-2 rounded-xl border border-white/5">
            <div className="p-1.5 rounded-full bg-emerald-500/20 text-emerald-300">
              <Mic className="w-4 h-4" />
            </div>
            <audio controls src={message.fileUrl} className="h-8 max-w-[210px] sm:max-w-[260px]" />
          </div>
        )}

        {/* FILE / DOCUMENT ATTACHMENT */}
        {message.messageType === 'file' && message.fileUrl && (
          <a
            href={message.fileUrl}
            download={message.fileName || 'download'}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-1.5 flex items-center gap-3 p-2.5 rounded-xl bg-black/20 hover:bg-black/30 border border-white/10 transition-colors group"
          >
            <div className="p-2 rounded-lg bg-emerald-600 text-white flex-shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0 pr-2">
              <p className="text-xs font-medium text-white truncate">
                {message.fileName || 'Attachment'}
              </p>
              {message.fileSize ? (
                <p className="text-[10px] text-neutral-300">{formatFileSize(message.fileSize)}</p>
              ) : null}
            </div>
            <Download className="w-4 h-4 text-neutral-300 group-hover:text-white flex-shrink-0" />
          </a>
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
