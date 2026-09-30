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
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { User, Group, Message } from '@/types';
import { apiRequest } from '@/lib/api';
import { Avatar } from '../ui/Avatar';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import { ChatAreaSkeleton } from '../ui/Skeleton';
import { ConfirmModal } from '../ui/ConfirmModal';

interface ChatAreaProps {
  selectedUser: User | null;
  selectedGroup: Group | null;
  currentUser: User | null;
  messages: Message[];
  isLoadingMessages?: boolean;
  isRecipientTyping: boolean;
  groupTypingUser?: string | null;
  onSendMessage: (content: string, attachment?: any) => void;
  onTypingStart: () => void;
  onTypingStop: () => void;
  onStartCall: (user: User, type: 'audio' | 'video') => void;
  onDeleteMessage?: (messageId: string) => void;
  onClearHistory?: () => void;
  onClearGroupMessages?: (groupId: string) => void;
  onDeleteGroup?: (groupId: string) => void;
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

const SUPER_ADMINS = [
  'shofiqul.sujon2201@gmail.com',
];

export const ChatArea: React.FC<ChatAreaProps> = ({
  selectedUser,
  selectedGroup,
  currentUser,
  messages,
  isLoadingMessages = false,
  isRecipientTyping,
  groupTypingUser,
  onSendMessage,
  onTypingStart,
  onTypingStop,
  onStartCall,
  onDeleteMessage,
  onClearHistory,
  onClearGroupMessages,
  onDeleteGroup,
  onBack,
  onFriendUpdated,
}) => {
  const [chatTheme, setChatTheme] = useState('emerald');
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [showContactMenu, setShowContactMenu] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmText?: string;
    isDanger?: boolean;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    description: '',
    confirmText: 'Delete',
    isDanger: true,
    onConfirm: () => {},
  });
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

  const handleUnfriend = () => {
    if (!selectedUser) return;
    setShowContactMenu(false);
    setConfirmDialog({
      isOpen: true,
      title: 'Remove Friend?',
      description: `Are you sure you want to unfriend ${selectedUser.name}? You will need to send a new friend request to chat again.`,
      confirmText: 'Unfriend',
      isDanger: true,
      onConfirm: async () => {
        try {
          setActionLoading(true);
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          await apiRequest(`/friends/unfriend/${selectedUser.id}`, { method: 'POST' });
          onFriendUpdated?.();
        } catch (err: unknown) {
          console.error(err instanceof Error ? err.message : 'Failed to unfriend user');
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  const handleBlock = () => {
    if (!selectedUser) return;
    setShowContactMenu(false);
    setConfirmDialog({
      isOpen: true,
      title: 'Block User?',
      description: `Block ${selectedUser.name}? You will no longer receive calls or messages from them.`,
      confirmText: 'Block User',
      isDanger: true,
      onConfirm: async () => {
        try {
          setActionLoading(true);
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          await apiRequest(`/friends/block/${selectedUser.id}`, { method: 'POST' });
          onFriendUpdated?.();
        } catch (err: unknown) {
          console.error(err instanceof Error ? err.message : 'Failed to block user');
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  const handleClearChatHistory = () => {
    if (!selectedUser) return;
    setShowContactMenu(false);
    setConfirmDialog({
      isOpen: true,
      title: 'Clear Chat History?',
      description: `Are you sure you want to clear the entire chat history with ${selectedUser.name}? All messages will be permanently removed for both sides.`,
      confirmText: 'Clear All',
      isDanger: true,
      onConfirm: async () => {
        try {
          setActionLoading(true);
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          await onClearHistory?.();
        } catch (err: unknown) {
          console.error(err instanceof Error ? err.message : 'Failed to clear chat history');
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  const handleClearGroup = () => {
    if (!selectedGroup) return;
    setShowContactMenu(false);
    setConfirmDialog({
      isOpen: true,
      title: 'Clear Group Messages?',
      description: `Are you sure you want to clear all messages in "${selectedGroup.name}"? This action cannot be undone.`,
      confirmText: 'Clear Messages',
      isDanger: true,
      onConfirm: async () => {
        try {
          setActionLoading(true);
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          await onClearGroupMessages?.(selectedGroup.id);
        } catch (err: unknown) {
          console.error(err instanceof Error ? err.message : 'Failed to clear group messages');
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  const handleDeleteGroupAction = () => {
    if (!selectedGroup) return;
    setShowContactMenu(false);
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Group Permanently?',
      description: `PERMANENT ACTION: Delete group "${selectedGroup.name}"? All members and chat history will be permanently deleted.`,
      confirmText: 'Delete Group',
      isDanger: true,
      onConfirm: async () => {
        try {
          setActionLoading(true);
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          await onDeleteGroup?.(selectedGroup.id);
        } catch (err: unknown) {
          console.error(err instanceof Error ? err.message : 'Failed to delete group');
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  const requestDeleteMessage = (messageId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Message?',
      description: 'Are you sure you want to delete this message? This message will be permanently removed.',
      confirmText: 'Delete Message',
      isDanger: true,
      onConfirm: () => {
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        onDeleteMessage?.(messageId);
      },
    });
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
          <span>Google Authenticated • Max 300 messages cap protection</span>
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

  const checkIsSelf = (msg: Message): boolean => {
    if (!currentUser) return false;
    const currentId = String(currentUser.id || (currentUser as any)._id || '');
    if (!currentId) return false;

    if (msg.senderId) {
      if (typeof msg.senderId === 'string' && String(msg.senderId) === currentId) {
        return true;
      }
      if (typeof msg.senderId === 'object') {
        const s = msg.senderId as any;
        const sId = String(s._id || s.id || '');
        if (sId && sId === currentId) return true;
      }
    }

    if (msg.sender) {
      const s = msg.sender as any;
      const sId = String(s._id || s.id || '');
      if (sId && sId === currentId) return true;
    }

    return false;
  };

  const isCurrentUserAdmin =
    SUPER_ADMINS.includes((currentUser?.email || '').toLowerCase()) ||
    currentUser?.role === 'admin';

  const isGroupAdmin = isGroup && selectedGroup && (
    isCurrentUserAdmin ||
    String(selectedGroup.creator) === String(currentUser?.id) ||
    (selectedGroup.admins || []).map(String).includes(String(currentUser?.id))
  );

  return (
    <main className="flex-1 flex flex-col h-full bg-neutral-950 overflow-hidden relative">
      {/* Chat Header */}
      <header className="px-4 py-3 bg-neutral-900/95 border-b border-neutral-800/80 backdrop-blur-md flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
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
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm text-white leading-tight">
                {isGroup ? selectedGroup.name : selectedUser!.name}
              </h3>
              <span
                className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-1.5 py-0.5 rounded-full font-medium"
                title="End-to-End Encrypted: Only chat participants can read messages"
              >
                <Lock className="w-2.5 h-2.5 text-emerald-400" />
                <span>E2EE</span>
              </span>
            </div>
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
            <Palette className="w-4 h-4" />
          </button>

          {/* Theme Picker Dropdown */}
          {showThemePicker && (
            <div className="absolute right-12 top-11 bg-neutral-900 border border-neutral-800 rounded-2xl p-2.5 shadow-2xl z-30 w-48 animate-in fade-in zoom-in-95 duration-150">
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

          {/* GROUP CALL ACTIONS: Group video call OFF, only group audio call! */}
          {isGroup && (
            <button
              onClick={() => {
                if (selectedGroup.members && selectedGroup.members.length > 0) {
                  const target = selectedGroup.members.find((m) => String(m.id) !== String(currentUser?.id));
                  if (target) {
                    onStartCall(target, 'audio');
                  } else {
                    console.warn('No other members to call in this group');
                  }
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white border border-emerald-500/30 transition-all text-xs font-medium active:scale-95 shadow-sm"
              title="Start Group Audio Call (Group Video Disabled)"
            >
              <Phone className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Audio Call</span>
            </button>
          )}

          {/* 1-to-1 CALL ACTIONS: Audio & Video calls */}
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
            </>
          )}

          {/* Options Dropdown (1-to-1: Clear Chat / Unfriend / Block | Group: Clear Group Messages / Delete Group) */}
          <div className="relative">
            <button
              onClick={() => setShowContactMenu((prev) => !prev)}
              className="p-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              title="Options"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showContactMenu && (
              <div className="absolute right-0 top-9 bg-neutral-900 border border-neutral-800 rounded-2xl p-1.5 shadow-2xl z-30 w-48 animate-in fade-in zoom-in-95 duration-150">
                {!isGroup && selectedUser && (
                  <>
                    <button
                      onClick={handleClearChatHistory}
                      disabled={actionLoading}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-neutral-200 hover:text-rose-400 hover:bg-neutral-800 transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-rose-400" />
                      <span>Clear Chat History</span>
                    </button>
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
                  </>
                )}

                {isGroup && selectedGroup && (
                  <>
                    {isGroupAdmin ? (
                      <>
                        <button
                          onClick={handleClearGroup}
                          disabled={actionLoading}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-neutral-200 hover:text-amber-400 hover:bg-neutral-800 transition-colors"
                        >
                          <Trash2 className="w-4 h-4 text-amber-400" />
                          <span>Clear Group Messages</span>
                        </button>
                        <button
                          onClick={handleDeleteGroupAction}
                          disabled={actionLoading}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-neutral-200 hover:text-rose-400 hover:bg-neutral-800 transition-colors"
                        >
                          <AlertTriangle className="w-4 h-4 text-rose-400" />
                          <span>Delete Group</span>
                        </button>
                      </>
                    ) : (
                      <div className="px-3 py-2 text-[11px] text-neutral-400">
                        Group admin controls only
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-4 py-3 custom-scrollbar">
        {/* End-to-End Encryption Privacy Banner */}
        <div className="flex items-center justify-center my-2">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-900/80 border border-neutral-800 text-[11px] text-neutral-400 select-none shadow-sm">
            <Lock className="w-3 h-3 text-emerald-400 flex-shrink-0" />
            <span>Messages are end-to-end encrypted. Nobody, not even database admins, can read them.</span>
          </div>
        </div>

        {isLoadingMessages ? (
          <ChatAreaSkeleton />
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-neutral-500">
            <p className="text-xs">No messages yet. Say hello! 👋</p>
          </div>
        ) : (
          messages.map((message) => {
            const isSelf = checkIsSelf(message);
            return (
              <MessageBubble
                key={message.id}
                message={message}
                isSelf={isSelf}
                isGroup={isGroup}
                theme={chatTheme}
                onDeleteMessage={onDeleteMessage ? requestDeleteMessage : undefined}
                canDelete={isCurrentUserAdmin || (isGroup && isGroupAdmin)}
              />
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input Footer */}
      <MessageInput
        onSendMessage={onSendMessage}
        onTypingStart={onTypingStart}
        onTypingStop={onTypingStop}
      />

      {/* Sleek Delete / Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmText={confirmDialog.confirmText}
        isDanger={confirmDialog.isDanger}
        isLoading={actionLoading}
        onConfirm={confirmDialog.onConfirm}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
      />
    </main>
  );
};
