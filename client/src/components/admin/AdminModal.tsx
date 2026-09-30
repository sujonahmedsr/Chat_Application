'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Search,
  ShieldAlert,
  UserX,
  Trash2,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  LogOut,
  ToggleLeft,
  ToggleRight,
  Sparkles,
} from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Avatar } from '../ui/Avatar';
import { ConfirmModal } from '../ui/ConfirmModal';
import { User } from '@/types';

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUsersUpdated?: () => void;
  onLogout?: () => void;
}

interface AdminUser extends User {
  friendsCount?: number;
}

interface AdminStats {
  totalUsers: number;
  onlineCount: number;
  blockedCount: number;
}

const SUPER_ADMINS = [
  'shofiqul.sujon2201@gmail.com',
];

export const AdminModal: React.FC<AdminModalProps> = ({
  isOpen,
  onClose,
  onUsersUpdated,
  onLogout,
}) => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<AdminStats>({ totalUsers: 0, onlineCount: 0, blockedCount: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [confirmState, setConfirmState] = useState<{
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
    onConfirm: () => {},
  });

  const fetchAdminUsers = async () => {
    try {
      setIsLoading(true);
      const data = await apiRequest('/admin/users');
      setUsers(data.users || []);
      if (data.stats) {
        setStats(data.stats);
      }
    } catch (err: any) {
      console.error('Failed to load admin users:', err);
      setFeedback({ message: err.message || 'Failed to load user list', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchAdminUsers();
    }
  }, [isOpen]);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback(null), 3500);
  };

  const handleToggleBlock = (user: AdminUser) => {
    if (SUPER_ADMINS.includes((user.email || '').toLowerCase())) {
      showNotification('Cannot block Super Admin accounts', 'error');
      return;
    }

    const action = user.isBlockedByAdmin ? 'unblock' : 'block';
    setConfirmState({
      isOpen: true,
      title: `${user.isBlockedByAdmin ? 'Unblock' : 'Block'} User?`,
      description: `Are you sure you want to ${action} ${user.name}?`,
      confirmText: user.isBlockedByAdmin ? 'Unblock' : 'Block',
      isDanger: !user.isBlockedByAdmin,
      onConfirm: async () => {
        setConfirmState((prev) => ({ ...prev, isOpen: false }));
        try {
          setActionId(user.id);
          const res = await apiRequest(`/admin/users/${user.id}/toggle-block`, { method: 'POST' });
          setUsers((prev) =>
            prev.map((u) =>
              u.id === user.id ? { ...u, isBlockedByAdmin: res.user.isBlockedByAdmin } : u
            )
          );
          setStats((prev) => ({
            ...prev,
            blockedCount: res.user.isBlockedByAdmin
              ? prev.blockedCount + 1
              : Math.max(0, prev.blockedCount - 1),
          }));
          showNotification(res.message);
          onUsersUpdated?.();
        } catch (err: unknown) {
          showNotification(err instanceof Error ? err.message : 'Action failed', 'error');
        } finally {
          setActionId(null);
        }
      },
    });
  };

  const handleDeleteUser = (user: AdminUser) => {
    if (SUPER_ADMINS.includes((user.email || '').toLowerCase())) {
      showNotification('Cannot delete Super Admin accounts', 'error');
      return;
    }

    setConfirmState({
      isOpen: true,
      title: 'Delete User Account?',
      description: `PERMANENT ACTION: Delete user ${user.name} (${user.email})? All their messages and conversations will be wiped.`,
      confirmText: 'Delete User',
      isDanger: true,
      onConfirm: async () => {
        setConfirmState((prev) => ({ ...prev, isOpen: false }));
        try {
          setActionId(user.id);
          const res = await apiRequest(`/admin/users/${user.id}`, { method: 'DELETE' });
          setUsers((prev) => prev.filter((u) => u.id !== user.id));
          setStats((prev) => ({
            ...prev,
            totalUsers: Math.max(0, prev.totalUsers - 1),
            onlineCount: user.isOnline ? Math.max(0, prev.onlineCount - 1) : prev.onlineCount,
          }));
          showNotification(res.message);
          onUsersUpdated?.();
        } catch (err: unknown) {
          showNotification(err instanceof Error ? err.message : 'Failed to delete user', 'error');
        } finally {
          setActionId(null);
        }
      },
    });
  };

  if (!isOpen) return null;

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase().trim();
    return (
      (u.name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.username || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div className="relative w-full max-w-3xl bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-white">Super Admin Control Panel</h3>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold uppercase tracking-wider border border-amber-500/30">
                  Root
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Manage dummy user settings, block users, or delete accounts
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Refresh */}
            <button
              onClick={fetchAdminUsers}
              disabled={isLoading}
              className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              title="Refresh Users"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            {/* Logout Option for Super Admin */}
            {onLogout && (
              <button
                onClick={() => {
                  setConfirmState({
                    isOpen: true,
                    title: 'Super Admin Logout',
                    description: 'Are you sure you want to log out from Super Admin?',
                    confirmText: 'Logout',
                    isDanger: false,
                    onConfirm: () => {
                      setConfirmState((prev) => ({ ...prev, isOpen: false }));
                      onLogout();
                    },
                  });
                }}
                className="px-3 py-1.5 rounded-xl bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                title="Super Admin Logout"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Logout</span>
              </button>
            )}

            {/* Close */}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3 p-4 bg-neutral-950/40 border-b border-neutral-800/80">
          <div className="p-3 rounded-2xl bg-neutral-900/80 border border-neutral-800 text-center">
            <span className="text-xl font-bold text-white">{stats.totalUsers}</span>
            <p className="text-[11px] text-neutral-400">Total Users</p>
          </div>
          <div className="p-3 rounded-2xl bg-neutral-900/80 border border-neutral-800 text-center">
            <span className="text-xl font-bold text-emerald-400">{stats.onlineCount}</span>
            <p className="text-[11px] text-neutral-400">Online Now</p>
          </div>
          <div className="p-3 rounded-2xl bg-neutral-900/80 border border-neutral-800 text-center">
            <span className="text-xl font-bold text-rose-400">{stats.blockedCount}</span>
            <p className="text-[11px] text-neutral-400">Suspended / Blocked</p>
          </div>
        </div>

        {/* Feedback alert */}
        {feedback && (
          <div
            className={`mx-4 mt-3 p-3 rounded-2xl text-xs flex items-center gap-2 animate-in fade-in duration-150 ${
              feedback.type === 'success'
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle className="w-4 h-4 flex-shrink-0 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-400" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Search Input */}
        <div className="p-4 border-b border-neutral-800/80">
          <div className="flex items-center bg-neutral-800/60 rounded-xl px-3 py-2 border border-neutral-700/60 focus-within:border-amber-500">
            <Search className="w-4 h-4 text-neutral-400 mr-2 flex-shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search user by name, email, or username..."
              className="w-full bg-transparent text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none"
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

        {/* Users List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 custom-scrollbar">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-44 text-neutral-400 text-xs">
              <span className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mb-2" />
              Loading users list...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12 text-neutral-500 text-xs">
              No users found matching &quot;{searchQuery}&quot;
            </div>
          ) : (
            filteredUsers.map((u) => {
              const isSuper = SUPER_ADMINS.includes((u.email || '').toLowerCase());
              return (
                <div
                  key={u.id}
                  className={`p-3 sm:p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                    u.isBlockedByAdmin
                      ? 'bg-rose-950/20 border-rose-900/40'
                      : isSuper
                      ? 'bg-amber-950/15 border-amber-800/40'
                      : 'bg-neutral-900/60 border-neutral-800 hover:border-neutral-700'
                  }`}
                >
                  {/* User info */}
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar
                      name={u.name}
                      avatar={u.avatar}
                      size="md"
                      isOnline={u.isOnline}
                      showStatus={true}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-white truncate">{u.name}</span>
                        {isSuper && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/25 text-amber-300 border border-amber-500/40 flex-shrink-0">
                            Super Admin
                          </span>
                        )}
                        {u.isBlockedByAdmin && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/25 text-rose-300 border border-rose-500/40 flex-shrink-0">
                            Blocked
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-400 truncate">{u.email}</p>
                      {u.username && (
                        <p className="text-[11px] text-emerald-400 font-mono">@{u.username}</p>
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  {!isSuper ? (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Block / Unblock */}
                      <button
                        onClick={() => handleToggleBlock(u)}
                        disabled={actionId === u.id}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                          u.isBlockedByAdmin
                            ? 'bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600 hover:text-white border border-emerald-500/30'
                            : 'bg-amber-600/20 text-amber-300 hover:bg-amber-600 hover:text-white border border-amber-500/30'
                        }`}
                        title={u.isBlockedByAdmin ? 'Unblock user' : 'Suspend / Block user'}
                      >
                        <UserX className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">
                          {u.isBlockedByAdmin ? 'Unblock' : 'Block'}
                        </span>
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => handleDeleteUser(u)}
                        disabled={actionId === u.id}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-600/20 text-rose-300 hover:bg-rose-600 hover:text-white border border-rose-500/30 flex items-center gap-1.5 transition-all"
                        title="Permanently Delete User"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Delete</span>
                      </button>
                    </div>
                  ) : (
                    <div className="text-[11px] text-amber-400/80 font-mono px-2 py-1 bg-amber-500/10 rounded-lg border border-amber-500/20">
                      Protected
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        description={confirmState.description}
        confirmText={confirmState.confirmText}
        isDanger={confirmState.isDanger}
        isLoading={actionId !== null}
        onConfirm={confirmState.onConfirm}
        onClose={() => setConfirmState((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
