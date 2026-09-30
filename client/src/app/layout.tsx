import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { SocketProvider } from '@/context/SocketContext';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  interactiveWidget: 'resizes-content',
};

export const metadata: Metadata = {
  metadataBase: new URL('https://shofichat.vercel.app'),
  title: {
    default: 'Shofi Chat — Real-Time Messaging & WebRTC Video Calling',
    template: '%s | Shofi Chat',
  },
  description:
    'Connect instantly with Shofi Chat. Enjoy persistent 1-to-1 messaging, group chats, audio voice notes, file sharing, and peer-to-peer WebRTC audio and video calling.',
  keywords: [
    'Shofi Chat',
    'ShofiChat',
    'real-time messaging',
    'WebRTC video calling',
    'audio calls',
    'group chat',
    'instant messaging app',
    'peer to peer calls',
    'Next.js chat app',
    'Socket.io real-time',
  ],
  authors: [{ name: 'Shofi', url: 'https://shofichat.vercel.app' }],
  creator: 'Shofi',
  publisher: 'Shofi Chat',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://shofichat.vercel.app',
    siteName: 'Shofi Chat',
    title: 'Shofi Chat — Real-Time Messaging & WebRTC Video Calling',
    description:
      'Ultra-fast real-time communication platform with persistent chat, group channels, voice notes, and crystal-clear WebRTC video & audio calling.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Shofi Chat — Real-Time Messaging & WebRTC Video Calling',
    description:
      'Ultra-fast messaging and WebRTC video calling powered by Next.js, Socket.io, and MongoDB.',
    creator: '@shofichat',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body
        suppressHydrationWarning
        className="h-full bg-neutral-950 text-neutral-100 flex flex-col font-sans overflow-hidden"
      >
        <AuthProvider>
          <SocketProvider>{children}</SocketProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
