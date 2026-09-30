'use client';

import React, { useState } from 'react';
import { X, Users, Check, Loader2 } from 'lucide-react';
import { User, Group } from '@/types';
import { apiRequest } from '@/lib/api';
import { Avatar } from '../ui/Avatar';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableUsers: User[];
  onGroupCreated: (group: Group) => void;
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  isOpen,
  onClose,
  availableUsers,
  onGroupCreated,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const toggleUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide a group name');
      return;
    }

    try {
      setError('');
      setSubmitting(true);
      const data = await apiRequest('/groups', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          memberIds: selectedUserIds,
        }),
      });

      onGroupCreated(data.group);
      onClose();
      setName('');
      setDescription('');
      setSelectedUserIds([]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create group');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-md mx-4 bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Create New Group</h3>
              <p className="text-xs text-neutral-400">Start a group chat with contacts</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-3 p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs text-center font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleCreate} className="flex-1 overflow-y-auto mt-4 space-y-4 pr-1">
          {/* Group Name */}
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1.5">
              Group Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Project Alpha Team"
              className="w-full bg-neutral-800/80 border border-neutral-700/60 rounded-xl px-3.5 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Group Description */}
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1.5">
              Description (optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Topic or description"
              className="w-full bg-neutral-800/80 border border-neutral-700/60 rounded-xl px-3.5 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Select Members */}
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-2">
              Select Members ({selectedUserIds.length} selected)
            </label>
            <div className="max-h-48 overflow-y-auto space-y-1 rounded-xl bg-neutral-900/60 p-2 border border-neutral-800">
              {availableUsers.length === 0 ? (
                <p className="text-xs text-neutral-500 text-center py-4">
                  No other contacts registered yet
                </p>
              ) : (
                availableUsers.map((u) => {
                  const isChecked = selectedUserIds.includes(u.id);
                  return (
                    <div
                      key={u.id}
                      onClick={() => toggleUser(u.id)}
                      className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-colors ${
                        isChecked ? 'bg-emerald-950/40 border border-emerald-800/40' : 'hover:bg-neutral-800'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Avatar name={u.name} avatar={u.avatar} size="sm" />
                        <div>
                          <p className="text-xs font-medium text-neutral-200">{u.name}</p>
                          <p className="text-[10px] text-neutral-400">{u.email}</p>
                        </div>
                      </div>

                      <div
                        className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                          isChecked
                            ? 'bg-emerald-600 border-emerald-500 text-white'
                            : 'border-neutral-600 bg-neutral-800'
                        }`}
                      >
                        {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || !name.trim()}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-98 transition-all"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Creating group...</span>
              </>
            ) : (
              <span>Create Group</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
