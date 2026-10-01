'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { X, Search, UserCheck, UserPlus, Check, Clock, UserX, ShieldOff } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Avatar } from '../ui/Avatar';
import { User } from '@/types';
import { useSocket } from '@/context/SocketContext';

interface FriendModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFriendAdded?: () => void;
  pendingCount?: number;
  onRequestHandled?: () => void;
}

interface SearchUserResult extends User {
  isFriend: boolean;
  hasSentRequest: boolean;
  hasReceivedRequest: boolean;
  isBlockedByMe?: boolean;
  hasBlockedMe?: boolean;
  isBlocked?: boolean;
}

interface FriendRequestItem {
  _id: string;
  from: User;
  createdAt: string;
}

const extractId = (val: any): string => {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object') return String(val._id || val.id || '');
  return String(val);
};

export const FriendModal: React.FC<FriendModalProps> = ({
  isOpen,
  onClose,
  onFriendAdded,
  onRequestHandled,
}) => {
  const { socket } = useSocket();
  const [activeTab, setActiveTab] = useState<'requests' | 'search' | 'blocked'>('requests');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUserResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<FriendRequestItem[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<User[]>([]);
  const [isLoadingBlocked, setIsLoadingBlocked] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Fetch pending requests
  const fetchPendingRequests = useCallback(async () => {
    try {
      setIsLoadingRequests(true);
      const data = await apiRequest('/friends/requests');
      setPendingRequests(data.requests || []);
    } catch (err) {
      console.error('Failed to fetch requests:', err);
    } finally {
      setIsLoadingRequests(false);
    }
  }, []);

  // Fetch blocked users
  const fetchBlockedUsers = useCallback(async () => {
    try {
      setIsLoadingBlocked(true);
      const data = await apiRequest('/friends/blocked');
      setBlockedUsers(data.blockedUsers || []);
    } catch (err) {
      console.error('Failed to fetch blocked users:', err);
    } finally {
      setIsLoadingBlocked(false);
    }
  }, []);

  // Fetch users: returns all discoverable accounts if query is empty
  const fetchUsers = useCallback(async (query = '') => {
    try {
      setIsSearching(true);
      const url = query.trim()
        ? `/friends/search?q=${encodeURIComponent(query.trim())}`
        : '/friends/search';
      const data = await apiRequest(url);
      setSearchResults(data.users || []);
    } catch (err) {
      console.error('Failed searching users:', err);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Initial load when opened or tab changed
  useEffect(() => {
    if (isOpen) {
      fetchPendingRequests();
      if (activeTab === 'search') {
        fetchUsers(searchQuery);
      } else if (activeTab === 'blocked') {
        fetchBlockedUsers();
      }
    }
  }, [isOpen, activeTab, fetchPendingRequests, fetchBlockedUsers, fetchUsers, searchQuery]);

  // Real-time socket event listeners inside FriendModal (Zero Reload)
  useEffect(() => {
    if (!socket || !isOpen) return;

    // 1. Incoming friend request received
    const onFriendRequestReceived = (data: { from: User }) => {
      const fromId = extractId(data.from.id || (data.from as any)._id);
      setPendingRequests((prev) => {
        if (prev.some((r) => extractId(r.from.id || (r.from as any)._id) === fromId)) return prev;
        return [
          {
            _id: fromId,
            from: data.from,
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ];
      });

      // Update in search results
      setSearchResults((prev) =>
        prev.map((u) =>
          extractId(u.id || (u as any)._id) === fromId
            ? { ...u, hasReceivedRequest: true, hasSentRequest: false }
            : u
        )
      );
    };

    // 2. Sent friend request confirmation
    const onFriendRequestSent = (data: { to: User }) => {
      const toId = extractId(data.to?.id || (data.to as any)?._id);
      if (toId) {
        setSearchResults((prev) =>
          prev.map((u) =>
            extractId(u.id || (u as any)._id) === toId
              ? { ...u, hasSentRequest: true, hasReceivedRequest: false }
              : u
          )
        );
      }
    };

    // 3. Friend request accepted
    const onFriendRequestAccepted = (data: { friend: User }) => {
      const friendId = extractId(data.friend.id || (data.friend as any)._id);
      setPendingRequests((prev) =>
        prev.filter((r) => extractId(r.from.id || (r.from as any)._id) !== friendId)
      );
      setSearchResults((prev) =>
        prev.map((u) =>
          extractId(u.id || (u as any)._id) === friendId
            ? { ...u, isFriend: true, hasSentRequest: false, hasReceivedRequest: false }
            : u
        )
      );
      onFriendAdded?.();
    };

    // 4. Friend request rejected
    const onFriendRequestRejected = (data: { fromUserId: string }) => {
      const targetId = extractId(data.fromUserId);
      setPendingRequests((prev) =>
        prev.filter((r) => extractId(r.from.id || (r.from as any)._id) !== targetId)
      );
      setSearchResults((prev) =>
        prev.map((u) =>
          extractId(u.id || (u as any)._id) === targetId
            ? { ...u, hasSentRequest: false, hasReceivedRequest: false }
            : u
        )
      );
    };

    // 5. User blocked
    const onFriendBlocked = (data: { userId: string; blockedBy: string }) => {
      const targetId = extractId(data.userId);
      setPendingRequests((prev) =>
        prev.filter((r) => extractId(r.from.id || (r.from as any)._id) !== targetId)
      );
      setSearchResults((prev) =>
        prev.map((u) =>
          extractId(u.id || (u as any)._id) === targetId
            ? {
                ...u,
                isFriend: false,
                hasSentRequest: false,
                hasReceivedRequest: false,
                isBlockedByMe: data.blockedBy === 'self',
                hasBlockedMe: data.blockedBy === 'other',
                isBlocked: true,
              }
            : u
        )
      );
      fetchBlockedUsers();
    };

    // 6. User unblocked
    const onFriendUnblocked = (data: { userId: string }) => {
      const targetId = extractId(data.userId);
      setSearchResults((prev) =>
        prev.map((u) =>
          extractId(u.id || (u as any)._id) === targetId
            ? { ...u, isBlockedByMe: false, hasBlockedMe: false, isBlocked: false, isFriend: false }
            : u
        )
      );
      setBlockedUsers((prev) => prev.filter((u) => extractId(u.id || (u as any)._id) !== targetId));
    };

    socket.on('friend:request:received', onFriendRequestReceived);
    socket.on('friend:request:sent', onFriendRequestSent);
    socket.on('friend:request:accepted', onFriendRequestAccepted);
    socket.on('friend:request:rejected', onFriendRequestRejected);
    socket.on('friend:blocked', onFriendBlocked);
    socket.on('friend:unblocked', onFriendUnblocked);

    return () => {
      socket.off('friend:request:received', onFriendRequestReceived);
      socket.off('friend:request:sent', onFriendRequestSent);
      socket.off('friend:request:accepted', onFriendRequestAccepted);
      socket.off('friend:request:rejected', onFriendRequestRejected);
      socket.off('friend:blocked', onFriendBlocked);
      socket.off('friend:unblocked', onFriendUnblocked);
    };
  }, [socket, isOpen, fetchBlockedUsers, onFriendAdded]);

  // Handle Search input debounce
  useEffect(() => {
    if (!isOpen || activeTab !== 'search') return;
    const timer = setTimeout(() => {
      fetchUsers(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, isOpen, activeTab, fetchUsers]);

  // Send friend request with INSTANT optimistic update
  const handleSendRequest = async (userId: string) => {
    const targetId = extractId(userId);
    try {
      setActionLoadingId(targetId);

      // Instant optimistic UI update: button immediately switches to "Pending"
      setSearchResults((prev) =>
        prev.map((u) =>
          extractId(u.id || (u as any)._id) === targetId
            ? { ...u, hasSentRequest: true, hasReceivedRequest: false }
            : u
        )
      );

      await apiRequest(`/friends/request/${targetId}`, { method: 'POST' });
      setFeedback('Friend request sent!');
      setTimeout(() => setFeedback(null), 3000);
      onRequestHandled?.();
    } catch (err: any) {
      // Revert if error
      setSearchResults((prev) =>
        prev.map((u) =>
          extractId(u.id || (u as any)._id) === targetId
            ? { ...u, hasSentRequest: false }
            : u
        )
      );
      setFeedback(err.message || 'Failed to send request');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Unblock user from search list
  const handleUnblock = async (userId: string) => {
    const targetId = extractId(userId);
    try {
      setActionLoadingId(targetId);
      await apiRequest(`/friends/unblock/${targetId}`, { method: 'POST' });
      setSearchResults((prev) =>
        prev.map((u) =>
          extractId(u.id || (u as any)._id) === targetId
            ? { ...u, isBlockedByMe: false, isBlocked: false, isFriend: false }
            : u
        )
      );
      setBlockedUsers((prev) => prev.filter((u) => extractId(u.id || (u as any)._id) !== targetId));
      setFeedback('User unblocked! You can send a friend request to connect again.');
      setTimeout(() => setFeedback(null), 3000);
      onFriendAdded?.();
      onRequestHandled?.();
    } catch (err: any) {
      setFeedback(err.message || 'Failed to unblock user');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Unblock user from dedicated Blocked tab
  const handleUnblockFromBlockedTab = async (userId: string) => {
    const targetId = extractId(userId);
    try {
      setActionLoadingId(targetId);
      await apiRequest(`/friends/unblock/${targetId}`, { method: 'POST' });
      setBlockedUsers((prev) => prev.filter((u) => extractId(u.id || (u as any)._id) !== targetId));
      setSearchResults((prev) =>
        prev.map((u) =>
          extractId(u.id || (u as any)._id) === targetId
            ? { ...u, isBlockedByMe: false, isBlocked: false, isFriend: false }
            : u
        )
      );
      setFeedback('User unblocked! They are now discoverable in Find Friends.');
      setTimeout(() => setFeedback(null), 3000);
      onFriendAdded?.();
      onRequestHandled?.();
    } catch (err: any) {
      setFeedback(err.message || 'Failed to unblock user');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Accept friend request
  const handleAccept = async (userId: string) => {
    const targetId = extractId(userId);
    try {
      setActionLoadingId(targetId);
      await apiRequest(`/friends/accept/${targetId}`, { method: 'POST' });
      setPendingRequests((prev) =>
        prev.filter((r) => extractId(r.from.id || (r.from as any)._id) !== targetId)
      );
      setSearchResults((prev) =>
        prev.map((u) =>
          extractId(u.id || (u as any)._id) === targetId
            ? { ...u, isFriend: true, hasReceivedRequest: false, hasSentRequest: false }
            : u
        )
      );
      setFeedback('Friend request accepted!');
      setTimeout(() => setFeedback(null), 3000);
      onFriendAdded?.();
      onRequestHandled?.();
    } catch (err: any) {
      setFeedback(err.message || 'Failed to accept request');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Reject friend request
  const handleReject = async (userId: string) => {
    const targetId = extractId(userId);
    try {
      setActionLoadingId(targetId);
      await apiRequest(`/friends/reject/${targetId}`, { method: 'POST' });
      setPendingRequests((prev) =>
        prev.filter((r) => extractId(r.from.id || (r.from as any)._id) !== targetId)
      );
      setSearchResults((prev) =>
        prev.map((u) =>
          extractId(u.id || (u as any)._id) === targetId
            ? { ...u, hasReceivedRequest: false, hasSentRequest: false }
            : u
        )
      );
      onRequestHandled?.();
    } catch (err: any) {
      setFeedback(err.message || 'Failed to decline request');
    } finally {
      setActionLoadingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-white">Friends & Contacts</h3>
            <p className="text-xs text-neutral-400">Manage friends, requests, and blocked users</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switchers */}
        <div className="flex border-b border-neutral-800 px-4 pt-2 gap-4">
          <button
            onClick={() => setActiveTab('requests')}
            className={`pb-2.5 text-xs font-semibold relative transition-colors ${
              activeTab === 'requests'
                ? 'text-emerald-400 border-b-2 border-emerald-500'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Friend Requests
            {pendingRequests.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 rounded-full text-[10px] font-bold">
                {pendingRequests.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={`pb-2.5 text-xs font-semibold relative transition-colors ${
              activeTab === 'search'
                ? 'text-emerald-400 border-b-2 border-emerald-500'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Find New Friends
          </button>
          <button
            onClick={() => {
              setActiveTab('blocked');
              fetchBlockedUsers();
            }}
            className={`pb-2.5 text-xs font-semibold relative transition-colors ${
              activeTab === 'blocked'
                ? 'text-rose-400 border-b-2 border-rose-500'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Blocked Users
            {blockedUsers.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.2 bg-rose-500/20 text-rose-300 rounded-full text-[10px] font-bold">
                {blockedUsers.length}
              </span>
            )}
          </button>
        </div>

        {feedback && (
          <div className="mx-4 mt-3 px-3 py-2 rounded-xl bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 flex-shrink-0" />
            <span>{feedback}</span>
          </div>
        )}

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {activeTab === 'requests' ? (
            isLoadingRequests ? (
              <div className="text-center py-8 text-neutral-500 text-xs">
                Checking pending requests...
              </div>
            ) : pendingRequests.length === 0 ? (
              <div className="text-center py-10 px-4 text-neutral-400">
                <div className="w-12 h-12 rounded-2xl bg-neutral-800/80 flex items-center justify-center mx-auto mb-3 text-neutral-500">
                  <UserCheck className="w-6 h-6 stroke-[1.5]" />
                </div>
                <p className="text-sm font-medium text-neutral-200">No pending requests</p>
                <p className="text-xs text-neutral-500 mt-1">
                  When someone adds you on Shofi Chat, their request will appear here.
                </p>
                <button
                  onClick={() => setActiveTab('search')}
                  className="mt-4 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all shadow-lg shadow-emerald-900/20"
                >
                  Find Friends to Add
                </button>
              </div>
            ) : (
              pendingRequests.map((req) => {
                const reqUserId = extractId(req.from.id || (req.from as any)._id);
                return (
                  <div
                    key={req._id || reqUserId}
                    className="flex items-center justify-between p-3 rounded-2xl bg-neutral-800/50 border border-neutral-800"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar name={req.from.name} avatar={req.from.avatar} size="md" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{req.from.name}</p>
                        <p className="text-xs text-neutral-400 truncate">{req.from.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleAccept(reqUserId)}
                        disabled={actionLoadingId === reqUserId}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors flex items-center gap-1 shadow-sm"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Accept</span>
                      </button>
                      <button
                        onClick={() => handleReject(reqUserId)}
                        disabled={actionLoadingId === reqUserId}
                        className="p-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-red-400 transition-colors"
                        title="Decline"
                      >
                        <UserX className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )
          ) : activeTab === 'blocked' ? (
            /* BLOCKED USERS TAB */
            isLoadingBlocked ? (
              <div className="text-center py-8 text-neutral-500 text-xs">
                Loading blocked users...
              </div>
            ) : blockedUsers.length === 0 ? (
              <div className="text-center py-10 px-4 text-neutral-400">
                <div className="w-12 h-12 rounded-2xl bg-neutral-800/80 flex items-center justify-center mx-auto mb-3 text-neutral-500">
                  <ShieldOff className="w-6 h-6 stroke-[1.5]" />
                </div>
                <p className="text-sm font-medium text-neutral-200">No blocked users</p>
                <p className="text-xs text-neutral-500 mt-1">
                  Users you block will appear here. They cannot message or call you.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {blockedUsers.map((user) => {
                  const uid = extractId(user.id || (user as any)._id);
                  return (
                    <div
                      key={uid}
                      className="flex items-center justify-between p-3 rounded-2xl bg-neutral-800/40 border border-neutral-800/70"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar name={user.name} avatar={user.avatar} size="md" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate">{user.name}</p>
                          <p className="text-xs text-neutral-400 truncate">{user.email}</p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleUnblockFromBlockedTab(uid)}
                        disabled={actionLoadingId === uid}
                        className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white text-xs font-semibold transition-colors flex items-center gap-1.5 border border-neutral-700/60 shadow-sm"
                      >
                        <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Unblock</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            /* SEARCH TAB */
            <div>
              <div className="relative mb-3">
                <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-neutral-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name or email..."
                  className="w-full pl-10 pr-4 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-xs text-white placeholder-neutral-400 focus:outline-none focus:border-emerald-500 transition-colors"
                  autoFocus
                />
              </div>

              {isSearching ? (
                <div className="text-center py-6 text-neutral-500 text-xs">Searching users...</div>
              ) : searchResults.length === 0 ? (
                <div className="text-center py-8 text-neutral-400 text-xs">
                  {searchQuery ? `No users found matching "${searchQuery}"` : 'No other users registered on Shofi Chat yet.'}
                </div>
              ) : (
                <div className="space-y-2">
                  {searchResults.map((user) => {
                    const uid = extractId(user.id || (user as any)._id);
                    return (
                      <div
                        key={uid}
                        className="flex items-center justify-between p-3 rounded-2xl bg-neutral-800/40 border border-neutral-800/70"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar name={user.name} avatar={user.avatar} size="md" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-white truncate">{user.name}</p>
                            <p className="text-xs text-neutral-400 truncate">
                              {user.username ? `@${user.username}` : user.email}
                            </p>
                          </div>
                        </div>

                        <div>
                          {user.isBlockedByMe ? (
                            <div className="flex items-center gap-1.5">
                              <span className="inline-flex items-center text-[11px] text-red-400 font-medium px-2 py-0.5 bg-red-950/40 rounded-lg border border-red-800/30">
                                Blocked
                              </span>
                              <button
                                onClick={() => handleUnblock(uid)}
                                disabled={actionLoadingId === uid}
                                className="px-2.5 py-1 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white text-xs font-medium transition-colors"
                              >
                                Unblock
                              </button>
                            </div>
                          ) : user.hasBlockedMe ? (
                            <span className="text-[11px] text-neutral-500 font-medium px-2 py-0.5 bg-neutral-800/50 rounded-lg">
                              Unavailable
                            </span>
                          ) : user.isFriend ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium px-2.5 py-1 bg-emerald-950/40 rounded-lg border border-emerald-800/30">
                              <Check className="w-3 h-3" />
                              Friends
                            </span>
                          ) : user.hasSentRequest ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-amber-400 font-medium px-2.5 py-1 bg-amber-950/40 rounded-lg border border-amber-800/30">
                              <Clock className="w-3 h-3 animate-spin" style={{ animationDuration: '4s' }} />
                              Pending
                            </span>
                          ) : user.hasReceivedRequest ? (
                            <button
                              onClick={() => handleAccept(uid)}
                              disabled={actionLoadingId === uid}
                              className="px-2.5 py-1.2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors"
                            >
                              Accept
                            </button>
                          ) : (
                            <button
                              onClick={() => handleSendRequest(uid)}
                              disabled={actionLoadingId === uid}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-emerald-600 text-neutral-200 hover:text-white text-xs font-medium transition-all"
                            >
                              <UserPlus className="w-3.5 h-3.5" />
                              <span>Add</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
