'use client';

import React, { useState, useRef } from 'react';
import {
  Image as ImageIcon,
  Send,
  X,
  Loader2,
  Sparkles,
  Smile,
  Hash,
  Heading,
  Link as LinkIcon,
} from 'lucide-react';
import { User } from '@/types';
import { Avatar } from '../ui/Avatar';
import { apiRequest } from '@/lib/api';

interface CreatePostCardProps {
  currentUser: User | null;
  onPostCreated: (post: any) => void;
  isDarkMode?: boolean;
}

const SUGGESTED_TAGS = ['#WebRTC', '#NextJS', '#Tech', '#Discussion', '#News', '#Question', '#Ideas'];

export const CreatePostCard: React.FC<CreatePostCardProps> = ({
  currentUser,
  onPostCreated,
  isDarkMode = true,
}) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [showTitleField, setShowTitleField] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTagInput, setCustomTagInput] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);
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

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleAddCustomTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const trimmed = customTagInput.trim().replace(/^#+/, '');
      if (trimmed) {
        const formatted = `#${trimmed}`;
        if (!selectedTags.includes(formatted)) {
          setSelectedTags((prev) => [...prev, formatted]);
        }
        setCustomTagInput('');
      }
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
          title: title.trim(),
          content: content.trim(),
          tags: selectedTags,
          image: imagePreview || '',
        }),
      });

      if (data?.post) {
        onPostCreated(data.post);
        setTitle('');
        setContent('');
        setSelectedTags([]);
        setShowTitleField(false);
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
            {/* Optional Blog Heading / Title */}
            {showTitleField && (
              <div className="mb-2.5">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Article / Blog Heading (optional)..."
                  maxLength={250}
                  className={`w-full font-bold text-sm sm:text-base rounded-2xl py-2 px-3.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all ${
                    isDarkMode
                      ? 'bg-neutral-950/80 border border-neutral-800 text-white placeholder-neutral-500'
                      : 'bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400'
                  }`}
                />
              </div>
            )}

            {/* Main Content Area */}
            <div className="relative">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={`What's on your mind, ${firstName}? Write a blog, article, or share ideas (links & #tags are clickable)...`}
                rows={3}
                className={`w-full rounded-2xl p-3.5 pr-10 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none transition-all leading-relaxed ${
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

            {/* Tags Selection & Suggestions */}
            {(showTagInput || selectedTags.length > 0) && (
              <div className="mt-2.5 space-y-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className={`text-[11px] font-semibold flex items-center gap-1 ${
                      isDarkMode ? 'text-neutral-400' : 'text-slate-500'
                    }`}
                  >
                    <Hash className="w-3 h-3 text-emerald-500" />
                    <span>Tags:</span>
                  </span>

                  {SUGGESTED_TAGS.map((tag) => {
                    const isSelected = selectedTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTag(tag)}
                        className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border transition-all ${
                          isSelected
                            ? 'bg-emerald-600 text-white border-emerald-500'
                            : isDarkMode
                            ? 'bg-neutral-800/80 text-neutral-300 border-neutral-700/80 hover:bg-neutral-750'
                            : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>

                {/* Custom tag input */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customTagInput}
                    onChange={(e) => setCustomTagInput(e.target.value)}
                    onKeyDown={handleAddCustomTag}
                    placeholder="Type custom #tag & press Enter..."
                    className={`text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 max-w-xs ${
                      isDarkMode
                        ? 'bg-neutral-950/80 border border-neutral-800 text-neutral-200 placeholder-neutral-500'
                        : 'bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400'
                    }`}
                  />
                  {selectedTags.length > 0 && (
                    <span
                      className={`text-[10px] ${
                        isDarkMode ? 'text-neutral-500' : 'text-slate-400'
                      }`}
                    >
                      ({selectedTags.length} selected)
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Selected Square Image Preview with remove option */}
            {imagePreview && (
              <div className="relative mt-3 inline-block group">
                <div className="w-56 h-56 aspect-square rounded-2xl overflow-hidden border border-neutral-700/60 shadow-md bg-neutral-950">
                  <img
                    src={imagePreview}
                    alt="Square upload preview"
                    className="w-full h-full object-cover"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-black/80 hover:bg-black text-white transition-all shadow-lg"
                  title="Remove image"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
                <span className="block text-[10px] text-neutral-400 mt-1 font-medium">
                  Square 1:1 format
                </span>
              </div>
            )}

            {error && (
              <p className="text-[11px] text-rose-500 mt-2 font-medium">{error}</p>
            )}

            {/* Bottom Toolbar & Action Bar */}
            <div
              className={`flex flex-wrap items-center justify-between gap-2 mt-3.5 pt-3 border-t ${
                isDarkMode ? 'border-neutral-800/80' : 'border-slate-100'
              }`}
            >
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* Photo Upload (Square) */}
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
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${
                    isDarkMode
                      ? 'bg-neutral-800/80 hover:bg-neutral-800 text-neutral-200 border-neutral-700/60'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                  title="Upload Square Photo"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Square Photo</span>
                </button>

                {/* Add Title / Heading Toggle */}
                <button
                  type="button"
                  onClick={() => setShowTitleField((prev) => !prev)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${
                    showTitleField
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : isDarkMode
                      ? 'bg-neutral-800/80 hover:bg-neutral-800 text-neutral-300 border-neutral-700/60'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                  title="Add Heading"
                >
                  <Heading className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Title</span>
                </button>

                {/* Add Tags Toggle */}
                <button
                  type="button"
                  onClick={() => setShowTagInput((prev) => !prev)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${
                    showTagInput || selectedTags.length > 0
                      ? 'bg-teal-500/15 text-teal-400 border-teal-500/30'
                      : isDarkMode
                      ? 'bg-neutral-800/80 hover:bg-neutral-800 text-neutral-300 border-neutral-700/60'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                  title="Add Tags"
                >
                  <Hash className="w-3.5 h-3.5 text-teal-400" />
                  <span>Tags</span>
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
