'use client';

import React, { useState, useRef } from 'react';
import { X, Image as ImageIcon, Loader2, Check } from 'lucide-react';
import { Post } from '@/types';
import { apiRequest } from '@/lib/api';

interface EditPostModalProps {
  post: Post | null;
  isOpen: boolean;
  onClose: () => void;
  onPostUpdated: (updatedPost: Post) => void;
  isDarkMode?: boolean;
}

export const EditPostModal: React.FC<EditPostModalProps> = ({
  post,
  isOpen,
  onClose,
  onPostUpdated,
  isDarkMode = true,
}) => {
  const [content, setContent] = useState(post?.content || '');
  const [imagePreview, setImagePreview] = useState<string | null>(post?.imageUrl || null);
  const [hasChangedImage, setHasChangedImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (post) {
      setContent(post.content || '');
      setImagePreview(post.imageUrl || null);
      setHasChangedImage(false);
      setError('');
    }
  }, [post]);

  if (!isOpen || !post) return null;

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
      setHasChangedImage(true);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setImagePreview(null);
    setHasChangedImage(true);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      setError('Post text cannot be empty');
      return;
    }

    try {
      setSaving(true);
      setError('');

      const bodyPayload: any = {
        content: content.trim(),
      };

      if (hasChangedImage) {
        bodyPayload.image = imagePreview || '';
      }

      const data = await apiRequest(`/posts/${post.id}`, {
        method: 'PUT',
        body: JSON.stringify(bodyPayload),
      });

      if (data?.post) {
        onPostUpdated(data.post);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update post');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className={`w-full max-w-lg rounded-3xl p-6 shadow-2xl relative overflow-hidden transition-colors border animate-in zoom-in-95 duration-200 ${
          isDarkMode
            ? 'bg-neutral-900 border-neutral-800 text-white'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800/80 mb-4">
          <div>
            <h3 className="text-base font-bold tracking-tight">Edit Post</h3>
            <p
              className={`text-xs ${
                isDarkMode ? 'text-neutral-400' : 'text-slate-500'
              }`}
            >
              Update your caption or photo
            </p>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-xl transition-colors ${
              isDarkMode
                ? 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
            }`}
            title="Cancel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              className={`block text-xs font-semibold mb-1.5 ${
                isDarkMode ? 'text-neutral-300' : 'text-slate-700'
              }`}
            >
              Post Content
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              placeholder="What would you like to update?"
              className={`w-full rounded-2xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 resize-none transition-all ${
                isDarkMode
                  ? 'bg-neutral-950/80 border border-neutral-800 text-neutral-100 placeholder-neutral-500'
                  : 'bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400'
              }`}
            />
          </div>

          {/* Image preview & change */}
          <div>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />

            {imagePreview ? (
              <div className="relative inline-block mt-1">
                <img
                  src={imagePreview}
                  alt="Post preview"
                  className="max-h-48 rounded-2xl object-cover border border-neutral-700/60 shadow"
                />
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-black/80 hover:bg-black text-white transition-all shadow-md"
                  title="Remove photo"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium border transition-colors ${
                  isDarkMode
                    ? 'bg-neutral-800 hover:bg-neutral-750 text-neutral-300 border-neutral-700'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                }`}
              >
                <ImageIcon className="w-4 h-4 text-emerald-500" />
                <span>Add / Replace Photo</span>
              </button>
            )}
          </div>

          {error && <p className="text-xs text-rose-500 font-medium">{error}</p>}

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-neutral-800/80">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className={`px-4 py-2 rounded-xl text-xs font-medium transition-colors ${
                isDarkMode
                  ? 'bg-neutral-800 hover:bg-neutral-750 text-neutral-300'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !content.trim()}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold shadow-lg shadow-emerald-950/40 transition-all active:scale-95"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
