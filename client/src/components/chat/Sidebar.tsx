'use client';

import React, { useState } from 'react';
import { Search, LogOut, PhoneCall, MessageSquare, Users, UserPlus } from 'lucide-react';
import { User, Group } from '@/types';
import { Avatar } from '../ui/Avatar';
import { UserItem } from './UserItem';

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
  isLoadingUsers,
}) => {
  const [activeTab, setActiveTab] = useState<'chats' | 'groups'>('chats');
  const [searchQuery, setSearchQuery] = useState('');

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
            <p className="text-xs text-emerald-400 font-medium">Online</p>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1 text-neutral-400">
          <button
            onClick={onOpenCreateGroup}
            className="p-2 rounded-xl hover:text-emerald-400 hover:bg-neutral-800 transition-colors"
            title="Create New Group"
          >
            <UserPlus className="w-5 h-5" />
          </button>
          <button
            onClick={onOpenCallLogs}
            className="p-2 rounded-xl hover:text-white hover:bg-neutral-800 transition-colors"
            title="Call History"
          >
            <PhoneCall className="w-5 h-5" />
          </button>
          <button
            onClick={onLogout}
            className="p-2 rounded-xl hover:text-red-400 hover:bg-neutral-800 transition-colors"
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Tabs: Direct Chats vs Groups */}
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
          <span>Direct Chats ({users.length})</span>
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
            placeholder={activeTab === 'chats' ? 'Search contacts...' : 'Search groups...'}
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
            Loading...
          </div>
        ) : activeTab === 'chats' ? (
          filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-neutral-400 text-center px-4">
              <MessageSquare className="w-8 h-8 text-neutral-600 mb-2 stroke-[1.5]" />
              <p className="text-xs font-medium text-neutral-400">
                {searchQuery ? 'No contacts match your search.' : 'No other users registered yet.'}
              </p>
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
