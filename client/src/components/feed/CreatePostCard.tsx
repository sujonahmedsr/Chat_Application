'use client';

import React, { useState } from 'react';
import { Image as ImageIcon, Heading, Hash, Smile } from 'lucide-react';
import { User, Post } from '@/types';
import { Avatar } from '../ui/Avatar';
import { CreatePostModal } from './CreatePostModal';

interface CreatePostCardProps {
  currentUser: User | null;
  onPostCreated: (post: Post) => void;
  isDarkMode?: boolean;
}

export const CreatePostCard: React.FC<CreatePostCardProps> = ({
  currentUser,
  onPostCreated,
  isDarkMode = true,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const firstName = currentUser?.name?.split(' ')[0] || 'Friend';

  return (
    <>
      <div
        className={`w-full rounded-3xl p-4 sm:p-5 shadow-sm border transition-all ${
          isDarkMode
            ? 'bg-neutral-900/90 border-neutral-800 text-white'
            : 'bg-white border-slate-200/90 text-slate-900'
        }`}
      >
        {/* Facebook Style Prompt Bar */}
        <div className="flex items-center gap-3">
          <Avatar
            name={currentUser?.name || 'User'}
            avatar={currentUser?.avatar}
            size="md"
          />

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className={`flex-1 rounded-full py-2.5 px-4 sm:px-5 text-left text-xs sm:text-sm font-medium transition-all border ${
              isDarkMode
                ? 'bg-neutral-950/70 border-neutral-800 text-neutral-400 hover:bg-neutral-800/80 hover:text-neutral-200'
                : 'bg-slate-100/80 border-slate-200 text-slate-500 hover:bg-slate-200/70 hover:text-slate-800'
            }`}
          >
            What&apos;s on your mind, {firstName}?
          </button>
        </div>

        {/* Quick Action Triggers Bar (Facebook style) */}
        <div
          className={`flex items-center justify-around mt-3.5 pt-3 border-t ${
            isDarkMode ? 'border-neutral-800/80' : 'border-slate-100'
          }`}
        >
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className={`flex-1 flex items-center justify-center gap-2 py-1.5 px-2 rounded-xl text-xs font-semibold transition-colors ${
              isDarkMode
                ? 'hover:bg-neutral-800 text-neutral-300'
                : 'hover:bg-slate-100 text-slate-600'
            }`}
          >
            <ImageIcon className="w-4 h-4 text-emerald-500" />
            <span className="hidden xs:inline sm:inline">Photo / Image</span>
          </button>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className={`flex-1 flex items-center justify-center gap-2 py-1.5 px-2 rounded-xl text-xs font-semibold transition-colors ${
              isDarkMode
                ? 'hover:bg-neutral-800 text-neutral-300'
                : 'hover:bg-slate-100 text-slate-600'
            }`}
          >
            <Heading className="w-4 h-4 text-indigo-400" />
            <span className="hidden xs:inline sm:inline">Blog Title</span>
          </button>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className={`flex-1 flex items-center justify-center gap-2 py-1.5 px-2 rounded-xl text-xs font-semibold transition-colors ${
              isDarkMode
                ? 'hover:bg-neutral-800 text-neutral-300'
                : 'hover:bg-slate-100 text-slate-600'
            }`}
          >
            <Hash className="w-4 h-4 text-teal-400" />
            <span className="hidden xs:inline sm:inline">Hashtags</span>
          </button>
        </div>
      </div>

      {/* Facebook Style Post Creation Popup Modal */}
      <CreatePostModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        currentUser={currentUser}
        onPostCreated={onPostCreated}
        isDarkMode={isDarkMode}
      />
    </>
  );
};
