'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Search,
  Shield,
  ShieldAlert,
  UserX,
  Trash2,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Users,
} from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Avatar } from '../ui/Avatar';
import { User } from '@/types';

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUsersUpdated?: () => void;
}

interface AdminUser extends User {
  friendsCount?: number;
}

interface AdminStats {
  totalUsers: number;
  onlineCount: number;
  blockedCount: number;
}

export const AdminModal: React.FC<AdminModalProps> = ({
  isOpen,
  onClose,
  onUsersUpdated,
}) => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<AdminStats>({ totalUsers: 0, onlineCount: 0, blockedCount: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

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

  const handleToggleBlock = async (user: AdminUser) => {
    if (user.email === 'shofi@gmail.com') {
      showNotification('Cannot block Super Admin', 'error');
      return;
    }

    const action = user.isBlockedByAdmin ? 'unblock' : 'block';
    if (!confirm(`Are you sure you want to ${action} ${user.name}?`)) return;

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
    } catch (err: any) {
      showNotification(err.message || 'Action failed', 'error');
    } finally {
      setActionId(null);
    }
  };

  const handleDeleteUser = async (user: AdminUser) => {
    if (user.email === 'shofi@gmail.com') {
      showNotification('Cannot delete Super Admin', 'error');
      return;
    }

    if (!confirm(`PERMANENT ACTION: Delete user ${user.name} (${user.email})? All their messages and conversations will be wiped.`)) {
      return;
    }

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
    } catch (err: any) {
      showNotification(err.message || 'Failed to delete user', 'error');
    } finally {
      setActionId(null);
    }
  };

  if (!isOpen) return null;

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase().trim();
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
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
                Manage, block, or delete any user on Shofi Chat
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchAdminUsers}
              disabled={isLoading}
              className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
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
          <div className="p-3 rounded-2xl bg-neutral-850/80 border border-neutral-800 text-center">
            <span className="text-xl font-bold text-white">{stats.totalUsers}</span>
            <p className="text-[11px] text-neutral-400">Total Users</p>
          </div>
          <div className="p-3 rounded-2xl bg-neutral-850/80 border border-neutral-800 text-center">
            <span className="text-xl font-bold text-emerald-400">{stats.onlineCount}</span>
            <p className="text-[11px] text-neutral-400">Online Now</p>
          </div>
          <div className="p-3 rounded-2xl bg-neutral-850/80 border border-neutral-800 text-center">
            <span className="text-xl font-bold text-rose-400">{stats.blockedCount}</span>
            <p className="text-[11px] text-neutral-400">Suspended / Blocked</p>
          </div>
        </div>

        {/* Feedback alert */}
        {feedback && (
          <div
            className={`mx-4 mt-3 px-3.5 py-2.5 rounded-2xl text-xs flex items-center gap-2.5 ${
              feedback.type === 'error'
                ? 'bg-rose-950/70 border border-rose-800/80 text-rose-300'
                : 'bg-emerald-950/70 border border-emerald-800/80 text-emerald-300'
            }`}
          >
            {feedback.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            ) : (
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Search Bar */}
        <div className="p-3 sm:px-4 border-b border-neutral-800/70">
          <div className="relative">
            <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users by name or email..."
              className="w-full pl-10 pr-4 py-2 bg-neutral-800/80 border border-neutral-700/80 rounded-xl text-xs text-white placeholder-neutral-400 focus:outline-none focus:border-amber-500/80"
            />
          </div>
        </div>

        {/* Users Table / List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {isLoading && users.length === 0 ? (
            <div className="text-center py-12 text-neutral-400 text-xs">
              Loading user directory...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12 text-neutral-400 text-xs">
              No users found matching &quot;{searchQuery}&quot;
            </div>
          ) : (
            filteredUsers.map((u) => {
              const isSuper = u.email === 'shofi@gmail.com';

              return (
                <div
                  key={u.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-2xl border transition-all gap-3 ${
                    u.isBlockedByAdmin
                      ? 'bg-rose-950/20 border-rose-900/40 text-neutral-300'
                      : isSuper
                      ? 'bg-amber-950/20 border-amber-800/40 text-neutral-200'
                      : 'bg-neutral-850/60 border-neutral-800 text-neutral-200'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar name={u.name} avatar={u.avatar} size="md" isOnline={u.isOnline} showStatus={true} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-white truncate">{u.name}</span>
                        {isSuper && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold uppercase border border-amber-500/30">
                            Super Admin
                          </span>
                        )}
                        {u.isBlockedByAdmin && (
                          <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 text-[9px] font-bold uppercase border border-rose-500/30">
                            Suspended
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-400 truncate">{u.email}</p>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-neutral-500 font-mono">
                        <span>{u.isOnline ? '🟢 Online' : '⚪ Offline'}</span>
                        <span>•</span>
                        <span>{u.friendsCount || 0} friends</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions for this user */}
                  {!isSuper && (
                    <div className="flex items-center gap-2 self-end sm:self-center">
                      {/* Block / Unblock */}
                      <button
                        onClick={() => handleToggleBlock(u)}
                        disabled={actionId === u.id}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 ${
                          u.isBlockedByAdmin
                            ? 'bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white border border-emerald-500/30'
                            : 'bg-amber-600/20 text-amber-400 hover:bg-amber-600 hover:text-white border border-amber-500/30'
                        }`}
                        title={u.isBlockedByAdmin ? 'Unblock user' : 'Suspend user'}
                      >
                        <UserX className="w-3.5 h-3.5" />
                        <span>{u.isBlockedByAdmin ? 'Unblock' : 'Suspend'}</span>
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => handleDeleteUser(u)}
                        disabled={actionId === u.id}
                        className="px-3 py-1.5 rounded-xl text-xs font-medium bg-rose-600/20 text-rose-400 hover:bg-rose-600 hover:text-white border border-rose-500/30 transition-all flex items-center gap-1.5"
                        title="Permanently Delete User"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
