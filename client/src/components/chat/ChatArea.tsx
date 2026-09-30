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
  Users,
  UserPlus,
  UserMinus,
  X,
  Reply,
  Crown,
  LogOut,
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
  availableFriends?: User[];
  isLoadingMessages?: boolean;
  isRecipientTyping: boolean;
  groupTypingUser?: string | null;
  onSendMessage: (content: string, attachment?: any, replyTo?: any) => void;
  onTypingStart: () => void;
  onTypingStop: () => void;
  onStartCall: (user: User, type: 'audio' | 'video') => void;
  onStartGroupCall?: (groupId: string, groupName: string, targetMemberIds: string[]) => void;
  onDeleteMessage?: (messageId: string) => void;
  onClearHistory?: () => void;
  onClearGroupMessages?: (groupId: string) => void;
  onDeleteGroup?: (groupId: string) => void;
  onGroupUpdated?: (updatedGroup: Group) => void;
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
  availableFriends = [],
  isLoadingMessages = false,
  isRecipientTyping,
  groupTypingUser,
  onSendMessage,
  onTypingStart,
  onTypingStop,
  onStartCall,
  onStartGroupCall,
  onDeleteMessage,
  onClearHistory,
  onClearGroupMessages,
  onDeleteGroup,
  onGroupUpdated,
  onBack,
  onFriendUpdated,
}) => {
  const [chatTheme, setChatTheme] = useState('emerald');
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [showContactMenu, setShowContactMenu] = useState(false);
  const [showGroupCallModal, setShowGroupCallModal] = useState(false);
  const [selectedGroupCallMembers, setSelectedGroupCallMembers] = useState<string[]>([]);
  const [showManageMembersModal, setShowManageMembersModal] = useState(false);
  const [replyingMessage, setReplyingMessage] = useState<Message | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const handleJumpToMessage = (targetMsgId: string) => {
    if (!targetMsgId) return;
    const targetElement = document.getElementById(`message-${targetMsgId}`);
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMessageId(targetMsgId);
      setTimeout(() => {
        setHighlightedMessageId(null);
      }, 2000);
    }
  };
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

  const isBlockedByMe = Boolean(
    selectedUser &&
      (selectedUser.isBlockedByMe ||
        currentUser?.blockedUsers?.map(String).includes(String(selectedUser.id)))
  );
  const hasBlockedMe = Boolean(selectedUser && selectedUser.hasBlockedMe);
  const isBlocked = isBlockedByMe || hasBlockedMe;

  const handleUnblockDirect = async () => {
    if (!selectedUser) return;
    try {
      setActionLoading(true);
      setShowContactMenu(false);
      await apiRequest(`/friends/unblock/${selectedUser.id}`, { method: 'POST' });
      onFriendUpdated?.();
    } catch (err: unknown) {
      console.error(err instanceof Error ? err.message : 'Failed to unblock user');
    } finally {
      setActionLoading(false);
    }
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

  const currentUserId = String(currentUser?.id || (currentUser as any)?._id || '');

  const extractId = (val: any): string => {
    if (!val) return '';
    if (typeof val === 'string') return val;
    return String(val.id || val._id || '');
  };

  const groupCreatorId = isGroup && selectedGroup ? extractId(selectedGroup.creator) : '';

  const groupAdminIds = isGroup && selectedGroup
    ? new Set(
        [
          groupCreatorId,
          ...((selectedGroup.admins || []).map((a: any) => extractId(a))),
        ].filter(Boolean)
      )
    : new Set<string>();

  const isGroupCreator = isGroup && Boolean(groupCreatorId && groupCreatorId === currentUserId);

  const isGroupAdmin = isGroup && Boolean(
    isCurrentUserAdmin || isGroupCreator || groupAdminIds.has(currentUserId)
  );

  const handleAddMemberToGroup = async (friendId: string) => {
    if (!selectedGroup) return;
    try {
      setActionLoading(true);
      const data = await apiRequest(`/groups/${selectedGroup.id}/members`, {
        method: 'POST',
        body: JSON.stringify({ memberIds: [friendId] }),
      });
      if (data.group) {
        onGroupUpdated?.(data.group);
      }
    } catch (err: unknown) {
      console.error(err instanceof Error ? err.message : 'Failed to add member to group');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveMemberFromGroup = async (memberId: string) => {
    if (!selectedGroup) return;
    try {
      setActionLoading(true);
      const data = await apiRequest(`/groups/${selectedGroup.id}/members/${memberId}`, {
        method: 'DELETE',
      });
      if (data.group) {
        onGroupUpdated?.(data.group);
      }
    } catch (err: unknown) {
      console.error(err instanceof Error ? err.message : 'Failed to remove member from group');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeaveGroupAction = () => {
    if (!selectedGroup || !currentUserId) return;
    setShowContactMenu(false);
    setConfirmDialog({
      isOpen: true,
      title: 'Leave Group?',
      description: `Are you sure you want to leave "${selectedGroup.name}"? You will not receive any further messages from this group.`,
      confirmText: 'Leave Group',
      isDanger: true,
      onConfirm: async () => {
        try {
          setActionLoading(true);
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          await apiRequest(`/groups/${selectedGroup.id}/members/${currentUserId}`, {
            method: 'DELETE',
          });
          onGroupUpdated?.({
            ...selectedGroup,
            members: (selectedGroup.members || []).filter((m) => extractId(m) !== currentUserId),
          });
          onBack?.();
        } catch (err: unknown) {
          console.error(err instanceof Error ? err.message : 'Failed to leave group');
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  return (
    <main className="flex-1 flex flex-col h-full bg-neutral-950 overflow-hidden relative">
      {/* Chat Header */}
      <header className="px-3 sm:px-4 py-2.5 sm:py-3 bg-neutral-900/95 border-b border-neutral-800/80 backdrop-blur-md flex items-center justify-between z-20 gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          {onBack && (
            <button
              onClick={onBack}
              className="md:hidden p-1.5 -ml-1 text-neutral-400 hover:text-white rounded-lg flex-shrink-0"
              title="Back to Chats"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          <div className="flex-shrink-0">
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
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="font-semibold text-sm text-white leading-tight truncate max-w-[120px] xs:max-w-[160px] sm:max-w-[240px] md:max-w-none">
                {isGroup ? selectedGroup.name : selectedUser!.name}
              </h3>
              <span
                className="hidden sm:inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-1.5 py-0.5 rounded-full font-medium flex-shrink-0"
                title="End-to-End Encrypted: Only chat participants can read messages"
              >
                <Lock className="w-2.5 h-2.5 text-emerald-400" />
                <span>E2EE</span>
              </span>
            </div>
            <p className="text-xs truncate">
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
        <div className="flex items-center gap-1 sm:gap-2 relative flex-shrink-0">
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

          {/* GROUP CALL ACTIONS: Opens member selector modal */}
          {isGroup && (
            <button
              onClick={() => {
                const otherMemberIds = (selectedGroup.members || [])
                  .map((m) => String(m.id || (m as any)._id))
                  .filter((id) => id !== currentUserId);
                setSelectedGroupCallMembers(otherMemberIds);
                setShowGroupCallModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white border border-emerald-500/30 transition-all text-xs font-medium active:scale-95 shadow-sm"
              title="Start Group Audio Call"
            >
              <Phone className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Audio Call</span>
            </button>
          )}

          {/* 1-to-1 CALL ACTIONS: Audio & Video calls (hidden if blocked) */}
          {!isGroup && selectedUser && !isBlocked && (
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

          {/* Options Dropdown */}
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
                    {isBlockedByMe ? (
                      <button
                        onClick={handleUnblockDirect}
                        disabled={actionLoading}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-neutral-200 hover:text-emerald-400 hover:bg-neutral-800 transition-colors"
                      >
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span>Unblock User</span>
                      </button>
                    ) : (
                      <button
                        onClick={handleBlock}
                        disabled={actionLoading}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-neutral-200 hover:text-red-400 hover:bg-neutral-800 transition-colors"
                      >
                        <Ban className="w-4 h-4 text-red-400" />
                        <span>Block User</span>
                      </button>
                    )}
                  </>
                )}

                {isGroup && selectedGroup && (
                  <>
                    {/* Admin Actions: Manage Members, Clear Messages, Delete Group */}
                    {isGroupAdmin ? (
                      <>
                        <button
                          onClick={() => {
                            setShowContactMenu(false);
                            setShowManageMembersModal(true);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-neutral-200 hover:text-emerald-400 hover:bg-neutral-800 transition-colors"
                        >
                          <Users className="w-4 h-4 text-emerald-400" />
                          <span>Manage Members</span>
                        </button>

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
                      /* Regular Member Action: Leave Group */
                      <button
                        onClick={handleLeaveGroupAction}
                        disabled={actionLoading}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-neutral-200 hover:text-rose-400 hover:bg-neutral-800 transition-colors"
                      >
                        <LogOut className="w-4 h-4 text-rose-400" />
                        <span>Leave Group</span>
                      </button>
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
                isGroupCreator={Boolean(isGroupCreator)}
                theme={chatTheme}
                onDeleteMessage={onDeleteMessage ? requestDeleteMessage : undefined}
                onReplyMessage={(msg) => setReplyingMessage(msg)}
                onJumpToMessage={handleJumpToMessage}
                isHighlighted={highlightedMessageId === message.id}
              />
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Replying Banner */}
      {replyingMessage && (
        <div className="px-4 py-2 bg-neutral-900/95 border-t border-neutral-800 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="flex items-center gap-2 border-l-2 border-emerald-400 pl-2.5 min-w-0">
            <Reply className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <div className="min-w-0">
              <span className="text-[11px] font-semibold text-emerald-400 block">
                Replying to {replyingMessage.senderName || (checkIsSelf(replyingMessage) ? 'yourself' : 'message')}
              </span>
              <p className="text-xs text-neutral-300 truncate">
                {replyingMessage.content || (replyingMessage.messageType === 'audio' ? '🎤 Voice note' : 'Attachment')}
              </p>
            </div>
          </div>
          <button
            onClick={() => setReplyingMessage(null)}
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors flex-shrink-0"
            title="Cancel reply"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Message Input Footer or Blocked Notice */}
      {isBlockedByMe ? (
        <div className="p-4 bg-neutral-900 border-t border-neutral-800 text-center flex flex-col sm:flex-row items-center justify-center gap-3">
          <span className="text-xs text-neutral-400">
            🚫 You have blocked {selectedUser?.name}. Unblock to send messages or calls.
          </span>
          <button
            onClick={handleUnblockDirect}
            disabled={actionLoading}
            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
          >
            Unblock
          </button>
        </div>
      ) : hasBlockedMe ? (
        <div className="p-4 bg-neutral-900 border-t border-neutral-800 text-center">
          <span className="text-xs text-neutral-400">
            You cannot send messages to this user.
          </span>
        </div>
      ) : (
        <MessageInput
          onSendMessage={(content, attachment) => {
            const replyPayload = replyingMessage ? {
              id: replyingMessage.id,
              content: replyingMessage.content || (replyingMessage.messageType === 'audio' ? '🎤 Voice note' : 'Attachment'),
              senderName: replyingMessage.senderName || (checkIsSelf(replyingMessage) ? 'You' : 'Member'),
            } : undefined;
            onSendMessage(content, attachment, replyPayload);
            setReplyingMessage(null);
          }}
          onTypingStart={onTypingStart}
          onTypingStop={onTypingStop}
          groupMembers={isGroup ? selectedGroup?.members : undefined}
        />
      )}

      {/* Group Audio Call Selector Modal */}
      {showGroupCallModal && selectedGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-neutral-800 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm text-white">Start Group Audio Call</h3>
                <p className="text-xs text-neutral-400">Select members to ring in {selectedGroup.name}</p>
              </div>
              <button
                onClick={() => setShowGroupCallModal(false)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              {/* Select All Toggle */}
              {(() => {
                const otherMembers = (selectedGroup.members || []).filter(
                  (m) => String(m.id || (m as any)._id) !== currentUserId
                );
                const allSelected =
                  otherMembers.length > 0 &&
                  selectedGroupCallMembers.length === otherMembers.length;

                return (
                  <div className="flex items-center justify-between px-2 py-1 text-xs text-neutral-400 border-b border-neutral-800 pb-2">
                    <span>
                      {selectedGroupCallMembers.length} of {otherMembers.length} selected
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (allSelected) {
                          setSelectedGroupCallMembers([]);
                        } else {
                          setSelectedGroupCallMembers(
                            otherMembers.map((m) => String(m.id || (m as any)._id))
                          );
                        }
                      }}
                      className="text-emerald-400 hover:underline font-medium text-xs"
                    >
                      {allSelected ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                );
              })()}

              <div className="max-h-60 overflow-y-auto space-y-1.5 custom-scrollbar">
                {selectedGroup.members
                  ?.filter((m) => String(m.id || (m as any)._id) !== currentUserId)
                  .map((member) => {
                    const mId = String(member.id || (member as any)._id);
                    const isSelected = selectedGroupCallMembers.includes(mId);

                    return (
                      <div
                        key={mId}
                        onClick={() => {
                          setSelectedGroupCallMembers((prev) =>
                            prev.includes(mId)
                              ? prev.filter((id) => id !== mId)
                              : [...prev, mId]
                          );
                        }}
                        className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-emerald-950/50 border border-emerald-800/60'
                            : 'bg-neutral-800/40 hover:bg-neutral-800'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Avatar
                            name={member.name}
                            avatar={member.avatar}
                            size="sm"
                            isOnline={member.isOnline}
                            showStatus={true}
                          />
                          <div>
                            <p className="text-xs font-medium text-white">{member.name}</p>
                            <p className="text-[10px] text-neutral-400">
                              {member.isOnline ? 'Online' : 'Offline'}
                            </p>
                          </div>
                        </div>

                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="w-4 h-4 rounded border-neutral-700 text-emerald-600 focus:ring-emerald-500"
                        />
                      </div>
                    );
                  })}
              </div>

              {/* Start Call Button */}
              <button
                onClick={() => {
                  setShowGroupCallModal(false);
                  onStartGroupCall?.(
                    selectedGroup.id,
                    selectedGroup.name,
                    selectedGroupCallMembers
                  );
                }}
                disabled={selectedGroupCallMembers.length === 0}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/40"
              >
                <Phone className="w-4 h-4" />
                <span>
                  Start Group Call ({selectedGroupCallMembers.length}{' '}
                  {selectedGroupCallMembers.length === 1 ? 'member' : 'members'})
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Group Member Management Modal */}
      {showManageMembersModal && selectedGroup && isGroupAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-neutral-800 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm text-white">Manage Group Members</h3>
                <p className="text-xs text-neutral-400">{selectedGroup.name}</p>
              </div>
              <button
                onClick={() => setShowManageMembersModal(false)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4 max-h-96 overflow-y-auto custom-scrollbar">
              {/* Current Members */}
              <div>
                <h4 className="text-xs font-semibold text-neutral-300 mb-2">
                  Current Members ({selectedGroup.members?.length || 0})
                </h4>
                <div className="space-y-1.5">
                  {selectedGroup.members?.map((member) => {
                    const memberId = extractId(member);
                    const isMemberCreator = memberId === groupCreatorId;
                    const isMemberAdmin = isMemberCreator || groupAdminIds.has(memberId);
                    const canRemove =
                      isGroupAdmin &&
                      !isMemberCreator &&
                      memberId !== currentUserId;

                    return (
                      <div
                        key={memberId}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-800/40 border border-neutral-800/60"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <Avatar name={member.name} avatar={member.avatar} size="sm" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-xs font-semibold text-white truncate max-w-[150px]">{member.name}</p>
                              {isMemberCreator ? (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                                  <Crown className="w-2.5 h-2.5 text-amber-400" />
                                  <span>Admin</span>
                                </span>
                              ) : isMemberAdmin ? (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                                  <ShieldCheck className="w-2.5 h-2.5 text-emerald-400" />
                                  <span>Admin</span>
                                </span>
                              ) : null}
                            </div>
                            <span className="text-[10px] text-neutral-400">
                              {isMemberCreator ? 'Group Creator & Admin' : isMemberAdmin ? 'Group Admin' : 'Member'}
                            </span>
                          </div>
                        </div>

                        {canRemove && (
                          <button
                            onClick={() => handleRemoveMemberFromGroup(memberId)}
                            disabled={actionLoading}
                            className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-400 hover:bg-neutral-800 transition-colors flex-shrink-0"
                            title="Remove member"
                          >
                            <UserMinus className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Add Friends to Group */}
              <div>
                <h4 className="text-xs font-semibold text-neutral-300 mb-2">
                  Add Friends to Group
                </h4>
                {(() => {
                  const existingIds = new Set(
                    (selectedGroup.members || []).map((m) => extractId(m))
                  );
                  const friendsToAdd = availableFriends.filter((f) => !existingIds.has(String(f.id)));

                  if (friendsToAdd.length === 0) {
                    return (
                      <p className="text-xs text-neutral-500 py-2">
                        All your friends are already in this group.
                      </p>
                    );
                  }

                  return (
                    <div className="space-y-1.5">
                      {friendsToAdd.map((friend) => (
                        <div
                          key={friend.id}
                          className="flex items-center justify-between p-2 rounded-xl bg-neutral-800/40 hover:bg-neutral-800 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <Avatar name={friend.name} avatar={friend.avatar} size="sm" />
                            <p className="text-xs font-medium text-white">{friend.name}</p>
                          </div>

                          <button
                            onClick={() => handleAddMemberToGroup(friend.id)}
                            disabled={actionLoading}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>Add</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

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
