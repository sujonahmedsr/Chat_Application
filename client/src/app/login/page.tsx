'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MessageSquare, Lock, Mail, ArrowRight, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in both email and password');
      return;
    }

    try {
      setError('');
      setSubmitting(true);
      await login(email, password);
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Subtle background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-neutral-900/90 border border-neutral-800 rounded-3xl p-8 shadow-2xl backdrop-blur-xl relative z-10">
        {/* App Logo */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-3 shadow-lg shadow-emerald-500/10">
            <MessageSquare className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Welcome Back
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            Sign in to access your chats and real-time audio calls
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs text-center font-medium animate-in fade-in">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1.5">
              Email Address
            </label>
            <div className="relative flex items-center bg-neutral-800/80 border border-neutral-700/60 rounded-xl px-3.5 py-2.5 focus-within:border-emerald-500/80 transition-all">
              <Mail className="w-4 h-4 text-neutral-400 mr-2.5 flex-shrink-0" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alice@example.com"
                className="w-full bg-transparent text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1.5">
              Password
            </label>
            <div className="relative flex items-center bg-neutral-800/80 border border-neutral-700/60 rounded-xl px-3.5 py-2.5 focus-within:border-emerald-500/80 transition-all">
              <Lock className="w-4 h-4 text-neutral-400 mr-2.5 flex-shrink-0" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-transparent text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full mt-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all active:scale-[0.99]"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Signing in...</span>
              </>
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Demo Quick Logins */}
        <div className="mt-6 pt-5 border-t border-neutral-800 text-center">
          <p className="text-xs text-neutral-400 mb-2.5">
            Quick 1-Click Demo Logins:
          </p>
          <div className="flex gap-2 justify-center">
            <button
              type="button"
              onClick={async () => {
                setEmail('alice@example.com');
                setPassword('password123');
                setSubmitting(true);
                try {
                  await login('alice@example.com', 'password123');
                  router.push('/');
                } catch (err: any) {
                  setError(err.message);
                } finally {
                  setSubmitting(false);
                }
              }}
              className="px-3.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs text-neutral-200 border border-neutral-700 transition-colors"
            >
              👩 Alice (User 1)
            </button>
            <button
              type="button"
              onClick={async () => {
                setEmail('bob@example.com');
                setPassword('password123');
                setSubmitting(true);
                try {
                  await login('bob@example.com', 'password123');
                  router.push('/');
                } catch (err: any) {
                  setError(err.message);
                } finally {
                  setSubmitting(false);
                }
              }}
              className="px-3.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs text-neutral-200 border border-neutral-700 transition-colors"
            >
              👨 Bob (User 2)
            </button>
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-neutral-400">
          Don't have an account?{' '}
          <Link
            href="/register"
            className="text-emerald-400 hover:text-emerald-300 font-medium hover:underline ml-1"
          >
            Create account
          </Link>
        </div>
      </div>
    </div>
  );
}
