'use client';

import React from 'react';

export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div
      className={`skeleton-shimmer rounded-xl ${className}`}
    />
  );
};

export const SidebarSkeleton: React.FC = () => {
  return (
    <div className="space-y-3 p-3">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="flex items-center gap-3 p-2.5 rounded-2xl bg-neutral-900/60 border border-neutral-800/60">
          <Skeleton className="w-11 h-11 rounded-2xl flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="w-28 h-3.5" />
            <Skeleton className="w-40 h-2.5" />
          </div>
          <Skeleton className="w-10 h-2.5 rounded-full" />
        </div>
      ))}
    </div>
  );
};

export const ChatAreaSkeleton: React.FC = () => {
  return (
    <div className="flex-1 flex flex-col justify-end p-4 space-y-4">
      {/* Remote bubble */}
      <div className="flex items-start gap-2.5 max-w-[70%]">
        <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
        <div className="space-y-1.5 flex-1">
          <Skeleton className="w-24 h-3" />
          <Skeleton className="w-56 h-12 rounded-2xl" />
        </div>
      </div>

      {/* Self bubble */}
      <div className="flex items-end justify-end">
        <Skeleton className="w-64 h-14 rounded-2xl rounded-br-sm" />
      </div>

      {/* Remote bubble */}
      <div className="flex items-start gap-2.5 max-w-[60%]">
        <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
        <div className="space-y-1.5 flex-1">
          <Skeleton className="w-20 h-3" />
          <Skeleton className="w-44 h-10 rounded-2xl" />
        </div>
      </div>

      {/* Self bubble */}
      <div className="flex items-end justify-end">
        <Skeleton className="w-48 h-10 rounded-2xl rounded-br-sm" />
      </div>
    </div>
  );
};
