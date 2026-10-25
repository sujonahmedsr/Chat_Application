'use client';

import React, { useState, useRef } from 'react';
import {
  X,
  Image as ImageIcon,
  Globe,
  Lock,
  Smile,
  Hash,
  Heading,
  Loader2,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import { User, Post } from '@/types';
import { Avatar } from '../ui/Avatar';
import { apiRequest } from '@/lib/api';

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onPostCreated: (newPost: Post) => void;
  isDarkMode?: boolean;
}

const POPULAR_TAGS = ['#WebRTC', '#NextJS', '#Tech', '#Discussion', '#Ideas', '#Question', '#News'];

export const CreatePostModal: React.FC<CreatePostModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onPostCreated,
  isDarkMode = true,
}) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [privacy, setPrivacy] = useState<'public' | 'private'>('public');
  const [showPrivacyMenu, setShowPrivacyMenu] = useState(false);
  const [showTitleInput, setShowTitleInput] = useState(false);
  const [showTagInput, setShowTagInput] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

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
      const trimmed = customTag.trim().replace(/^#+/, '');
      if (trimmed) {
        const formatted = `#${trimmed}`;
        if (!selectedTags.includes(formatted)) {
          setSelectedTags((prev) => [...prev, formatted]);
        }
        setCustomTag('');
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
          privacy,
          image: imagePreview || '',
        }),
      });

      if (data?.post) {
        onPostCreated(data.post);
        onClose();
        setTitle('');
        setContent('');
        setSelectedTags([]);
        setImagePreview(null);
        setPrivacy('public');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to publish post');
    } finally {
      setSubmitting(false);
    }
  };

  const firstName = currentUser?.name?.split(' ')[0] || 'Friend';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className={`w-full max-w-lg rounded-3xl shadow-2xl border flex flex-col max-h-[90vh] overflow-hidden transition-colors animate-in zoom-in-95 duration-150 ${
          isDarkMode
            ? 'bg-neutral-900 border-neutral-800 text-white'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Facebook Style Modal Header */}
        <div
          className={`px-4 sm:px-5 py-3.5 border-b flex items-center justify-between relative ${
            isDarkMode ? 'border-neutral-800' : 'border-slate-100'
          }`}
        >
          <div className="w-8" />
          <h3 className="font-bold text-sm sm:text-base text-center">Create post</h3>
          <button
            onClick={onClose}
            className={`p-2 rounded-full transition-colors ${
              isDarkMode
                ? 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
            }`}
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 custom-scrollbar">
          {/* Author info + Audience selector */}
          <div className="flex items-center gap-3">
            <Avatar
              name={currentUser?.name || 'User'}
              avatar={currentUser?.avatar}
              size="md"
            />
            <div>
              <h4 className="font-bold text-xs sm:text-sm">{currentUser?.name || 'User'}</h4>

              {/* Privacy selector pill (Facebook style) */}
              <div className="relative mt-1">
                <button
                  type="button"
                  onClick={() => setShowPrivacyMenu((prev) => !prev)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                    isDarkMode
                      ? 'bg-neutral-800/90 hover:bg-neutral-750 text-neutral-300 border-neutral-700/80'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                  }`}
                >
                  {privacy === 'public' ? (
                    <>
                      <Globe className="w-3 h-3 text-emerald-400" />
                      <span>Public</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-3 h-3 text-amber-400" />
                      <span>Only me (Private)</span>
                    </>
                  )}
                  <ChevronDown className="w-3 h-3 opacity-60" />
                </button>

                {showPrivacyMenu && (
                  <div
                    className={`absolute left-0 top-8 z-30 w-52 rounded-2xl shadow-2xl p-1.5 border animate-in fade-in zoom-in-95 ${
                      isDarkMode
                        ? 'bg-neutral-900 border-neutral-800 text-white'
                        : 'bg-white border-slate-200 text-slate-900'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setPrivacy('public');
                        setShowPrivacyMenu(false);
                      }}
                      className={`w-full flex items-center gap-2.5 p-2 rounded-xl text-left text-xs transition-colors ${
                        privacy === 'public'
                          ? 'bg-emerald-500/15 text-emerald-400 font-semibold'
                          : isDarkMode
                          ? 'hover:bg-neutral-800 text-neutral-300'
                          : 'hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <Globe className="w-4 h-4 text-emerald-400" />
                      <div>
                        <span className="block font-semibold">Public</span>
                        <span className="text-[10px] opacity-75">Anyone on Shofi Chat</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPrivacy('private');
                        setShowPrivacyMenu(false);
                      }}
                      className={`w-full flex items-center gap-2.5 p-2 rounded-xl text-left text-xs transition-colors ${
                        privacy === 'private'
                          ? 'bg-amber-500/15 text-amber-400 font-semibold'
                          : isDarkMode
                          ? 'hover:bg-neutral-800 text-neutral-300'
                          : 'hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <Lock className="w-4 h-4 text-amber-400" />
                      <div>
                        <span className="block font-semibold">Only me (Private)</span>
                        <span className="text-[10px] opacity-75">Only you can see this post</span>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Optional Heading / Title Input */}
          {showTitleInput && (
            <div>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Blog / Article Headline..."
                className={`w-full font-bold text-sm sm:text-base rounded-2xl p-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all ${
                  isDarkMode
                    ? 'bg-neutral-950/80 border border-neutral-800 text-white placeholder-neutral-500'
                    : 'bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400'
                }`}
              />
            </div>
          )}

          {/* Main Content Textarea */}
          <div className="relative">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={`What's on your mind, ${firstName}? Write a story, article, or share thoughts...`}
              rows={5}
              autoFocus
              className={`w-full rounded-2xl p-3.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none transition-all leading-relaxed ${
                isDarkMode
                  ? 'bg-neutral-950/60 border border-neutral-800 text-neutral-100 placeholder-neutral-500'
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

          {/* Tags Selector & Custom Input */}
          {(showTagInput || selectedTags.length > 0) && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={`text-[11px] font-semibold flex items-center gap-1 ${
                    isDarkMode ? 'text-neutral-400' : 'text-slate-500'
                  }`}
                >
                  <Hash className="w-3 h-3 text-emerald-500" />
                  <span>Tags:</span>
                </span>
                {POPULAR_TAGS.map((tag) => {
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
                          ? 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:bg-neutral-750'
                          : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>

              <input
                type="text"
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                onKeyDown={handleAddCustomTag}
                placeholder="Type custom #tag & hit Enter..."
                className={`text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 w-full sm:max-w-xs ${
                  isDarkMode
                    ? 'bg-neutral-950/80 border border-neutral-800 text-neutral-200 placeholder-neutral-500'
                    : 'bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400'
                }`}
              />
            </div>
          )}

          {/* Square Image Preview (Facebook style 1:1) */}
          {imagePreview && (
            <div className="relative inline-block mt-1">
              <div className="w-56 h-56 aspect-square rounded-2xl overflow-hidden border border-neutral-700/60 shadow-lg bg-neutral-950">
                <img
                  src={imagePreview}
                  alt="Square preview"
                  className="w-full h-full object-cover"
                />
              </div>
              <button
                type="button"
                onClick={handleRemoveImage}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-black/80 hover:bg-black text-white transition-all shadow-md"
                title="Remove photo"
              >
                <X className="w-3.5 h-3.5" />
              </button>
              <span className="block text-[10px] text-neutral-400 mt-1 font-medium">
                Square 1:1 format
              </span>
            </div>
          )}

          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
          />

          {error && <p className="text-xs text-rose-500 font-medium">{error}</p>}

          {/* Facebook-style "Add to your post" toolbar */}
          <div
            className={`p-3 rounded-2xl border flex items-center justify-between ${
              isDarkMode
                ? 'bg-neutral-950/60 border-neutral-800'
                : 'bg-slate-50 border-slate-200'
            }`}
          >
            <span
              className={`text-xs font-semibold ${
                isDarkMode ? 'text-neutral-300' : 'text-slate-700'
              }`}
            >
              Add to your post
            </span>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`p-2 rounded-xl transition-colors ${
                  isDarkMode
                    ? 'text-emerald-400 hover:bg-neutral-800'
                    : 'text-emerald-600 hover:bg-slate-200'
                }`}
                title="Add Square Photo"
              >
                <ImageIcon className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setShowTitleInput((prev) => !prev)}
                className={`p-2 rounded-xl transition-colors ${
                  showTitleInput
                    ? 'text-indigo-400 bg-indigo-500/10'
                    : isDarkMode
                    ? 'text-indigo-400 hover:bg-neutral-800'
                    : 'text-indigo-600 hover:bg-slate-200'
                }`}
                title="Add Blog Headline"
              >
                <Heading className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setShowTagInput((prev) => !prev)}
                className={`p-2 rounded-xl transition-colors ${
                  showTagInput || selectedTags.length > 0
                    ? 'text-teal-400 bg-teal-500/10'
                    : isDarkMode
                    ? 'text-teal-400 hover:bg-neutral-800'
                    : 'text-teal-600 hover:bg-slate-200'
                }`}
                title="Add Hashtags"
              >
                <Hash className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer Post Button */}
        <div
          className={`p-4 border-t ${
            isDarkMode ? 'border-neutral-800' : 'border-slate-100'
          }`}
        >
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || (!content.trim() && !imagePreview)}
            className="w-full py-2.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-sm shadow-md shadow-emerald-950/30 transition-all flex items-center justify-center gap-2 active:scale-[0.99]"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Publishing...</span>
              </>
            ) : (
              <span>Post</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
