'use client';

import React, { useState, useEffect } from 'react';
import {
  Bell,
  BellRing,
  Volume2,
  VolumeX,
  MessageSquare,
  AtSign,
  Reply,
  Check,
  X,
  Sparkles,
} from 'lucide-react';
import {
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  getNotificationPreferences,
  saveNotificationPreferences,
  triggerNotification,
  NotificationPreferences,
} from '@/lib/notification';

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTestToast?: (title: string, body: string) => void;
}

export const NotificationModal: React.FC<NotificationModalProps> = ({
  isOpen,
  onClose,
  onTestToast,
}) => {
  const [permission, setPermission] = useState<string>('default');
  const [prefs, setPrefs] = useState<NotificationPreferences>({
    sound: true,
    desktop: true,
    inAppToast: true,
    notifyReply: true,
    notifyMention: true,
  });
  const [testSent, setTestSent] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (isNotificationSupported()) {
        setPermission(getNotificationPermission());
      }
      setPrefs(getNotificationPreferences());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRequestPermission = async () => {
    const granted = await requestNotificationPermission();
    setPermission(granted ? 'granted' : 'denied');
  };

  const handleTogglePref = (key: keyof NotificationPreferences) => {
    const nextVal = !prefs[key];
    const updated = saveNotificationPreferences({ [key]: nextVal });
    setPrefs(updated);
  };

  const handleSendTestNotification = () => {
    setTestSent(true);
    triggerNotification('Shofi Chat Test Alert 🔔', {
      body: 'Notifications and sound chime are working properly on your device!',
    });
    onTestToast?.(
      'Shofi Chat Test Alert 🔔',
      'Notifications and sound chime are working properly on your device!'
    );
    setTimeout(() => setTestSent(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
              <BellRing className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-white">Notification Setup</h3>
              <p className="text-xs text-neutral-400">Manage real-time alerts & sound chime</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar">
          {/* 1. System / Browser Notifications */}
          <div className="p-3.5 rounded-2xl bg-neutral-800/60 border border-neutral-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-semibold text-white">Desktop & Mobile Alerts</span>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  permission === 'granted'
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/50'
                    : 'bg-amber-950 text-amber-300 border border-amber-800/50'
                }`}
              >
                {permission === 'granted' ? 'Active' : permission === 'denied' ? 'Blocked' : 'Action Needed'}
              </span>
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Receive notifications for incoming messages and calls even when the browser tab is in the background.
            </p>
            {permission !== 'granted' && (
              <button
                onClick={handleRequestPermission}
                className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-emerald-900/30"
              >
                <BellRing className="w-4 h-4" />
                <span>Enable Notifications Permission</span>
              </button>
            )}
          </div>

          {/* 2. Notification Preferences Switches */}
          <div className="space-y-2">
            {/* Chime Sound */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-800/40 border border-white/5">
              <div className="flex items-center gap-2.5">
                {prefs.sound ? (
                  <Volume2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <VolumeX className="w-4 h-4 text-neutral-400" />
                )}
                <div>
                  <p className="text-xs font-medium text-white">Notification Chime Sound</p>
                  <p className="text-[11px] text-neutral-400">Play pleasant sound on new messages</p>
                </div>
              </div>
              <button
                onClick={() => handleTogglePref('sound')}
                className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                  prefs.sound ? 'bg-emerald-600' : 'bg-neutral-700'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    prefs.sound ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* In-App Floating Toasts */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-800/40 border border-white/5">
              <div className="flex items-center gap-2.5">
                <MessageSquare className="w-4 h-4 text-emerald-400" />
                <div>
                  <p className="text-xs font-medium text-white">In-App Floating Banner</p>
                  <p className="text-[11px] text-neutral-400">Show visual toast banner at top-right</p>
                </div>
              </div>
              <button
                onClick={() => handleTogglePref('inAppToast')}
                className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                  prefs.inAppToast ? 'bg-emerald-600' : 'bg-neutral-700'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    prefs.inAppToast ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Reply Notifications */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-800/40 border border-white/5">
              <div className="flex items-center gap-2.5">
                <Reply className="w-4 h-4 text-emerald-400" />
                <div>
                  <p className="text-xs font-medium text-white">Reply Notifications</p>
                  <p className="text-[11px] text-neutral-400">Alert when someone replies to your message</p>
                </div>
              </div>
              <button
                onClick={() => handleTogglePref('notifyReply')}
                className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                  prefs.notifyReply ? 'bg-emerald-600' : 'bg-neutral-700'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    prefs.notifyReply ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Mention Notifications */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-800/40 border border-white/5">
              <div className="flex items-center gap-2.5">
                <AtSign className="w-4 h-4 text-emerald-400" />
                <div>
                  <p className="text-xs font-medium text-white">@ Mention Notifications</p>
                  <p className="text-[11px] text-neutral-400">Alert when tagged in group messages</p>
                </div>
              </div>
              <button
                onClick={() => handleTogglePref('notifyMention')}
                className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                  prefs.notifyMention ? 'bg-emerald-600' : 'bg-neutral-700'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    prefs.notifyMention ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* 3. Test Button */}
          <div className="pt-2">
            <button
              onClick={handleSendTestNotification}
              className="w-full py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white text-xs font-medium transition-all flex items-center justify-center gap-2 border border-neutral-700"
            >
              {testSent ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400">Test Notification Sent!</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span>Send Test Notification Now</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-neutral-800 bg-neutral-900/60 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
