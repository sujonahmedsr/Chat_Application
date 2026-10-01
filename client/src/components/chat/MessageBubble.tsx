'use client';

import React, { useState } from 'react';
import {
  Check,
  CheckCheck,
  Mic,
  PhoneCall,
  Video,
  PhoneMissed,
  Trash2,
  Reply,
  SmilePlus,
  ExternalLink,
  Copy,
  Pencil,
  X,
} from 'lucide-react';
import { Message } from '@/types';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

interface MessageBubbleProps {
  message: Message;
  isSelf: boolean;
  isGroup?: boolean;
  isGroupCreator?: boolean;
  theme?: string;
  onDeleteMessage?: (messageId: string) => void;
  onReplyMessage?: (message: Message) => void;
  onJumpToMessage?: (messageId: string) => void;
  onReactMessage?: (messageId: string, emoji: string) => void;
  onEditMessage?: (messageId: string, newContent: string) => void;
  isHighlighted?: boolean;
  canDelete?: boolean;
  currentUserId?: string;
}

const SUPER_ADMINS = [
  'shofiqul.sujon2201@gmail.com',
];

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isSelf,
  isGroup,
  isGroupCreator = false,
  theme = 'emerald',
  onDeleteMessage,
  onReplyMessage,
  onJumpToMessage,
  onReactMessage,
  onEditMessage,
  isHighlighted = false,
  canDelete = false,
  currentUserId,
}) => {
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content || '');
  const [isCopied, setIsCopied] = useState(false);

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
        return 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-br-sm border border-blue-500/30';
      case 'purple':
        return 'bg-gradient-to-r from-purple-600 to-violet-600 text-white rounded-br-sm border border-purple-500/30';
      case 'sunset':
        return 'bg-gradient-to-r from-orange-500 to-amber-600 text-white rounded-br-sm border border-orange-500/30';
      case 'ruby':
        return 'bg-gradient-to-r from-rose-600 to-red-600 text-white rounded-br-sm border border-rose-500/30';
      case 'slate':
        return 'bg-neutral-800 text-white rounded-br-sm border border-neutral-700';
      case 'emerald':
      default:
        return 'bg-emerald-700/90 text-white rounded-br-sm border border-emerald-600/30';
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
  const senderEmail = (message.sender?.email || (message as any).senderId?.email || '').toLowerCase();
  const isSenderAdmin = SUPER_ADMINS.includes(senderEmail) || (message.sender as any)?.role === 'admin';

  const actualMessageId = String(message.id || (message as any)._id || '');

  // Group reactions by emoji for display
  const currentUserIdStr = String(currentUserId || '');
  const groupedReactions = (message.reactions || []).reduce<Record<string, { count: number; users: string[]; hasMyReaction: boolean }>>((acc, r) => {
    if (!acc[r.emoji]) {
      acc[r.emoji] = { count: 0, users: [], hasMyReaction: false };
    }
    acc[r.emoji].count += 1;
    if (r.userName) acc[r.emoji].users.push(r.userName);
    const rUserIdStr = typeof r.userId === 'object' && r.userId !== null
      ? String((r.userId as any)._id || (r.userId as any).id || '')
      : String(r.userId || '');
    if (currentUserIdStr && rUserIdStr === currentUserIdStr) {
      acc[r.emoji].hasMyReaction = true;
    }
    return acc;
  }, {});

  const hasReactions = Object.keys(groupedReactions).length > 0;

  // SPECIAL CALL EVENT CARD (Audio/Video Call Log inside Chat)
  if (message.messageType === 'call') {
    const isVideo = message.content?.toLowerCase().includes('video');
    const isMissed = message.callStatus === 'missed' || message.callStatus === 'rejected';

    return (
      <div className="flex w-full justify-center my-2 select-none group relative">
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-neutral-900/80 border border-neutral-800/80 shadow-md backdrop-blur-sm max-w-sm">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
              isMissed
                ? 'bg-rose-500/20 text-rose-400'
                : 'bg-emerald-500/20 text-emerald-400'
            }`}
          >
            {isVideo ? (
              <Video className="w-4 h-4" />
            ) : isMissed ? (
              <PhoneMissed className="w-4 h-4" />
            ) : (
              <PhoneCall className="w-4 h-4" />
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

          {(isSelf || canDelete) && onDeleteMessage && (
            <button
              onClick={() => onDeleteMessage(actualMessageId)}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-neutral-500 hover:text-red-400 rounded"
              title="Delete log"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  }

  const renderHighlightedContent = (text: string) => {
    // Regex matching full URLs, www. domains, popular platforms (YouTube, Facebook, TikTok, etc.), and @mentions
    const LINK_OR_MENTION_REGEX =
      /(https?:\/\/[^\s]+|www\.[^\s]+|(?:(?:youtube\.com|youtu\.be|facebook\.com|fb\.watch|fb\.me|tiktok\.com|instagram\.com|twitter\.com|x\.com|github\.com)[^\s]*)|@[a-zA-Z0-9._]+)/gi;

    const parts = text.split(LINK_OR_MENTION_REGEX);

    return parts.map((part, index) => {
      if (!part) return null;

      // Handle @mentions
      if (part.startsWith('@') && part.length > 1) {
        return (
          <span
            key={index}
            className="inline-block font-semibold text-emerald-300 bg-emerald-500/20 px-1.5 py-0.5 rounded text-[13px] border border-emerald-500/30 mx-0.5"
          >
            {part}
          </span>
        );
      }

      // Check if this part is a link
      const isHttpUrl = /^https?:\/\//i.test(part);
      const isWwwUrl = /^www\./i.test(part);
      const isSocialDomain = /^(youtube\.com|youtu\.be|facebook\.com|fb\.watch|fb\.me|tiktok\.com|instagram\.com|twitter\.com|x\.com|github\.com)/i.test(part);

      if (isHttpUrl || isWwwUrl || isSocialDomain) {
        // Strip trailing punctuation like dot, comma, parenthesis from the link
        let cleanUrl = part;
        let trailingPunct = '';
        const matchPunct = cleanUrl.match(/[.,!?;:)]+$/);
        if (matchPunct) {
          trailingPunct = matchPunct[0];
          cleanUrl = cleanUrl.slice(0, -trailingPunct.length);
        }

        const href = isHttpUrl ? cleanUrl : `https://${cleanUrl}`;

        return (
          <React.Fragment key={index}>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className={`inline-flex items-center gap-1 underline underline-offset-2 break-all font-medium transition-colors ${
                isSelf
                  ? 'text-sky-200 hover:text-white'
                  : 'text-sky-400 hover:text-sky-300'
              }`}
            >
              <span>{cleanUrl}</span>
              <ExternalLink className="w-3 h-3 inline-block flex-shrink-0 opacity-80" />
            </a>
            {trailingPunct}
          </React.Fragment>
        );
      }

      return part;
    });
  };

  const canDeleteThisMessage = isGroup ? (isSelf || isGroupCreator) : isSelf;

  const handleReact = (emoji: string) => {
    onReactMessage?.(actualMessageId, emoji);
    setShowReactionPicker(false);
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!message.content) return;
    navigator.clipboard.writeText(message.content);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditContent(message.content || '');
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    const trimmed = editContent.trim();
    if (!trimmed) return;
    if (trimmed !== message.content) {
      onEditMessage?.(actualMessageId, trimmed);
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditContent(message.content || '');
    setIsEditing(false);
  };

  return (
    <div
      id={`message-${actualMessageId}`}
      className={`flex w-full ${isSelf ? 'justify-end' : 'justify-start'} my-1 group transition-all duration-300 rounded-2xl ${
        isHighlighted ? 'bg-emerald-500/20 ring-2 ring-emerald-400/80 p-1.5' : ''
      }`}
    >
      <div className="flex items-center gap-1.5 max-w-[88%] sm:max-w-[72%]">
        {/* Actions for self (React + Copy + Edit + Reply + Delete) */}
        {isSelf && (
          <div className="opacity-70 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-center gap-0.5 self-center flex-shrink-0">
            {/* Reaction button */}
            {onReactMessage && (
              <div className="relative">
                <button
                  onClick={() => setShowReactionPicker((p) => !p)}
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-amber-400 hover:bg-neutral-800/80 transition-colors"
                  title="React with Emoji"
                >
                  <SmilePlus className="w-3.5 h-3.5" />
                </button>
                {showReactionPicker && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowReactionPicker(false)}
                    />
                    <div className="absolute bottom-full right-0 mb-1 flex items-center gap-0.5 px-2 py-1.5 rounded-full bg-neutral-800 border border-neutral-700 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100">
                      {QUICK_REACTIONS.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => handleReact(emoji)}
                          className="text-base hover:scale-125 active:scale-95 transition-transform p-0.5 hover:bg-neutral-700/50 rounded"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Copy button */}
            {message.content && (
              <button
                onClick={handleCopy}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-sky-300 hover:bg-neutral-800/80 transition-colors"
                title={isCopied ? 'Copied to clipboard!' : 'Copy message'}
              >
                {isCopied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            )}

            {/* Edit button */}
            {message.content && onEditMessage && (
              <button
                onClick={handleStartEdit}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-emerald-300 hover:bg-neutral-800/80 transition-colors"
                title="Edit message"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}

            {onReplyMessage && (
              <button
                onClick={() => onReplyMessage(message)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-emerald-400 hover:bg-neutral-800/80 transition-colors"
                title="Reply to Message"
              >
                <Reply className="w-3.5 h-3.5" />
              </button>
            )}
            {canDeleteThisMessage && onDeleteMessage && (
              <button
                onClick={() => onDeleteMessage(message.id)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-400 hover:bg-neutral-800/80 transition-colors"
                title="Delete Message"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        <div className="flex flex-col">
          <div
            className={`relative px-3.5 py-2 rounded-2xl shadow-sm text-sm break-words transition-all w-full ${
              isSelf
                ? getThemeClass()
                : 'bg-neutral-800/90 text-neutral-100 rounded-bl-sm border border-neutral-800/50'
            }`}
          >
            {/* Group Sender Name */}
            {isGroup && !isSelf && senderName && (
              <div className="flex items-center gap-1.5 mb-1 select-none">
                <span className="text-[11px] font-semibold text-emerald-400">
                  {senderName}
                </span>
                {isSenderAdmin && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-500/25 text-amber-300 border border-amber-500/30">
                    Admin
                  </span>
                )}
              </div>
            )}

            {/* QUOTED REPLY BLOCK - Clickable to jump to original message */}
            {message.replyTo && message.replyTo.content && (
              <div
                onClick={() => {
                  if (message.replyTo?.id && onJumpToMessage) {
                    onJumpToMessage(message.replyTo.id);
                  }
                }}
                className="mb-2 px-2.5 py-1.5 rounded-xl bg-black/30 border-l-2 border-emerald-400 text-left select-none cursor-pointer hover:bg-black/50 active:scale-[0.99] transition-all group/reply"
                title="Click to jump to original message"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-emerald-400 block text-[11px] group-hover/reply:underline">
                    {message.replyTo.senderName || 'Replied Message'}
                  </span>
                  <span className="text-[9px] text-neutral-400 opacity-70 group-hover/reply:opacity-100">
                    Jump ↗
                  </span>
                </div>
                <p className="text-neutral-300 line-clamp-2 text-[11px]">
                  {message.replyTo.content}
                </p>
              </div>
            )}

            {/* AUDIO / VOICE NOTE ATTACHMENT */}
            {message.messageType === 'audio' && message.fileUrl && (
              <div className={`mb-1 flex items-center gap-2.5 px-3 py-2 rounded-2xl select-none w-full min-w-0 ${
                isSelf
                  ? 'bg-white/15 backdrop-blur-sm border border-white/10'
                  : 'bg-white/90 backdrop-blur-sm border border-neutral-200/60'
              }`}>
                <div className={`flex-shrink-0 p-2 rounded-full ${
                  isSelf
                    ? 'bg-white/20 text-white'
                    : 'bg-emerald-100 text-emerald-600'
                }`}>
                  <Mic className="w-4 h-4 " />
                </div>
                <audio
                  controls
                  controlsList="nodownload noplaybackrate"
                  onContextMenu={(e) => e.preventDefault()}
                  src={message.fileUrl}
                  className={`h-8 min-w-0 flex-1 max-w-full ${
                    isSelf ? 'custom-audio-player' : 'custom-audio-player-light'
                  }`}
                />
              </div>
            )}

            {/* TEXT CONTENT / INLINE EDITOR */}
            {isEditing ? (
              <div className="w-full min-w-[200px] sm:min-w-[260px] py-1">
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSaveEdit();
                    } else if (e.key === 'Escape') {
                      handleCancelEdit();
                    }
                  }}
                  rows={Math.min(5, Math.max(2, editContent.split('\n').length))}
                  className="w-full p-2.5 text-sm bg-black/40 border border-emerald-400/60 rounded-xl text-white placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 resize-none font-normal"
                  autoFocus
                />
                <div className="flex items-center justify-end gap-1.5 mt-1.5">
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="px-2.5 py-1 text-xs rounded-lg bg-black/30 hover:bg-black/50 text-neutral-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveEdit()}
                    disabled={!editContent.trim()}
                    className="px-2.5 py-1 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white transition-colors flex items-center gap-1 shadow-sm"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Save</span>
                  </button>
                </div>
              </div>
            ) : (
              message.content && (
                <p className="whitespace-pre-wrap leading-relaxed text-[14px]">
                  {renderHighlightedContent(message.content)}
                </p>
              )
            )}

            {/* TIMESTAMP & STATUS & EDITED TAG */}
            <div className="flex items-center justify-end gap-1 mt-1 select-none">
              {message.isEdited && (
                <span className="text-[10px] text-neutral-300/70 italic mr-0.5" title="Edited message">
                  (edited)
                </span>
              )}
              <span className="text-[10px] text-neutral-300/80 font-mono">
                {formatTime(message.timestamp)}
              </span>
              {renderStatusIcon()}
            </div>
          </div>

          {/* REACTIONS DISPLAY — Below the bubble */}
          {hasReactions && (
            <div className={`flex flex-wrap gap-1 mt-1 ${isSelf ? 'justify-end' : 'justify-start'}`}>
              {Object.entries(groupedReactions).map(([emoji, data]) => (
                <button
                  key={emoji}
                  onClick={() => onReactMessage?.(actualMessageId, emoji)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium transition-all hover:scale-105 active:scale-95 shadow-sm ${
                    data.hasMyReaction
                      ? 'bg-emerald-950/80 border-emerald-600/80 text-emerald-300 ring-1 ring-emerald-500/30'
                      : 'bg-neutral-800/90 border-neutral-700/80 text-neutral-300 hover:bg-neutral-700/80'
                  }`}
                  title={data.users.length ? data.users.join(', ') : emoji}
                >
                  <span className="text-sm leading-none">{emoji}</span>
                  {data.count > 1 && (
                    <span className="text-[11px] font-semibold">{data.count}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Actions for non-self (React + Copy + Reply, and Delete if group creator) */}
        {!isSelf && (
          <div className="opacity-70 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-center gap-0.5 self-center flex-shrink-0">
            {/* Reaction button */}
            {onReactMessage && (
              <div className="relative">
                <button
                  onClick={() => setShowReactionPicker((p) => !p)}
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-amber-400 hover:bg-neutral-800/80 transition-colors"
                  title="React with Emoji"
                >
                  <SmilePlus className="w-3.5 h-3.5" />
                </button>
                {showReactionPicker && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowReactionPicker(false)}
                    />
                    <div className="absolute bottom-full left-0 mb-1 flex items-center gap-0.5 px-2 py-1.5 rounded-full bg-neutral-800 border border-neutral-700 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100">
                      {QUICK_REACTIONS.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => handleReact(emoji)}
                          className="text-base hover:scale-125 active:scale-95 transition-transform p-0.5 hover:bg-neutral-700/50 rounded"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Copy button */}
            {message.content && (
              <button
                onClick={handleCopy}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-sky-300 hover:bg-neutral-800/80 transition-colors"
                title={isCopied ? 'Copied to clipboard!' : 'Copy message'}
              >
                {isCopied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            )}

            {onReplyMessage && (
              <button
                onClick={() => onReplyMessage(message)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-emerald-400 hover:bg-neutral-800/80 transition-colors"
                title="Reply to Message"
              >
                <Reply className="w-3.5 h-3.5" />
              </button>
            )}
            {canDeleteThisMessage && onDeleteMessage && (
              <button
                onClick={() => onDeleteMessage(actualMessageId)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-400 hover:bg-neutral-800/80 transition-colors"
                title="Delete Message (Group Creator)"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
