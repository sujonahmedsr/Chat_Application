'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Smile, Paperclip, Image, FileText, Mic, Square, Trash2, X } from 'lucide-react';

interface AttachmentPayload {
  messageType: 'text' | 'image' | 'file' | 'audio';
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
}

interface MessageInputProps {
  onSendMessage: (content: string, attachment?: AttachmentPayload) => void;
  onTypingStart: () => void;
  onTypingStop: () => void;
}

const QUICK_EMOJIS = ['😊', '😂', '❤️', '👍', '🔥', '🎉', '👋', '🙏', '🚀', '💯'];

export const MessageInput: React.FC<MessageInputProps> = ({
  onSendMessage,
  onTypingStart,
  onTypingStop,
}) => {
  const [content, setContent] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<AttachmentPayload | null>(null);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const typingTimeoutRef = useRef<any>(null);
  const isTypingRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

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
    if (!content.trim() && !pendingAttachment) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    isTypingRef.current = false;
    onTypingStop();

    onSendMessage(content.trim(), pendingAttachment || undefined);

    setContent('');
    setPendingAttachment(null);
    setShowEmojiPicker(false);
    setShowAttachMenu(false);

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

  // Convert uploaded file to Base64 Data URL for zero-dependency local transfer
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'file') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPendingAttachment({
        messageType: type,
        fileUrl: dataUrl,
        fileName: file.name,
        fileSize: file.size,
      });
      setShowAttachMenu(false);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
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
      {/* Hidden file inputs */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => handleFileChange(e, 'file')}
        className="hidden"
      />
      <input
        type="file"
        accept="image/*"
        ref={imageInputRef}
        onChange={(e) => handleFileChange(e, 'image')}
        className="hidden"
      />

      {/* Quick emoji drawer */}
      {showEmojiPicker && (
        <div className="absolute bottom-full mb-2 left-4 bg-neutral-800/95 border border-neutral-700 backdrop-blur-md rounded-2xl p-2.5 shadow-xl flex items-center gap-2 z-20 animate-in fade-in zoom-in-95">
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                setContent((prev) => prev + emoji);
                setShowEmojiPicker(false);
                textareaRef.current?.focus();
              }}
              className="text-xl p-1.5 hover:bg-neutral-700/70 rounded-xl transition-transform hover:scale-125"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Attachment Menu Popup */}
      {showAttachMenu && (
        <div className="absolute bottom-full mb-2 left-12 bg-neutral-800 border border-neutral-700 rounded-2xl p-2 shadow-2xl z-20 flex flex-col gap-1 min-w-36 animate-in fade-in zoom-in-95">
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-neutral-200 hover:bg-neutral-700 rounded-xl transition-colors"
          >
            <Image className="w-4 h-4 text-emerald-400" />
            <span>Image / Photo</span>
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-neutral-200 hover:bg-neutral-700 rounded-xl transition-colors"
          >
            <FileText className="w-4 h-4 text-teal-400" />
            <span>Document / File</span>
          </button>
        </div>
      )}

      {/* Pending attachment preview banner */}
      {pendingAttachment && (
        <div className="max-w-5xl mx-auto mb-2 p-2 rounded-xl bg-neutral-800 border border-neutral-700 flex items-center justify-between">
          <div className="flex items-center gap-2.5 overflow-hidden">
            {pendingAttachment.messageType === 'image' ? (
              <img
                src={pendingAttachment.fileUrl}
                alt="preview"
                className="w-10 h-10 rounded-lg object-cover bg-black/40"
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-emerald-600/20 text-emerald-400 flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-medium text-white truncate">
                {pendingAttachment.fileName || 'Attachment'}
              </p>
              <p className="text-[10px] text-neutral-400">Ready to send</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setPendingAttachment(null)}
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ACTIVE VOICE RECORDING BAR */}
      {isRecording ? (
        <div className="flex items-center justify-between max-w-5xl mx-auto bg-neutral-800/90 border border-red-500/40 rounded-2xl px-4 py-2 animate-in fade-in">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
            <span className="text-xs font-mono font-semibold text-red-400">
              Recording Voice... {formatSeconds(recordingSeconds)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={discardRecording}
              className="p-2 rounded-full bg-neutral-700 hover:bg-neutral-600 text-neutral-300"
              title="Discard"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={sendVoiceRecording}
              className="px-3.5 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/30"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send Voice</span>
            </button>
          </div>
        </div>
      ) : (
        /* NORMAL MESSAGE COMPOSER */
        <div className="flex items-end gap-2 max-w-5xl mx-auto">
          {/* Emoji button */}
          <button
            type="button"
            onClick={() => setShowEmojiPicker((prev) => !prev)}
            className={`p-2.5 rounded-full transition-colors ${
              showEmojiPicker
                ? 'text-emerald-400 bg-neutral-800'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
            }`}
            title="Emojis"
          >
            <Smile className="w-5 h-5" />
          </button>

          {/* Attachment button */}
          <button
            type="button"
            onClick={() => setShowAttachMenu((prev) => !prev)}
            className={`p-2.5 rounded-full transition-colors ${
              showAttachMenu
                ? 'text-emerald-400 bg-neutral-800'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
            }`}
            title="Attach Image or Document"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          {/* Input box */}
          <div className="flex-1 bg-neutral-800/80 border border-neutral-700/60 focus-within:border-emerald-500/80 rounded-2xl px-4 py-2 transition-all">
            <textarea
              ref={textareaRef}
              rows={1}
              value={content}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              className="w-full bg-transparent text-sm text-neutral-100 placeholder-neutral-400 focus:outline-none resize-none max-h-32 leading-relaxed"
            />
          </div>

          {/* If typing or attachment present: Send Button. If input empty: Voice Note Mic Button! */}
          {content.trim() || pendingAttachment ? (
            <button
              type="button"
              onClick={handleSend}
              className="w-10 h-10 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center transition-all flex-shrink-0 shadow-md shadow-emerald-600/20 active:scale-95"
              title="Send message"
            >
              <Send className="w-4 h-4 translate-x-0.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={startRecording}
              className="w-10 h-10 rounded-full bg-neutral-800 hover:bg-emerald-600/20 text-neutral-300 hover:text-emerald-400 border border-neutral-700 flex items-center justify-center transition-all flex-shrink-0 active:scale-95"
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
