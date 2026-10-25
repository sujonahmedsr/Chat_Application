'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Globe,
  RefreshCw,
  Sparkles,
  X,
  MessageSquare,
  Users,
} from 'lucide-react';
import { Post, User } from '@/types';
import { apiRequest } from '@/lib/api';
import { useSocket } from '@/context/SocketContext';
import { CreatePostCard } from './CreatePostCard';
import { PostCard } from './PostCard';
import { UserProfileModal } from './UserProfileModal';

interface FeedAreaProps {
  currentUser: User | null;
  onStartChat: (user: User) => void;
  onAddFriend?: (userId: string) => void;
  onOpenSidebar?: () => void;
}

export const FeedArea: React.FC<FeedAreaProps> = ({
  currentUser,
  onStartChat,
  onAddFriend,
  onOpenSidebar,
}) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedProfileUser, setSelectedProfileUser] = useState<User | null>(null);
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

    const handlePostCreated = (newPost: Post) => {
      setPosts((prev) => {
        if (prev.some((p) => p.id === newPost.id)) return prev;
        return [newPost, ...prev];
      });
    };

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

    const handlePostDeleted = ({ postId }: { postId: string }) => {
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    };

    socket.on('post:created', handlePostCreated);
    socket.on('post:reacted', handlePostReacted);
    socket.on('post:deleted', handlePostDeleted);

    return () => {
      socket.off('post:created', handlePostCreated);
      socket.off('post:reacted', handlePostReacted);
      socket.off('post:deleted', handlePostDeleted);
    };
  }, [socket]);

  // Handle Like
  const handleLike = async (postId: string) => {
    // Optimistic UI update
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
    // Optimistic UI update
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

  return (
    <div className="flex-1 flex flex-col h-full bg-neutral-950 relative overflow-hidden select-none">
      {/* Top Header Bar */}
      <header className="h-16 px-4 sm:px-6 bg-neutral-900/80 backdrop-blur-md border-b border-neutral-800 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          {onOpenSidebar && (
            <button
              onClick={onOpenSidebar}
              className="md:hidden p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors mr-1"
              title="Open Chat List"
            >
              <Users className="w-5 h-5 text-emerald-400" />
            </button>
          )}

          <div className="w-10 h-10 rounded-2xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-md shadow-emerald-950/40">
            <Globe className="w-5 h-5 stroke-[1.8]" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
                Community Feed
              </h2>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Public
              </span>
            </div>
            <p className="text-[11px] text-neutral-400">
              Share updates, ideas, and photos with the Shofi Chat community
            </p>
          </div>
        </div>

        {/* Refresh Feed */}
        <button
          onClick={() => fetchFeed(true)}
          disabled={refreshing}
          className="p-2.5 rounded-2xl bg-neutral-800/80 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700/60 shadow-sm transition-all active:scale-95"
          title="Refresh Feed"
        >
          <RefreshCw
            className={`w-4 h-4 text-emerald-400 ${refreshing ? 'animate-spin' : ''}`}
          />
        </button>
      </header>

      {/* Main Feed Content Scroll Area */}
      <div className="flex-1 overflow-y-auto px-4 py-5 sm:p-6 custom-scrollbar">
        <div className="max-w-2xl mx-auto space-y-5">
          {/* Create Post Form */}
          <CreatePostCard
            currentUser={currentUser}
            onPostCreated={(newPost) => {
              setPosts((prev) => [newPost, ...prev]);
            }}
          />

          {/* Posts Stream */}
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center text-center text-neutral-500 gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-emerald-500" />
              <p className="text-xs">Loading community posts...</p>
            </div>
          ) : posts.length === 0 ? (
            <div className="py-16 px-4 rounded-3xl bg-neutral-900/40 border border-neutral-800/60 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-neutral-800 flex items-center justify-center text-emerald-400 mb-3 shadow-inner">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-neutral-200">
                No posts shared yet
              </h3>
              <p className="text-xs text-neutral-400 mt-1 max-w-xs">
                Be the first to publish a post, share a photo, or start a discussion!
              </p>
            </div>
          ) : (
            posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                currentUser={currentUser}
                onLike={handleLike}
                onDislike={handleDislike}
                onDelete={handleDeletePost}
                onStartChat={onStartChat}
                onOpenProfile={(author) => setSelectedProfileUser(author)}
                onOpenImageLightbox={(url) => setLightboxImage(url)}
              />
            ))
          )}
        </div>
      </div>

      {/* User Profile Info Modal */}
      {selectedProfileUser && (
        <UserProfileModal
          user={selectedProfileUser}
          currentUser={currentUser}
          onClose={() => setSelectedProfileUser(null)}
          onStartChat={onStartChat}
          onAddFriend={onAddFriend}
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
