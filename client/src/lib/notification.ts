// Notification & Sound Utility for Shofi Chat

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Play a high-quality, gentle chime sound when a new message arrives.
 */
export function playNotificationSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'sine';

    // Pleasant two-tone chime (F6 to A6)
    osc1.frequency.setValueAtTime(1396.91, now); // F6
    osc2.frequency.setValueAtTime(1760.0, now + 0.08); // A6

    gainNode.gain.setValueAtTime(0.08, now);
    gainNode.gain.exponentialRampToValueAtTime(0.18, now + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.12);

    osc2.start(now + 0.08);
    osc2.stop(now + 0.35);
  } catch (err) {
    console.debug('[Audio] Could not play notification sound:', err);
  }
}

/**
 * Check if the browser supports notifications
 */
export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * Get current notification permission
 */
export function getNotificationPermission(): NotificationPermission {
  if (!isNotificationSupported()) return 'denied';
  return Notification.permission;
}

/**
 * Request notification permission from user
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNotificationSupported()) return false;
  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch (e) {
    console.error('Error requesting notification permission:', e);
    return false;
  }
}

/**
 * Trigger desktop/browser notification
 */
export function triggerNotification(
  title: string,
  options?: {
    body?: string;
    icon?: string;
    tag?: string;
    onClick?: () => void;
  }
) {
  if (typeof window === 'undefined') return;

  // Always play message sound
  playNotificationSound();

  // If browser notification allowed and document is hidden or user unfocused
  if (isNotificationSupported() && Notification.permission === 'granted') {
    try {
      const notif = new Notification(title, {
        body: options?.body || 'New message on Shofi Chat',
        icon: options?.icon || 'https://api.dicebear.com/7.x/identicon/svg?seed=ShofiChat',
        tag: options?.tag || 'shofi-chat-message',
      });

      if (options?.onClick) {
        notif.onclick = () => {
          window.focus();
          options.onClick?.();
          notif.close();
        };
      }
    } catch (err) {
      console.debug('[Notification] Failed to show system notification:', err);
    }
  }
}
