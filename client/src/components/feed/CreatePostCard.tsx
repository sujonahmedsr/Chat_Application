'use client';

import React, { useState, useRef } from 'react';
import { Image as ImageIcon, Send, X, Loader2, Sparkles } from 'lucide-react';
import { User } from '@/types';
import { Avatar } from '../ui/Avatar';
import { apiRequest } from '@/lib/api';

interface CreatePostCardProps {
  currentUser: User | null;
  onPostCreated: (post: any) => void;
}

export const CreatePostCard: React.FC<CreatePostCardProps> = ({
  currentUser,
  onPostCreated,
}) => {
  const [content, setContent] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (PNG, JPG, WebP, GIF)');
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setError('Image must be smaller than 8MB');
      return;
    }

    setError('');
    const reader = new FileReader();
    reader.onload = (event) => {
      setImagePreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && !imagePreview) return;

    try {
      setSubmitting(true);
      setError('');

      const data = await apiRequest('/posts', {
        method: 'POST',
        body: JSON.stringify({
          content: content.trim(),
          image: imagePreview || '',
        }),
      });

      if (data?.post) {
        onPostCreated(data.post);
        setContent('');
        setImagePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    } catch (err: any) {
      setError(err.message || 'Failed to publish post');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full bg-neutral-900/90 border border-neutral-800 rounded-3xl p-4 sm:p-5 shadow-xl backdrop-blur-xl relative overflow-hidden transition-all">
      <form onSubmit={handleSubmit}>
        <div className="flex gap-3">
          <Avatar
            name={currentUser?.name || 'User'}
            avatar={currentUser?.avatar}
            size="md"
          />

          <div className="flex-1 min-w-0">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={`What's on your mind, ${currentUser?.name?.split(' ')[0] || 'friend'}?`}
              rows={2}
              className="w-full bg-neutral-950/60 border border-neutral-800/80 rounded-2xl p-3 text-xs sm:text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/20 resize-none transition-all"
            />

            {/* Selected Image Preview with remove option */}
            {imagePreview && (
              <div className="relative mt-2.5 inline-block group">
                <img
                  src={imagePreview}
                  alt="Upload preview"
                  className="max-h-56 max-w-full rounded-2xl object-cover border border-neutral-700 shadow-md"
                />
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-black/75 hover:bg-black text-neutral-200 hover:text-white transition-all shadow-lg"
                  title="Remove image"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {error && (
              <p className="text-[11px] text-rose-400 mt-2 font-medium">{error}</p>
            )}

            {/* Action Bar */}
            <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-neutral-800/80">
              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-800/80 hover:bg-neutral-800 text-neutral-300 hover:text-white text-xs font-medium border border-neutral-700/60 transition-colors"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Photo</span>
                </button>
              </div>

              <button
                type="submit"
                disabled={submitting || (!content.trim() && !imagePreview)}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white text-xs font-semibold shadow-lg shadow-emerald-900/30 transition-all active:scale-95"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Publishing...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Post</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
