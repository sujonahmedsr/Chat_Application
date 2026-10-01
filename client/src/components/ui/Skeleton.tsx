'use client';

import React from 'react';

export const Skeleton: React.FC<{ className?: string; style?: React.CSSProperties }> = ({
  className = '',
  style,
}) => {
  return <div className={`skeleton-shimmer rounded-xl ${className}`} style={style} />;
};

// ===== SIDEBAR SKELETON (WhatsApp Chat List Style) =====
export const SidebarSkeleton: React.FC = () => {
  const items = [
    { nameW: 72, msgW: 140 },
    { nameW: 96, msgW: 120 },
    { nameW: 64, msgW: 160 },
    { nameW: 88, msgW: 100 },
    { nameW: 76, msgW: 130 },
    { nameW: 100, msgW: 110 },
    { nameW: 60, msgW: 150 },
    { nameW: 80, msgW: 90 },
  ];

  return (
    <div className="space-y-1 p-3">
      {items.map((item, i) => (
        <div
          key={i}
          className="flex items-center gap-3 p-3 rounded-2xl skeleton-stagger"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          {/* Avatar — circle like WhatsApp */}
          <Skeleton className="w-12 h-12 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2.5">
            {/* Name + timestamp row */}
            <div className="flex items-center justify-between">
              <Skeleton className="h-3.5 rounded-full" style={{ width: `${item.nameW}px` }} />
              <Skeleton className="w-10 h-2.5 rounded-full opacity-60" />
            </div>
            {/* Last message preview */}
            <Skeleton className="h-2.5 rounded-full" style={{ width: `${item.msgW}px` }} />
          </div>
        </div>
      ))}
    </div>
  );
};

// ===== CHAT AREA SKELETON (WhatsApp/Telegram Message Bubbles) =====
export const ChatAreaSkeleton: React.FC = () => {
  // Alternating left/right with varying widths — mimics real conversation
  const bubbles = [
    { side: 'left' as const, w: 'w-48', h: 'h-11', delay: 0 },
    { side: 'left' as const, w: 'w-36', h: 'h-9', delay: 60 },
    { side: 'right' as const, w: 'w-56', h: 'h-14', delay: 120 },
    { side: 'left' as const, w: 'w-44', h: 'h-[4.5rem]', delay: 180 },
    { side: 'right' as const, w: 'w-40', h: 'h-10', delay: 240 },
    { side: 'right' as const, w: 'w-52', h: 'h-12', delay: 300 },
    { side: 'left' as const, w: 'w-60', h: 'h-16', delay: 360 },
    { side: 'right' as const, w: 'w-44', h: 'h-10', delay: 420 },
  ];

  return (
    <div className="flex-1 flex flex-col justify-end p-4 space-y-3 overflow-hidden">
      {bubbles.map((b, idx) => (
        <div
          key={idx}
          className={`flex ${b.side === 'right' ? 'justify-end' : 'justify-start'} items-end gap-2 skeleton-stagger`}
          style={{ animationDelay: `${b.delay}ms` }}
        >
          {b.side === 'left' && (
            <Skeleton className="w-7 h-7 rounded-full flex-shrink-0 opacity-50" />
          )}
          <div
            className={`flex flex-col ${b.side === 'right' ? 'items-end' : 'items-start'} gap-1`}
          >
            <Skeleton
              className={`${b.w} ${b.h} ${
                b.side === 'right' ? 'rounded-2xl rounded-br-sm' : 'rounded-2xl rounded-bl-sm'
              }`}
            />
            <Skeleton className="w-10 h-2 rounded-full opacity-30" />
          </div>
        </div>
      ))}
    </div>
  );
};

// ===== CONTACT INFO SKELETON (Profile header while loading) =====
export const ContactInfoSkeleton: React.FC = () => (
  <div className="flex items-center gap-3 p-3">
    <Skeleton className="w-10 h-10 rounded-full" />
    <div className="space-y-1.5 flex-1">
      <Skeleton className="w-28 h-3.5 rounded-full" />
      <Skeleton className="w-16 h-2.5 rounded-full opacity-60" />
    </div>
  </div>
);
