'use client';

import React, { useState } from 'react';
import {
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Trash2,
  ShieldCheck,
  MoreVertical,
  ExternalLink,
} from 'lucide-react';
import { Post, User } from '@/types';
import { Avatar } from '../ui/Avatar';

const SUPER_ADMINS = ['shofiqul.sujon2201@gmail.com'];

interface PostCardProps {
  post: Post;
  currentUser: User | null;
  onLike: (postId: string) => void;
  onDislike: (postId: string) => void;
  onDelete: (postId: string) => void;
  onStartChat: (user: User) => void;
  onOpenProfile: (user: User) => void;
  onOpenImageLightbox: (imageUrl: string) => void;
}

export const PostCard: React.FC<PostCardProps> = ({
  post,
  currentUser,
  onLike,
  onDislike,
  onDelete,
  onStartChat,
  onOpenProfile,
  onOpenImageLightbox,
}) => {
  const [showMenu, setShowMenu] = useState(false);

  const author = post.author;
  const authorId = author ? String(author.id || (author as any)._id) : '';
  const currentUserId = currentUser ? String(currentUser.id || (currentUser as any)._id) : '';

  const isAuthor = authorId === currentUserId;
  const isSuper =
    SUPER_ADMINS.includes((currentUser?.email || '').toLowerCase()) ||
    currentUser?.role === 'admin';
  const canDelete = isAuthor || isSuper;

  const isAuthorSuperAdmin =
    SUPER_ADMINS.includes((author?.email || '').toLowerCase()) ||
    author?.role === 'admin';

  const formatTimestamp = (isoStr: string) => {
    try {
      const date = new Date(isoStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  return (
    <div className="w-full bg-neutral-900/80 hover:bg-neutral-900 border border-neutral-800 rounded-3xl p-4 sm:p-5 shadow-lg backdrop-blur-md transition-all text-neutral-100 relative group">
      {/* Header: Author Info */}
      <div className="flex items-center justify-between mb-3">
        <div
          onClick={() => author && onOpenProfile(author)}
          className="flex items-center gap-3 cursor-pointer group/author"
        >
          <div className="relative">
            <Avatar
              name={author?.name || 'User'}
              avatar={author?.avatar}
              size="md"
            />
            {author?.isOnline && (
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-neutral-900" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <h4 className="text-xs sm:text-sm font-bold text-white group-hover/author:text-emerald-400 transition-colors">
                {author?.name || 'Anonymous User'}
              </h4>
              {isAuthorSuperAdmin && (
                <span title="Verified Super Admin">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                </span>
              )}
            </div>
            <p className="text-[11px] text-neutral-500">
              {formatTimestamp(post.createdAt)}
            </p>
          </div>
        </div>

        {/* Post Options Menu */}
        <div className="relative">
          {canDelete && (
            <button
              onClick={() => setShowMenu((prev) => !prev)}
              className="p-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              title="Post Options"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          )}

          {showMenu && canDelete && (
            <div className="absolute right-0 top-8 z-20 w-36 bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl py-1.5 animate-in fade-in zoom-in-95">
              <button
                onClick={() => {
                  setShowMenu(false);
                  onDelete(post.id);
                }}
                className="w-full px-3 py-2 text-left text-xs text-rose-400 hover:bg-rose-500/10 flex items-center gap-2 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Post</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Content Text */}
      <p className="text-xs sm:text-sm text-neutral-200 leading-relaxed whitespace-pre-wrap break-words mb-3 select-text">
        {post.content}
      </p>

      {/* Post Image (Clickable Lightbox) */}
      {post.imageUrl && (
        <div
          onClick={() => onOpenImageLightbox(post.imageUrl!)}
          className="relative mb-3.5 rounded-2xl overflow-hidden bg-neutral-950/80 border border-neutral-800 cursor-pointer group/img"
        >
          <img
            src={post.imageUrl}
            alt="Post media"
            loading="lazy"
            className="w-full max-h-[460px] object-cover group-hover/img:scale-[1.01] transition-transform duration-300"
          />
          <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/20 flex items-center justify-center transition-all opacity-0 group-hover/img:opacity-100">
            <span className="px-3 py-1.5 rounded-full bg-black/70 backdrop-blur-md text-[11px] font-medium text-white flex items-center gap-1.5 shadow-lg">
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Click to view full photo</span>
            </span>
          </div>
        </div>
      )}

      {/* Bottom Action Bar: Like, Dislike, and Message Author */}
      <div className="flex items-center justify-between pt-2.5 border-t border-neutral-800/80">
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* LIKE BUTTON */}
          <button
            onClick={() => onLike(post.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95 ${
              post.isLiked
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm'
                : 'bg-neutral-800/60 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 border border-neutral-700/40'
            }`}
            title="Like"
          >
            <ThumbsUp
              className={`w-3.5 h-3.5 ${post.isLiked ? 'fill-emerald-400' : ''}`}
            />
            <span>{post.likesCount || 0}</span>
          </button>

          {/* DISLIKE BUTTON */}
          <button
            onClick={() => onDislike(post.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95 ${
              post.isDisliked
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-sm'
                : 'bg-neutral-800/60 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 border border-neutral-700/40'
            }`}
            title="Dislike"
          >
            <ThumbsDown
              className={`w-3.5 h-3.5 ${post.isDisliked ? 'fill-rose-400' : ''}`}
            />
            <span>{post.dislikesCount || 0}</span>
          </button>
        </div>

        {/* CHAT / MESSAGE AUTHOR BUTTON */}
        {!isAuthor && author && (
          <button
            onClick={() => onStartChat(author)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-800/80 hover:bg-emerald-600 text-neutral-300 hover:text-white text-xs font-medium border border-neutral-700/60 hover:border-emerald-500/50 shadow-sm transition-all active:scale-95 group/chat"
            title={`Message ${author.name}`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-emerald-400 group-hover/chat:text-white" />
            <span>Chat</span>
          </button>
        )}
      </div>
    </div>
  );
};
