'use client';

import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  ShieldCheck,
  Zap,
  PhoneCall,
  Users,
  Bell,
  Lock,
  Sparkles,
  Loader2,
  AlertCircle,
  Share2,
  CheckCircle2,
  Radio,
} from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { initNotificationAndAudioOnce } from '@/lib/notification';

export const LandingPage: React.FC = () => {
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [prefetchedGoogleUrl, setPrefetchedGoogleUrl] = useState<string>('');

  // Check URL query parameters for errors (?error=...)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const err = params.get('error');
      if (err) {
        setError(err.replace(/_/g, ' '));
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, []);

  // Pre-fetch Google OAuth 2.0 URL as soon as the landing page loads for instant 0ms click redirect
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const currentOrigin = window.location.origin;
      apiRequest(`/auth/google/url?client_url=${encodeURIComponent(currentOrigin)}`)
        .then((data) => {
          if (data?.hasClientId && data?.url) {
            setPrefetchedGoogleUrl(data.url);
          }
        })
        .catch(() => {});
    }
  }, []);

  // Direct Google OAuth 2.0 Flow
  const handleGoogleLogin = async () => {
    try {
      setSubmitting(true);
      setError('');

      // Pre-warm sound audio context and prompt notification once on user click
      initNotificationAndAudioOnce().catch(() => {});

      // Instant redirect if already pre-warmed / prefetched (0ms latency!)
      if (prefetchedGoogleUrl) {
        window.location.href = prefetchedGoogleUrl;
        return;
      }

      // Fallback: Check backend for Direct Google OAuth 2.0 URL
      const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
      const data = await apiRequest(`/auth/google/url${currentOrigin ? `?client_url=${encodeURIComponent(currentOrigin)}` : ''}`);
      if (data?.hasClientId && data?.url) {
        window.location.href = data.url;
        return;
      }

      setError('গুগল লগইন চালু করতে server/.env ফাইলে GOOGLE_CLIENT_ID এবং GOOGLE_CLIENT_SECRET দিন।');
    } catch (err: any) {
      setError(err.message || 'Failed to initiate Google sign-in');
    } finally {
      setSubmitting(false);
    }
  };

  const features = [
    {
      icon: Zap,
      title: 'আল্ট্রা-ফাস্ট রিয়েলটাইম মেসেজিং',
      desc: 'Redis হাই-স্পিড ক্যাশিং আর্কিটেকচার দ্বারা চালিত—০ms ল্যাটেঞ্চিতে তৎক্ষণাৎ মেসেজ ডেলিভারি।',
      gradient: 'from-amber-500/20 to-orange-500/10',
      iconColor: 'text-amber-400',
      borderColor: 'border-amber-500/20',
    },
    {
      icon: Lock,
      title: 'এন্ড-টু-এন্ড এনক্রিপশন (E2EE)',
      desc: 'আপনার সকল ব্যক্তিগত চ্যাট সম্পূর্ণ ক্লায়েন্ট-সাইডে এনক্রিপ্টেড। আপনার গোপনীয়তা শতভাগ নিশ্চিত।',
      gradient: 'from-emerald-500/20 to-teal-500/10',
      iconColor: 'text-emerald-400',
      borderColor: 'border-emerald-500/20',
    },
    {
      icon: PhoneCall,
      title: 'এইচডি ভয়েস ও ভিডিও কলিং',
      desc: 'WebRTC ও Metered TURN রিলের মাধ্যমে মোবাইল ৪জি/৫জি ও ব্রডব্যান্ডে ক্রিস্টাল-ক্লিয়ার অডিও-ভিডিও কল।',
      gradient: 'from-blue-500/20 to-cyan-500/10',
      iconColor: 'text-blue-400',
      borderColor: 'border-blue-500/20',
    },
    {
      icon: Users,
      title: 'গ্রুপ চ্যানেল ও অডিও কনফারেন্স',
      desc: 'আনলিমিটেড মেম্বারদের সাথে গ্রুপ চ্যাট তৈরি করুন এবং একসাথে একাধিক বন্ধুদের সাথে কথা বলুন।',
      gradient: 'from-purple-500/20 to-indigo-500/10',
      iconColor: 'text-purple-400',
      borderColor: 'border-purple-500/20',
    },
    {
      icon: Bell,
      title: 'স্মার্ট ইমেইল ও পুশ নোটিফিকেশন',
      desc: 'অ্যাকাউন্ট তৈরি বা নতুন ফ্রেন্ড রিকোয়েস্ট আসলেই তাৎক্ষণিক ইমেইল নোটিফিকেশন পৌঁছে যাবে।',
      gradient: 'from-rose-500/20 to-pink-500/10',
      iconColor: 'text-rose-400',
      borderColor: 'border-rose-500/20',
    },
    {
      icon: Share2,
      title: 'ইনস্ট্যান্ট মিডিয়া ও ফাইল শেয়ারিং',
      desc: 'ছবি, অডিও ভয়েস নোট ও প্রয়োজনীয় ফাইল সেকেন্ডের মধ্যে চ্যাটে নিরাপদভাবে শেয়ার করুন।',
      gradient: 'from-teal-500/20 to-emerald-500/10',
      iconColor: 'text-teal-400',
      borderColor: 'border-teal-500/20',
    },
  ];

  return (
    <div className="min-h-screen w-full bg-neutral-950 text-neutral-100 flex flex-col lg:flex-row relative overflow-x-hidden font-sans select-none">
      {/* Background Ambient Glows */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-emerald-600/15 rounded-full blur-[140px]" />
        <div className="absolute bottom-1/4 right-1/4 translate-x-1/3 translate-y-1/3 w-[600px] h-[600px] bg-teal-600/10 rounded-full blur-[160px]" />
      </div>

      {/* ======================================================== */}
      {/* LEFT SIDE: App Advantages & Value Proposition (সুবিধাসমূহ) */}
      {/* ======================================================== */}
      <div className="w-full lg:w-[58%] min-h-screen p-6 sm:p-10 lg:p-16 flex flex-col justify-between relative z-10 border-b lg:border-b-0 lg:border-r border-neutral-800/80 bg-neutral-950/40 backdrop-blur-sm">
        {/* Top Branding */}
        <div>
          <div className="flex items-center gap-3.5 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/25 ring-1 ring-emerald-400/30">
              <MessageSquare className="w-6 h-6 text-neutral-950 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-extrabold tracking-tight text-white">Shofi Chat</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-semibold border border-emerald-500/30 flex items-center gap-1">
                  <Radio className="w-2.5 h-2.5 animate-pulse text-emerald-400" />
                  Live v2.0
                </span>
              </div>
              <p className="text-xs text-neutral-400">Next-Gen Realtime Communication Suite</p>
            </div>
          </div>

          {/* Headline */}
          <div className="max-w-xl mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-neutral-900/90 border border-neutral-800 text-xs text-neutral-300 font-medium mb-4 shadow-inner">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>নিরাপদ, স্মার্ট ও বিদ্যুৎগতির চ্যাট প্ল্যাটফর্ম</span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-[1.15]">
              যোগাযোগ হোক{' '}
              <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
                সীমাহীন, সহজ ও সুপার-ফাস্ট
              </span>
            </h1>
            <p className="mt-4 text-sm sm:text-base text-neutral-400 leading-relaxed max-w-lg">
              কোনো প্রকার ল্যাগ ছাড়াই বন্ধুদের সাথে সরাসরি চ্যাট, এইচডি ভয়েস/ভিডিও কল এবং গ্রুপ আড্ডা দিন একই প্ল্যাটফর্মে।
            </p>
          </div>

          {/* Grid of Advantages / Features */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 max-w-2xl">
            {features.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={idx}
                  className={`p-4 rounded-2xl bg-neutral-900/60 border ${item.borderColor} hover:border-neutral-700/80 transition-all duration-200 group hover:bg-neutral-900/90 flex flex-col justify-start`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-9 h-9 rounded-xl bg-gradient-to-tr ${item.gradient} border border-neutral-700/40 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform`}>
                      <Icon className={`w-4 h-4 ${item.iconColor}`} />
                    </div>
                    <h3 className="text-xs sm:text-sm font-semibold text-white tracking-tight group-hover:text-emerald-300 transition-colors">
                      {item.title}
                    </h3>
                  </div>
                  <p className="text-[11px] sm:text-xs text-neutral-400 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom Trust Badges */}
        <div className="mt-10 pt-6 border-t border-neutral-800/60 flex flex-wrap items-center gap-6 text-xs text-neutral-400">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>১০০% ফ্রি ও উন্মুক্ত</span>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-teal-400 flex-shrink-0" />
            <span>২৫৬-বিট SSL এনক্রিপশন</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>Redis জিরো-ল্যাগ পারফরম্যান্স</span>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* RIGHT SIDE: ONLY Google Login Option                      */}
      {/* ======================================================== */}
      <div className="w-full lg:w-[42%] min-h-screen flex items-center justify-center p-6 sm:p-10 lg:p-14 relative z-10 bg-neutral-950/80">
        <div className="w-full max-w-md bg-neutral-900/90 border border-neutral-800/90 rounded-3xl p-8 sm:p-10 shadow-2xl backdrop-blur-2xl relative overflow-hidden">
          {/* Subtle top card glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />

          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-emerald-600/30 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-5 shadow-xl shadow-emerald-500/10 ring-1 ring-emerald-500/20">
              <MessageSquare className="w-8 h-8 stroke-[1.8]" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Welcome to Shofi Chat
            </h2>
            <p className="text-xs sm:text-sm text-neutral-400 mt-2 leading-relaxed">
              এক ক্লিকে আপনার গুগল অ্যাকাউন্ট দিয়ে সরাসরি যুক্ত হোন। কোনো বাড়তি পাসওয়ার্ডের ঝামেলা নেই।
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium flex items-center gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1 text-left">{error}</span>
            </div>
          )}

          {/* PRIMARY DIRECT GOOGLE LOGIN BUTTON */}
          <div className="space-y-4">
            <button
              onClick={handleGoogleLogin}
              disabled={submitting}
              className="w-full py-4 px-5 rounded-2xl bg-white hover:bg-neutral-100 text-neutral-900 font-semibold text-sm sm:text-base flex items-center justify-center gap-3 shadow-xl shadow-black/40 transition-all active:scale-[0.98] border border-neutral-200 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed group"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-neutral-700" />
                  <span>Redirecting to Google...</span>
                </>
              ) : (
                <>
                  {/* Official Google 'G' icon */}
                  <svg className="w-5 h-5 flex-shrink-0 group-hover:scale-105 transition-transform" viewBox="0 0 24 24">
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

            {/* Security Indicator */}
            <div className="pt-2 flex items-center justify-center gap-1.5 text-xs text-neutral-400 text-center">
              <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>Direct Google OAuth 2.0 Security • Auto profile sync</span>
            </div>
          </div>

          {/* Privacy Note */}
          <div className="mt-8 pt-6 border-t border-neutral-800 text-center text-[11px] text-neutral-400">
            লগইন করার মাধ্যমে আপনি আমাদের নীতি ও শর্তাবলীতে সম্মত হচ্ছেন। আপনার প্রোফাইল সম্পূর্ণ সুরক্ষিত।
          </div>
        </div>
      </div>
    </div>
  );
};
