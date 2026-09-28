'use client';

import React, { useEffect, useRef } from 'react';
import { Phone, Video, ArrowLeft, ShieldCheck, Lock, Users } from 'lucide-react';
import { User, Group, Message } from '@/types';
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
}

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
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
          Select a contact or group to start chatting, send voice recordings & photos, or initiate WebRTC audio/video calls.
        </p>
        <div className="flex items-center gap-1.5 text-xs text-neutral-500 mt-8">
          <Lock className="w-3.5 h-3.5" />
          <span>Peer-to-peer WebRTC audio/video & persistent MongoDB storage</span>
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
      <header className="px-4 py-3 bg-neutral-900/90 border-b border-neutral-800/80 backdrop-blur-md flex items-center justify-between z-10">
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

        {/* 1-to-1 Calling Actions */}
        {!isGroup && selectedUser && (
          <div className="flex items-center gap-2">
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
          </div>
        )}
      </header>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
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
            />
          ))
        )}

        {/* Typing indicator bubble */}
        {(isRecipientTyping || groupTypingUser) && (
          <div className="flex justify-start my-1">
            <div className="bg-neutral-850 border border-neutral-700/40 rounded-2xl px-3 py-2 flex items-center gap-1">
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
