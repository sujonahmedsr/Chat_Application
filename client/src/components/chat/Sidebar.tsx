'use client';

import React, { useState, useEffect } from 'react';
import {
  Search,
  LogOut,
  PhoneCall,
  MessageSquare,
  Users,
  UserPlus,
  Bell,
  BellOff,
  UserCheck,
  ShieldAlert,
  Settings,
  MoreVertical,
} from 'lucide-react';
import { User, Group } from '@/types';
import { Avatar } from '../ui/Avatar';
import { UserItem } from './UserItem';
import { SidebarSkeleton } from '../ui/Skeleton';
import {
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  playNotificationSound,
} from '@/lib/notification';
import { isEncrypted, decryptMessage, getConversationId } from '@/lib/crypto';

const SUPER_ADMINS = [
  'shofiqul.sujon2201@gmail.com',
];

interface SidebarProps {
  currentUser: User | null;
  users: User[];
  groups: Group[];
  selectedUser: User | null;
  selectedGroup: Group | null;
  onSelectUser: (user: User) => void;
  onSelectGroup: (group: Group) => void;
  onLogout: () => void;
  onOpenCallLogs: () => void;
  onOpenCreateGroup: () => void;
  onOpenFriendModal: () => void;
  onOpenAdminModal?: () => void;
  onOpenSettings?: () => void;
  onOpenNotificationSetup?: () => void;
  pendingRequestsCount: number;
  isLoadingUsers: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentUser,
  users,
  groups,
  selectedUser,
  selectedGroup,
  onSelectUser,
  onSelectGroup,
  onLogout,
  onOpenCallLogs,
  onOpenCreateGroup,
  onOpenFriendModal,
  onOpenAdminModal,
  onOpenSettings,
  onOpenNotificationSetup,
  pendingRequestsCount,
  isLoadingUsers,
}) => {
  const [activeTab, setActiveTab] = useState<'chats' | 'groups'>('chats');
  const [searchQuery, setSearchQuery] = useState('');
  const [notificationStatus, setNotificationStatus] = useState<string>('default');

  useEffect(() => {
    if (isNotificationSupported()) {
      const current = getNotificationPermission();
      setNotificationStatus(current);

      if (current === 'default') {
        // Automatically request notification permission on load
        requestNotificationPermission().then((granted) => {
          setNotificationStatus(granted ? 'granted' : 'denied');
          if (granted) {
            playNotificationSound();
          }
        });
      }
    }
  }, []);

  const handleToggleNotification = async () => {
    if (!isNotificationSupported()) {
      console.warn('Desktop notifications are not supported in this browser.');
      return;
    }

    if (notificationStatus === 'granted') {
      playNotificationSound();
      return;
    }

    const granted = await requestNotificationPermission();
    setNotificationStatus(granted ? 'granted' : 'denied');
    if (granted) {
      playNotificationSound();
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase().trim();
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  const filteredGroups = groups.filter((g) => {
    const q = searchQuery.toLowerCase().trim();
    return g.name.toLowerCase().includes(q) || (g.description && g.description.toLowerCase().includes(q));
  });

  return (
    <aside className="w-full md:w-80 lg:w-96 flex-shrink-0 flex flex-col h-full bg-neutral-900 border-r border-neutral-800">
      {/* Top Header Card */}
      <div className="p-3.5 border-b border-neutral-800 bg-neutral-900/95 backdrop-blur-sm space-y-3">
        {/* 1. Main Profile Row (Clickable to open Settings for everyone) */}
        <div className="flex items-center justify-between gap-2">
          <div
            onClick={onOpenSettings}
            className="flex items-center gap-3 cursor-pointer group flex-1 min-w-0"
            title="Click to view & edit Profile"
          >
            <div className="relative flex-shrink-0">
              <Avatar
                name={currentUser?.name || 'User'}
                avatar={currentUser?.avatar}
                size="md"
                isOnline={true}
                showStatus={true}
              />
              <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px]">
                <Settings className="w-3.5 h-3.5 text-emerald-400" />
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-bold text-white truncate group-hover:text-emerald-400 transition-colors">
                  {currentUser?.name || 'User'}
                </h2>
                {(SUPER_ADMINS.includes((currentUser?.email || '').toLowerCase()) || currentUser?.role === 'admin') && (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex-shrink-0">
                    Admin
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                <p className="text-xs text-neutral-400 truncate">
                  {currentUser?.username ? `@${currentUser.username}` : (currentUser?.bio || 'Online')}
                </p>
              </div>
            </div>
          </div>

          {/* Right Action: Notification Setup, Settings & Super Admin Shield */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Super Admin Shield */}
            {(SUPER_ADMINS.includes((currentUser?.email || '').toLowerCase()) || currentUser?.role === 'admin') && (
              <button
                onClick={onOpenAdminModal}
                className="p-1.5 rounded-xl text-amber-400 hover:bg-neutral-800 transition-colors relative"
                title="Super Admin Dashboard"
              >
                <ShieldAlert className="w-4 h-4" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-amber-500 rounded-full animate-ping" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-amber-500 rounded-full" />
              </button>
            )}

            {/* Notification Setup Button (Single smart icon with live status indicator) */}
            <button
              onClick={() => {
                if (notificationStatus !== 'granted' && isNotificationSupported()) {
                  requestNotificationPermission().then((granted) => {
                    setNotificationStatus(granted ? 'granted' : 'denied');
                    if (granted) playNotificationSound();
                  });
                }
                onOpenNotificationSetup?.();
              }}
              className={`p-1.5 rounded-xl transition-colors relative ${
                notificationStatus === 'granted'
                  ? 'text-emerald-400 hover:bg-neutral-800'
                  : 'text-neutral-400 hover:text-amber-400 hover:bg-neutral-800'
              }`}
              title={
                notificationStatus === 'granted'
                  ? 'Notifications Active (Click to manage)'
                  : 'Notifications Off (Click to enable)'
              }
            >
              {notificationStatus === 'granted' ? (
                <>
                  <Bell className="w-4 h-4" />
                  <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-400" />
                </>
              ) : (
                <>
                  <BellOff className="w-4 h-4 text-neutral-400" />
                  <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                </>
              )}
            </button>

            {/* Profile Settings (Available for everyone) */}
            <button
              onClick={onOpenSettings}
              className="p-1.5 rounded-xl text-neutral-400 hover:text-emerald-400 hover:bg-neutral-800 transition-colors"
              title="Profile & Storage Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 2. Action Icons Toolbar */}
        <div className="flex items-center justify-between px-2 pt-2 border-t border-neutral-800/80 text-neutral-400">
          <button
            onClick={onOpenFriendModal}
            className="p-1.5 rounded-xl hover:text-emerald-400 hover:bg-neutral-800 transition-colors relative"
            title="Friends & Add Contacts"
          >
            <UserCheck className="w-4 h-4" />
            {pendingRequestsCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-emerald-500 rounded-full ring-2 ring-neutral-900 animate-ping" />
            )}
            {pendingRequestsCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-emerald-500 rounded-full ring-2 ring-neutral-900" />
            )}
          </button>

          <button
            onClick={onOpenCreateGroup}
            className="p-1.5 rounded-xl hover:text-emerald-400 hover:bg-neutral-800 transition-colors"
            title="Create New Group"
          >
            <Users className="w-4 h-4" />
          </button>

          <button
            onClick={onOpenCallLogs}
            className="p-1.5 rounded-xl hover:text-emerald-400 hover:bg-neutral-800 transition-colors"
            title="Call History"
          >
            <PhoneCall className="w-4 h-4" />
          </button>

          <button
            onClick={onLogout}
            className="p-1.5 rounded-xl hover:text-red-400 hover:bg-neutral-800 transition-colors"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs: Direct Chats (Friends) vs Groups */}
      <div className="flex p-1.5 mx-3 mt-3 bg-neutral-900 rounded-xl border border-neutral-800">
        <button
          onClick={() => setActiveTab('chats')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'chats'
              ? 'bg-neutral-800 text-white shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Friends ({users.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('groups')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'groups'
              ? 'bg-neutral-800 text-white shadow-sm'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Groups ({groups.length})</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="p-3 border-b border-neutral-800/80">
        <div className="relative flex items-center bg-neutral-800/80 border border-neutral-700/60 rounded-xl px-3 py-2 focus-within:border-emerald-500/80 transition-all">
          <Search className="w-4 h-4 text-neutral-400 mr-2 flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={activeTab === 'chats' ? 'Search friends...' : 'Search groups...'}
            className="w-full bg-transparent text-xs text-neutral-100 placeholder-neutral-400 focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-xs text-neutral-400 hover:text-white"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Main List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
        {isLoadingUsers ? (
          <SidebarSkeleton />
        ) : activeTab === 'chats' ? (
          filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-56 text-neutral-400 text-center px-4">
              <div className="w-12 h-12 rounded-2xl bg-neutral-800 flex items-center justify-center mb-3 text-neutral-500">
                <UserPlus className="w-6 h-6 stroke-[1.5]" />
              </div>
              <p className="text-xs font-semibold text-neutral-200 mb-1">
                {searchQuery ? 'No friends match your search' : 'No friends added yet'}
              </p>
              <p className="text-[11px] text-neutral-400 mb-4 max-w-[200px]">
                {searchQuery
                  ? 'Try a different search term or add them as a friend.'
                  : 'Send friend requests to start 1-to-1 conversations.'}
              </p>
              <button
                onClick={onOpenFriendModal}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors flex items-center gap-1.5 shadow-lg shadow-emerald-900/20"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Add Friends</span>
              </button>
            </div>
          ) : (
            filteredUsers.map((u) => (
              <UserItem
                key={u.id}
                user={u}
                isSelected={!selectedGroup && selectedUser?.id === u.id}
                onSelect={onSelectUser}
                currentUserId={currentUser?.id}
              />
            ))
          )
        ) : (
          /* GROUPS LIST */
          filteredGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-neutral-400 text-center px-4">
              <Users className="w-8 h-8 text-neutral-600 mb-2 stroke-[1.5]" />
              <p className="text-xs font-medium text-neutral-400">
                {searchQuery ? 'No groups match your search.' : 'No groups created yet.'}
              </p>
              <button
                onClick={onOpenCreateGroup}
                className="mt-3 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors"
              >
                + Create a Group
              </button>
            </div>
          ) : (
            filteredGroups.map((g) => (
              <GroupItem
                key={g.id}
                group={g}
                isSelected={selectedGroup?.id === g.id}
                onSelect={onSelectGroup}
                currentUserId={currentUser?.id}
              />
            ))
          )
        )}
      </div>
    </aside>
  );
};

interface GroupItemProps {
  group: Group;
  isSelected: boolean;
  onSelect: (group: Group) => void;
  currentUserId?: string;
}

const GroupItem: React.FC<GroupItemProps> = ({
  group,
  isSelected,
  onSelect,
  currentUserId,
}) => {
  const [decryptedText, setDecryptedText] = useState('');

  useEffect(() => {
    let isCancelled = false;
    const compute = async () => {
      if (!group.lastMessage?.content) {
        setDecryptedText('');
        return;
      }
      const raw = group.lastMessage.content;
      if (isEncrypted(raw) && currentUserId) {
        const convId = getConversationId(currentUserId, undefined, group.id);
        const plain = await decryptMessage(raw, convId);
        if (!isCancelled) setDecryptedText(plain);
      } else {
        if (!isCancelled) setDecryptedText(raw);
      }
    };
    compute();
    return () => {
      isCancelled = true;
    };
  }, [group.lastMessage?.content, group.id, currentUserId]);

  const preview =
    decryptedText ||
    (isEncrypted(group.lastMessage?.content)
      ? 'Encrypted message'
      : group.lastMessage?.content);

  return (
    <div
      onClick={() => onSelect(group)}
      className={`flex items-center gap-3 px-3 py-3 rounded-2xl cursor-pointer transition-all select-none ${
        isSelected
          ? 'bg-emerald-950/40 border border-emerald-800/40 text-white'
          : 'hover:bg-neutral-800/60 text-neutral-300'
      }`}
    >
      <div className="relative">
        <Avatar name={group.name} avatar={group.avatar} size="md" />
        <span className="absolute -bottom-1 -right-1 bg-emerald-700 text-white text-[9px] font-bold px-1 rounded-full">
          {group.members?.length || 0}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="font-medium text-sm text-neutral-100 truncate">
            {group.name}
          </span>
          {group.lastMessage?.timestamp && (
            <span className="text-[11px] text-neutral-400 font-mono flex-shrink-0">
              {new Date(group.lastMessage.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}
        </div>
        <p className="text-xs text-neutral-400 truncate mt-0.5">
          {group.lastMessage
            ? `${group.lastMessage.sender?.name ? group.lastMessage.sender.name + ': ' : ''}${preview || 'Attachment'}`
            : group.description || `${group.members?.length || 0} members`}
        </p>
      </div>
    </div>
  );
};
