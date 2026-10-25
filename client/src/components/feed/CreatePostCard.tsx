'use client';

import React, { useState, useRef } from 'react';
import { Image as ImageIcon, Send, X, Loader2, Sparkles, Smile } from 'lucide-react';
import { User } from '@/types';
import { Avatar } from '../ui/Avatar';
import { apiRequest } from '@/lib/api';

interface CreatePostCardProps {
  currentUser: User | null;
  onPostCreated: (post: any) => void;
  isDarkMode?: boolean;
}

export const CreatePostCard: React.FC<CreatePostCardProps> = ({
  currentUser,
  onPostCreated,
  isDarkMode = true,
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

  const firstName = currentUser?.name?.split(' ')[0] || 'friend';

  return (
    <div
      className={`w-full rounded-3xl p-5 sm:p-6 shadow-sm border transition-colors ${
        isDarkMode
          ? 'bg-neutral-900/90 border-neutral-800 text-white'
          : 'bg-white border-slate-200/90 text-slate-900'
      }`}
    >
      <form onSubmit={handleSubmit}>
        <div className="flex items-start gap-3.5">
          <Avatar
            name={currentUser?.name || 'User'}
            avatar={currentUser?.avatar}
            size="md"
          />

          <div className="flex-1 min-w-0">
            <div className="relative">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={`What's on your mind, ${firstName}?`}
                rows={2}
                className={`w-full rounded-2xl p-3.5 pr-10 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none transition-all ${
                  isDarkMode
                    ? 'bg-neutral-950/70 border border-neutral-800 text-neutral-100 placeholder-neutral-500'
                    : 'bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400'
                }`}
              />
              <button
                type="button"
                onClick={() => setContent((prev) => prev + ' 😊')}
                className={`absolute right-3 top-3 p-1 rounded-lg transition-colors ${
                  isDarkMode
                    ? 'text-neutral-500 hover:text-neutral-300'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
                title="Add emoji"
              >
                <Smile className="w-4 h-4" />
              </button>
            </div>

            {/* Selected Image Preview with remove option */}
            {imagePreview && (
              <div className="relative mt-3 inline-block group">
                <img
                  src={imagePreview}
                  alt="Upload preview"
                  className="max-h-56 max-w-full rounded-2xl object-cover border border-neutral-700/60 shadow-md"
                />
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-black/80 hover:bg-black text-white transition-all shadow-lg"
                  title="Remove image"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {error && (
              <p className="text-[11px] text-rose-500 mt-2 font-medium">{error}</p>
            )}

            {/* Bottom Action Bar */}
            <div
              className={`flex items-center justify-between mt-3.5 pt-3 border-t ${
                isDarkMode ? 'border-neutral-800/80' : 'border-slate-100'
              }`}
            >
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
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${
                    isDarkMode
                      ? 'bg-neutral-800/80 hover:bg-neutral-800 text-neutral-200 border-neutral-700/60'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  <ImageIcon className="w-4 h-4 text-emerald-500" />
                  <span>Add Image</span>
                </button>
              </div>

              <button
                type="submit"
                disabled={submitting || (!content.trim() && !imagePreview)}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 text-white text-xs font-bold shadow-md shadow-emerald-950/30 transition-all active:scale-95"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Publishing...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Publish Post</span>
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
