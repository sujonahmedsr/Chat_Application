'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Phone,
  Video,
  ArrowLeft,
  ShieldCheck,
  Lock,
  Palette,
  MoreVertical,
  UserX,
  Ban,
  Check,
} from 'lucide-react';
import { User, Group, Message } from '@/types';
import { apiRequest } from '@/lib/api';
import { Avatar } from '../ui/Avatar';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';

interface ChatAreaProps {
  selectedUser: User | null;
  selectedGroup: Group | null;
  currentUser: User | null;
  messages: Message[];
  isRecipientTyping: boolean;
  groupTypingUser?: string | null;
  onSendMessage: (content: string, attachment?: any) => void;
  onTypingStart: () => void;
  onTypingStop: () => void;
  onStartCall: (user: User, type: 'audio' | 'video') => void;
  onBack?: () => void;
  onFriendUpdated?: () => void;
}

const CHAT_THEMES = [
  { id: 'emerald', name: 'WhatsApp Emerald', color: '#059669' },
  { id: 'messenger', name: 'Messenger Blue', color: '#2563eb' },
  { id: 'purple', name: 'Midnight Purple', color: '#7c3aed' },
  { id: 'sunset', name: 'Sunset Amber', color: '#d97706' },
  { id: 'ruby', name: 'Crimson Rose', color: '#e11d48' },
  { id: 'slate', name: 'Minimal Dark', color: '#475569' },
];

export const ChatArea: React.FC<ChatAreaProps> = ({
  selectedUser,
  selectedGroup,
  currentUser,
  messages,
  isRecipientTyping,
  groupTypingUser,
  onSendMessage,
  onTypingStart,
  onTypingStop,
  onStartCall,
  onBack,
  onFriendUpdated,
}) => {
  const [chatTheme, setChatTheme] = useState('emerald');
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [showContactMenu, setShowContactMenu] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load persisted theme
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('shofi_chat_theme');
      if (saved) setChatTheme(saved);
    }
  }, []);

  const handleSelectTheme = (themeId: string) => {
    setChatTheme(themeId);
    if (typeof window !== 'undefined') {
      localStorage.setItem('shofi_chat_theme', themeId);
    }
    setShowThemePicker(false);
  };

  const handleUnfriend = async () => {
    if (!selectedUser) return;
    if (!confirm(`Are you sure you want to unfriend ${selectedUser.name}?`)) return;

    try {
      setActionLoading(true);
      await apiRequest(`/friends/unfriend/${selectedUser.id}`, { method: 'POST' });
      setShowContactMenu(false);
      onFriendUpdated?.();
    } catch (err: any) {
      alert(err.message || 'Failed to unfriend user');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBlock = async () => {
    if (!selectedUser) return;
    if (!confirm(`Block ${selectedUser.name}? You will no longer receive calls or messages from them.`)) return;

    try {
      setActionLoading(true);
      await apiRequest(`/friends/block/${selectedUser.id}`, { method: 'POST' });
      setShowContactMenu(false);
      onFriendUpdated?.();
    } catch (err: any) {
      alert(err.message || 'Failed to block user');
    } finally {
      setActionLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isRecipientTyping, groupTypingUser]);

  if (!selectedUser && !selectedGroup) {
    return (
      <main className="flex-1 hidden md:flex flex-col items-center justify-center p-8 bg-neutral-950 text-center select-none">
        <div className="w-20 h-20 rounded-3xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-emerald-400 mb-6 shadow-xl">
          <ShieldCheck className="w-10 h-10 stroke-[1.5]" />
        </div>
        <h2 className="text-xl font-semibold text-white tracking-tight">
          Shofi Chat
        </h2>
        <p className="text-sm text-neutral-400 max-w-sm mt-2 leading-relaxed">
          Select a friend or group to start chatting, send voice notes & emojis, or initiate WebRTC audio/video calls.
        </p>
        <div className="flex items-center gap-1.5 text-xs text-neutral-500 mt-8">
          <Lock className="w-3.5 h-3.5" />
          <span>Peer-to-peer WebRTC audio/video & nested MongoDB message storage</span>
        </div>
      </main>
    );
  }

  const isGroup = !!selectedGroup;

  const formatLastSeen = (dateString?: string) => {
    if (!dateString) return 'Offline';
    try {
      const date = new Date(dateString);
      return `Last seen ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return 'Offline';
    }
  };

  return (
    <main className="flex-1 flex flex-col h-full bg-neutral-950 overflow-hidden relative">
      {/* Chat Header */}
      <header className="px-4 py-3 bg-neutral-900/95 border-b border-neutral-800/80 backdrop-blur-md flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          {/* Back button for mobile */}
          {onBack && (
            <button
              onClick={onBack}
              className="md:hidden p-1.5 -ml-1 text-neutral-400 hover:text-white rounded-lg"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          {isGroup ? (
            <Avatar name={selectedGroup.name} avatar={selectedGroup.avatar} size="md" />
          ) : (
            <Avatar
              name={selectedUser!.name}
              avatar={selectedUser!.avatar}
              size="md"
              isOnline={selectedUser!.isOnline}
              showStatus={true}
            />
          )}

          <div>
            <h3 className="font-semibold text-sm text-white leading-tight">
              {isGroup ? selectedGroup.name : selectedUser!.name}
            </h3>
            <p className="text-xs">
              {isGroup ? (
                groupTypingUser ? (
                  <span className="text-emerald-400 font-medium animate-pulse">
                    {groupTypingUser} is typing...
                  </span>
                ) : (
                  <span className="text-neutral-400">
                    {selectedGroup.members?.length || 0} members
                  </span>
                )
              ) : isRecipientTyping ? (
                <span className="text-emerald-400 font-medium animate-pulse">
                  typing...
                </span>
              ) : selectedUser!.isOnline ? (
                <span className="text-emerald-400 font-medium">Online</span>
              ) : (
                <span className="text-neutral-400">{formatLastSeen(selectedUser!.lastSeen)}</span>
              )}
            </p>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-2 relative">
          {/* Theme Color Customizer Button */}
          <button
            onClick={() => setShowThemePicker((prev) => !prev)}
            className="p-2 rounded-xl text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 transition-colors"
            title="Chat Color Theme"
          >
            <Palette className="w-4.5 h-4.5" />
          </button>

          {/* Theme Picker Dropdown */}
          {showThemePicker && (
            <div className="absolute right-12 top-11 bg-neutral-900 border border-neutral-750 rounded-2xl p-2.5 shadow-2xl z-30 w-48 animate-in fade-in zoom-in-95 duration-150">
              <span className="text-[11px] font-semibold text-neutral-400 block px-2 mb-1.5">
                Chat Theme Color
              </span>
              <div className="space-y-1">
                {CHAT_THEMES.map((theme) => (
                  <button
                    key={theme.id}
                    onClick={() => handleSelectTheme(theme.id)}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl hover:bg-neutral-800 text-xs text-neutral-200 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3.5 h-3.5 rounded-full"
                        style={{ backgroundColor: theme.color }}
                      />
                      <span>{theme.name}</span>
                    </div>
                    {chatTheme === theme.id && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 1-to-1 Calling Actions */}
          {!isGroup && selectedUser && (
            <>
              {/* Audio Call */}
              <button
                onClick={() => onStartCall(selectedUser, 'audio')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white border border-emerald-500/30 transition-all text-xs font-medium active:scale-95 shadow-sm"
                title="Start Audio Call"
              >
                <Phone className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Audio</span>
              </button>

              {/* Video Call */}
              <button
                onClick={() => onStartCall(selectedUser, 'video')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-teal-600/20 text-teal-400 hover:bg-teal-600 hover:text-white border border-teal-500/30 transition-all text-xs font-medium active:scale-95 shadow-sm"
                title="Start Video Call"
              >
                <Video className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Video</span>
              </button>

              {/* Contact Options: Unfriend / Block */}
              <div className="relative">
                <button
                  onClick={() => setShowContactMenu((prev) => !prev)}
                  className="p-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
                  title="Contact options"
                >
                  <MoreVertical className="w-4.5 h-4.5" />
                </button>

                {showContactMenu && (
                  <div className="absolute right-0 top-9 bg-neutral-900 border border-neutral-750 rounded-2xl p-1.5 shadow-2xl z-30 w-44 animate-in fade-in zoom-in-95 duration-150">
                    <button
                      onClick={handleUnfriend}
                      disabled={actionLoading}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-neutral-200 hover:text-amber-400 hover:bg-neutral-800 transition-colors"
                    >
                      <UserX className="w-4 h-4 text-amber-400" />
                      <span>Unfriend</span>
                    </button>
                    <button
                      onClick={handleBlock}
                      disabled={actionLoading}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-neutral-200 hover:text-red-400 hover:bg-neutral-800 transition-colors"
                    >
                      <Ban className="w-4 h-4 text-red-400" />
                      <span>Block User</span>
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </header>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 relative bg-[radial-gradient(#1f2937_1px,transparent_1px)] [background-size:16px_16px] bg-neutral-950">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <p className="text-xs text-neutral-400">
              {isGroup
                ? `Welcome to ${selectedGroup.name}! Say hi to the team! 👋`
                : `No messages here yet. Say hello to ${selectedUser?.name}! 👋`}
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isSelf={msg.senderId === currentUser?.id}
              isGroup={isGroup}
              theme={chatTheme}
            />
          ))
        )}

        {/* Typing indicator bubble */}
        {(isRecipientTyping || groupTypingUser) && (
          <div className="flex justify-start my-1">
            <div className="bg-neutral-850 border border-neutral-750 rounded-2xl px-3 py-2 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Message Input Bar */}
      <MessageInput
        onSendMessage={onSendMessage}
        onTypingStart={onTypingStart}
        onTypingStop={onTypingStop}
      />
    </main>
  );
};
