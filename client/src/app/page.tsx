'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import { useWebRTC } from '@/hooks/useWebRTC';
import { User, Group, Message } from '@/types';
import { apiRequest } from '@/lib/api';
import { sounds } from '@/lib/sound';
import { Sidebar } from '@/components/chat/Sidebar';
import { ChatArea } from '@/components/chat/ChatArea';
import { IncomingCallModal } from '@/components/call/IncomingCallModal';
import { ActiveCallModal } from '@/components/call/ActiveCallModal';
import { CallLogsModal } from '@/components/chat/CallLogsModal';
import { CreateGroupModal } from '@/components/chat/CreateGroupModal';

export default function ChatDashboard() {
  const { user: currentUser, loading: authLoading, logout } = useAuth();
  const { socket, isConnected, onlineUserIds } = useSocket();
  const router = useRouter();

  // State
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [isRecipientTyping, setIsRecipientTyping] = useState(false);
  const [groupTypingUser, setGroupTypingUser] = useState<string | null>(null);
  const [showCallLogs, setShowCallLogs] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);

  // WebRTC hook
  const {
    callStatus,
    callType,
    peerUser,
    incomingCall,
    duration,
    isMuted,
    isCameraOff,
    remoteAudioRef,
    localVideoRef,
    remoteVideoRef,
    startCall,
    answerCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera,
  } = useWebRTC();

  // Redirect to login if unauthenticated
  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.push('/login');
    }
  }, [authLoading, currentUser, router]);

  // Fetch users directory
  const fetchUsers = useCallback(async () => {
    try {
      setIsLoadingUsers(true);
      const data = await apiRequest('/users');
      setUsers(data.users || []);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setIsLoadingUsers(false);
    }
  }, []);

  // Fetch groups
  const fetchGroups = useCallback(async () => {
    try {
      const data = await apiRequest('/groups');
      setGroups(data.groups || []);
    } catch (err) {
      console.error('Failed to fetch groups:', err);
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchUsers();
      fetchGroups();
    }
  }, [currentUser, fetchUsers, fetchGroups]);

  // Sync users with live online presence
  useEffect(() => {
    setUsers((prevUsers) =>
      prevUsers.map((u) => {
        const isOnline = onlineUserIds.has(u.id);
        return {
          ...u,
          isOnline,
          lastSeen: isOnline ? new Date().toISOString() : u.lastSeen,
        };
      })
    );

    if (selectedUser) {
      setSelectedUser((prev) => {
        if (!prev) return null;
        const isOnline = onlineUserIds.has(prev.id);
        return {
          ...prev,
          isOnline,
          lastSeen: isOnline ? new Date().toISOString() : prev.lastSeen,
        };
      });
    }
  }, [onlineUserIds]);

  // Select 1-to-1 User chat
  const handleSelectUser = async (targetUser: User) => {
    setSelectedUser(targetUser);
    setSelectedGroup(null);
    setIsMobileChatOpen(true);
    setIsRecipientTyping(false);
    setGroupTypingUser(null);

    try {
      const data = await apiRequest(`/messages/${targetUser.id}`);
      setMessages(data.messages || []);

      await apiRequest(`/messages/${targetUser.id}/read`, { method: 'PUT' });
      if (socket) {
        socket.emit('message:read', { senderId: targetUser.id });
      }

      setUsers((prev) =>
        prev.map((u) => (u.id === targetUser.id ? { ...u, unreadCount: 0 } : u))
      );
    } catch (err) {
      console.error('Failed to load chat history:', err);
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
      const data = await apiRequest(`/groups/${group.id}/messages`);
      setMessages(data.messages || []);

      if (socket) {
        socket.emit('group:join', { groupId: group.id });
      }
    } catch (err) {
      console.error('Failed to load group messages:', err);
    }
  };

  // Send message (handles text, photos, files, and voice notes)
  const handleSendMessage = (content: string, attachment?: any) => {
    if (!currentUser || !socket) return;
    if (!selectedUser && !selectedGroup) return;

    const tempId = `temp_${Date.now()}`;
    const optimisticMessage: Message = {
      id: tempId,
      senderId: currentUser.id,
      receiverId: selectedUser?.id,
      groupId: selectedGroup?.id,
      content,
      messageType: attachment?.messageType || 'text',
      fileUrl: attachment?.fileUrl,
      fileName: attachment?.fileName,
      fileSize: attachment?.fileSize,
      status: selectedUser?.isOnline ? 'delivered' : 'sent',
      timestamp: new Date().toISOString(),
      sender: currentUser,
    };

    setMessages((prev) => [...prev, optimisticMessage]);

    // Send payload to socket
    const payload = {
      receiverId: selectedUser?.id,
      groupId: selectedGroup?.id,
      content,
      messageType: attachment?.messageType || 'text',
      fileUrl: attachment?.fileUrl,
      fileName: attachment?.fileName,
      fileSize: attachment?.fileSize,
      tempId,
    };

    socket.emit('message:send', payload, (response: any) => {
      if (response?.success && response.message) {
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? response.message : m))
        );
      }
    });
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

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    // Incoming 1-to-1 message
    const handleReceiveMessage = (message: Message) => {
      if (selectedUser && message.senderId === selectedUser.id) {
        setMessages((prev) => [...prev, message]);
        sounds.playMessageSound();
        socket.emit('message:read', { senderId: selectedUser.id });
        apiRequest(`/messages/${selectedUser.id}/read`, { method: 'PUT' }).catch(() => {});
      } else {
        sounds.playMessageSound();
        setUsers((prev) =>
          prev.map((u) => {
            if (u.id === message.senderId) {
              return {
                ...u,
                unreadCount: (u.unreadCount || 0) + 1,
                lastMessage: message,
              };
            }
            return u;
          })
        );
      }
    };

    // Incoming group message
    const handleReceiveGroupMessage = (message: Message) => {
      if (selectedGroup && message.groupId === selectedGroup.id) {
        // Avoid duplicate if sent by current user
        setMessages((prev) => {
          if (prev.some((m) => m.id === message.id)) return prev;
          return [...prev, message];
        });
        if (message.senderId !== currentUser?.id) {
          sounds.playMessageSound();
        }
      } else {
        sounds.playMessageSound();
        setGroups((prev) =>
          prev.map((g) =>
            g.id === message.groupId ? { ...g, lastMessage: message } : g
          )
        );
      }
    };

    // Delivery confirmation
    const handleMessageDelivered = ({ messageId }: { messageId: string }) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, status: 'delivered' } : m))
      );
    };

    // Read receipts update
    const handleMessageRead = ({ readerId }: { readerId: string }) => {
      if (selectedUser && selectedUser.id === readerId) {
        setMessages((prev) =>
          prev.map((m) => (m.status !== 'read' ? { ...m, status: 'read' } : m))
        );
      }
    };

    // 1-to-1 Typing
    const handleRemoteTypingStart = ({ senderId }: { senderId: string }) => {
      if (selectedUser && selectedUser.id === senderId) {
        setIsRecipientTyping(true);
      }
    };

    const handleRemoteTypingStop = ({ senderId }: { senderId: string }) => {
      if (selectedUser && selectedUser.id === senderId) {
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
      if (selectedGroup && selectedGroup.id === groupId) {
        setGroupTypingUser(senderName);
      }
    };

    const handleGroupTypingStop = ({ groupId }: { groupId: string }) => {
      if (selectedGroup && selectedGroup.id === groupId) {
        setGroupTypingUser(null);
      }
    };

    socket.on('message:receive', handleReceiveMessage);
    socket.on('group:message:receive', handleReceiveGroupMessage);
    socket.on('message:delivered', handleMessageDelivered);
    socket.on('message:read', handleMessageRead);
    socket.on('typing:start', handleRemoteTypingStart);
    socket.on('typing:stop', handleRemoteTypingStop);
    socket.on('group:typing:start', handleGroupTypingStart);
    socket.on('group:typing:stop', handleGroupTypingStop);

    return () => {
      socket.off('message:receive', handleReceiveMessage);
      socket.off('group:message:receive', handleReceiveGroupMessage);
      socket.off('message:delivered', handleMessageDelivered);
      socket.off('message:read', handleMessageRead);
      socket.off('typing:start', handleRemoteTypingStart);
      socket.off('typing:stop', handleRemoteTypingStop);
      socket.off('group:typing:start', handleGroupTypingStart);
      socket.off('group:typing:stop', handleGroupTypingStop);
    };
  }, [socket, selectedUser, selectedGroup, currentUser?.id]);

  if (authLoading || !currentUser) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-neutral-950 text-neutral-400 gap-3">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
        <span className="text-sm font-medium">Initializing ShofiChat...</span>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen bg-neutral-950 overflow-hidden select-none">
      {/* Sidebar */}
      <div className={`${isMobileChatOpen ? 'hidden md:flex' : 'flex'} w-full md:w-auto h-full`}>
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
          isLoadingUsers={isLoadingUsers}
        />
      </div>

      {/* Main Chat Area */}
      <div className={`${!isMobileChatOpen ? 'hidden md:flex' : 'flex'} flex-1 h-full`}>
        <ChatArea
          selectedUser={selectedUser}
          selectedGroup={selectedGroup}
          currentUser={currentUser}
          messages={messages}
          isRecipientTyping={isRecipientTyping}
          groupTypingUser={groupTypingUser}
          onSendMessage={handleSendMessage}
          onTypingStart={handleTypingStart}
          onTypingStop={handleTypingStop}
          onStartCall={(target, type) => startCall(target, type)}
          onBack={() => setIsMobileChatOpen(false)}
        />
      </div>

      {/* Incoming Call Popup */}
      <IncomingCallModal
        incomingCall={incomingCall}
        onAccept={answerCall}
        onReject={rejectCall}
      />

      {/* Active Call Floating / Video Viewport Modal */}
      <ActiveCallModal
        callStatus={callStatus}
        callType={callType}
        peerUser={peerUser}
        duration={duration}
        isMuted={isMuted}
        isCameraOff={isCameraOff}
        onToggleMute={toggleMute}
        onToggleCamera={toggleCamera}
        onEndCall={endCall}
        remoteAudioRef={remoteAudioRef}
        localVideoRef={localVideoRef}
        remoteVideoRef={remoteVideoRef}
      />

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
    </div>
  );
}
