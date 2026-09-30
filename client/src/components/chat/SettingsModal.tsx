'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  User,
  AtSign,
  Clock,
  HardDrive,
  Check,
  Loader2,
  Sparkles,
  LogOut,
  Upload,
  Camera,
  FileText,
  Trash2,
  Lock,
} from 'lucide-react';
import { User as UserType } from '@/types';
import { Avatar } from '../ui/Avatar';
import { apiRequest } from '@/lib/api';
import { useRouter } from 'next/navigation';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserType | null;
  onSaveProfile: (data: {
    name?: string;
    username?: string;
    avatar?: string;
    bio?: string;
    settings?: {
      saveChatHistory?: boolean;
      chatRetentionDays?: number;
      hasCompletedSetup?: boolean;
    };
  }) => Promise<any>;
  onLogout?: () => void;
  isInitialSetup?: boolean;
}

const PRESET_DAYS = [1, 3, 7, 10, 15];

const AVATAR_SEEDS = ['Felix', 'Luna', 'Alex', 'Sarah', 'Leo', 'Maya'];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSaveProfile,
  onLogout,
  isInitialSetup = false,
}) => {
  const router = useRouter();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [avatar, setAvatar] = useState('');
  const [bio, setBio] = useState('');
  const [saveChatHistory, setSaveChatHistory] = useState(true);
  const [retentionDays, setRetentionDays] = useState(15);
  const [isCustomDays, setIsCustomDays] = useState(false);
  const [customDaysInput, setCustomDaysInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteProfileModal, setShowDeleteProfileModal] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isDeletingProfile, setIsDeletingProfile] = useState(false);
  const [copiedName, setCopiedName] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isSuperAdmin = currentUser && ['shofiqul.sujon2201@gmail.com'].includes((currentUser.email || '').toLowerCase());

  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name || '');
      const emailPrefix = currentUser.email ? currentUser.email.split('@')[0] : '';
      setUsername(currentUser.username || emailPrefix);
      setAvatar(currentUser.avatar || '');
      setBio(currentUser.bio || '');

      const userSettings = currentUser.settings || {};
      setSaveChatHistory(userSettings.saveChatHistory !== false);

      const days = userSettings.chatRetentionDays || 15;
      if (PRESET_DAYS.includes(days)) {
        setRetentionDays(days);
        setIsCustomDays(false);
      } else {
        setRetentionDays(days);
        setIsCustomDays(true);
        setCustomDaysInput(String(days));
      }
    }
  }, [currentUser, isOpen]);

  if (!isOpen) return null;

  const handleSelectDays = (days: number) => {
    setIsCustomDays(false);
    setRetentionDays(days);
  };

  const handleCustomDaysChange = (val: string) => {
    setCustomDaysInput(val);
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed > 0) {
      setRetentionDays(parsed);
    }
  };

  const handleSelectAvatarPreset = (seed: string) => {
    const newAvatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(seed)}`;
    setAvatar(newAvatar);
  };

  // Direct File Upload handler (Device Gallery / Camera)
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      setError('Image file size must be less than 8MB');
      return;
    }
    setError(null);

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAvatar(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setFeedback(null);
      setError(null);

      const finalDays = isCustomDays ? parseInt(customDaysInput, 10) || 15 : retentionDays;

      await onSaveProfile({
        name: name.trim(),
        username: username.trim(),
        avatar: avatar.trim(),
        bio: bio.trim(),
        settings: {
          saveChatHistory,
          chatRetentionDays: finalDays,
          hasCompletedSetup: true,
        },
      });

      setFeedback('Profile updated successfully!');
      setTimeout(() => {
        setFeedback(null);
        onClose();
      }, 900);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmName.trim() !== (currentUser?.name || '').trim()) {
      setDeleteError('Profile name does not match. Name na mille delete hobe na.');
      return;
    }

    try {
      setIsDeletingProfile(true);
      setDeleteError('');
      await apiRequest('/users/profile', { method: 'DELETE' });
      setShowDeleteProfileModal(false);
      onClose();
      if (onLogout) {
        onLogout();
      } else {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        router.push('/login');
      }
    } catch (err: unknown) {
      setIsDeletingProfile(false);
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete profile');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in select-none">
      <div className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white tracking-tight">
                {isInitialSetup ? 'Welcome! Set Up Your Profile' : 'Profile & Storage Settings'}
              </h2>
              {isInitialSetup && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-semibold">
                  Required
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              Customize your profile details and conversation retention preferences
            </p>
          </div>

          {!isInitialSetup && (
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {feedback && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs text-center font-medium flex items-center justify-center gap-2">
            <Check className="w-4 h-4" />
            <span>{feedback}</span>
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs text-center font-medium flex items-center justify-center gap-2">
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 mt-5">
          {/* PROFILE SECTION */}
          <div className="space-y-4">
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider block">
              1. Profile Information
            </span>

            {/* Direct Image File Upload & Preview */}
            <div className="p-4 rounded-2xl bg-neutral-950/60 border border-neutral-800 space-y-3">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleImageFileChange}
                className="hidden"
              />

              <div className="flex items-center gap-4">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="relative group cursor-pointer rounded-2xl overflow-hidden ring-2 ring-emerald-500/30 hover:ring-emerald-500 transition-all flex-shrink-0"
                >
                  <Avatar name={name || 'User'} avatar={avatar} size="lg" />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[10px] font-medium gap-0.5">
                    <Camera className="w-4 h-4 text-emerald-400" />
                    <span>Change</span>
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-semibold text-white">Profile Photo</h4>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    Upload a custom image from your device or gallery
                  </p>

                  <div className="flex items-center gap-2 mt-2.5">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Photo</span>
                    </button>

                    {avatar && (
                      <button
                        type="button"
                        onClick={() => setAvatar('')}
                        className="p-1.5 rounded-xl text-neutral-400 hover:text-rose-400 hover:bg-neutral-800 transition-colors"
                        title="Remove custom photo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Avatar Generator Presets */}
            <div>
              <span className="text-[11px] text-neutral-400 block mb-1.5 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" />
                Or pick a preset avatar:
              </span>
              <div className="flex gap-2 flex-wrap">
                {AVATAR_SEEDS.map((seed) => (
                  <button
                    key={seed}
                    type="button"
                    onClick={() => handleSelectAvatarPreset(seed)}
                    className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-xs text-neutral-300 transition-colors"
                  >
                    {seed}
                  </button>
                ))}
              </div>
            </div>

            {/* Name */}
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1">
                Display Name
              </label>
              <div className="flex items-center bg-neutral-800/80 rounded-xl px-3.5 py-2.5 border border-neutral-700 focus-within:border-emerald-500">
                <User className="w-4 h-4 text-neutral-400 mr-2.5 flex-shrink-0" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your Name"
                  className="w-full bg-transparent text-sm text-white placeholder-neutral-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Username (Permanent - derived from email prefix) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-neutral-300">
                  Username (Permanent ID)
                </label>
                <span className="text-[10px] text-neutral-400 flex items-center gap-1 font-medium bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800">
                  <Lock className="w-2.5 h-2.5 text-neutral-400" /> Locked to email handle
                </span>
              </div>
              <div className="flex items-center bg-neutral-900/80 rounded-xl px-3.5 py-2.5 border border-neutral-800 text-neutral-300 select-none">
                <AtSign className="w-4 h-4 text-emerald-500 mr-2 flex-shrink-0" />
                <span className="font-mono text-sm font-semibold tracking-tight text-white">
                  {username || (currentUser?.email ? currentUser.email.split('@')[0] : '')}
                </span>
                <span className="ml-auto text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">
                  Cannot be changed
                </span>
              </div>
              <p className="text-[11px] text-neutral-500 mt-1">
                Your username is derived from your email address and is permanently locked.
              </p>
            </div>

            {/* Bio / About */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-neutral-300">
                  Bio / Status
                </label>
                <span className="text-[10px] text-neutral-500 font-mono">
                  {bio.length}/200
                </span>
              </div>
              <div className="flex items-start bg-neutral-800/80 rounded-xl p-3 border border-neutral-700 focus-within:border-emerald-500">
                <FileText className="w-4 h-4 text-neutral-400 mr-2.5 mt-0.5 flex-shrink-0" />
                <textarea
                  value={bio}
                  maxLength={200}
                  rows={2}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Write a short bio or status..."
                  className="w-full bg-transparent text-sm text-white placeholder-neutral-500 focus:outline-none resize-none"
                />
              </div>
            </div>
          </div>

          {/* STORAGE & RETENTION SECTION */}
          <div className="space-y-4 pt-4 border-t border-neutral-800">
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider block">
              2. Chat History & Database Retention
            </span>

            {/* Save Chat Toggle */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-neutral-950/60 border border-neutral-800">
              <div className="pr-4">
                <h4 className="text-sm font-semibold text-white">Save Chat History</h4>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Save your messages in the database. If turned off, messages disappear after 24 hours.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSaveChatHistory((prev) => !prev)}
                className={`w-12 h-6 rounded-full transition-colors relative flex items-center p-0.5 ${
                  saveChatHistory ? 'bg-emerald-500' : 'bg-neutral-700'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    saveChatHistory ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Retention Duration Selector */}
            {saveChatHistory && (
              <div className="space-y-2">
                <label className="block text-xs font-medium text-neutral-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Auto-delete / Disappearing Messages After:</span>
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {PRESET_DAYS.map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => handleSelectDays(days)}
                      className={`py-2 px-2.5 rounded-xl text-xs font-semibold border transition-all text-center ${
                        !isCustomDays && retentionDays === days
                          ? 'bg-emerald-600/25 border-emerald-500 text-emerald-300 shadow-sm'
                          : 'bg-neutral-800/80 border-neutral-700 text-neutral-300 hover:bg-neutral-800'
                      }`}
                    >
                      {days} {days === 1 ? 'Day' : 'Days'}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setIsCustomDays(true)}
                    className={`py-2 px-2.5 rounded-xl text-xs font-semibold border transition-all text-center ${
                      isCustomDays
                        ? 'bg-emerald-600/25 border-emerald-500 text-emerald-300 shadow-sm'
                        : 'bg-neutral-800/80 border-neutral-700 text-neutral-300 hover:bg-neutral-800'
                    }`}
                  >
                    Custom
                  </button>
                </div>

                {isCustomDays && (
                  <div className="mt-2 flex items-center gap-2 animate-in fade-in">
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={customDaysInput}
                      onChange={(e) => handleCustomDaysChange(e.target.value)}
                      placeholder="e.g. 30"
                      className="w-24 px-3 py-1.5 rounded-xl bg-neutral-800 border border-neutral-700 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                    />
                    <span className="text-xs text-neutral-400">days retention</span>
                  </div>
                )}
              </div>
            )}

            {/* Database Cap Safeguard Notice */}
            <div className="p-3.5 rounded-2xl bg-neutral-950/80 border border-emerald-500/20 flex items-start gap-3">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 flex-shrink-0 mt-0.5">
                <HardDrive className="w-4 h-4" />
              </div>
              <div>
                <h5 className="text-xs font-semibold text-neutral-200">
                  Storage Cap Protection Active (Max 300 Messages)
                </h5>
                <p className="text-[11px] text-neutral-400 mt-0.5 leading-relaxed">
                  To keep the database lightweight and ultra-fast, only the newest 300 messages are stored per conversation. When new messages arrive past 300, the oldest messages are automatically cleaned up.
                </p>
              </div>
            </div>

            {/* Danger Zone: Delete Profile & Account */}
            {!isSuperAdmin && !isInitialSetup && (
              <div className="p-4 rounded-2xl bg-rose-950/20 border border-rose-900/40 flex items-center justify-between gap-4">
                <div>
                  <h5 className="text-xs font-semibold text-rose-300 flex items-center gap-1.5">
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    Delete Profile &amp; Account
                  </h5>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    Permanently delete your profile, chat messages, and account data.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDeleteConfirmName('');
                    setDeleteError('');
                    setShowDeleteProfileModal(true);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 text-xs font-semibold transition-all flex items-center gap-1.5 flex-shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Profile</span>
                </button>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-neutral-800 flex items-center justify-between gap-3">
            {onLogout ? (
              <button
                type="button"
                onClick={onLogout}
                className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-red-500/20 text-neutral-400 hover:text-red-400 border border-neutral-700 text-xs font-medium flex items-center gap-2 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            ) : <div />}

            <div className="flex gap-2">
              {!isInitialSetup && (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-neutral-300 transition-colors"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition-all active:scale-95"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Save Preferences</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Delete Profile Confirmation Popup (Name match required) */}
      {showDeleteProfileModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-neutral-900 border border-rose-900/50 rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <Trash2 className="w-6 h-6" />
              </div>
              <button
                type="button"
                onClick={() => setShowDeleteProfileModal(false)}
                className="p-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <h3 className="text-base font-bold text-white mb-1.5">
              Delete Profile &amp; Account?
            </h3>
            <p className="text-xs text-rose-300/90 leading-relaxed mb-4">
              ⚠️ This is a permanent action. All your messages, contacts, and personal profile data will be permanently wiped out. This cannot be undone.
            </p>

            <div className="bg-neutral-950/80 border border-neutral-800 rounded-2xl p-3.5 mb-4">
              <div className="flex items-center justify-between text-xs text-neutral-400 mb-1.5">
                <span>To confirm, copy or type your profile name:</span>
                <button
                  type="button"
                  onClick={() => {
                    if (currentUser?.name) {
                      navigator.clipboard.writeText(currentUser.name);
                      setCopiedName(true);
                      setTimeout(() => setCopiedName(false), 2000);
                    }
                  }}
                  className="text-[11px] text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
                >
                  {copiedName ? '✓ Copied' : 'Copy Name'}
                </button>
              </div>
              <div className="p-2 rounded-xl bg-neutral-900 border border-neutral-700/60 font-mono text-sm text-amber-300 select-all break-all">
                {currentUser?.name || ''}
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                Type your exact name to unlock deletion:
              </label>
              <input
                type="text"
                value={deleteConfirmName}
                onChange={(e) => {
                  setDeleteConfirmName(e.target.value);
                  setDeleteError('');
                }}
                placeholder={currentUser?.name || 'Enter exact name'}
                className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-800 border border-neutral-700 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500 font-medium"
              />
              {deleteConfirmName.trim() && deleteConfirmName.trim() !== (currentUser?.name || '').trim() && (
                <p className="text-[11px] text-rose-400 mt-1.5">
                  Name does not match. Please enter &quot;{currentUser?.name}&quot; exactly.
                </p>
              )}
              {deleteError && (
                <p className="text-[11px] text-rose-400 mt-1.5">
                  {deleteError}
                </p>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteProfileModal(false)}
                disabled={isDeletingProfile}
                className="flex-1 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  isDeletingProfile ||
                  deleteConfirmName.trim() !== (currentUser?.name || '').trim()
                }
                onClick={handleDeleteAccount}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:hover:bg-rose-600 text-xs font-semibold text-white flex items-center justify-center gap-1.5 shadow-lg shadow-rose-600/30 transition-all active:scale-98"
              >
                {isDeletingProfile ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Permanently</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
