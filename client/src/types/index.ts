export interface User {
  id: string;
  name: string;
  email: string;
  username?: string;
  avatar?: string;
  bio?: string;
  isOnline: boolean;
  lastSeen: string;
  createdAt?: string;
  role?: 'user' | 'admin';
  isBlockedByAdmin?: boolean;
  unreadCount?: number;
  lastMessage?: Message | null;
  blockedUsers?: string[];
  isBlocked?: boolean;
  isBlockedByMe?: boolean;
  hasBlockedMe?: boolean;
  settings?: {
    saveChatHistory?: boolean;
    chatRetentionDays?: number;
    hasCompletedSetup?: boolean;
  };
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  avatar?: string;
  creator: User | string;
  members: User[];
  admins: string[];
  unreadCount?: number;
  lastMessage?: Message | null;
  updatedAt?: string;
}

export interface Message {
  id: string;
  senderId: string;
  receiverId?: string;
  groupId?: string;
  content: string;
  messageType?: 'text' | 'image' | 'file' | 'audio' | 'call';
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  callDuration?: number;
  callStatus?: string;
  status: 'sent' | 'delivered' | 'read';
  timestamp: string;
  sender?: User;
}

export interface CallLog {
  id: string;
  callerId: User;
  receiverId: User;
  callType: 'audio' | 'video';
  status: 'missed' | 'completed' | 'rejected';
  duration: number;
  timestamp: string;
}

export type CallState = 'idle' | 'calling' | 'incoming' | 'connected' | 'ended';

export interface IncomingCallData {
  from: string;
  callerName: string;
  callerAvatar?: string;
  callType: 'audio' | 'video';
  offer: RTCSessionDescriptionInit;
}
