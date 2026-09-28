'use client';

import React, { useState, useEffect } from 'react';
import { X, Search, UserCheck, UserPlus, Check, Clock, UserX, AlertCircle } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Avatar } from '../ui/Avatar';
import { User } from '@/types';

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
}

interface FriendRequestItem {
  _id: string;
  from: User;
  createdAt: string;
}

export const FriendModal: React.FC<FriendModalProps> = ({
  isOpen,
  onClose,
  onFriendAdded,
  onRequestHandled,
}) => {
  const [activeTab, setActiveTab] = useState<'requests' | 'search'>('requests');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUserResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<FriendRequestItem[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Fetch pending requests
  const fetchPendingRequests = async () => {
    try {
      setIsLoadingRequests(true);
      const data = await apiRequest('/friends/requests');
      setPendingRequests(data.requests || []);
    } catch (err) {
      console.error('Failed to fetch requests:', err);
    } finally {
      setIsLoadingRequests(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchPendingRequests();
    }
  }, [isOpen]);

  // Handle Search
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        return;
      }

      try {
        setIsSearching(true);
        const data = await apiRequest(`/friends/search?q=${encodeURIComponent(searchQuery.trim())}`);
        setSearchResults(data.users || []);
      } catch (err) {
        console.error('Failed searching users:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Send friend request
  const handleSendRequest = async (userId: string) => {
    try {
      setActionLoadingId(userId);
      await apiRequest(`/friends/request/${userId}`, { method: 'POST' });
      setSearchResults((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, hasSentRequest: true } : u))
      );
      setFeedback('Friend request sent!');
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      setFeedback(err.message || 'Failed to send request');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Accept friend request
  const handleAccept = async (userId: string) => {
    try {
      setActionLoadingId(userId);
      await apiRequest(`/friends/accept/${userId}`, { method: 'POST' });
      setPendingRequests((prev) => prev.filter((r) => r.from.id !== userId));
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
    try {
      setActionLoadingId(userId);
      await apiRequest(`/friends/reject/${userId}`, { method: 'POST' });
      setPendingRequests((prev) => prev.filter((r) => r.from.id !== userId));
      onRequestHandled?.();
    } catch (err: any) {
      setFeedback(err.message || 'Failed to decline request');
    } finally {
      setActionLoadingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-white">Friends & Contacts</h3>
            <p className="text-xs text-neutral-400">Connect with people on Shofi Chat</p>
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
              <span className="ml-1.5 px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 rounded-full text-[10px]">
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
              pendingRequests.map((req) => (
                <div
                  key={req._id}
                  className="flex items-center justify-between p-3 rounded-2xl bg-neutral-800/50 border border-neutral-750"
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
                      onClick={() => handleAccept(req.from.id)}
                      disabled={actionLoadingId === req.from.id}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Accept</span>
                    </button>
                    <button
                      onClick={() => handleReject(req.from.id)}
                      disabled={actionLoadingId === req.from.id}
                      className="p-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-red-400 transition-colors"
                      title="Decline"
                    >
                      <UserX className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
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
                <div className="text-center py-6 text-neutral-500 text-xs">Searching...</div>
              ) : searchResults.length === 0 ? (
                searchQuery ? (
                  <div className="text-center py-8 text-neutral-400 text-xs">
                    No users found matching &quot;{searchQuery}&quot;
                  </div>
                ) : (
                  <div className="text-center py-8 text-neutral-500 text-xs">
                    Type a name or email address above to find users.
                  </div>
                )
              ) : (
                <div className="space-y-2">
                  {searchResults.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-3 rounded-2xl bg-neutral-800/40 border border-neutral-750/70"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar name={user.name} avatar={user.avatar} size="md" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate">{user.name}</p>
                          <p className="text-xs text-neutral-400 truncate">{user.email}</p>
                        </div>
                      </div>

                      <div>
                        {user.isFriend ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium px-2 py-1 bg-emerald-950/40 rounded-lg border border-emerald-800/30">
                            <Check className="w-3 h-3" />
                            Friends
                          </span>
                        ) : user.hasSentRequest ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-amber-400 font-medium px-2 py-1 bg-amber-950/40 rounded-lg border border-amber-800/30">
                            <Clock className="w-3 h-3" />
                            Pending
                          </span>
                        ) : user.hasReceivedRequest ? (
                          <button
                            onClick={() => handleAccept(user.id)}
                            className="px-2.5 py-1.2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors"
                          >
                            Accept
                          </button>
                        ) : (
                          <button
                            onClick={() => handleSendRequest(user.id)}
                            disabled={actionLoadingId === user.id}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-emerald-600 text-neutral-200 hover:text-white text-xs font-medium transition-all"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>Add</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
