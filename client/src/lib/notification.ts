// Notification & Sound Utility for Shofi Chat

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

// Pre-warm / unlock Web Audio API on first user interaction (touch, click, keydown)
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    try {
      const ctx = getAudioContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
    } catch {}
  };
  window.addEventListener('click', unlockAudio, { passive: true });
  window.addEventListener('touchstart', unlockAudio, { passive: true });
  window.addEventListener('keydown', unlockAudio, { passive: true });
}

/**
 * Play a high-quality, gentle chime sound when a new message arrives.
 */
export function playNotificationSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

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
    gainNode.gain.exponentialRampToValueAtTime(0.22, now + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.12);

    osc2.start(now + 0.08);
    osc2.stop(now + 0.38);
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
    if (typeof window !== 'undefined') {
      localStorage.setItem('shofi_notification_asked', 'true');
    }
    return permission === 'granted';
  } catch (e) {
    console.error('Error requesting notification permission:', e);
    return false;
  }
}

/**
 * One-time setup on login/first entry:
 * Prompts notification permission ONCE and unlocks audio context
 * so the user is never repeatedly prompted or annoyed afterwards.
 */
export async function initNotificationAndAudioOnce(): Promise<void> {
  if (typeof window === 'undefined') return;

  // Unlock and pre-warm audio context
  try {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      await ctx.resume();
    }
  } catch {}

  const alreadyRequested = localStorage.getItem('shofi_notification_asked') === 'true';

  // Only request if permission is still 'default' and we have not prompted yet
  if (isNotificationSupported() && Notification.permission === 'default' && !alreadyRequested) {
    localStorage.setItem('shofi_notification_asked', 'true');
    try {
      const res = await Notification.requestPermission();
      if (res === 'granted') {
        playNotificationSound();
      }
    } catch (err) {
      console.debug('[Notification] Request permission notice:', err);
    }
  }
}

export interface NotificationPreferences {
  sound: boolean;
  desktop: boolean;
  inAppToast: boolean;
  notifyReply: boolean;
  notifyMention: boolean;
}

const DEFAULT_PREFS: NotificationPreferences = {
  sound: true,
  desktop: true,
  inAppToast: true,
  notifyReply: true,
  notifyMention: true,
};

export function getNotificationPreferences(): NotificationPreferences {
  if (typeof window === 'undefined') return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem('shofi_notification_prefs');
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function saveNotificationPreferences(prefs: Partial<NotificationPreferences>): NotificationPreferences {
  const current = getNotificationPreferences();
  const updated = { ...current, ...prefs };
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('shofi_notification_prefs', JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to save notification preferences:', err);
    }
  }
  return updated;
}

/**
 * Trigger desktop/browser notification + audio chime
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
  const prefs = getNotificationPreferences();

  // Play sound if enabled
  if (prefs.sound) {
    playNotificationSound();
  }

  // If desktop notifications enabled and permission granted
  if (prefs.desktop && isNotificationSupported() && Notification.permission === 'granted') {
    try {
      const notif = new Notification(title, {
        body: options?.body || 'New message on Shofi Chat',
        icon: options?.icon || 'https://api.dicebear.com/7.x/identicon/svg?seed=ShofiChat',
        tag: options?.tag || `shofi-chat-${Date.now()}`,
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
