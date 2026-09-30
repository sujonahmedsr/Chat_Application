'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();

  useEffect(() => {
    // Automatically redirect to Google Authentication on /login
    router.replace('/login');
  }, [router]);

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-4 text-center">
      <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mb-3" />
      <p className="text-sm text-neutral-400">
        Redirecting to Google Sign-In...
      </p>
    </div>
  );
}
