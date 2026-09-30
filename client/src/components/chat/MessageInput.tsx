'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Smile, Mic, Trash2, Check, X, AtSign } from 'lucide-react';
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

const EMOJI_CATEGORIES = [
  {
    name: 'Smileys & Emotion',
    emojis: ['😊', '😂', '🤣', '❤️', '😍', '🥰', '😘', '😎', '🤩', '🥳', '🥺', '😭', '😇', '🤔', '🤫', '🤗', '😴', '😜', '🔥', '💯'],
  },
  {
    name: 'Gestures & People',
    emojis: ['👍', '👎', '👏', '🙌', '🙏', '🤝', '✌️', '🤞', '💪', '👋', '🤙', '👌', '👀', '💖', '💔', '✨', '⭐', '⚡', '🎉', '🚀'],
  },
  {
    name: 'Animals & Nature',
    emojis: ['🐱', '🐶', '🦁', '🐼', '🦊', '🌺', '🌸', '🌹', '🍀', '🌴', '🌞', '🌙', '⭐', '🌈', '🌧️', '❄️', '☕', '🍕', '🍔', '🍦'],
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

  // Mention state
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
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

  const checkMentionTrigger = (text: string, cursorPos: number) => {
    if (!groupMembers || groupMembers.length === 0) {
      setShowMentions(false);
      return;
    }

    const textBeforeCursor = text.slice(0, cursorPos);
    const match = textBeforeCursor.match(/@([a-zA-Z0-9._]*)$/);

    if (match) {
      const query = match[1].toLowerCase();
      setMentionFilter(query);
      const filtered = groupMembers.filter((m) =>
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
      }
    }, 0);
  };

  const handleSend = () => {
    if (!content.trim()) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    isTypingRef.current = false;
    onTypingStop();

    onSendMessage(content.trim());

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

  // Stop recording and send voice note
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

  // Discard voice recording
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

  return (
    <div className="relative p-3 bg-neutral-900 border-t border-neutral-800">
      {/* GROUP @ MENTION POPUP */}
      {showMentions && filteredMembers.length > 0 && (
        <div className="absolute bottom-16 left-2 right-2 sm:left-12 sm:right-auto sm:w-80 bg-neutral-900/95 backdrop-blur-md border border-neutral-800 rounded-2xl shadow-2xl z-40 overflow-hidden max-h-56 overflow-y-auto animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="px-3 py-2 border-b border-neutral-800/80 bg-neutral-950/40 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-neutral-400 flex items-center gap-1.5">
              <AtSign className="w-3.5 h-3.5 text-emerald-400" />
              <span>Mention group member</span>
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
                    ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30'
                    : 'text-neutral-200 hover:bg-neutral-800'
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

      {/* EMOJI PICKER POPUP */}
      {showEmojiPicker && (
        <div className="absolute bottom-16 left-2 sm:left-3 bg-neutral-900 border border-neutral-800 rounded-2xl p-3 shadow-2xl z-30 w-[calc(100vw-1rem)] max-w-xs sm:w-80 max-h-72 overflow-y-auto animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-neutral-800">
            <span className="text-xs font-semibold text-neutral-300">Emojis</span>
            <button
              onClick={() => setShowEmojiPicker(false)}
              className="text-neutral-500 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {EMOJI_CATEGORIES.map((cat) => (
            <div key={cat.name} className="mb-3">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-neutral-500 block mb-1">
                {cat.name}
              </span>
              <div className="grid grid-cols-8 gap-1">
                {cat.emojis.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      setContent((prev) => prev + emoji);
                      if (textareaRef.current) textareaRef.current.focus();
                    }}
                    className="h-8 flex items-center justify-center text-lg hover:bg-neutral-800 rounded-lg transition-transform hover:scale-125"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODERN VOICE RECORDING OVERLAY */}
      {isRecording ? (
        <div className="flex items-center justify-between bg-neutral-950/90 backdrop-blur-md border border-rose-500/40 rounded-2xl px-4 py-3 shadow-2xl shadow-rose-950/20 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center gap-3">
            {/* Pulsing Red Live indicator */}
            <div className="relative flex items-center justify-center w-4 h-4">
              <span className="w-4 h-4 rounded-full bg-rose-500/40 animate-ping absolute" />
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 relative shadow-sm shadow-rose-500" />
            </div>

            {/* Live recording timer */}
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold tracking-wider text-rose-400">
                Recording Voice
              </span>
              <span className="text-sm font-mono font-bold text-white tracking-widest">
                {formatSeconds(recordingSeconds)}
              </span>
            </div>

            {/* Dynamic animated waveform equalizer bars */}
            <div className="hidden sm:flex items-center gap-1 ml-4 h-6">
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
              className="px-3 py-2 rounded-xl bg-neutral-900 hover:bg-rose-500/20 text-neutral-400 hover:text-rose-400 border border-neutral-800 hover:border-rose-500/40 transition-all active:scale-95 flex items-center gap-1.5"
              title="Discard Recording"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline text-xs font-medium">Discard</span>
            </button>

            {/* Send voice recording button */}
            <button
              type="button"
              onClick={sendVoiceRecording}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-950/40 transition-all active:scale-95 flex items-center gap-1.5"
              title="Send Voice Note"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline text-xs font-semibold">Send</span>
            </button>
          </div>
        </div>
      ) : (
        /* NORMAL TEXT + AUDIO INPUT */
        <div className="flex items-end gap-2">
          {/* Emoji Toggle Button */}
          <button
            type="button"
            onClick={() => setShowEmojiPicker((prev) => !prev)}
            className={`p-2.5 rounded-xl transition-colors ${
              showEmojiPicker
                ? 'text-emerald-400 bg-neutral-800'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
            }`}
            title="Add Emoji"
          >
            <Smile className="w-5 h-5" />
          </button>

          {/* Text Area */}
          <div className="flex-1 bg-neutral-800/90 border border-neutral-800 focus-within:border-emerald-500/80 rounded-2xl px-3 py-2 transition-all">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={groupMembers && groupMembers.length > 0 ? "Type a message or @ to mention..." : "Type a message..."}
              rows={1}
              className="w-full bg-transparent text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none resize-none max-h-32"
            />
          </div>

          {/* Record Voice Note or Send Text */}
          {content.trim() ? (
            <button
              type="button"
              onClick={handleSend}
              className="p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-900/30 transition-transform active:scale-95"
              title="Send Message"
            >
              <Send className="w-5 h-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={startRecording}
              className="p-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-emerald-400 hover:border-emerald-500/30 border border-neutral-800 transition-all active:scale-95 group"
              title="Record Voice Note"
            >
              <Mic className="w-5 h-5 group-hover:scale-110 transition-transform" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
