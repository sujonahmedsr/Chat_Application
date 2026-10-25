'use client';

import React from 'react';
import {
  Flame,
  Users,
  Compass,
  ArrowUpRight,
  UserPlus,
  Quote,
} from 'lucide-react';
import { User } from '@/types';
import { Avatar } from '../ui/Avatar';

interface FeedWidgetsProps {
  onlineFriends: User[];
  onSelectTag?: (tag: string) => void;
  activeTag?: string | null;
  onStartChat: (user: User) => void;
  onOpenCreateGroup?: () => void;
  onOpenFriendModal?: () => void;
  isDarkMode?: boolean;
}

const DEFAULT_TRENDS = [
  { tag: '#WebRTC', postsCount: '124 posts' },
  { tag: '#NextJS', postsCount: '98 posts' },
  { tag: '#Security', postsCount: '76 posts' },
  { tag: '#AudioVideo', postsCount: '64 posts' },
  { tag: '#React', postsCount: '52 posts' },
];

export const FeedWidgets: React.FC<FeedWidgetsProps> = ({
  onlineFriends = [],
  onSelectTag,
  activeTag,
  onStartChat,
  onOpenCreateGroup,
  onOpenFriendModal,
  isDarkMode = true,
}) => {
  return (
    <aside className="w-80 flex-shrink-0 space-y-4 select-none">
      {/* 1. Trending Topics */}
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

        <div className="space-y-2">
          {DEFAULT_TRENDS.map((trend, idx) => {
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
                      {trend.postsCount}
                    </span>
                  </div>
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 opacity-60" />
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Online Now Contacts */}
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

      {/* 3. Quick Actions */}
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

      {/* 4. Community Inspiration Banner */}
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
