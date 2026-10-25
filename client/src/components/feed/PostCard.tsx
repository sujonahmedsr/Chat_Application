'use client';

import React, { useState } from 'react';
import {
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Trash2,
  Edit3,
  ShieldCheck,
  MoreVertical,
  ExternalLink,
  Globe,
  Tag,
  Lock,
} from 'lucide-react';
import { Post, User } from '@/types';
import { Avatar } from '../ui/Avatar';
import { CommentsSection } from './CommentsSection';
import { DeleteConfirmModal } from './DeleteConfirmModal';

const SUPER_ADMINS = ['shofiqul.sujon2201@gmail.com'];

interface PostCardProps {
  post: Post;
  currentUser: User | null;
  onLike: (postId: string) => void;
  onDislike: (postId: string) => void;
  onDelete: (postId: string) => void;
  onEdit: (post: Post) => void;
  onAddComment: (postId: string, content: string) => Promise<void>;
  onDeleteComment: (postId: string, commentId: string) => Promise<void>;
  onStartChat: (user: User) => void;
  onOpenProfile: (user: User) => void;
  onOpenImageLightbox: (imageUrl: string) => void;
  onSelectTag?: (tag: string) => void;
  isDarkMode?: boolean;
}

export const PostCard: React.FC<PostCardProps> = ({
  post,
  currentUser,
  onLike,
  onDislike,
  onDelete,
  onEdit,
  onAddComment,
  onDeleteComment,
  onStartChat,
  onOpenProfile,
  onOpenImageLightbox,
  onSelectTag,
  isDarkMode = true,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const author = post.author;
  const authorId = author ? String(author.id || (author as any)._id) : '';
  const currentUserId = currentUser ? String(currentUser.id || (currentUser as any)._id) : '';

  const isAuthor = authorId === currentUserId;
  const isSuper =
    SUPER_ADMINS.includes((currentUser?.email || '').toLowerCase()) ||
    currentUser?.role === 'admin';
  const canEdit = isAuthor || isSuper;
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

  const commentsCount =
    post.commentsCount !== undefined
      ? post.commentsCount
      : (post.comments || []).length;

  // Helper to format URLs and Hashtags as clickable elements
  const renderFormattedBody = (text: string) => {
    if (!text) return null;
    const tokenRegex = /(https?:\/\/[^\s]+|#[a-zA-Z0-9_\u0980-\u09FF]+)/g;
    const parts = text.split(tokenRegex);

    return parts.map((part, idx) => {
      if (part.startsWith('http://') || part.startsWith('https://')) {
        return (
          <a
            key={idx}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-500 hover:text-emerald-400 underline font-medium inline-flex items-center gap-0.5 break-all"
            onClick={(e) => e.stopPropagation()}
            title="Open link in new tab"
          >
            <span>{part}</span>
            <ExternalLink className="w-3 h-3 inline-block ml-0.5 opacity-80" />
          </a>
        );
      }
      if (part.startsWith('#')) {
        return (
          <button
            key={idx}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectTag?.(part);
            }}
            className="text-teal-400 hover:text-teal-300 font-semibold hover:underline"
            title={`Filter by ${part}`}
          >
            {part}
          </button>
        );
      }
      return <React.Fragment key={idx}>{part}</React.Fragment>;
    });
  };

  return (
    <div
      className={`w-full rounded-3xl p-5 sm:p-6 shadow-sm border transition-all relative group ${
        isDarkMode
          ? 'bg-neutral-900/90 border-neutral-800 text-white'
          : 'bg-white border-slate-200/90 text-slate-900'
      }`}
    >
      {/* Header: Author info + Options */}
      <div className="flex items-center justify-between mb-3.5">
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
              <h4
                className={`text-sm font-bold transition-colors ${
                  isDarkMode
                    ? 'text-white group-hover/author:text-emerald-400'
                    : 'text-slate-900 group-hover/author:text-emerald-600'
                }`}
              >
                {author?.name || 'Anonymous User'}
              </h4>
              {isAuthorSuperAdmin && (
                <span title="Verified Super Admin">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-neutral-400">
              <span>{formatTimestamp(post.createdAt)}</span>
              {post.isEdited && (
                <span className="italic text-emerald-500 font-medium">
                  • edited
                </span>
              )}
              <span>•</span>
              {post.privacy === 'private' ? (
                <span
                  className="inline-flex items-center gap-1 text-amber-400 font-medium"
                  title="Only you can see this post (Private)"
                >
                  <Lock className="w-3 h-3 text-amber-400" />
                  <span>Only me</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-neutral-400" title="Public post">
                  <Globe className="w-3 h-3 text-neutral-400" />
                  <span>Public</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Post Options Menu */}
        <div className="relative">
          {(canEdit || canDelete) && (
            <button
              onClick={() => setShowMenu((prev) => !prev)}
              className={`p-1.5 rounded-xl transition-colors ${
                isDarkMode
                  ? 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                  : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
              }`}
              title="Post Options"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          )}

          {showMenu && (canEdit || canDelete) && (
            <div
              className={`absolute right-0 top-8 z-30 w-36 rounded-2xl shadow-xl py-1.5 border animate-in fade-in zoom-in-95 ${
                isDarkMode
                  ? 'bg-neutral-900 border-neutral-800 text-neutral-200'
                  : 'bg-white border-slate-200 text-slate-700'
              }`}
            >
              {canEdit && (
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onEdit(post);
                  }}
                  className={`w-full px-3 py-2 text-left text-xs flex items-center gap-2 transition-colors ${
                    isDarkMode
                      ? 'hover:bg-neutral-800 text-neutral-200'
                      : 'hover:bg-slate-100 text-slate-800'
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Edit Post</span>
                </button>
              )}

              {canDelete && (
                <button
                  onClick={() => {
                    setShowMenu(false);
                    setShowDeleteModal(true);
                  }}
                  className="w-full px-3 py-2 text-left text-xs text-rose-500 hover:bg-rose-500/10 flex items-center gap-2 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Post</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Blog / Article Heading (if present) */}
      {post.title && (
        <h3
          className={`text-base sm:text-lg font-bold tracking-tight mb-2 leading-snug ${
            isDarkMode ? 'text-white' : 'text-slate-900'
          }`}
        >
          {post.title}
        </h3>
      )}

      {/* Content Text with clickable links and hashtags */}
      <div
        className={`text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words mb-3.5 select-text ${
          isDarkMode ? 'text-neutral-200' : 'text-slate-700'
        }`}
      >
        {renderFormattedBody(post.content)}
      </div>

      {/* Post Tags Chips (if present) */}
      {post.tags && post.tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-3.5">
          {post.tags.map((tag, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onSelectTag?.(tag)}
              className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors"
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Square Post Image (Clickable Lightbox) */}
      {post.imageUrl && (
        <div
          onClick={() => onOpenImageLightbox(post.imageUrl!)}
          className={`relative mb-3.5 rounded-2xl overflow-hidden border cursor-pointer aspect-square w-full mx-auto ${
            isDarkMode
              ? 'bg-neutral-950 border-neutral-800'
              : 'bg-slate-100 border-slate-200'
          }`}
        >
          <img
            src={post.imageUrl}
            alt="Square post media"
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100">
            <span className="px-3 py-1.5 rounded-full bg-black/75 backdrop-blur-md text-[11px] font-semibold text-white flex items-center gap-1.5 shadow-lg">
              <ExternalLink className="w-3.5 h-3.5" />
              <span>View Full Photo</span>
            </span>
          </div>
        </div>
      )}

      {/* Action Bar */}
      <div
        className={`flex items-center justify-between pt-3 border-t ${
          isDarkMode ? 'border-neutral-800/80' : 'border-slate-100'
        }`}
      >
        <div className="flex items-center gap-2">
          {/* LIKE BUTTON */}
          <button
            onClick={() => onLike(post.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95 ${
              post.isLiked
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm'
                : isDarkMode
                ? 'bg-neutral-800/60 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 border border-neutral-700/40'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200'
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
                : isDarkMode
                ? 'bg-neutral-800/60 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 border border-neutral-700/40'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200'
            }`}
            title="Dislike"
          >
            <ThumbsDown
              className={`w-3.5 h-3.5 ${post.isDisliked ? 'fill-rose-400' : ''}`}
            />
            <span>{post.dislikesCount || 0}</span>
          </button>

          {/* COMMENTS TOGGLE BUTTON */}
          <button
            onClick={() => setShowComments((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95 ${
              showComments
                ? 'bg-teal-500/20 text-teal-400 border border-teal-500/40 shadow-sm'
                : isDarkMode
                ? 'bg-neutral-800/60 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 border border-neutral-700/40'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200'
            }`}
            title="Comments"
          >
            <MessageSquare className="w-3.5 h-3.5 text-teal-400" />
            <span>{commentsCount}</span>
          </button>
        </div>

        {/* CHAT / MESSAGE AUTHOR BUTTON */}
        {!isAuthor && author && (
          <button
            onClick={() => onStartChat(author)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95 border ${
              isDarkMode
                ? 'bg-neutral-800/80 hover:bg-emerald-600 text-neutral-200 hover:text-white border-neutral-700/60 hover:border-emerald-500'
                : 'bg-slate-100 hover:bg-emerald-600 text-slate-700 hover:text-white border-slate-200 hover:border-emerald-500'
            }`}
            title={`Message ${author.name}`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />
            <span>Chat with {author.name?.split(' ')[0]}</span>
          </button>
        )}
      </div>

      {/* Expandable Comments Section */}
      {showComments && (
        <CommentsSection
          postId={post.id}
          postAuthorId={authorId}
          comments={post.comments || []}
          currentUser={currentUser}
          onAddComment={onAddComment}
          onDeleteComment={onDeleteComment}
          onOpenProfile={onOpenProfile}
          isDarkMode={isDarkMode}
        />
      )}

      {/* Delete Confirmation Popup Modal */}
      <DeleteConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={() => onDelete(post.id)}
        isDarkMode={isDarkMode}
      />
    </div>
  );
};
