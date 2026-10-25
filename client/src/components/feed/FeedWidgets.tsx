'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Flame,
  Users,
  ArrowUpRight,
  UserPlus,
  Quote,
  UserCheck,
  Check,
  X,
  Loader2,
} from 'lucide-react';
import { User, Post } from '@/types';
import { Avatar } from '../ui/Avatar';
import { apiRequest } from '@/lib/api';
import { useSocket } from '@/context/SocketContext';

interface FeedWidgetsProps {
  onlineFriends: User[];
  posts?: Post[];
  onSelectTag?: (tag: string) => void;
  activeTag?: string | null;
  onStartChat: (user: User) => void;
  onOpenCreateGroup?: () => void;
  onOpenFriendModal?: () => void;
  onFriendUpdated?: () => void;
  isDarkMode?: boolean;
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

export const FeedWidgets: React.FC<FeedWidgetsProps> = ({
  onlineFriends = [],
  posts = [],
  onSelectTag,
  activeTag,
  onStartChat,
  onOpenCreateGroup,
  onOpenFriendModal,
  onFriendUpdated,
  isDarkMode = true,
}) => {
  const [requests, setRequests] = useState<FriendRequestItem[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<User[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const { socket } = useSocket();

  // 1. Fetch real pending friend requests
  const fetchRequests = useCallback(async () => {
    try {
      setLoadingRequests(true);
      const data = await apiRequest('/friends/requests');
      setRequests(data?.requests || []);

      // If no requests, fetch suggested users to find friends
      if (!data?.requests || data.requests.length === 0) {
        const searchData = await apiRequest('/friends/search');
        const discoverable = (searchData?.users || [])
          .filter((u: any) => !u.isFriend && !u.hasSentRequest && !u.hasReceivedRequest)
          .slice(0, 4);
        setSuggestedUsers(discoverable);
      }
    } catch (err) {
      console.error('Failed to load widget requests:', err);
    } finally {
      setLoadingRequests(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Listen to socket friend events for instant sync
  useEffect(() => {
    if (!socket) return;

    const handleReqReceived = (data: { from: User }) => {
      fetchRequests();
    };

    socket.on('friend:request:received', handleReqReceived);
    socket.on('friend:request:accepted', fetchRequests);
    socket.on('friend:request:rejected', fetchRequests);

    return () => {
      socket.off('friend:request:received', handleReqReceived);
      socket.off('friend:request:accepted', fetchRequests);
      socket.off('friend:request:rejected', fetchRequests);
    };
  }, [socket, fetchRequests]);

  // Accept request
  const handleAcceptRequest = async (userId: string) => {
    const targetId = extractId(userId);
    try {
      setActionLoadingId(targetId);
      // Optimistic removal
      setRequests((prev) => prev.filter((r) => extractId(r.from?.id || (r.from as any)?._id) !== targetId));
      await apiRequest(`/friends/accept/${targetId}`, { method: 'POST' });
      onFriendUpdated?.();
    } catch (err) {
      console.error('Failed to accept friend request:', err);
      fetchRequests();
    } finally {
      setActionLoadingId(null);
    }
  };

  // Reject / Delete request
  const handleRejectRequest = async (userId: string) => {
    const targetId = extractId(userId);
    try {
      setActionLoadingId(targetId);
      setRequests((prev) => prev.filter((r) => extractId(r.from?.id || (r.from as any)?._id) !== targetId));
      await apiRequest(`/friends/reject/${targetId}`, { method: 'POST' });
    } catch (err) {
      console.error('Failed to reject friend request:', err);
      fetchRequests();
    } finally {
      setActionLoadingId(null);
    }
  };

  // Send request to suggested user
  const handleSendRequest = async (userId: string) => {
    const targetId = extractId(userId);
    try {
      setActionLoadingId(targetId);
      setSuggestedUsers((prev) => prev.filter((u) => extractId(u.id || (u as any)._id) !== targetId));
      await apiRequest(`/friends/request/${targetId}`, { method: 'POST' });
    } catch (err) {
      console.error('Failed to send request:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  // 2. Real Trending Topics extracted dynamically from existing public posts (Zero dummy data!)
  const realTrendingTags = useMemo(() => {
    const tagCountMap: Record<string, number> = {};

    posts.forEach((post) => {
      if (post.privacy !== 'private' && Array.isArray(post.tags)) {
        post.tags.forEach((tag) => {
          if (tag) {
            const normalized = tag.startsWith('#') ? tag : `#${tag}`;
            tagCountMap[normalized] = (tagCountMap[normalized] || 0) + 1;
          }
        });
      }
    });

    return Object.entries(tagCountMap)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [posts]);

  return (
    <aside className="w-80 flex-shrink-0 space-y-4 select-none">
      {/* 1. Facebook Style "Friend Requests / Find Friends" Widget (Above Trending) */}
      <div
        className={`rounded-3xl p-4 sm:p-5 border shadow-sm transition-colors ${
          isDarkMode
            ? 'bg-neutral-900/80 border-neutral-800'
            : 'bg-white border-slate-200/90'
        }`}
      >
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-500">
              <UserCheck className="w-4 h-4" />
            </div>
            <h3
              className={`text-xs font-bold uppercase tracking-wider ${
                isDarkMode ? 'text-white' : 'text-slate-900'
              }`}
            >
              {requests.length > 0 ? 'Friend Requests' : 'Find Friends'}
            </h3>
          </div>

          {onOpenFriendModal && (
            <button
              onClick={onOpenFriendModal}
              className="text-xs font-semibold text-emerald-500 hover:text-emerald-400 hover:underline transition-colors"
            >
              See all
            </button>
          )}
        </div>

        {/* Requests List */}
        {requests.length > 0 ? (
          <div className="space-y-3">
            {requests.slice(0, 4).map((req) => {
              const fromUser = req.from;
              const fromId = extractId(fromUser?.id || (fromUser as any)?._id);
              const isLoading = actionLoadingId === fromId;

              return (
                <div
                  key={req._id || fromId}
                  className={`p-2.5 rounded-2xl border flex items-center justify-between gap-2.5 ${
                    isDarkMode
                      ? 'bg-neutral-950/60 border-neutral-800/80'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <Avatar
                      name={fromUser?.name || 'User'}
                      avatar={fromUser?.avatar}
                      size="md"
                    />
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-bold truncate leading-tight">
                        {fromUser?.name || 'User'}
                      </h4>
                      <p
                        className={`text-[10px] truncate mt-0.5 ${
                          isDarkMode ? 'text-neutral-400' : 'text-slate-500'
                        }`}
                      >
                        Sent you a request
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => handleAcceptRequest(fromId)}
                      className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold shadow-sm transition-all active:scale-95 flex items-center gap-1"
                      title="Confirm"
                    >
                      {isLoading ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <>
                          <Check className="w-3 h-3" />
                          <span>Confirm</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => handleRejectRequest(fromId)}
                      className={`p-1.5 rounded-xl transition-all ${
                        isDarkMode
                          ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-400'
                          : 'bg-slate-200 hover:bg-slate-300 text-slate-600'
                      }`}
                      title="Delete request"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : suggestedUsers.length > 0 ? (
          /* Suggested Users if no pending requests */
          <div className="space-y-2.5">
            <span
              className={`text-[10px] font-semibold block uppercase tracking-wider ${
                isDarkMode ? 'text-neutral-400' : 'text-slate-500'
              }`}
            >
              People you may know
            </span>
            {suggestedUsers.map((user) => {
              const uId = extractId(user.id || (user as any)._id);
              const isLoading = actionLoadingId === uId;

              return (
                <div
                  key={uId}
                  className={`p-2 rounded-xl flex items-center justify-between gap-2 ${
                    isDarkMode ? 'hover:bg-neutral-800/60' : 'hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Avatar name={user.name} avatar={user.avatar} size="sm" />
                    <span className="text-xs font-semibold truncate">{user.name}</span>
                  </div>

                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => handleSendRequest(uId)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-600/15 text-emerald-400 hover:bg-emerald-600 hover:text-white border border-emerald-500/20 text-[10px] font-bold transition-all"
                  >
                    {isLoading ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <>
                        <UserPlus className="w-3 h-3" />
                        <span>Add</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <p
            className={`text-xs text-center py-2 italic ${
              isDarkMode ? 'text-neutral-500' : 'text-slate-400'
            }`}
          >
            No pending friend requests
          </p>
        )}
      </div>

      {/* 2. REAL Trending Topics (Only real hashtags from actual posts, ZERO dummy data!) */}
      <div
        className={`rounded-3xl p-4 sm:p-5 border shadow-sm transition-colors ${
          isDarkMode
            ? 'bg-neutral-900/80 border-neutral-800'
            : 'bg-white border-slate-200/90'
        }`}
      >
        <div className="flex items-center gap-2 mb-3.5">
          <div className="p-1.5 rounded-xl bg-amber-500/10 text-amber-500">
            <Flame className="w-4 h-4" />
          </div>
          <h3
            className={`text-xs font-bold uppercase tracking-wider ${
              isDarkMode ? 'text-white' : 'text-slate-900'
            }`}
          >
            Trending Topics
          </h3>
        </div>

        {realTrendingTags.length > 0 ? (
          <div className="space-y-2">
            {realTrendingTags.map((trend, idx) => {
              const isSelected = activeTag === trend.tag;
              return (
                <button
                  key={trend.tag}
                  onClick={() => onSelectTag?.(isSelected ? '' : trend.tag)}
                  className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-all ${
                    isSelected
                      ? isDarkMode
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : isDarkMode
                      ? 'hover:bg-neutral-800/70 text-neutral-300'
                      : 'hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`text-[11px] font-bold w-4 text-center ${
                        isDarkMode ? 'text-neutral-500' : 'text-slate-400'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <div>
                      <span className="text-xs font-semibold block leading-tight">
                        {trend.tag}
                      </span>
                      <span
                        className={`text-[10px] ${
                          isDarkMode ? 'text-neutral-400' : 'text-slate-400'
                        }`}
                      >
                        {trend.count} {trend.count === 1 ? 'post' : 'posts'}
                      </span>
                    </div>
                  </div>
                  <ArrowUpRight className="w-3.5 h-3.5 opacity-60" />
                </button>
              );
            })}
          </div>
        ) : (
          <p
            className={`text-xs text-center py-3 italic leading-relaxed ${
              isDarkMode ? 'text-neutral-500' : 'text-slate-400'
            }`}
          >
            No hashtags trending yet. Use #hashtags in your posts to trend here!
          </p>
        )}
      </div>

      {/* 3. Online Now Contacts */}
      <div
        className={`rounded-3xl p-4 sm:p-5 border shadow-sm transition-colors ${
          isDarkMode
            ? 'bg-neutral-900/80 border-neutral-800'
            : 'bg-white border-slate-200/90'
        }`}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h3
              className={`text-xs font-bold uppercase tracking-wider ${
                isDarkMode ? 'text-white' : 'text-slate-900'
              }`}
            >
              Online Now
            </h3>
          </div>
          <span
            className={`text-[11px] font-medium ${
              isDarkMode ? 'text-neutral-400' : 'text-slate-500'
            }`}
          >
            {onlineFriends.length} Active
          </span>
        </div>

        {onlineFriends.length > 0 ? (
          <div className="flex items-center gap-2 flex-wrap pt-1">
            {onlineFriends.slice(0, 8).map((friend) => (
              <button
                key={friend.id}
                onClick={() => onStartChat(friend)}
                className="relative hover:scale-105 transition-transform"
                title={`Chat with ${friend.name}`}
              >
                <Avatar name={friend.name} avatar={friend.avatar} size="sm" />
                <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 border border-neutral-900" />
              </button>
            ))}
            {onlineFriends.length > 8 && (
              <span
                className={`text-[11px] font-semibold px-2 py-1 rounded-full ${
                  isDarkMode
                    ? 'bg-neutral-800 text-neutral-300'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                +{onlineFriends.length - 8}
              </span>
            )}
          </div>
        ) : (
          <p
            className={`text-[11px] italic py-1 ${
              isDarkMode ? 'text-neutral-500' : 'text-slate-400'
            }`}
          >
            No friends online at this moment
          </p>
        )}
      </div>

      {/* 4. Quick Actions */}
      <div
        className={`rounded-3xl p-4 sm:p-5 border shadow-sm transition-colors ${
          isDarkMode
            ? 'bg-neutral-900/80 border-neutral-800'
            : 'bg-white border-slate-200/90'
        }`}
      >
        <h3
          className={`text-xs font-bold uppercase tracking-wider mb-3 ${
            isDarkMode ? 'text-white' : 'text-slate-900'
          }`}
        >
          Quick Actions
        </h3>

        <div className="space-y-2">
          {onOpenCreateGroup && (
            <button
              onClick={onOpenCreateGroup}
              className={`w-full flex items-center gap-2.5 p-2 rounded-xl text-xs font-medium transition-colors ${
                isDarkMode
                  ? 'bg-neutral-850 hover:bg-neutral-800 text-neutral-200'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
              }`}
            >
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                <Users className="w-3.5 h-3.5" />
              </div>
              <span>Create New Group</span>
            </button>
          )}

          {onOpenFriendModal && (
            <button
              onClick={onOpenFriendModal}
              className={`w-full flex items-center gap-2.5 p-2 rounded-xl text-xs font-medium transition-colors ${
                isDarkMode
                  ? 'bg-neutral-850 hover:bg-neutral-800 text-neutral-200'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
              }`}
            >
              <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-400">
                <UserPlus className="w-3.5 h-3.5" />
              </div>
              <span>Find & Add Friends</span>
            </button>
          )}
        </div>
      </div>

      {/* 5. Community Inspiration Banner */}
      <div
        className={`rounded-3xl p-4 border relative overflow-hidden transition-colors ${
          isDarkMode
            ? 'bg-gradient-to-br from-emerald-950/30 to-neutral-900/80 border-emerald-900/30 text-neutral-300'
            : 'bg-gradient-to-br from-emerald-50/70 to-slate-50 border-emerald-100 text-slate-700'
        }`}
      >
        <Quote className="w-5 h-5 text-emerald-500/40 mb-2" />
        <p className="text-xs leading-relaxed italic">
          &quot;Better conversations build stronger, more collaborative communities.&quot;
        </p>
        <span className="block text-[10px] font-bold text-emerald-500 mt-2 uppercase tracking-wider">
          — Shofi Chat Community
        </span>
      </div>
    </aside>
  );
};
