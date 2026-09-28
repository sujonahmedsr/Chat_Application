'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Smile, Mic, Trash2, Check, X } from 'lucide-react';

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
}) => {
  const [content, setContent] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const typingTimeoutRef = useRef<any>(null);
  const isTypingRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);

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

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
      console.error('Failed to access microphone for voice recording:', err);
      alert('Microphone permission required to record audio voice notes.');
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
      {/* EMOJI PICKER POPUP */}
      {showEmojiPicker && (
        <div className="absolute bottom-16 left-3 bg-neutral-900 border border-neutral-750 rounded-2xl p-3 shadow-2xl z-30 w-72 sm:w-80 max-h-72 overflow-y-auto animate-in fade-in slide-in-from-bottom-2 duration-150">
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

      {/* VOICE RECORDING OVERLAY */}
      {isRecording ? (
        <div className="flex items-center justify-between bg-neutral-850 border border-emerald-500/40 rounded-2xl px-4 py-2.5 animate-pulse">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
            <span className="text-xs font-mono text-white">Recording Voice Note...</span>
            <span className="text-xs font-mono text-emerald-400 font-bold">
              {formatSeconds(recordingSeconds)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={discardRecording}
              className="p-2 rounded-xl text-neutral-400 hover:text-red-400 hover:bg-neutral-800 transition-colors"
              title="Discard Recording"
            >
              <Trash2 className="w-5 h-5" />
            </button>
            <button
              onClick={sendVoiceRecording}
              className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
              title="Send Voice Note"
            >
              <Check className="w-5 h-5" />
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
          <div className="flex-1 bg-neutral-800/90 border border-neutral-750 focus-within:border-emerald-500/80 rounded-2xl px-3 py-2 transition-all">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
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
              className="p-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-750 text-neutral-300 hover:text-emerald-400 transition-all active:scale-95"
              title="Record Voice Note"
            >
              <Mic className="w-5 h-5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
