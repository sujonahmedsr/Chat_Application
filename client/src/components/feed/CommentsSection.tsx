'use client';

import React, { useState } from 'react';
import { Send, Trash2, ShieldCheck, Loader2 } from 'lucide-react';
import { PostComment, User } from '@/types';
import { Avatar } from '../ui/Avatar';

const SUPER_ADMINS = ['shofiqul.sujon2201@gmail.com'];

interface CommentsSectionProps {
  postId: string;
  postAuthorId: string;
  comments: PostComment[];
  currentUser: User | null;
  onAddComment: (postId: string, content: string) => Promise<void>;
  onDeleteComment: (postId: string, commentId: string) => Promise<void>;
  onOpenProfile?: (user: User) => void;
  isDarkMode?: boolean;
}

export const CommentsSection: React.FC<CommentsSectionProps> = ({
  postId,
  postAuthorId,
  comments = [],
  currentUser,
  onAddComment,
  onDeleteComment,
  onOpenProfile,
  isDarkMode = true,
}) => {
  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const currentUserId = currentUser ? String(currentUser.id || (currentUser as any)._id) : '';
  const isSuperUser =
    SUPER_ADMINS.includes((currentUser?.email || '').toLowerCase()) ||
    currentUser?.role === 'admin';

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      await onAddComment(postId, commentText.trim());
      setCommentText('');
    } catch (err) {
      console.error('Failed to submit comment:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      setDeletingId(commentId);
      await onDeleteComment(postId, commentId);
    } catch (err) {
      console.error('Failed to delete comment:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const formatCommentTime = (isoStr: string) => {
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
    <div
      className={`mt-3 pt-3 border-t space-y-3 transition-colors ${
        isDarkMode ? 'border-neutral-800/80' : 'border-slate-200/80'
      }`}
    >
      {/* List of comments */}
      {comments.length > 0 ? (
        <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
          {comments.map((comment) => {
            const commentUser = comment.user;
            const commentUserId = commentUser
              ? String(commentUser.id || (commentUser as any)._id)
              : '';
            const isCommentAuthor = commentUserId === currentUserId;
            const isPostAuthor = postAuthorId === currentUserId;
            const canDeleteComment = isCommentAuthor || isPostAuthor || isSuperUser;
            const isCommentAuthorAdmin =
              SUPER_ADMINS.includes((commentUser?.email || '').toLowerCase()) ||
              commentUser?.role === 'admin';

            return (
              <div
                key={comment.id || comment._id}
                className={`p-2.5 rounded-2xl flex items-start justify-between gap-2.5 transition-colors group/comment ${
                  isDarkMode ? 'bg-neutral-950/60' : 'bg-slate-50'
                }`}
              >
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <div
                    onClick={() => commentUser && onOpenProfile?.(commentUser)}
                    className="cursor-pointer hover:opacity-85 transition-opacity flex-shrink-0 mt-0.5"
                  >
                    <Avatar
                      name={commentUser?.name || 'User'}
                      avatar={commentUser?.avatar}
                      size="sm"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        onClick={() => commentUser && onOpenProfile?.(commentUser)}
                        className={`text-xs font-semibold cursor-pointer transition-colors ${
                          isDarkMode
                            ? 'text-white hover:text-emerald-400'
                            : 'text-slate-900 hover:text-emerald-600'
                        }`}
                      >
                        {commentUser?.name || 'User'}
                      </span>
                      {isCommentAuthorAdmin && (
                        <ShieldCheck className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                      )}
                      <span
                        className={`text-[10px] ${
                          isDarkMode ? 'text-neutral-500' : 'text-slate-400'
                        }`}
                      >
                        • {formatCommentTime(comment.createdAt)}
                      </span>
                    </div>

                    <p
                      className={`text-xs mt-1 leading-relaxed select-text whitespace-pre-wrap break-words ${
                        isDarkMode ? 'text-neutral-200' : 'text-slate-700'
                      }`}
                    >
                      {comment.content}
                    </p>
                  </div>
                </div>

                {/* Delete Comment button */}
                {canDeleteComment && (
                  <button
                    onClick={() => handleDelete(comment.id || comment._id!)}
                    disabled={deletingId === (comment.id || comment._id)}
                    className={`p-1.5 rounded-lg opacity-0 group-hover/comment:opacity-100 transition-all ${
                      isDarkMode
                        ? 'text-neutral-500 hover:text-rose-400 hover:bg-neutral-800'
                        : 'text-slate-400 hover:text-rose-500 hover:bg-slate-200/60'
                    }`}
                    title="Delete comment"
                  >
                    {deletingId === (comment.id || comment._id) ? (
                      <Loader2 className="w-3 h-3 animate-spin text-rose-400" />
                    ) : (
                      <Trash2 className="w-3 h-3" />
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p
          className={`text-[11px] text-center py-2 ${
            isDarkMode ? 'text-neutral-500' : 'text-slate-400'
          }`}
        >
          No comments yet. Be the first to start the conversation!
        </p>
      )}

      {/* New Comment Input Field */}
      <form onSubmit={handleSend} className="flex items-center gap-2 pt-1">
        <Avatar
          name={currentUser?.name || 'You'}
          avatar={currentUser?.avatar}
          size="sm"
        />

        <div className="relative flex-1">
          <input
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Write a constructive comment..."
            maxLength={1000}
            className={`w-full rounded-xl py-2 pl-3 pr-9 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500/30 transition-all ${
              isDarkMode
                ? 'bg-neutral-950/80 border border-neutral-800 text-neutral-100 placeholder-neutral-500 focus:border-emerald-500/60'
                : 'bg-slate-100/90 border border-slate-200 text-slate-800 placeholder-slate-400 focus:border-emerald-600'
            }`}
          />
          <button
            type="submit"
            disabled={isSubmitting || !commentText.trim()}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:hover:bg-emerald-600 text-white transition-all shadow-sm"
            title="Post comment"
          >
            {isSubmitting ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Send className="w-3 h-3" />
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
