'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Globe,
  RefreshCw,
  Sparkles,
  X,
  Users,
  Search,
  Moon,
  Sun,
  User as UserIcon,
  Filter,
} from 'lucide-react';
import { Post, User } from '@/types';
import { apiRequest } from '@/lib/api';
import { useSocket } from '@/context/SocketContext';
import { CreatePostCard } from './CreatePostCard';
import { PostCard } from './PostCard';
import { EditPostModal } from './EditPostModal';
import { UserProfileModal } from './UserProfileModal';
import { FeedWidgets } from './FeedWidgets';

interface FeedAreaProps {
  currentUser: User | null;
  onStartChat: (user: User) => void;
  onAddFriend?: (userId: string) => void;
  onOpenSidebar?: () => void;
  onlineFriends?: User[];
  onOpenCreateGroup?: () => void;
  onOpenFriendModal?: () => void;
}

export const FeedArea: React.FC<FeedAreaProps> = ({
  currentUser,
  onStartChat,
  onAddFriend,
  onOpenSidebar,
  onlineFriends = [],
  onOpenCreateGroup,
  onOpenFriendModal,
}) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [feedTab, setFeedTab] = useState<'all' | 'my'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);

  // Theme: Dark vs Light mode (defaults to dark, persisted in localStorage)
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('shofi_feed_theme');
      return saved ? saved === 'dark' : true;
    }
    return true;
  });

  const toggleTheme = () => {
    setIsDarkMode((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('shofi_feed_theme', next ? 'dark' : 'light');
      }
      return next;
    });
  };

  // Modals state
  const [selectedProfileUser, setSelectedProfileUser] = useState<User | null>(null);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const { socket } = useSocket();

  const fetchFeed = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      const data = await apiRequest('/posts?limit=50');
      if (data?.posts) {
        setPosts(data.posts);
      }
    } catch (err) {
      console.error('Failed to load posts feed:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  // Real-time socket event listeners for live feed sync
  useEffect(() => {
    if (!socket) return;

    // 1. Post created
    const handlePostCreated = (newPost: Post) => {
      setPosts((prev) => {
        if (prev.some((p) => p.id === newPost.id)) return prev;
        return [newPost, ...prev];
      });
    };

    // 2. Post updated (edited)
    const handlePostUpdated = (updatedPost: Post) => {
      setPosts((prev) =>
        prev.map((p) => (p.id === updatedPost.id ? updatedPost : p))
      );
    };

    // 3. Post reacted (like/dislike)
    const handlePostReacted = ({
      postId,
      likesCount,
      dislikesCount,
    }: {
      postId: string;
      likesCount: number;
      dislikesCount: number;
    }) => {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, likesCount, dislikesCount } : p
        )
      );
    };

    // 4. Post comment added
    const handleCommentAdded = ({
      postId,
      comment,
      commentsCount,
    }: {
      postId: string;
      comment: any;
      commentsCount: number;
    }) => {
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id !== postId) return p;
          const currentComments = p.comments || [];
          if (currentComments.some((c) => (c.id || c._id) === (comment.id || comment._id))) {
            return p;
          }
          return {
            ...p,
            commentsCount,
            comments: [...currentComments, comment],
          };
        })
      );
    };

    // 5. Post comment deleted
    const handleCommentDeleted = ({
      postId,
      commentId,
      commentsCount,
    }: {
      postId: string;
      commentId: string;
      commentsCount: number;
    }) => {
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id !== postId) return p;
          const currentComments = p.comments || [];
          return {
            ...p,
            commentsCount,
            comments: currentComments.filter(
              (c) => (c.id || c._id) !== commentId
            ),
          };
        })
      );
    };

    // 6. Post deleted
    const handlePostDeleted = ({ postId }: { postId: string }) => {
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    };

    socket.on('post:created', handlePostCreated);
    socket.on('post:updated', handlePostUpdated);
    socket.on('post:reacted', handlePostReacted);
    socket.on('post:comment:added', handleCommentAdded);
    socket.on('post:comment:deleted', handleCommentDeleted);
    socket.on('post:deleted', handlePostDeleted);

    return () => {
      socket.off('post:created', handlePostCreated);
      socket.off('post:updated', handlePostUpdated);
      socket.off('post:reacted', handlePostReacted);
      socket.off('post:comment:added', handleCommentAdded);
      socket.off('post:comment:deleted', handleCommentDeleted);
      socket.off('post:deleted', handlePostDeleted);
    };
  }, [socket]);

  // Handle Like
  const handleLike = async (postId: string) => {
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const currentlyLiked = Boolean(p.isLiked);
        return {
          ...p,
          isLiked: !currentlyLiked,
          isDisliked: false,
          likesCount: currentlyLiked ? Math.max(0, p.likesCount - 1) : p.likesCount + 1,
          dislikesCount: p.isDisliked ? Math.max(0, p.dislikesCount - 1) : p.dislikesCount,
        };
      })
    );

    try {
      const data = await apiRequest(`/posts/${postId}/like`, { method: 'POST' });
      if (data?.post) {
        setPosts((prev) =>
          prev.map((p) => (p.id === postId ? data.post : p))
        );
      }
    } catch (err) {
      console.error('Failed to toggle like:', err);
      fetchFeed();
    }
  };

  // Handle Dislike
  const handleDislike = async (postId: string) => {
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const currentlyDisliked = Boolean(p.isDisliked);
        return {
          ...p,
          isDisliked: !currentlyDisliked,
          isLiked: false,
          dislikesCount: currentlyDisliked
            ? Math.max(0, p.dislikesCount - 1)
            : p.dislikesCount + 1,
          likesCount: p.isLiked ? Math.max(0, p.likesCount - 1) : p.likesCount,
        };
      })
    );

    try {
      const data = await apiRequest(`/posts/${postId}/dislike`, { method: 'POST' });
      if (data?.post) {
        setPosts((prev) =>
          prev.map((p) => (p.id === postId ? data.post : p))
        );
      }
    } catch (err) {
      console.error('Failed to toggle dislike:', err);
      fetchFeed();
    }
  };

  // Handle Add Comment
  const handleAddComment = async (postId: string, content: string) => {
    const data = await apiRequest(`/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });

    if (data?.post) {
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? data.post : p))
      );
    }
  };

  // Handle Delete Comment
  const handleDeleteComment = async (postId: string, commentId: string) => {
    // Optimistic removal
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const currentComments = p.comments || [];
        return {
          ...p,
          commentsCount: Math.max(0, (p.commentsCount || currentComments.length) - 1),
          comments: currentComments.filter(
            (c) => (c.id || c._id) !== commentId
          ),
        };
      })
    );

    try {
      await apiRequest(`/posts/${postId}/comments/${commentId}`, {
        method: 'DELETE',
      });
    } catch (err) {
      console.error('Failed to delete comment:', err);
      fetchFeed();
    }
  };

  // Handle Delete Post
  const handleDeletePost = async (postId: string) => {
    if (!confirm('Are you sure you want to delete this post?')) return;

    setPosts((prev) => prev.filter((p) => p.id !== postId));

    try {
      await apiRequest(`/posts/${postId}`, { method: 'DELETE' });
    } catch (err) {
      console.error('Failed to delete post:', err);
      fetchFeed();
    }
  };

  // Filter posts by Tab (All vs My Posts) & Search Query & Active Tag
  const currentUserId = currentUser ? String(currentUser.id || (currentUser as any)._id) : '';

  const myPostsCount = useMemo(() => {
    return posts.filter(
      (p) => String(p.author?.id || (p.author as any)?._id) === currentUserId
    ).length;
  }, [posts, currentUserId]);

  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      // 1. Tab filter
      if (feedTab === 'my') {
        const postAuthorId = String(post.author?.id || (post.author as any)?._id);
        if (postAuthorId !== currentUserId) return false;
      }

      // 2. Tag filter
      if (activeTag) {
        const hasTag = (post.content || '').toLowerCase().includes(activeTag.toLowerCase());
        if (!hasTag) return false;
      }

      // 3. Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesContent = (post.content || '').toLowerCase().includes(query);
        const matchesAuthor = (post.author?.name || '').toLowerCase().includes(query);
        if (!matchesContent && !matchesAuthor) return false;
      }

      return true;
    });
  }, [posts, feedTab, activeTag, searchQuery, currentUserId]);

  return (
    <div
      className={`flex-1 flex flex-col h-full relative overflow-hidden select-none transition-colors ${
        isDarkMode ? 'bg-neutral-950 text-white' : 'bg-[#f4f6fb] text-slate-900'
      }`}
    >
      {/* 1. Top Header Bar (Matching screenshot style) */}
      <header
        className={`h-16 px-4 sm:px-6 backdrop-blur-md border-b flex items-center justify-between z-10 transition-colors ${
          isDarkMode
            ? 'bg-neutral-900/80 border-neutral-800'
            : 'bg-white/90 border-slate-200/90'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {onOpenSidebar && (
            <button
              onClick={onOpenSidebar}
              className={`md:hidden p-2 rounded-xl transition-colors mr-1 ${
                isDarkMode
                  ? 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
              }`}
              title="Open Chat List"
            >
              <Users className="w-5 h-5 text-emerald-500" />
            </button>
          )}

          {/* Search Input Bar (matching screenshot) */}
          <div className="relative max-w-md w-full">
            <Search
              className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${
                isDarkMode ? 'text-neutral-500' : 'text-slate-400'
              }`}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search posts, thoughts, or authors..."
              className={`w-full rounded-2xl py-2 pl-9 pr-14 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all ${
                isDarkMode
                  ? 'bg-neutral-950/70 border border-neutral-800 text-neutral-100 placeholder-neutral-500'
                  : 'bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400'
              }`}
            />
            <span
              className={`absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold px-1.5 py-0.5 rounded-md border ${
                isDarkMode
                  ? 'bg-neutral-900 border-neutral-700 text-neutral-400'
                  : 'bg-slate-100 border-slate-200 text-slate-500'
              }`}
            >
              ⌘ K
            </span>
          </div>
        </div>

        {/* Right Header Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Active Tag Clear Button */}
          {activeTag && (
            <button
              onClick={() => setActiveTag(null)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold"
            >
              <span>{activeTag}</span>
              <X className="w-3 h-3" />
            </button>
          )}

          {/* Refresh Feed Button */}
          <button
            onClick={() => fetchFeed(true)}
            disabled={refreshing}
            className={`p-2 rounded-2xl border transition-all active:scale-95 ${
              isDarkMode
                ? 'bg-neutral-850 hover:bg-neutral-800 text-neutral-300 border-neutral-700/60'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
            }`}
            title="Refresh Feed"
          >
            <RefreshCw
              className={`w-4 h-4 text-emerald-500 ${refreshing ? 'animate-spin' : ''}`}
            />
          </button>

          {/* Dark / Light Mode Toggle Button (Matching top right icon in screenshot) */}
          <button
            onClick={toggleTheme}
            className={`p-2 rounded-2xl border transition-all active:scale-95 ${
              isDarkMode
                ? 'bg-neutral-850 hover:bg-neutral-800 text-amber-400 border-neutral-700/60'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
            }`}
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDarkMode ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-700" />
            )}
          </button>
        </div>
      </header>

      {/* 2. Main Body: Center Feed + Right Widgets (3-column layout on wide screens) */}
      <div className="flex-1 overflow-y-auto px-4 py-5 sm:p-6 custom-scrollbar">
        <div className="max-w-6xl mx-auto flex gap-6 items-start">
          {/* Feed Column */}
          <div className="flex-1 min-w-0 max-w-2xl mx-auto space-y-5">
            {/* Feed Filter Tabs (All Posts vs My Posts) */}
            <div
              className={`p-1 rounded-2xl flex items-center justify-between border ${
                isDarkMode
                  ? 'bg-neutral-900/90 border-neutral-800'
                  : 'bg-white border-slate-200/90'
              }`}
            >
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setFeedTab('all')}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    feedTab === 'all'
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/30'
                      : isDarkMode
                      ? 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>Community Feed</span>
                </button>

                <button
                  onClick={() => setFeedTab('my')}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    feedTab === 'my'
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/30'
                      : isDarkMode
                      ? 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                  }`}
                >
                  <UserIcon className="w-3.5 h-3.5" />
                  <span>My Posts</span>
                  {myPostsCount > 0 && (
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-full ${
                        feedTab === 'my'
                          ? 'bg-emerald-800 text-white'
                          : isDarkMode
                          ? 'bg-neutral-800 text-neutral-300'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {myPostsCount}
                    </span>
                  )}
                </button>
              </div>

              <span
                className={`text-[11px] font-medium pr-3 hidden sm:inline ${
                  isDarkMode ? 'text-neutral-500' : 'text-slate-400'
                }`}
              >
                {filteredPosts.length} posts
              </span>
            </div>

            {/* Create Post Form */}
            <CreatePostCard
              currentUser={currentUser}
              onPostCreated={(newPost) => {
                setPosts((prev) => [newPost, ...prev]);
              }}
              isDarkMode={isDarkMode}
            />

            {/* Posts Stream */}
            {loading ? (
              <div className="py-16 flex flex-col items-center justify-center text-center text-neutral-500 gap-3">
                <RefreshCw className="w-6 h-6 animate-spin text-emerald-500" />
                <p className="text-xs">Loading community posts...</p>
              </div>
            ) : filteredPosts.length === 0 ? (
              <div
                className={`py-16 px-4 rounded-3xl border flex flex-col items-center justify-center text-center ${
                  isDarkMode
                    ? 'bg-neutral-900/40 border-neutral-800/60 text-neutral-200'
                    : 'bg-white border-slate-200 text-slate-800 shadow-sm'
                }`}
              >
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center text-emerald-500 mb-3 ${
                    isDarkMode ? 'bg-neutral-800' : 'bg-emerald-50'
                  }`}
                >
                  <Sparkles className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-semibold">
                  {searchQuery || activeTag
                    ? 'No matching posts found'
                    : feedTab === 'my'
                    ? 'You have not shared any posts yet'
                    : 'No posts shared yet'}
                </h3>
                <p
                  className={`text-xs mt-1 max-w-xs ${
                    isDarkMode ? 'text-neutral-400' : 'text-slate-500'
                  }`}
                >
                  {feedTab === 'my'
                    ? 'Use the form above to share your thoughts, photos, or updates with the community!'
                    : 'Be the first to publish a post, share a photo, or start a discussion!'}
                </p>
              </div>
            ) : (
              filteredPosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  currentUser={currentUser}
                  onLike={handleLike}
                  onDislike={handleDislike}
                  onDelete={handleDeletePost}
                  onEdit={(p) => setEditingPost(p)}
                  onAddComment={handleAddComment}
                  onDeleteComment={handleDeleteComment}
                  onStartChat={onStartChat}
                  onOpenProfile={(author) => setSelectedProfileUser(author)}
                  onOpenImageLightbox={(url) => setLightboxImage(url)}
                  onSelectTag={(tag) => setActiveTag(tag || null)}
                  isDarkMode={isDarkMode}
                />
              ))
            )}
          </div>

          {/* Right Companion Widgets Column (Sticky on scroll) */}
          <div className="hidden lg:block w-80 flex-shrink-0 sticky top-2 self-start">
            <FeedWidgets
              onlineFriends={onlineFriends}
              posts={posts}
              activeTag={activeTag}
              onSelectTag={(tag) => setActiveTag(tag || null)}
              onStartChat={onStartChat}
              onOpenCreateGroup={onOpenCreateGroup}
              onOpenFriendModal={onOpenFriendModal}
              isDarkMode={isDarkMode}
            />
          </div>
        </div>
      </div>

      {/* Edit Post Modal */}
      {editingPost && (
        <EditPostModal
          post={editingPost}
          isOpen={Boolean(editingPost)}
          onClose={() => setEditingPost(null)}
          onPostUpdated={(updatedPost) => {
            setPosts((prev) =>
              prev.map((p) => (p.id === updatedPost.id ? updatedPost : p))
            );
          }}
          isDarkMode={isDarkMode}
        />
      )}

      {/* User Profile Info Modal */}
      {selectedProfileUser && (
        <UserProfileModal
          user={selectedProfileUser}
          currentUser={currentUser}
          onClose={() => setSelectedProfileUser(null)}
          onStartChat={onStartChat}
          onAddFriend={onAddFriend}
          isDarkMode={isDarkMode}
        />
      )}

      {/* Full-Screen Image Lightbox Modal */}
      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4 animate-in fade-in duration-200 cursor-zoom-out"
        >
          <button
            onClick={() => setLightboxImage(null)}
            className="absolute top-5 right-5 p-2 rounded-full bg-neutral-800/80 hover:bg-neutral-700 text-white shadow-xl transition-colors cursor-pointer"
            title="Close image"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={lightboxImage}
            alt="Expanded view"
            className="max-h-[90vh] max-w-[95vw] rounded-2xl object-contain shadow-2xl animate-in zoom-in-95 duration-200 cursor-default"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};
