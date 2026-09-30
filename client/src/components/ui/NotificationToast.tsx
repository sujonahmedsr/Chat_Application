'use client';

import React, { useEffect } from 'react';
import { MessageSquare, X } from 'lucide-react';

export interface ToastNotificationData {
  id: string;
  title: string;
  body: string;
  onClick?: () => void;
}

interface NotificationToastProps {
  notification: ToastNotificationData | null;
  onClose: () => void;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({
  notification,
  onClose,
}) => {
  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => {
      onClose();
    }, 4500);
    return () => clearTimeout(timer);
  }, [notification, onClose]);

  if (!notification) return null;

  return (
    <div className="fixed top-5 right-5 z-50 max-w-sm w-[calc(100vw-2.5rem)] sm:w-80 animate-in fade-in slide-in-from-top-4 duration-200">
      <div
        onClick={() => {
          notification.onClick?.();
          onClose();
        }}
        className="cursor-pointer bg-neutral-900/95 backdrop-blur-md border border-emerald-500/40 hover:border-emerald-500 text-white p-3.5 rounded-2xl shadow-2xl flex items-start gap-3 transition-all hover:scale-[1.02]"
      >
        <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 flex-shrink-0 mt-0.5">
          <MessageSquare className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-semibold text-emerald-400 truncate">
              {notification.title}
            </h4>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-xs text-neutral-200 line-clamp-2 mt-0.5">
            {notification.body}
          </p>
        </div>
      </div>
    </div>
  );
};
