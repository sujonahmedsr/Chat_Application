'use client';

import React from 'react';

interface AvatarProps {
  name: string;
  avatar?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isOnline?: boolean;
  showStatus?: boolean;
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-20 h-20 text-xl font-bold',
};

const badgeSizeClasses = {
  sm: 'w-2.5 h-2.5 bottom-0 right-0',
  md: 'w-3 h-3 bottom-0 right-0',
  lg: 'w-3.5 h-3.5 bottom-0.5 right-0.5',
  xl: 'w-5 h-5 bottom-1 right-1',
};

export const Avatar: React.FC<AvatarProps> = ({
  name,
  avatar,
  size = 'md',
  isOnline = false,
  showStatus = false,
}) => {
  const getInitials = (str: string) => {
    if (!str) return '?';
    const parts = str.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return str.slice(0, 2).toUpperCase();
  };

  return (
    <div className={`relative inline-flex flex-shrink-0 items-center justify-center ${sizeClasses[size]} rounded-full select-none`}>
      {avatar ? (
        <img
          src={avatar}
          alt={name}
          className="w-full h-full rounded-full object-cover bg-neutral-800"
          onError={(e) => {
            // fallback if avatar image fails
            (e.target as HTMLElement).style.display = 'none';
          }}
        />
      ) : (
        <div className="w-full h-full rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-medium shadow-inner">
          {getInitials(name)}
        </div>
      )}

      {showStatus && (
        <span
          className={`absolute rounded-full ring-2 ring-neutral-900 ${badgeSizeClasses[size]} ${
            isOnline ? 'bg-emerald-500 shadow-sm' : 'bg-neutral-500'
          }`}
          title={isOnline ? 'Online' : 'Offline'}
        />
      )}
    </div>
  );
};
