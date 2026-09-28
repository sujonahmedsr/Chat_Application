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
} from 'lucide-react';
import { User, Group } from '@/types';
import { Avatar } from '../ui/Avatar';
import { UserItem } from './UserItem';
import {
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  playNotificationSound,
} from '@/lib/notification';

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
  pendingRequestsCount,
  isLoadingUsers,
}) => {
  const [activeTab, setActiveTab] = useState<'chats' | 'groups'>('chats');
  const [searchQuery, setSearchQuery] = useState('');
  const [notificationStatus, setNotificationStatus] = useState<string>('default');

  useEffect(() => {
    if (isNotificationSupported()) {
      setNotificationStatus(getNotificationPermission());
    }
  }, []);

  const handleToggleNotification = async () => {
    if (!isNotificationSupported()) {
      alert('Desktop notifications are not supported in this browser.');
      return;
    }

    if (notificationStatus === 'granted') {
      // Test audio chime
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
      {/* Top Header */}
      <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar
            name={currentUser?.name || 'User'}
            avatar={currentUser?.avatar}
            size="md"
            isOnline={true}
            showStatus={true}
          />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-white truncate">
              {currentUser?.name}
            </h2>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <p className="text-xs text-emerald-400 font-medium">Online</p>
            </div>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-0.5 text-neutral-400">
          {/* Notifications toggle */}
          <button
            onClick={handleToggleNotification}
            className={`p-2 rounded-xl transition-colors relative ${
              notificationStatus === 'granted'
                ? 'text-emerald-400 hover:bg-neutral-800'
                : 'hover:text-amber-400 hover:bg-neutral-800'
            }`}
            title={
              notificationStatus === 'granted'
                ? 'Notifications Enabled (Click to test sound)'
                : 'Enable Browser & Sound Notifications'
            }
          >
            {notificationStatus === 'granted' ? (
              <Bell className="w-4.5 h-4.5" />
            ) : (
              <BellOff className="w-4.5 h-4.5 text-neutral-400" />
            )}
          </button>

          {/* Friends & Requests Modal */}
          <button
            onClick={onOpenFriendModal}
            className="p-2 rounded-xl hover:text-emerald-400 hover:bg-neutral-800 transition-colors relative"
            title="Friends & Add Contacts"
          >
            <UserCheck className="w-4.5 h-4.5" />
            {pendingRequestsCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-neutral-900 animate-ping" />
            )}
            {pendingRequestsCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-neutral-900" />
            )}
          </button>

          {/* Create Group */}
          <button
            onClick={onOpenCreateGroup}
            className="p-2 rounded-xl hover:text-emerald-400 hover:bg-neutral-800 transition-colors"
            title="Create New Group"
          >
            <Users className="w-4.5 h-4.5" />
          </button>

          {/* Super Admin Control Panel */}
          {(currentUser?.email === 'shofi@gmail.com' || currentUser?.role === 'admin') && (
            <button
              onClick={onOpenAdminModal}
              className="p-2 rounded-xl text-amber-400 hover:bg-neutral-800 transition-colors relative"
              title="Super Admin Dashboard"
            >
              <ShieldAlert className="w-4.5 h-4.5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-500 rounded-full animate-ping" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-500 rounded-full" />
            </button>
          )}

          {/* Call History */}
          <button
            onClick={onOpenCallLogs}
            className="p-2 rounded-xl hover:text-white hover:bg-neutral-800 transition-colors"
            title="Call History"
          >
            <PhoneCall className="w-4.5 h-4.5" />
          </button>

          {/* Logout */}
          <button
            onClick={onLogout}
            className="p-2 rounded-xl hover:text-red-400 hover:bg-neutral-800 transition-colors"
            title="Logout"
          >
            <LogOut className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>

      {/* Tabs: Direct Chats (Friends) vs Groups */}
      <div className="flex p-1.5 mx-3 mt-3 bg-neutral-850 rounded-xl border border-neutral-800">
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
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {isLoadingUsers ? (
          <div className="flex flex-col items-center justify-center h-48 text-neutral-400 text-xs">
            <span className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-2" />
            Loading friends...
          </div>
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
              <div
                key={g.id}
                onClick={() => onSelectGroup(g)}
                className={`flex items-center gap-3 px-3 py-3 rounded-2xl cursor-pointer transition-all select-none ${
                  selectedGroup?.id === g.id
                    ? 'bg-emerald-950/40 border border-emerald-800/40 text-white'
                    : 'hover:bg-neutral-800/60 text-neutral-300'
                }`}
              >
                <div className="relative">
                  <Avatar name={g.name} avatar={g.avatar} size="md" />
                  <span className="absolute -bottom-1 -right-1 bg-emerald-700 text-white text-[9px] font-bold px-1 rounded-full">
                    {g.members?.length || 0}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm text-neutral-100 truncate">
                      {g.name}
                    </span>
                    {g.lastMessage?.timestamp && (
                      <span className="text-[11px] text-neutral-400 font-mono flex-shrink-0">
                        {new Date(g.lastMessage.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-400 truncate mt-0.5">
                    {g.lastMessage
                      ? `${g.lastMessage.sender?.name ? g.lastMessage.sender.name + ': ' : ''}${g.lastMessage.content || 'Attachment'}`
                      : g.description || `${g.members?.length || 0} members`}
                  </p>
                </div>
              </div>
            ))
          )
        )}
      </div>
    </aside>
  );
};
