'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import { useWebRTC } from '@/hooks/useWebRTC';
import { useGroupCall } from '@/hooks/useGroupCall';
import { User, Group, Message } from '@/types';
import { apiRequest } from '@/lib/api';
import { triggerNotification, playNotificationSound, initNotificationAndAudioOnce } from '@/lib/notification';
import { NotificationToast, ToastNotificationData } from '@/components/ui/NotificationToast';
import { Sidebar } from '@/components/chat/Sidebar';
import { ChatArea } from '@/components/chat/ChatArea';
import { IncomingCallModal } from '@/components/call/IncomingCallModal';
import { ActiveCallModal } from '@/components/call/ActiveCallModal';
import { GroupIncomingCallModal } from '@/components/call/GroupIncomingCallModal';
import { ActiveGroupCallModal } from '@/components/call/ActiveGroupCallModal';
import { CallLogsModal } from '@/components/chat/CallLogsModal';
import { CreateGroupModal } from '@/components/chat/CreateGroupModal';
import { FriendModal } from '@/components/chat/FriendModal';
import { AdminModal } from '@/components/admin/AdminModal';
import { SettingsModal } from '@/components/chat/SettingsModal';
import { NotificationModal } from '@/components/chat/NotificationModal';
import { LandingPage } from '@/components/landing/LandingPage';
import {
  encryptMessage,
  decryptMessage,
  decryptMessageList,
  getConversationId,
  isEncrypted,
} from '@/lib/crypto';

const extractId = (val: any): string => {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object') return String(val._id || val.id || '');
  return String(val);
};

export default function ChatDashboard() {
  const { user: currentUser, loading: authLoading, logout, updateProfile, refreshUser } = useAuth();
  const { socket, onlineUserIds } = useSocket();
  const router = useRouter();

  // State
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isRecipientTyping, setIsRecipientTyping] = useState(false);
  const [groupTypingUser, setGroupTypingUser] = useState<string | null>(null);
  const [showCallLogs, setShowCallLogs] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showFriendModal, setShowFriendModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
  const [activeToast, setActiveToast] = useState<ToastNotificationData | null>(null);

  // Refs to eliminate stale closures in real-time socket handlers
  const selectedUserRef = useRef<User | null>(null);
  const selectedGroupRef = useRef<Group | null>(null);
  const currentUserRef = useRef<User | null>(null);
  const usersRef = useRef<User[]>([]);
  const groupsRef = useRef<Group[]>([]);

  useEffect(() => {
    selectedUserRef.current = selectedUser;
  }, [selectedUser]);

  useEffect(() => {
    selectedGroupRef.current = selectedGroup;
  }, [selectedGroup]);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  useEffect(() => {
    usersRef.current = users;
  }, [users]);

  useEffect(() => {
    groupsRef.current = groups;
  }, [groups]);

  const showNotificationAlert = useCallback((title: string, body: string, onClick?: () => void) => {
    setActiveToast({
      id: String(Date.now()),
      title,
      body,
      onClick,
    });
    triggerNotification(title, { body, onClick });
  }, []);

  // One-time Notification & Sound permission initialization upon login / initial entry
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Run once upon initial entry
    initNotificationAndAudioOnce();

    // Fallback: in case browser strictly requires direct user interaction gesture to prompt
    const onUserInteraction = () => {
      initNotificationAndAudioOnce();
    };

    window.addEventListener('click', onUserInteraction, { once: true, passive: true });
    window.addEventListener('touchstart', onUserInteraction, { once: true, passive: true });

    return () => {
      window.removeEventListener('click', onUserInteraction);
      window.removeEventListener('touchstart', onUserInteraction);
    };
  }, []);

  // Automatic Call Log in Conversation Handler
  const handleCallEndedLog = useCallback(
    (callLog: {
      peerId: string;
      callType: 'audio' | 'video';
      duration: number;
      status: 'completed' | 'missed' | 'rejected';
    }) => {
      if (!socket || !currentUser) return;

      const payload = {
        receiverId: callLog.peerId,
        content: callLog.callType === 'video' ? 'Video call' : 'Voice call',
        messageType: 'call',
        callDuration: callLog.duration,
        callStatus: callLog.status,
        tempId: `call_${Date.now()}`,
      };

      const optimisticMessage: Message = {
        id: payload.tempId,
        senderId: currentUser.id,
        receiverId: callLog.peerId,
        content: payload.content,
        messageType: 'call',
        callDuration: callLog.duration,
        callStatus: callLog.status,
        status: 'delivered',
        timestamp: new Date().toISOString(),
        sender: currentUser,
      };

      if (selectedUser?.id === callLog.peerId) {
        setMessages((prev) => [...prev, optimisticMessage]);
      }

      socket.emit('message:send', payload);
    },
    [socket, currentUser, selectedUser?.id]
  );

  // WebRTC hook
  const {
    callStatus,
    callType,
    peerUser,
    incomingCall,
    duration,
    isMuted,
    isCameraOff,
    isMirrored,
    facingMode,
    remoteAudioRef,
    localVideoRef,
    remoteVideoRef,
    startCall,
    answerCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera,
    toggleMirror,
    switchCamera,
  } = useWebRTC({ onCallEndedLog: handleCallEndedLog });

  // Multi-Party Group Audio Conference hook
  const {
    callState: groupCallState,
    activeGroupId,
    activeGroupName,
    participants: groupCallParticipants,
    incomingGroupCall,
    isMuted: isGroupMuted,
    duration: groupCallDuration,
    startGroupCall,
    joinGroupCall,
    rejectGroupCall,
    inviteMembers: inviteToGroupCall,
    leaveGroupCall,
    toggleMute: toggleGroupMute,
  } = useGroupCall(currentUser?.id);



  // Fetch confirmed friends list
  const fetchFriends = useCallback(async () => {
    try {
      setIsLoadingUsers(true);
      const data = await apiRequest('/friends');
      setUsers(data.friends || []);
    } catch (err) {
      console.error('Failed to fetch friends, trying users fallback:', err);
      try {
        const fallback = await apiRequest('/users');
        setUsers(fallback.users || []);
      } catch {}
    } finally {
      setIsLoadingUsers(false);
    }
  }, []);

  // Fetch pending friend requests count
  const fetchPendingRequestsCount = useCallback(async () => {
    try {
      const data = await apiRequest('/friends/requests');
      setPendingRequestsCount(data.requests?.length || 0);
    } catch (err) {
      console.error('Failed to fetch pending requests count:', err);
    }
  }, []);

  // Fetch groups
  const fetchGroups = useCallback(async () => {
    try {
      const data = await apiRequest('/groups');
      const loadedGroups: Group[] = data.groups || [];
      setGroups(loadedGroups);
      if (socket) {
        loadedGroups.forEach((g) => {
          const gid = extractId(g.id || (g as any)._id);
          if (gid) socket.emit('group:join', { groupId: gid });
        });
      }
    } catch (err) {
      console.error('Failed to fetch groups:', err);
    }
  }, [socket]);

  // Keep socket in sync with all user groups
  useEffect(() => {
    if (socket && groups.length > 0) {
      groups.forEach((g) => {
        const gid = extractId(g.id || (g as any)._id);
        if (gid) socket.emit('group:join', { groupId: gid });
      });
    }
  }, [socket, groups]);

  useEffect(() => {
    if (currentUser) {
      fetchFriends();
      fetchGroups();
      fetchPendingRequestsCount();
    }
  }, [currentUser, fetchFriends, fetchGroups, fetchPendingRequestsCount]);

  // Sync users with live online presence
  useEffect(() => {
    setUsers((prevUsers) =>
      prevUsers.map((u) => {
        const uid = extractId(u.id || (u as any)._id);
        const isOnline = onlineUserIds.has(uid);
        return {
          ...u,
          isOnline,
          lastSeen: isOnline ? new Date().toISOString() : u.lastSeen,
        };
      })
    );

    setSelectedUser((prev) => {
      if (!prev) return null;
      const pid = extractId(prev.id || (prev as any)._id);
      const isOnline = onlineUserIds.has(pid);
      return {
        ...prev,
        isOnline,
        lastSeen: isOnline ? new Date().toISOString() : prev.lastSeen,
      };
    });
  }, [onlineUserIds]);

  // Select 1-to-1 User chat
  const handleSelectUser = async (targetUser: User) => {
    setSelectedUser(targetUser);
    setSelectedGroup(null);
    setIsMobileChatOpen(true);
    setIsRecipientTyping(false);
    setGroupTypingUser(null);

    try {
      setIsLoadingMessages(true);
      const data = await apiRequest(`/messages/${targetUser.id}`);
      const rawMessages: Message[] = data.messages || [];
      if (currentUser) {
        const convId = getConversationId(currentUser.id, targetUser.id);
        const decrypted = await decryptMessageList(rawMessages, convId);
        setMessages(decrypted);
      } else {
        setMessages(rawMessages);
      }

      await apiRequest(`/messages/${targetUser.id}/read`, { method: 'PUT' });
      if (socket) {
        socket.emit('message:read', { senderId: targetUser.id });
      }

      setUsers((prev) =>
        prev.map((u) => (u.id === targetUser.id ? { ...u, unreadCount: 0 } : u))
      );
    } catch (err) {
      console.error('Failed to load chat history:', err);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  // Select Group chat
  const handleSelectGroup = async (group: Group) => {
    setSelectedGroup(group);
    setSelectedUser(null);
    setIsMobileChatOpen(true);
    setIsRecipientTyping(false);
    setGroupTypingUser(null);

    try {
      setIsLoadingMessages(true);
      const data = await apiRequest(`/groups/${group.id}/messages`);
      const rawMessages: Message[] = data.messages || [];
      if (currentUser) {
        const convId = getConversationId(currentUser.id, undefined, group.id);
        const decrypted = await decryptMessageList(rawMessages, convId);
        setMessages(decrypted);
      } else {
        setMessages(rawMessages);
      }

      if (socket) {
        socket.emit('group:join', { groupId: group.id });
      }
    } catch (err) {
      console.error('Failed to load group messages:', err);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  // Send message with End-to-End Encryption
  const handleSendMessage = async (content: string, attachment?: any, replyTo?: any) => {
    if (!currentUser || !socket) return;
    if (!selectedUser && !selectedGroup) return;

    const tempId = `temp_${Date.now()}`;
    const optimisticMessage: Message = {
      id: tempId,
      senderId: currentUser.id,
      receiverId: selectedUser?.id,
      groupId: selectedGroup?.id,
      content, // Plaintext shown in sender UI
      messageType: attachment?.messageType || 'text',
      fileUrl: attachment?.fileUrl,
      fileName: attachment?.fileName,
      fileSize: attachment?.fileSize,
      replyTo,
      status: selectedUser?.isOnline ? 'delivered' : 'sent',
      timestamp: new Date().toISOString(),
      sender: currentUser,
    };

    setMessages((prev) => [...prev, optimisticMessage]);

    // Encrypt content with conversation key before sending over socket
    const convId = getConversationId(currentUser.id, selectedUser?.id, selectedGroup?.id);
    const encryptedContent = content ? await encryptMessage(content, convId) : '';

    // Send encrypted payload to socket
    const payload = {
      receiverId: selectedUser?.id,
      groupId: selectedGroup?.id,
      content: encryptedContent, // ENCRYPTED: Database & Network only see ciphertext
      messageType: attachment?.messageType || 'text',
      fileUrl: attachment?.fileUrl,
      fileName: attachment?.fileName,
      fileSize: attachment?.fileSize,
      replyTo,
      tempId,
    };

    socket.emit('message:send', payload, (response: any) => {
      if (response?.success && response.message) {
        setMessages((prev) => {
          const exists = prev.some((m) => m.id === tempId);
          if (!exists) {
            // User deleted it before socket acknowledgment returned!
            const realId = response.message.id || (response.message as any)._id;
            if (realId) {
              apiRequest(`/messages/${realId}`, { method: 'DELETE' }).catch(() => {});
              if (socket) {
                socket.emit('message:delete', {
                  messageId: realId,
                  receiverId: selectedUser?.id,
                  groupId: selectedGroup?.id,
                });
              }
            }
            return prev;
          }
          // Display plaintext content for the sender
          const messageWithPlaintext = {
            ...response.message,
            content,
            replyTo: response.message.replyTo || replyTo,
          };

          // Also update active sidebar item immediately for sender
          if (selectedUser) {
            const sId = extractId(selectedUser.id || (selectedUser as any)._id);
            setUsers((uPrev) => {
              const updated = uPrev.map((u) =>
                extractId(u.id || (u as any)._id) === sId
                  ? { ...u, lastMessage: messageWithPlaintext }
                  : u
              );
              const target = updated.find((u) => extractId(u.id || (u as any)._id) === sId);
              const others = updated.filter((u) => extractId(u.id || (u as any)._id) !== sId);
              return target ? [target, ...others] : updated;
            });
          } else if (selectedGroup) {
            const gId = extractId(selectedGroup.id || (selectedGroup as any)._id);
            setGroups((gPrev) => {
              const updated = gPrev.map((g) =>
                extractId(g.id || (g as any)._id) === gId
                  ? { ...g, lastMessage: messageWithPlaintext }
                  : g
              );
              const target = updated.find((g) => extractId(g.id || (g as any)._id) === gId);
              const others = updated.filter((g) => extractId(g.id || (g as any)._id) !== gId);
              return target ? [target, ...others] : updated;
            });
          }

          return prev.map((m) => (m.id === tempId ? messageWithPlaintext : m));
        });
      }
    });
  };

  // Delete single message
  const handleDeleteMessage = async (messageId: string) => {
    try {
      setMessages((prev) => prev.filter((m) => m.id !== messageId));

      // If it's a temporary optimistic message, no backend call needed
      if (!messageId || messageId.startsWith('temp_')) {
        return;
      }

      apiRequest(`/messages/${messageId}`, { method: 'DELETE' }).catch((err) => {
        console.warn('[DeleteMessage] HTTP delete notice:', err);
      });

      if (socket) {
        socket.emit('message:delete', {
          messageId,
          receiverId: selectedUser?.id,
          groupId: selectedGroup?.id,
        });
      }
    } catch (err: unknown) {
      console.error('Failed to delete message:', err);
    }
  };

  // Edit message (Optimistic 0ms latency + Socket emit + REST fallback)
  const handleEditMessage = async (messageId: string, newContent: string) => {
    const msgId = extractId(messageId);
    if (!msgId || !newContent.trim()) return;

    const trimmed = newContent.trim();
    const now = new Date().toISOString();

    // 1. Instant optimistic local update
    setMessages((prev) =>
      prev.map((m) =>
        extractId(m.id || (m as any)._id) === msgId
          ? { ...m, content: trimmed, isEdited: true, editedAt: now }
          : m
      )
    );

    // 2. Broadcast edit via socket
    if (socket) {
      socket.emit('message:edit', {
        messageId: msgId,
        newContent: trimmed,
        receiverId: extractId(selectedUserRef.current?.id || (selectedUserRef.current as any)?._id),
        groupId: extractId(selectedGroupRef.current?.id || (selectedGroupRef.current as any)?._id),
      });
    }

    // 3. Fallback REST API
    apiRequest(`/messages/${msgId}`, {
      method: 'PUT',
      body: JSON.stringify({ content: trimmed }),
    }).catch((err) => {
      console.warn('[EditMessage] HTTP PUT fallback error:', err);
    });
  };

  // Clear full 1-to-1 chat history
  const handleClearHistory = async () => {
    if (!selectedUser) return;
    try {
      setMessages([]);
      await apiRequest('/messages/clear-history', {
        method: 'POST',
        body: JSON.stringify({ peerId: selectedUser.id }),
      });
      fetchFriends();
    } catch (err: unknown) {
      console.error('Failed to clear chat history:', err);
    }
  };

  // Clear group messages (Group Admin)
  const handleClearGroupMessages = async (groupId: string) => {
    try {
      setMessages([]);
      await apiRequest(`/groups/${groupId}/clear-messages`, { method: 'POST' });
      fetchGroups();
    } catch (err: unknown) {
      console.error('Failed to clear group messages:', err);
    }
  };

  // Delete Group (Group Admin)
  const handleDeleteGroup = async (groupId: string) => {
    try {
      await apiRequest(`/groups/${groupId}`, { method: 'DELETE' });
      setSelectedGroup(null);
      fetchGroups();
    } catch (err: unknown) {
      console.error('Failed to delete group:', err);
    }
  };

  // Typing events
  const handleTypingStart = () => {
    if (!socket) return;
    if (selectedUser) {
      socket.emit('typing:start', { receiverId: selectedUser.id });
    } else if (selectedGroup) {
      socket.emit('group:typing:start', { groupId: selectedGroup.id });
    }
  };

  const handleTypingStop = () => {
    if (!socket) return;
    if (selectedUser) {
      socket.emit('typing:stop', { receiverId: selectedUser.id });
    } else if (selectedGroup) {
      socket.emit('group:typing:stop', { groupId: selectedGroup.id });
    }
  };

  // React to a message with an emoji (Optimistic Instant UI Update + Socket Broadcast)
  const handleReactMessage = useCallback(
    (messageId: string, emoji: string) => {
      const msgId = extractId(messageId);
      if (!msgId) return;

      const myUserId = extractId(currentUserRef.current?.id || (currentUserRef.current as any)?._id);
      const myUserName = currentUserRef.current?.name || '';

      // 1. Instant optimistic update in local state (0ms delay)
      setMessages((prev) =>
        prev.map((m) => {
          if (extractId(m.id || (m as any)._id) !== msgId) return m;
          const currentReactions = Array.isArray(m.reactions) ? [...m.reactions] : [];
          const existingIdx = currentReactions.findIndex(
            (r) => String(r.userId) === myUserId && r.emoji === emoji
          );
          let newReactions;
          if (existingIdx >= 0) {
            newReactions = currentReactions.filter((_, idx) => idx !== existingIdx);
          } else {
            newReactions = [
              ...currentReactions.filter((r) => String(r.userId) !== myUserId),
              { emoji, userId: myUserId, userName: myUserName },
            ];
          }
          return { ...m, reactions: newReactions };
        })
      );

      // 2. Broadcast via socket to sync partner & persist to database
      if (socket) {
        socket.emit('message:react', {
          messageId: msgId,
          emoji,
          receiverId: extractId(selectedUserRef.current?.id || (selectedUserRef.current as any)?._id),
          groupId: extractId(selectedGroupRef.current?.id || (selectedGroupRef.current as any)?._id),
        });
      }
    },
    [socket]
  );

  // Socket event listeners (Ref-based for zero stale closures & instantaneous multi-device sync)
  useEffect(() => {
    if (!socket) return;

    // Incoming 1-to-1 message (handles direct message + cross-device sent sync)
    const handleReceiveMessage = async (message: Message) => {
      const current = currentUserRef.current;
      const currentUserIdStr = extractId(current?.id || (current as any)?._id);
      const selectedUserIdStr = extractId(selectedUserRef.current?.id || (selectedUserRef.current as any)?._id);
      const senderIdStr = extractId(message.senderId || (message.sender as any)?._id || (message.sender as any)?.id);
      const receiverIdStr = extractId(message.receiverId || (message as any)?.receiver?._id || (message as any)?.receiver?.id);
      const msgIdStr = extractId(message.id || (message as any)._id);

      const isSentByMe = senderIdStr === currentUserIdStr;
      const otherPartyId = isSentByMe ? receiverIdStr : senderIdStr;

      let displayMessage = message;
      if (message.content && isEncrypted(message.content) && current) {
        const convId = getConversationId(currentUserIdStr, otherPartyId);
        const plain = await decryptMessage(message.content, convId);
        displayMessage = { ...message, content: plain };
      }

      const sender = usersRef.current.find((u) => extractId(u.id || (u as any)._id) === senderIdStr);
      const otherUser = usersRef.current.find((u) => extractId(u.id || (u as any)._id) === otherPartyId);
      const senderName = sender?.name || (message.sender as any)?.name || 'Someone';

      let notifTitle = `New message from ${senderName}`;
      if (message.replyTo) {
        notifTitle = `💬 ${senderName} replied to your message`;
      } else if (
        current?.username &&
        displayMessage.content?.toLowerCase().includes(`@${current.username.toLowerCase()}`)
      ) {
        notifTitle = `📣 ${senderName} mentioned you`;
      }

      const isCurrentChatOpen = selectedUserIdStr && selectedUserIdStr === otherPartyId;

      if (isCurrentChatOpen) {
        setMessages((prev) => {
          if (msgIdStr && prev.some((m) => extractId(m.id || (m as any)._id) === msgIdStr)) {
            return prev;
          }
          return [...prev, displayMessage];
        });

        if (!isSentByMe) {
          playNotificationSound();
          if (
            message.replyTo ||
            (current?.username &&
              displayMessage.content?.toLowerCase().includes(`@${current.username.toLowerCase()}`))
          ) {
            showNotificationAlert(notifTitle, displayMessage.content || 'Voice Note');
          }
          socket.emit('message:read', { senderId: otherPartyId });
          apiRequest(`/messages/${otherPartyId}/read`, { method: 'PUT' }).catch(() => {});
        }

        // Update sidebar users list: bump to top and update lastMessage
        setUsers((prev) => {
          const exists = prev.some((u) => extractId(u.id || (u as any)._id) === otherPartyId);
          if (!exists) {
            fetchFriends();
            return prev;
          }
          const updated = prev.map((u) => {
            if (extractId(u.id || (u as any)._id) === otherPartyId) {
              return {
                ...u,
                unreadCount: 0,
                lastMessage: displayMessage,
              };
            }
            return u;
          });
          const target = updated.find((u) => extractId(u.id || (u as any)._id) === otherPartyId);
          const others = updated.filter((u) => extractId(u.id || (u as any)._id) !== otherPartyId);
          return target ? [target, ...others] : updated;
        });
      } else {
        if (!isSentByMe && message.messageType !== 'call') {
          showNotificationAlert(notifTitle, displayMessage.content || 'Voice Note', () => {
            if (otherUser) {
              handleSelectUser(otherUser);
            }
          });
          playNotificationSound();
        }

        setUsers((prev) => {
          const exists = prev.some((u) => extractId(u.id || (u as any)._id) === otherPartyId);
          if (!exists) {
            fetchFriends();
            return prev;
          }
          const updated = prev.map((u) => {
            if (extractId(u.id || (u as any)._id) === otherPartyId) {
              return {
                ...u,
                unreadCount: isSentByMe ? (u.unreadCount || 0) : (u.unreadCount || 0) + 1,
                lastMessage: displayMessage,
              };
            }
            return u;
          });
          const target = updated.find((u) => extractId(u.id || (u as any)._id) === otherPartyId);
          const others = updated.filter((u) => extractId(u.id || (u as any)._id) !== otherPartyId);
          return target ? [target, ...others] : updated;
        });
      }
    };

    // Incoming group message
    const handleReceiveGroupMessage = async (message: Message) => {
      const current = currentUserRef.current;
      const currentUserIdStr = extractId(current?.id || (current as any)?._id);
      const selectedGroupIdStr = extractId(selectedGroupRef.current?.id || (selectedGroupRef.current as any)?._id);
      const senderIdStr = extractId(message.senderId || (message.sender as any)?._id || (message.sender as any)?.id);
      const groupIdStr = extractId(message.groupId);
      const msgIdStr = extractId(message.id || (message as any)._id);

      const isSentByMe = senderIdStr === currentUserIdStr;

      let displayMessage = message;
      if (message.content && isEncrypted(message.content) && current) {
        const convId = getConversationId(currentUserIdStr, undefined, groupIdStr);
        const plain = await decryptMessage(message.content, convId);
        displayMessage = { ...message, content: plain };
      }

      const group = groupsRef.current.find((g) => extractId(g.id || (g as any)._id) === groupIdStr);
      const groupName = group?.name || 'Group';

      let notifTitle = `${groupName} • ${message.sender?.name || 'Member'}`;
      if (message.replyTo) {
        notifTitle = `💬 ${message.sender?.name || 'Member'} replied to you in ${groupName}`;
      } else if (
        current?.username &&
        displayMessage.content?.toLowerCase().includes(`@${current.username.toLowerCase()}`)
      ) {
        notifTitle = `📣 ${message.sender?.name || 'Member'} mentioned you in ${groupName}`;
      }

      const isCurrentGroupOpen = selectedGroupIdStr && selectedGroupIdStr === groupIdStr;

      if (isCurrentGroupOpen) {
        setMessages((prev) => {
          if (msgIdStr && prev.some((m) => extractId(m.id || (m as any)._id) === msgIdStr)) return prev;
          return [...prev, displayMessage];
        });

        if (!isSentByMe) {
          playNotificationSound();
          if (
            message.replyTo ||
            (current?.username &&
              displayMessage.content?.toLowerCase().includes(`@${current.username.toLowerCase()}`))
          ) {
            showNotificationAlert(notifTitle, displayMessage.content || 'Voice note');
          }
        }

        // Update group in sidebar: bump to top and update lastMessage
        setGroups((prev) => {
          const exists = prev.some((g) => extractId(g.id || (g as any)._id) === groupIdStr);
          if (!exists) {
            fetchGroups();
            return prev;
          }
          const updated = prev.map((g) =>
            extractId(g.id || (g as any)._id) === groupIdStr ? { ...g, lastMessage: displayMessage } : g
          );
          const target = updated.find((g) => extractId(g.id || (g as any)._id) === groupIdStr);
          const others = updated.filter((g) => extractId(g.id || (g as any)._id) !== groupIdStr);
          return target ? [target, ...others] : updated;
        });
      } else {
        if (!isSentByMe) {
          showNotificationAlert(notifTitle, displayMessage.content || 'Voice note', () => {
            if (group) {
              handleSelectGroup(group);
            }
          });
          playNotificationSound();
        }

        setGroups((prev) => {
          const exists = prev.some((g) => extractId(g.id || (g as any)._id) === groupIdStr);
          if (!exists) {
            fetchGroups();
            return prev;
          }
          const updated = prev.map((g) =>
            extractId(g.id || (g as any)._id) === groupIdStr ? { ...g, lastMessage: displayMessage } : g
          );
          const target = updated.find((g) => extractId(g.id || (g as any)._id) === groupIdStr);
          const others = updated.filter((g) => extractId(g.id || (g as any)._id) !== groupIdStr);
          return target ? [target, ...others] : updated;
        });
      }
    };

    // Message deleted listener
    const handleMessageDeleted = ({ messageId }: { messageId: string }) => {
      const targetId = extractId(messageId);
      setMessages((prev) => prev.filter((m) => extractId(m.id || (m as any)._id) !== targetId));
    };

    // Friend requests listeners
    const handleFriendRequestReceived = (data: { from: User }) => {
      setPendingRequestsCount((prev) => prev + 1);
      fetchPendingRequestsCount();
      showNotificationAlert('Friend Request Received', `${data.from.name} sent you a friend request!`, () => {
        setShowFriendModal(true);
      });
    };

    const handleFriendRequestSent = () => {
      fetchPendingRequestsCount();
    };

    const handleFriendRequestAccepted = (data: { friend: User }) => {
      fetchFriends();
      fetchPendingRequestsCount();
      showNotificationAlert('Request Accepted', `${data.friend.name} accepted your friend request!`, () => {
        handleSelectUser(data.friend);
      });
    };

    const handleFriendRequestRejected = () => {
      fetchPendingRequestsCount();
    };

    const handleUnfriended = ({ userId }: { userId: string }) => {
      const targetUid = extractId(userId);
      setUsers((prev) => prev.filter((u) => extractId(u.id || (u as any)._id) !== targetUid));
      const currentSelectedId = extractId(selectedUserRef.current?.id || (selectedUserRef.current as any)?._id);
      if (currentSelectedId === targetUid) {
        setSelectedUser(null);
        setMessages([]);
        setIsMobileChatOpen(false);
      }
    };

    const handleBlocked = ({ userId }: { userId: string }) => {
      const targetUid = extractId(userId);
      // Instantly remove from local friends list (instant update, zero reload)
      setUsers((prev) => prev.filter((u) => extractId(u.id || (u as any)._id) !== targetUid));
      const currentSelectedId = extractId(selectedUserRef.current?.id || (selectedUserRef.current as any)?._id);
      if (currentSelectedId === targetUid) {
        setSelectedUser(null);
        setMessages([]);
        setIsMobileChatOpen(false);
      }
      refreshUser();
    };

    const handleUnblocked = ({ userId }: { userId: string }) => {
      refreshUser();
      fetchFriends();
    };

    // Delivery confirmation
    const handleMessageDelivered = ({ messageId }: { messageId: string }) => {
      const targetId = extractId(messageId);
      setMessages((prev) =>
        prev.map((m) => (extractId(m.id || (m as any)._id) === targetId ? { ...m, status: 'delivered' } : m))
      );
    };

    // Read receipts update
    const handleMessageRead = ({ readerId }: { readerId: string }) => {
      const currentSelectedId = extractId(selectedUserRef.current?.id || (selectedUserRef.current as any)?._id);
      if (currentSelectedId === extractId(readerId)) {
        setMessages((prev) =>
          prev.map((m) => (m.status !== 'read' ? { ...m, status: 'read' } : m))
        );
      }
    };

    // 1-to-1 Typing
    const handleRemoteTypingStart = ({ senderId }: { senderId: string }) => {
      const currentSelectedId = extractId(selectedUserRef.current?.id || (selectedUserRef.current as any)?._id);
      if (currentSelectedId === extractId(senderId)) {
        setIsRecipientTyping(true);
      }
    };

    const handleRemoteTypingStop = ({ senderId }: { senderId: string }) => {
      const currentSelectedId = extractId(selectedUserRef.current?.id || (selectedUserRef.current as any)?._id);
      if (currentSelectedId === extractId(senderId)) {
        setIsRecipientTyping(false);
      }
    };

    // Group Typing
    const handleGroupTypingStart = ({
      groupId,
      senderName,
    }: {
      groupId: string;
      senderName: string;
    }) => {
      const currentGid = extractId(selectedGroupRef.current?.id || (selectedGroupRef.current as any)?._id);
      if (currentGid === extractId(groupId)) {
        setGroupTypingUser(senderName);
      }
    };

    const handleGroupTypingStop = ({ groupId }: { groupId: string }) => {
      const currentGid = extractId(selectedGroupRef.current?.id || (selectedGroupRef.current as any)?._id);
      if (currentGid === extractId(groupId)) {
        setGroupTypingUser(null);
      }
    };

    // Realtime Group Lifecycle Sync (Zero Reload)
    const handleGroupCreated = ({ group }: { group: Group }) => {
      const gId = extractId(group.id || (group as any)._id);
      setGroups((prev) => [group, ...prev.filter((g) => extractId(g.id || (g as any)._id) !== gId)]);
      if (socket) {
        socket.emit('group:join', { groupId: gId });
      }
      showNotificationAlert('New Group Created', `You were added to "${group.name}"`, () => {
        handleSelectGroup(group);
      });
    };

    const handleGroupUpdated = ({ group }: { group: Group }) => {
      const gId = extractId(group.id || (group as any)._id);
      setGroups((prev) => prev.map((g) => (extractId(g.id || (g as any)._id) === gId ? group : g)));
      setSelectedGroup((prev) => (extractId(prev?.id || (prev as any)?._id) === gId ? group : prev));
      if (socket) {
        socket.emit('group:join', { groupId: gId });
      }
    };

    const handleGroupRemoved = ({ groupId }: { groupId: string }) => {
      const targetGid = extractId(groupId);
      setGroups((prev) => prev.filter((g) => extractId(g.id || (g as any)._id) !== targetGid));
      setSelectedGroup((prev) => {
        if (extractId(prev?.id || (prev as any)?._id) === targetGid) {
          setIsMobileChatOpen(false);
          setMessages([]);
          return null;
        }
        return prev;
      });
    };

    const handleGroupDeleted = ({ groupId }: { groupId: string }) => {
      const targetGid = extractId(groupId);
      setGroups((prev) => prev.filter((g) => extractId(g.id || (g as any)._id) !== targetGid));
      setSelectedGroup((prev) => {
        if (extractId(prev?.id || (prev as any)?._id) === targetGid) {
          setIsMobileChatOpen(false);
          setMessages([]);
          return null;
        }
        return prev;
      });
    };

    const handleGroupMessagesCleared = ({ groupId }: { groupId: string }) => {
      const targetGid = extractId(groupId);
      const currentGid = extractId(selectedGroupRef.current?.id || (selectedGroupRef.current as any)?._id);
      if (currentGid === targetGid) {
        setMessages([]);
      }
      setGroups((prev) =>
        prev.map((g) => (extractId(g.id || (g as any)._id) === targetGid ? { ...g, lastMessage: null } : g))
      );
    };

    const handleConversationCleared = ({ peerId }: { peerId: string }) => {
      const targetPeerId = extractId(peerId);
      const currentSelectedId = extractId(selectedUserRef.current?.id || (selectedUserRef.current as any)?._id);
      if (currentSelectedId === targetPeerId) {
        setMessages([]);
      }
      setUsers((prev) =>
        prev.map((u) => (extractId(u.id || (u as any)._id) === targetPeerId ? { ...u, lastMessage: null } : u))
      );
    };

    const handleAdminBlocked = (data: { message?: string }) => {
      console.warn(data.message || 'Your account has been suspended by an administrator.');
      logout();
    };

    const handleAdminDeleted = (data: { message?: string }) => {
      console.warn(data.message || 'Your account has been deleted by an administrator.');
      logout();
    };

    socket.on('message:receive', handleReceiveMessage);
    socket.on('message:sent-sync', handleReceiveMessage);
    socket.on('group:message:receive', handleReceiveGroupMessage);
    socket.on('message:deleted', handleMessageDeleted);
    socket.on('friend:request:received', handleFriendRequestReceived);
    socket.on('friend:request:sent', handleFriendRequestSent);
    socket.on('friend:request:accepted', handleFriendRequestAccepted);
    socket.on('friend:request:rejected', handleFriendRequestRejected);
    socket.on('friend:unfriended', handleUnfriended);
    socket.on('friend:blocked', handleBlocked);
    socket.on('friend:unblocked', handleUnblocked);
    socket.on('group:created', handleGroupCreated);
    socket.on('group:updated', handleGroupUpdated);
    socket.on('group:removed', handleGroupRemoved);
    socket.on('group:deleted', handleGroupDeleted);
    socket.on('group:messages:cleared', handleGroupMessagesCleared);
    socket.on('conversation:cleared', handleConversationCleared);
    socket.on('user:admin:blocked', handleAdminBlocked);
    socket.on('user:admin:deleted', handleAdminDeleted);
    socket.on('message:delivered', handleMessageDelivered);
    socket.on('message:read', handleMessageRead);
    socket.on('typing:start', handleRemoteTypingStart);
    socket.on('typing:stop', handleRemoteTypingStop);
    socket.on('group:typing:start', handleGroupTypingStart);
    socket.on('group:typing:stop', handleGroupTypingStop);

    // Realtime message reactions
    const handleReaction = ({ messageId, reactions }: { messageId: string; reactions: any[] }) => {
      setMessages((prev) =>
        prev.map((m) =>
          extractId(m.id || (m as any)._id) === extractId(messageId)
            ? { ...m, reactions }
            : m
        )
      );
    };
    socket.on('message:reaction', handleReaction);

    // Realtime message edited listener
    const handleMessageEdited = ({
      messageId,
      content,
      isEdited,
      editedAt,
    }: {
      messageId: string;
      content: string;
      isEdited: boolean;
      editedAt: string;
    }) => {
      const targetId = extractId(messageId);
      setMessages((prev) =>
        prev.map((m) =>
          extractId(m.id || (m as any)._id) === targetId
            ? { ...m, content, isEdited: true, editedAt }
            : m
        )
      );

      setUsers((prev) =>
        prev.map((u) => {
          if (extractId(u.lastMessage?.id || (u.lastMessage as any)?._id) === targetId) {
            return {
              ...u,
              lastMessage: u.lastMessage ? { ...u.lastMessage, content, isEdited: true } : null,
            };
          }
          return u;
        })
      );

      setGroups((prev) =>
        prev.map((g) => {
          if (extractId(g.lastMessage?.id || (g.lastMessage as any)?._id) === targetId) {
            return {
              ...g,
              lastMessage: g.lastMessage ? { ...g.lastMessage, content, isEdited: true } : null,
            };
          }
          return g;
        })
      );
    };
    socket.on('message:edited', handleMessageEdited);

    return () => {
      socket.off('message:receive', handleReceiveMessage);
      socket.off('message:sent-sync', handleReceiveMessage);
      socket.off('group:message:receive', handleReceiveGroupMessage);
      socket.off('message:deleted', handleMessageDeleted);
      socket.off('friend:request:received', handleFriendRequestReceived);
      socket.off('friend:request:sent', handleFriendRequestSent);
      socket.off('friend:request:accepted', handleFriendRequestAccepted);
      socket.off('friend:request:rejected', handleFriendRequestRejected);
      socket.off('friend:unfriended', handleUnfriended);
      socket.off('friend:blocked', handleBlocked);
      socket.off('friend:unblocked', handleUnblocked);
      socket.off('group:created', handleGroupCreated);
      socket.off('group:updated', handleGroupUpdated);
      socket.off('group:removed', handleGroupRemoved);
      socket.off('group:deleted', handleGroupDeleted);
      socket.off('group:messages:cleared', handleGroupMessagesCleared);
      socket.off('conversation:cleared', handleConversationCleared);
      socket.off('user:admin:blocked', handleAdminBlocked);
      socket.off('user:admin:deleted', handleAdminDeleted);
      socket.off('message:delivered', handleMessageDelivered);
      socket.off('message:read', handleMessageRead);
      socket.off('typing:start', handleRemoteTypingStart);
      socket.off('typing:stop', handleRemoteTypingStop);
      socket.off('group:typing:start', handleGroupTypingStart);
      socket.off('group:typing:stop', handleGroupTypingStop);
      socket.off('message:reaction', handleReaction);
      socket.off('message:edited', handleMessageEdited);
    };
  }, [socket, fetchFriends, fetchGroups, fetchPendingRequestsCount, logout]);

  if (authLoading) {
    return (
      <div className="h-[100dvh] w-full flex flex-col items-center justify-center bg-neutral-950 text-neutral-400 gap-3">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
        <span className="text-sm font-medium">Initializing Shofi Chat...</span>
      </div>
    );
  }

  if (!currentUser) {
    return <LandingPage />;
  }

  return (
    <div className="flex h-[100dvh] w-full max-w-full bg-neutral-950 overflow-hidden select-none">
      {/* Sidebar */}
      <div className={`${isMobileChatOpen ? 'hidden md:flex' : 'flex'} w-full md:w-auto h-full min-w-0`}>
        <Sidebar
          currentUser={currentUser}
          users={users}
          groups={groups}
          selectedUser={selectedUser}
          selectedGroup={selectedGroup}
          onSelectUser={handleSelectUser}
          onSelectGroup={handleSelectGroup}
          onLogout={logout}
          onOpenCallLogs={() => setShowCallLogs(true)}
          onOpenCreateGroup={() => setShowCreateGroup(true)}
          onOpenFriendModal={() => setShowFriendModal(true)}
          onOpenAdminModal={() => setShowAdminModal(true)}
          onOpenSettings={() => setShowSettingsModal(true)}
          onOpenNotificationSetup={() => setShowNotificationModal(true)}
          pendingRequestsCount={pendingRequestsCount}
          isLoadingUsers={isLoadingUsers}
        />
      </div>

      {/* Main Chat Area */}
      <div className={`${!isMobileChatOpen ? 'hidden md:flex' : 'flex'} flex-1 h-full min-w-0`}>
        <ChatArea
          selectedUser={selectedUser}
          selectedGroup={selectedGroup}
          currentUser={currentUser}
          messages={messages}
          availableFriends={users}
          isLoadingMessages={isLoadingMessages}
          isRecipientTyping={isRecipientTyping}
          groupTypingUser={groupTypingUser}
          onSendMessage={handleSendMessage}
          onTypingStart={handleTypingStart}
          onTypingStop={handleTypingStop}
          onStartCall={(target, type) => startCall(target, type)}
          onStartGroupCall={(groupId, groupName, targetMemberIds) =>
            startGroupCall(groupId, groupName, targetMemberIds)
          }
          onDeleteMessage={handleDeleteMessage}
          onReactMessage={handleReactMessage}
          onEditMessage={handleEditMessage}
          onClearHistory={handleClearHistory}
          onClearGroupMessages={handleClearGroupMessages}
          onDeleteGroup={handleDeleteGroup}
          onGroupUpdated={(updatedGroup) => {
            setGroups((prev) => prev.map((g) => (g.id === updatedGroup.id ? updatedGroup : g)));
            setSelectedGroup(updatedGroup);
          }}
          onBack={() => setIsMobileChatOpen(false)}
          onFriendUpdated={() => {
            fetchFriends();
            setSelectedUser(null);
            setMessages([]);
          }}
        />
      </div>

      {/* 1-to-1 Incoming Call Popup - strictly only when ringing */}
      {incomingCall && callStatus === 'incoming' && (
        <IncomingCallModal
          incomingCall={incomingCall}
          onAccept={answerCall}
          onReject={rejectCall}
        />
      )}

      {/* 1-to-1 Active Call Non-blocking Draggable Viewport Modal */}
      <ActiveCallModal
        callStatus={callStatus}
        callType={callType}
        peerUser={peerUser}
        duration={duration}
        isMuted={isMuted}
        isCameraOff={isCameraOff}
        isMirrored={isMirrored}
        facingMode={facingMode}
        onToggleMute={toggleMute}
        onToggleCamera={toggleCamera}
        onToggleMirror={toggleMirror}
        onSwitchCamera={switchCamera}
        onEndCall={endCall}
        remoteAudioRef={remoteAudioRef}
        localVideoRef={localVideoRef}
        remoteVideoRef={remoteVideoRef}
      />

      {/* Multi-Party Group Audio Conference: Incoming Call Ringing Modal */}
      {incomingGroupCall && (
        <GroupIncomingCallModal
          incomingCall={incomingGroupCall}
          onAccept={joinGroupCall}
          onReject={rejectGroupCall}
        />
      )}

      {/* Multi-Party Group Audio Conference: Active Room Modal */}
      {groupCallState !== 'idle' && (
        <ActiveGroupCallModal
          isOpen={true}
          groupName={activeGroupName || 'Group Call'}
          participants={groupCallParticipants}
          isMuted={isGroupMuted}
          duration={groupCallDuration}
          availableGroupMembers={
            selectedGroup?.id === activeGroupId
              ? selectedGroup.members?.filter((m) => m.id !== currentUser.id)
              : users
          }
          onToggleMute={toggleGroupMute}
          onLeaveCall={leaveGroupCall}
          onInviteMembers={inviteToGroupCall}
        />
      )}

      {/* Call History Modal */}
      <CallLogsModal
        isOpen={showCallLogs}
        onClose={() => setShowCallLogs(false)}
        currentUserId={currentUser.id}
        onStartCall={(target) => startCall(target, 'audio')}
      />

      {/* Create Group Modal */}
      <CreateGroupModal
        isOpen={showCreateGroup}
        onClose={() => setShowCreateGroup(false)}
        availableUsers={users}
        onGroupCreated={(newGroup) => {
          setGroups((prev) => [newGroup, ...prev]);
          handleSelectGroup(newGroup);
        }}
      />

      {/* Friends & Requests Modal */}
      <FriendModal
        isOpen={showFriendModal}
        onClose={() => setShowFriendModal(false)}
        onFriendAdded={fetchFriends}
        onRequestHandled={fetchPendingRequestsCount}
      />

      {/* Super Admin Control Panel Modal */}
      <AdminModal
        isOpen={showAdminModal}
        onClose={() => setShowAdminModal(false)}
        onUsersUpdated={fetchFriends}
        onLogout={logout}
      />

      {/* Profile & Storage Retention Settings Modal */}
      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        currentUser={currentUser}
        onSaveProfile={updateProfile}
        onLogout={logout}
        isInitialSetup={currentUser.settings?.hasCompletedSetup === false}
      />

      {/* Notification Setup Modal */}
      <NotificationModal
        isOpen={showNotificationModal}
        onClose={() => setShowNotificationModal(false)}
        onTestToast={(title, body) => showNotificationAlert(title, body)}
      />

      {/* Floating In-App Toast Notification */}
      <NotificationToast
        notification={activeToast}
        onClose={() => setActiveToast(null)}
      />
    </div>
  );
}
