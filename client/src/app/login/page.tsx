'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquare, ShieldCheck, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { apiRequest } from '@/lib/api';

export default function LoginPage() {
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  // Check URL query parameters for errors (?error=...)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const err = params.get('error');
      if (err) {
        setError(err.replace(/_/g, ' '));
        window.history.replaceState({}, '', '/login');
      }
    }
  }, []);

  // Direct Google OAuth 2.0 Flow
  const handleDirectGoogleLogin = async () => {
    try {
      setSubmitting(true);
      setError('');

      // Check backend for Direct Google OAuth 2.0 URL
      const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
      const data = await apiRequest(`/auth/google/url${currentOrigin ? `?client_url=${encodeURIComponent(currentOrigin)}` : ''}`);
      if (data.hasClientId && data.url) {
        // Direct redirect to Google's official login page!
        window.location.href = data.url;
        return;
      }

      // If GOOGLE_CLIENT_ID is not configured in server/.env:
      setError('গুগল লগইন চালু করতে server/.env ফাইলে GOOGLE_CLIENT_ID এবং GOOGLE_CLIENT_SECRET বসিয়ে সেভ করুন।');
    } catch (err: any) {
      setError(err.message || 'Failed to initiate Google sign-in');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4 relative overflow-hidden select-none">
      {/* Ambient background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md bg-neutral-900/90 border border-neutral-800 rounded-3xl p-8 shadow-2xl backdrop-blur-xl relative z-10">
        {/* App Logo & Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600/30 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4 shadow-xl shadow-emerald-500/10 ring-1 ring-emerald-500/20">
            <MessageSquare className="w-8 h-8 stroke-[1.8]" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Welcome to Shofi Chat
          </h1>
          <p className="text-sm text-neutral-400 mt-1 max-w-xs leading-relaxed">
            Real-time messaging, group channels & WebRTC calls. Direct Google Authentication.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs text-center font-medium flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1 text-left">{error}</span>
          </div>
        )}

        {/* PRIMARY DIRECT GOOGLE LOGIN BUTTON */}
        <div className="space-y-4">
          <button
            onClick={handleDirectGoogleLogin}
            disabled={submitting}
            className="w-full py-3.5 px-4 rounded-2xl bg-white hover:bg-neutral-100 text-neutral-900 font-semibold text-sm flex items-center justify-center gap-3 shadow-lg shadow-black/30 transition-all active:scale-[0.99] border border-neutral-200"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin text-neutral-700" />
                <span>Redirecting to Google...</span>
              </>
            ) : (
              <>
                {/* Official Google 'G' icon */}
                <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.87c2.26-2.09 3.675-5.17 3.675-9.15z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.87-3.05c-1.08.72-2.45 1.16-4.06 1.16-3.13 0-5.78-2.11-6.73-4.96H1.28v3.15C3.26 21.36 7.33 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.27 14.24c-.25-.72-.39-1.49-.39-2.24s.14-1.52.39-2.24V6.61H1.28C.46 8.23 0 10.06 0 12s.46 3.77 1.28 5.39l3.99-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.28 6.61l3.99 3.15c.95-2.85 3.6-4.96 6.73-4.96z"
                  />
                </svg>
                <span>Continue with Google</span>
              </>
            )}
          </button>

          <div className="flex items-center justify-center gap-1.5 text-[11px] text-neutral-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Direct Google OAuth 2.0 Security • Auto profile sync</span>
          </div>
        </div>
      </div>
    </div>
  );
}
