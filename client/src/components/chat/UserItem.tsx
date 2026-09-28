'use client';

import React from 'react';
import { User } from '@/types';
import { Avatar } from '../ui/Avatar';

interface UserItemProps {
  user: User;
  isSelected: boolean;
  onSelect: (user: User) => void;
  currentUserId?: string;
}

export const UserItem: React.FC<UserItemProps> = ({
  user,
  isSelected,
  onSelect,
  currentUserId,
}) => {
  const formatLastSeen = (dateString?: string) => {
    if (!dateString) return 'offline';
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);

      if (diffMins < 1) return 'just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return 'offline';
    }
  };

  const getLastMessageText = () => {
    if (!user.lastMessage) {
      return user.isOnline ? 'Online' : `Last seen ${formatLastSeen(user.lastSeen)}`;
    }

    const isSelf = user.lastMessage.senderId === currentUserId;
    const prefix = isSelf ? 'You: ' : '';
    return `${prefix}${user.lastMessage.content}`;
  };

  return (
    <div
      onClick={() => onSelect(user)}
      className={`flex items-center gap-3 px-3 py-3 rounded-2xl cursor-pointer transition-all select-none ${
        isSelected
          ? 'bg-emerald-950/40 border border-emerald-800/40 text-white'
          : 'hover:bg-neutral-800/60 text-neutral-300'
      }`}
    >
      {/* Avatar with live status indicator */}
      <Avatar
        name={user.name}
        avatar={user.avatar}
        size="md"
        isOnline={user.isOnline}
        showStatus={true}
      />

      {/* User info & message preview */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 truncate">
            <span className="font-medium text-sm text-neutral-100 truncate">
              {user.name}
            </span>
            {(user.email === 'shofi@gmail.com' || (user as any).role === 'admin') && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex-shrink-0">
                Admin
              </span>
            )}
          </div>

          {user.lastMessage?.timestamp && (
            <span className="text-[11px] text-neutral-400 font-mono flex-shrink-0">
              {new Date(user.lastMessage.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between mt-0.5">
          <p className="text-xs text-neutral-400 truncate pr-2">
            {getLastMessageText()}
          </p>

          {/* Unread badge */}
          {user.unreadCount && user.unreadCount > 0 ? (
            <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-emerald-500 text-neutral-950 font-bold text-[11px] flex-shrink-0 shadow-sm animate-pulse">
              {user.unreadCount}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
};
