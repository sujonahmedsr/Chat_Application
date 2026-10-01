'use client';

import React from 'react';
import Link from 'next/link';
import {
  MessageSquare,
  Shield,
  Zap,
  PhoneCall,
  Video,
  Smile,
  Users,
  Lock,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  HeartHandshake,
  CheckCheck,
  SmilePlus,
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 selection:bg-emerald-500/30 selection:text-emerald-200 overflow-x-hidden font-sans">
      {/* Background Ambient Glow Accents */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-emerald-600/15 rounded-full blur-[140px]" />
        <div className="absolute top-1/2 -right-32 w-96 h-96 bg-teal-600/10 rounded-full blur-[160px]" />
        <div className="absolute -bottom-32 left-1/3 w-96 h-96 bg-emerald-700/15 rounded-full blur-[140px]" />
      </div>

      {/* TOP NAVIGATION BAR */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-neutral-950/70 border-b border-neutral-800/80 transition-all">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-900/30">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-base font-bold tracking-tight bg-gradient-to-r from-white via-neutral-100 to-neutral-400 bg-clip-text text-transparent">
                Shofi Chat
              </span>
              <span className="hidden sm:inline-block ml-2 px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20">
                Realtime Hub
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-300 hover:text-white hover:bg-neutral-800/60 transition-all border border-transparent hover:border-neutral-700/60"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-emerald-500 to-teal-500 text-neutral-950 hover:brightness-110 transition-all shadow-md shadow-emerald-500/20 flex items-center gap-1.5"
            >
              <span>Get Started</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* ========================================================= */}
      {/* SECTION 1: HERO & LIVE INTERACTIVE UI SHOWCASE            */}
      {/* ========================================================= */}
      <section className="relative pt-16 pb-20 sm:pt-20 sm:pb-28 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto z-10 text-center">
        {/* Futuristic Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-neutral-900/90 border border-neutral-800/90 shadow-inner mb-6 animate-in fade-in duration-500">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-xs font-medium text-neutral-300">
            Next-Gen Realtime Communication Engine
          </span>
        </div>

        {/* Main Headline */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight max-w-4xl mx-auto leading-[1.12]">
          Connect, Chat & Call{' '}
          <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-sky-400 bg-clip-text text-transparent">
            Seamlessly Anywhere.
          </span>
        </h1>

        {/* Subtitle */}
        <p className="mt-6 text-base sm:text-lg text-neutral-400 max-w-2xl mx-auto leading-relaxed">
          Zero-delay messaging, crystal-clear WebRTC voice & video calls, live emoji reactions,
          and end-to-end privacy — crafted for teams, friends, and communities who value speed and clarity.
        </p>

        {/* CTAs */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/register"
            className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-neutral-950 font-bold text-sm hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2"
          >
            <span>Start Chatting Free</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/login"
            className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-neutral-900 hover:bg-neutral-800 text-neutral-200 font-semibold text-sm border border-neutral-800 hover:border-neutral-700 transition-all flex items-center justify-center gap-2"
          >
            <span>Login to Account</span>
          </Link>
        </div>

        {/* LIVE UI PREVIEW MOCKUP */}
        <div className="mt-14 sm:mt-18 max-w-3xl mx-auto rounded-3xl p-1 bg-gradient-to-b from-neutral-700/40 via-neutral-800/20 to-transparent shadow-2xl">
          <div className="bg-neutral-900/90 rounded-[22px] border border-neutral-800/80 overflow-hidden backdrop-blur-2xl">
            {/* Mock Window Top Bar */}
            <div className="px-5 py-3.5 bg-neutral-950/70 border-b border-neutral-800/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-500/80" />
                <span className="w-3 h-3 rounded-full bg-amber-500/80" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
                <span className="ml-2 text-xs font-semibold text-neutral-300">Shofi Chat • Live Room</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live Connected
                </span>
              </div>
            </div>

            {/* Mock Chat Body */}
            <div className="p-6 space-y-4 text-left font-sans">
              {/* Message Left */}
              <div className="flex items-start gap-3 max-w-md">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0 shadow-md">
                  S
                </div>
                <div>
                  <div className="bg-neutral-800/90 border border-neutral-700/60 rounded-2xl rounded-tl-sm px-4 py-2.5 text-xs text-neutral-200 shadow-md">
                    <p className="font-semibold text-[11px] text-purple-300 mb-0.5">Sujon Ahmed</p>
                    <p>Hey! Check out this product launch demo video:</p>
                    <span className="text-sky-400 underline font-medium mt-1 inline-block">
                      https://youtube.com/watch?v=demo-chat
                    </span>
                    <div className="text-[10px] text-neutral-400 mt-1 flex justify-end">10:42 AM</div>
                  </div>
                  {/* Reaction badge */}
                  <div className="flex items-center gap-1 mt-1">
                    <span className="px-2 py-0.5 rounded-full bg-neutral-800 border border-neutral-700 text-[11px] flex items-center gap-1">
                      <span>🔥</span>
                      <span className="text-[10px] font-bold text-neutral-300">3</span>
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-600/80 text-[11px] flex items-center gap-1 text-emerald-300">
                      <span>❤️</span>
                      <span className="text-[10px] font-bold">1</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Message Right (Self) */}
              <div className="flex items-start justify-end gap-3">
                <div className="max-w-md flex flex-col items-end">
                  <div className="bg-emerald-700/90 border border-emerald-600/40 rounded-2xl rounded-tr-sm px-4 py-2.5 text-xs text-white shadow-md">
                    <p>Awesome! The audio call from my phone to your desktop was crystal clear too!</p>
                    <div className="text-[10px] text-emerald-200/80 mt-1 flex items-center justify-end gap-1">
                      <span>10:43 AM</span>
                      <CheckCheck className="w-3.5 h-3.5 text-sky-300" />
                    </div>
                  </div>
                  {/* Reaction badge self */}
                  <div className="flex items-center gap-1 mt-1">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-600/80 text-[11px] flex items-center gap-1 text-emerald-300">
                      <span>👍</span>
                      <span className="text-[10px] font-bold">2</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Voice Call Pill */}
              <div className="flex justify-center my-2">
                <div className="inline-flex items-center gap-3 px-4 py-2 rounded-2xl bg-neutral-950/80 border border-neutral-800 text-xs">
                  <div className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <PhoneCall className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-semibold text-neutral-200">Voice Call Ended</span>
                    <span className="text-neutral-400 ml-2 font-mono text-[11px]">Duration: 12m 45s</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Mock Input Bar */}
            <div className="p-3 bg-neutral-950/80 border-t border-neutral-800 flex items-center gap-3">
              <div className="flex-1 bg-neutral-800/80 border border-neutral-700/60 rounded-xl px-4 py-2 text-xs text-neutral-400 flex items-center justify-between">
                <span>Type a message, mention @someone, or paste a link...</span>
                <SmilePlus className="w-4 h-4 text-neutral-400" />
              </div>
              <button className="px-4 py-2 rounded-xl bg-emerald-500 text-neutral-950 font-bold text-xs shadow-md">
                Send
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* SECTION 2: WHO IS IT FOR & CORE PURPOSE                   */}
      {/* ========================================================= */}
      <section className="py-20 bg-neutral-900/40 border-y border-neutral-800/60 relative z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-2">
              Who Is It For?
            </h2>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-white">
              Built For Modern Teams, Friends & Privacy
            </h3>
            <p className="mt-3 text-sm text-neutral-400">
              Whether you need to collaborate with your workspace or stay in touch with friends, Shofi Chat delivers effortless communication.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1 */}
            <div className="p-7 rounded-3xl bg-neutral-900/80 border border-neutral-800/80 hover:border-emerald-500/40 transition-all hover:-translate-y-1 group shadow-lg">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <Users className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-bold text-white mb-2">Remote Teams & Workspaces</h4>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Organize discussions in dedicated group channels, hold simultaneous group voice calls, and collaborate in real-time with zero friction.
              </p>
            </div>

            {/* Card 2 */}
            <div className="p-7 rounded-3xl bg-neutral-900/80 border border-neutral-800/80 hover:border-purple-500/40 transition-all hover:-translate-y-1 group shadow-lg">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <HeartHandshake className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-bold text-white mb-2">Friends & Personal Chats</h4>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Connect 1-to-1 with instant messaging, live emoji reactions, interactive video calls, and voice notes across mobile and desktop.
              </p>
            </div>

            {/* Card 3 */}
            <div className="p-7 rounded-3xl bg-neutral-900/80 border border-neutral-800/80 hover:border-sky-500/40 transition-all hover:-translate-y-1 group shadow-lg">
              <div className="w-12 h-12 rounded-2xl bg-sky-500/10 text-sky-400 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <Shield className="w-6 h-6" />
              </div>
              <h4 className="text-lg font-bold text-white mb-2">Privacy-Focused Individuals</h4>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Protect your privacy with end-to-end encrypted messaging, self-destructing history options, and instant real-time blocking and unfriend control.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* SECTION 3: KEY CAPABILITIES & GET STARTED BANNER          */}
      {/* ========================================================= */}
      <section className="py-20 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* 4 Feature Highlights Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-16">
          <div className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800 flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center flex-shrink-0">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h5 className="text-sm font-bold text-white">0-Latency Engine</h5>
              <p className="text-[11px] text-neutral-400 mt-0.5">Bi-directional WebSockets for instant delivery & status.</p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800 flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center flex-shrink-0">
              <PhoneCall className="w-4 h-4" />
            </div>
            <div>
              <h5 className="text-sm font-bold text-white">Mobile ↔ PC Calls</h5>
              <p className="text-[11px] text-neutral-400 mt-0.5">HD WebRTC voice & video with TURN NAT traversal.</p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800 flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center flex-shrink-0">
              <Smile className="w-4 h-4" />
            </div>
            <div>
              <h5 className="text-sm font-bold text-white">Live Emoji Reactions</h5>
              <p className="text-[11px] text-neutral-400 mt-0.5">Express instantly with live emoji reactions & badges.</p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800 flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center flex-shrink-0">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h5 className="text-sm font-bold text-white">Instant Block & Privacy</h5>
              <p className="text-[11px] text-neutral-400 mt-0.5">One-click blocking, chat purge, and zero reload.</p>
            </div>
          </div>
        </div>

        {/* Final High-Conversion Banner */}
        <div className="p-10 sm:p-14 rounded-3xl bg-gradient-to-b from-neutral-900 to-neutral-950 border border-neutral-800/90 shadow-2xl relative overflow-hidden text-center">
          <div className="absolute top-0 right-0 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <h3 className="text-3xl sm:text-4xl font-extrabold text-white mb-3">
            Ready to Upgrade Your Chat Experience?
          </h3>
          <p className="text-sm text-neutral-400 max-w-lg mx-auto mb-8">
            Create an account in 10 seconds and experience lightning-fast communication with friends and colleagues.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register"
              className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-neutral-950 font-bold text-sm hover:brightness-110 transition-all shadow-lg shadow-emerald-500/20"
            >
              Create Free Account
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-neutral-800 hover:bg-neutral-700 text-white font-semibold text-sm transition-all border border-neutral-700/60"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* MINIMAL FOOTER */}
      <footer className="border-t border-neutral-900 py-8 bg-neutral-950 relative z-10 text-xs text-neutral-500">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-lg bg-emerald-600 flex items-center justify-center text-white">
              <MessageSquare className="w-3 h-3" />
            </div>
            <span className="font-semibold text-neutral-300">Shofi Chat</span>
            <span>• © {new Date().getFullYear()} All rights reserved.</span>
          </div>

          <div className="flex items-center gap-2 text-neutral-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>All Systems Operational</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
