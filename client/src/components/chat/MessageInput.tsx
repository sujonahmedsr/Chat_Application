'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Smile,
  Mic,
  Trash2,
  X,
  AtSign,
  ArrowUp,
  Search,
} from 'lucide-react';
import { User } from '@/types';
import { Avatar } from '../ui/Avatar';

interface AttachmentPayload {
  messageType: 'text' | 'image' | 'file' | 'audio' | 'call';
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
}

interface MessageInputProps {
  onSendMessage: (content: string, attachment?: AttachmentPayload) => void;
  onTypingStart: () => void;
  onTypingStop: () => void;
  groupMembers?: User[];
}

interface EmojiCategory {
  id: string;
  name: string;
  icon: string;
  emojis: string[];
}

const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    id: 'smileys',
    name: 'Smileys',
    icon: '😊',
    emojis: ['😊', '😂', '🤣', '❤️', '😍', '🥰', '😘', '😎', '🤩', '🥳', '🥺', '😭', '😇', '🤔', '🤫', '🤗', '😴', '😜', '🔥', '💯', '✨', '💖', '💔', '💀'],
  },
  {
    id: 'gestures',
    name: 'Gestures',
    icon: '👍',
    emojis: ['👍', '👎', '👏', '🙌', '🙏', '🤝', '✌️', '🤞', '💪', '👋', '🤙', '👌', '👀', '🫡', '👊', '✊', '🤛', '🤜', '🫰', '🫶'],
  },
  {
    id: 'nature',
    name: 'Nature & Animals',
    icon: '🌸',
    emojis: ['🐱', '🐶', '🦁', '🐼', '🦊', '🌺', '🌸', '🌹', '🍀', '🌴', '🌞', '🌙', '⭐', '🌈', '🌧️', '❄️', '🌿', '🌱', '🌻', '🍁'],
  },
  {
    id: 'food',
    name: 'Food & Drink',
    icon: '🍕',
    emojis: ['☕', '🍕', '🍔', '🍦', '🍩', '🍫', '🍿', '🧁', '🍟', '🍣', '🍎', '🍓', '🍇', '🍉', '🥑', '🍹', '🍺', '🎂', '🥞', '🥤'],
  },
  {
    id: 'objects',
    name: 'Objects & Travel',
    icon: '🚀',
    emojis: ['🎉', '🚀', '⚡', '💡', '🎵', '🎮', '📱', '💻', '📷', '✈️', '🚗', '🏆', '🎯', '🎈', '🎁', '💎', '🔑', '🔔', '📌', '📦'],
  },
];

export const MessageInput: React.FC<MessageInputProps> = ({
  onSendMessage,
  onTypingStart,
  onTypingStop,
  groupMembers = [],
}) => {
  const [content, setContent] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeEmojiCategory, setActiveEmojiCategory] = useState<string>('smileys');
  const [emojiSearch, setEmojiSearch] = useState('');

  // Mention state
  const [showMentions, setShowMentions] = useState(false);
  const [filteredMembers, setFilteredMembers] = useState<User[]>([]);
  const [mentionSelectedIndex, setMentionSelectedIndex] = useState(0);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const typingTimeoutRef = useRef<any>(null);
  const isTypingRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);


  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);

  // Auto-resize textarea like ChatGPT / Telegram
  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(textareaRef.current.scrollHeight, 140);
      textareaRef.current.style.height = `${newHeight}px`;
    }
  };

  const checkMentionTrigger = (text: string, cursorPos: number) => {
    if (!groupMembers || groupMembers.length === 0) {
      setShowMentions(false);
      return;
    }

    const textBeforeCursor = text.slice(0, cursorPos);
    const match = textBeforeCursor.match(/@([a-zA-Z0-9._]*)$/);

    if (match) {
      const query = match[1].toLowerCase();
      const filtered = groupMembers.filter(
        (m) =>
          m.name.toLowerCase().includes(query) ||
          (m.username && m.username.toLowerCase().includes(query)) ||
          (m.email && m.email.toLowerCase().includes(query))
      );
      setFilteredMembers(filtered);
      setMentionSelectedIndex(0);
      setShowMentions(filtered.length > 0);
    } else {
      setShowMentions(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);
    adjustTextareaHeight();
    checkMentionTrigger(val, e.target.selectionStart || 0);

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      onTypingStart();
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      onTypingStop();
    }, 1500);
  };

  const insertMention = (member: User) => {
    if (!textareaRef.current) return;
    const cursorPos = textareaRef.current.selectionStart || content.length;
    const textBeforeCursor = content.slice(0, cursorPos);
    const textAfterCursor = content.slice(cursorPos);
    const mentionTag = `@${member.username || member.name} `;
    const newBefore = textBeforeCursor.replace(/@([a-zA-Z0-9._]*)$/, mentionTag);
    const newContent = newBefore + textAfterCursor;

    setContent(newContent);
    setShowMentions(false);

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.selectionStart = textareaRef.current.selectionEnd = newBefore.length;
        adjustTextareaHeight();
      }
    }, 0);
  };

  const handleSend = () => {
    const trimmed = content.trim();
    if (!trimmed) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    isTypingRef.current = false;
    onTypingStop();

    onSendMessage(trimmed);
    resetInput();
  };


  const resetInput = () => {
    setContent('');
    setShowEmojiPicker(false);
    setShowMentions(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentions && filteredMembers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionSelectedIndex((prev) => (prev + 1) % filteredMembers.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionSelectedIndex((prev) => (prev - 1 + filteredMembers.length) % filteredMembers.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (filteredMembers[mentionSelectedIndex]) {
          insertMention(filteredMembers[mentionSelectedIndex]);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowMentions(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Start voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.warn('Microphone permission required to record audio voice notes:', err);
    }
  };

  const sendVoiceRecording = () => {
    if (!mediaRecorderRef.current || !isRecording) return;

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }

    const recorder = mediaRecorderRef.current;
    recorder.onstop = () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      const reader = new FileReader();
      reader.onload = () => {
        const audioUrl = reader.result as string;
        onSendMessage('', {
          messageType: 'audio',
          fileUrl: audioUrl,
          fileName: `voice_note_${Date.now()}.webm`,
          fileSize: audioBlob.size,
        });
      };
      reader.readAsDataURL(audioBlob);
    };

    recorder.stop();
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  const discardRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, []);

  const hasContent = content.trim().length > 0;

  // Filter emojis by search
  const visibleEmojis = emojiSearch.trim()
    ? EMOJI_CATEGORIES.flatMap((c) => c.emojis)
    : EMOJI_CATEGORIES.find((c) => c.id === activeEmojiCategory)?.emojis || [];

  return (
    <div className="relative p-2.5 sm:px-4 sm:py-3 bg-neutral-950/90 backdrop-blur-2xl border-t border-neutral-800/80">


      {/* GROUP @ MENTION POPUP (Telegram Style) */}
      {showMentions && filteredMembers.length > 0 && (
        <div className="absolute bottom-[72px] left-3 sm:left-6 right-3 sm:right-auto sm:w-80 bg-neutral-900/95 backdrop-blur-xl border border-neutral-800 rounded-2xl shadow-2xl z-40 overflow-hidden max-h-60 overflow-y-auto animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="px-3.5 py-2 border-b border-neutral-800/80 bg-neutral-950/60 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-neutral-400 flex items-center gap-1.5">
              <AtSign className="w-3.5 h-3.5 text-emerald-400" />
              <span>Mention member</span>
            </span>
            <span className="text-[10px] text-neutral-500 font-mono">↑↓ Enter</span>
          </div>

          <div className="p-1 space-y-0.5">
            {filteredMembers.map((member, idx) => (
              <button
                key={member.id}
                type="button"
                onClick={() => insertMention(member)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-colors ${
                  idx === mentionSelectedIndex
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'text-neutral-200 hover:bg-neutral-800/70'
                }`}
              >
                <Avatar name={member.name} avatar={member.avatar} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-white truncate">{member.name}</p>
                  <p className="text-[10px] text-neutral-400 truncate">
                    {member.username ? `@${member.username}` : member.email}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* EMOJI & STICKER PICKER POPUP (WhatsApp / Telegram Style) */}
      {showEmojiPicker && (
        <div className="absolute bottom-[72px] left-3 sm:left-6 bg-neutral-900/95 backdrop-blur-2xl border border-neutral-800 rounded-2xl p-3 shadow-2xl z-40 w-[calc(100vw-1.5rem)] max-w-sm sm:w-84 max-h-80 flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-150">
          {/* Header & Search */}
          <div className="flex items-center gap-2 pb-2 mb-2 border-b border-neutral-800/80">
            <div className="flex-1 flex items-center gap-1.5 px-2.5 py-1.5 bg-neutral-800/70 rounded-xl text-xs text-neutral-300 border border-neutral-700/50 focus-within:border-emerald-500/50">
              <Search className="w-3.5 h-3.5 text-neutral-400" />
              <input
                type="text"
                value={emojiSearch}
                onChange={(e) => setEmojiSearch(e.target.value)}
                placeholder="Search emojis..."
                className="w-full bg-transparent placeholder-neutral-500 focus:outline-none text-xs text-white"
              />
            </div>
            <button
              onClick={() => setShowEmojiPicker(false)}
              className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Category tabs */}
          {!emojiSearch && (
            <div className="flex items-center justify-between px-1 mb-2">
              {EMOJI_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveEmojiCategory(cat.id)}
                  className={`text-base p-1.5 rounded-xl transition-all ${
                    activeEmojiCategory === cat.id
                      ? 'bg-emerald-500/20 scale-110 shadow-sm shadow-emerald-500/20'
                      : 'hover:bg-neutral-800 opacity-60 hover:opacity-100'
                  }`}
                  title={cat.name}
                >
                  {cat.icon}
                </button>
              ))}
            </div>
          )}

          {/* Emoji Grid */}
          <div className="flex-1 overflow-y-auto max-h-48 pr-1">
            <div className="grid grid-cols-8 gap-1">
              {visibleEmojis.map((emoji, index) => (
                <button
                  key={`${emoji}-${index}`}
                  type="button"
                  onClick={() => {
                    setContent((prev) => prev + emoji);
                    if (textareaRef.current) {
                      textareaRef.current.focus();
                      adjustTextareaHeight();
                    }
                  }}
                  className="h-9 flex items-center justify-center text-xl hover:bg-neutral-800 rounded-xl transition-transform active:scale-125 hover:scale-115"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODERN VOICE RECORDING OVERLAY (WhatsApp / Telegram Waveform Style) */}
      {isRecording ? (
        <div className="flex items-center justify-between bg-neutral-900/95 backdrop-blur-xl border border-rose-500/40 rounded-[28px] px-4 py-2.5 shadow-2xl shadow-rose-950/30 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center gap-3">
            {/* Pulsing Red Live indicator */}
            <div className="relative flex items-center justify-center w-4 h-4">
              <span className="w-4 h-4 rounded-full bg-rose-500/40 animate-ping absolute" />
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 relative shadow-sm shadow-rose-500" />
            </div>

            {/* Live recording timer */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-white tracking-wider">
                {formatSeconds(recordingSeconds)}
              </span>
              <span className="text-[11px] font-medium text-rose-400">
                Recording...
              </span>
            </div>

            {/* Dynamic animated waveform equalizer bars */}
            <div className="hidden sm:flex items-center gap-1 ml-4 h-5">
              {[40, 75, 55, 90, 60, 100, 70, 85, 45, 95, 65, 80].map((height, i) => (
                <span
                  key={i}
                  className="w-1 bg-gradient-to-t from-rose-500 to-amber-400 rounded-full animate-pulse"
                  style={{
                    height: `${height}%`,
                    animationDelay: `${(i % 5) * 150}ms`,
                    animationDuration: '600ms',
                  }}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Cancel/Discard button */}
            <button
              type="button"
              onClick={discardRecording}
              className="px-3 py-1.5 rounded-full bg-neutral-800 hover:bg-rose-500/20 text-neutral-300 hover:text-rose-400 border border-neutral-700/60 hover:border-rose-500/40 transition-all active:scale-95 flex items-center gap-1.5 text-xs font-medium"
              title="Discard Recording"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Cancel</span>
            </button>

            {/* Send voice recording button */}
            <button
              type="button"
              onClick={sendVoiceRecording}
              className="w-9 h-9 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-white shadow-lg shadow-emerald-500/25 transition-transform active:scale-95 flex items-center justify-center"
              title="Send Voice Note"
            >
              <ArrowUp className="w-5 h-5 stroke-[2.5]" />
            </button>
          </div>
        </div>
      ) : (
        /* ULTRA-MODERN CHATGPT / WHATSAPP / TELEGRAM INPUT CAPSULE */
        <div className="flex flex-col bg-neutral-900/90 border border-neutral-700/60 hover:border-neutral-600 focus-within:border-emerald-500/70 focus-within:ring-2 focus-within:ring-emerald-500/15 rounded-[26px] shadow-xl shadow-black/25 transition-all duration-200">
          {/* MAIN INPUT ROW */}
          <div className="flex items-end gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2">
            {/* Emoji Toggle Button */}
            <button
              type="button"
              onClick={() => setShowEmojiPicker((prev) => !prev)}
              className={`p-2 rounded-full transition-all active:scale-95 flex-shrink-0 ${
                showEmojiPicker
                  ? 'text-emerald-400 bg-emerald-500/15'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/80'
              }`}
              title="Add Emoji"
            >
              <Smile className="w-5 h-5" />
            </button>

            {/* Auto-Expanding Textarea (ChatGPT / Telegram style) */}
            <div className="flex-1 flex items-center min-w-0 py-1">
              <textarea
                ref={textareaRef}
                value={content}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={
                  groupMembers && groupMembers.length > 0
                    ? 'Message or type @ to mention...'
                    : 'Message...'
                }
                rows={1}
                className="w-full bg-transparent text-[14px] text-neutral-100 placeholder-neutral-500 focus:outline-none resize-none leading-relaxed max-h-36 scrollbar-thin scrollbar-thumb-neutral-700"
              />
            </div>

            {/* Dynamic Action Button: Send (Circular ArrowUp/Send) vs Voice Mic */}
            {hasContent ? (
              <button
                type="button"
                onClick={handleSend}
                className="w-9 h-9 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-white shadow-md shadow-emerald-500/25 transition-all duration-150 active:scale-90 flex items-center justify-center flex-shrink-0"
                title="Send Message"
              >
                <ArrowUp className="w-5 h-5 stroke-[2.5]" />
              </button>
            ) : (
              <button
                type="button"
                onClick={startRecording}
                className="w-9 h-9 rounded-full text-neutral-400 hover:text-emerald-400 hover:bg-neutral-800/80 transition-all duration-150 active:scale-90 flex items-center justify-center flex-shrink-0 group"
                title="Record Voice Note"
              >
                <Mic className="w-5 h-5 group-hover:scale-110 transition-transform" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
