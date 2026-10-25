'use client';

import React from 'react';
import { X, MessageSquare, UserPlus, Mail, ShieldCheck, Check } from 'lucide-react';
import { User } from '@/types';
import { Avatar } from '../ui/Avatar';

const SUPER_ADMINS = ['shofiqul.sujon2201@gmail.com'];

interface UserProfileModalProps {
  user: User | null;
  currentUser: User | null;
  onClose: () => void;
  onStartChat: (user: User) => void;
  onAddFriend?: (userId: string) => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  user,
  currentUser,
  onClose,
  onStartChat,
  onAddFriend,
}) => {
  if (!user) return null;

  const isSelf = String(user.id || (user as any)._id) === String(currentUser?.id);
  const isSuper = SUPER_ADMINS.includes((user.email || '').toLowerCase()) || user.role === 'admin';
  const isFriend = Boolean(user.isFriend || (currentUser?.friends as any[])?.some((f: any) => String(f?.id || f?._id || f) === String(user.id || (user as any)._id)));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden text-neutral-100 animate-in zoom-in-95 duration-200">
        {/* Glow ambient background */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-emerald-600/15 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Avatar & Online status */}
        <div className="flex flex-col items-center text-center mt-2">
          <div className="relative mb-3.5">
            <Avatar name={user.name} avatar={user.avatar} size="xl" />
            <span
              className={`absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-neutral-900 ${
                user.isOnline ? 'bg-emerald-500' : 'bg-neutral-600'
              }`}
              title={user.isOnline ? 'Online' : 'Offline'}
            />
          </div>

          <div className="flex items-center gap-1.5 mb-1">
            <h3 className="text-lg font-bold text-white tracking-tight">{user.name}</h3>
            {isSuper && (
              <span title="Verified Super Admin">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
              </span>
            )}
          </div>

          <p className="text-xs text-neutral-400 flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5 text-neutral-500" />
            <span>{user.email}</span>
          </p>

          {user.bio ? (
            <p className="text-xs text-neutral-300 mt-3 px-3 py-2 rounded-xl bg-neutral-800/60 border border-neutral-800 text-center leading-relaxed">
              &quot;{user.bio}&quot;
            </p>
          ) : (
            <p className="text-[11px] text-neutral-500 italic mt-2">No bio provided yet.</p>
          )}

          {/* User Status Badge */}
          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium bg-neutral-800/80 border border-neutral-700/60 text-neutral-300">
            <span
              className={`w-2 h-2 rounded-full ${
                user.isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-500'
              }`}
            />
            <span>{user.isOnline ? 'Online Now' : 'Offline'}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-col gap-2.5">
          {!isSelf && (
            <button
              onClick={() => {
                onClose();
                onStartChat(user);
              }}
              className="w-full py-2.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30 transition-all active:scale-[0.98]"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Send Message</span>
            </button>
          )}

          {!isSelf && onAddFriend && !isFriend && (
            <button
              onClick={() => {
                onAddFriend(user.id || (user as any)._id);
              }}
              className="w-full py-2.5 px-4 rounded-2xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium text-xs flex items-center justify-center gap-2 border border-neutral-700/80 transition-all active:scale-[0.98]"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add as Friend</span>
            </button>
          )}

          {!isSelf && isFriend && (
            <div className="w-full py-2 rounded-xl bg-emerald-950/30 border border-emerald-800/30 text-emerald-400 text-xs font-medium flex items-center justify-center gap-1.5">
              <Check className="w-3.5 h-3.5" />
              <span>Connected as Friend</span>
            </div>
          )}

          {isSelf && (
            <div className="w-full py-2 rounded-xl bg-neutral-800/50 text-neutral-400 text-xs text-center font-medium">
              This is your profile
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
