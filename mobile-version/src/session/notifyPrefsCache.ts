import type { UserSettings } from '../api/settings';

export type NotifyKind = 'messages' | 'matches' | 'likes' | 'interest' | 'safety' | 'generic';

export type CachedNotifyPrefs = {
  push: boolean;
  email: boolean;
  messages: boolean;
  matches: boolean;
  likes: boolean;
  interestAlerts: boolean;
  interestVibrate: boolean;
  sound: boolean;
  quietHours: { enabled: boolean; start: string; end: string };
};

let cached: CachedNotifyPrefs | null = null;

function parseHm(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(value || '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || min > 59) return null;
  return h * 60 + min;
}

export function isQuietHoursNow(quiet: CachedNotifyPrefs['quietHours'], now = new Date()): boolean {
  if (!quiet?.enabled) return false;
  const start = parseHm(quiet.start);
  const end = parseHm(quiet.end);
  if (start == null || end == null) return false;
  const cur = now.getHours() * 60 + now.getMinutes();
  if (start === end) return true;
  if (start < end) return cur >= start && cur < end;
  return cur >= start || cur < end;
}

export function cacheNotifyPrefs(settings: UserSettings | null | undefined): void {
  const n = settings?.notifications;
  if (!n) return;
  cached = {
    push: n.push !== false,
    email: n.email !== false,
    messages: n.messages !== false,
    matches: n.matches !== false,
    likes: n.likes !== false,
    interestAlerts: n.interestAlerts !== false,
    interestVibrate: n.interestVibrate !== false,
    sound: n.sound !== false,
    quietHours: {
      enabled: Boolean(n.quietHours?.enabled),
      start: n.quietHours?.start || '22:00',
      end: n.quietHours?.end || '08:00',
    },
  };
}

export function getCachedNotifyPrefs(): CachedNotifyPrefs | null {
  return cached;
}

export function shouldNotifyInApp(kind: NotifyKind = 'generic'): boolean {
  const n = cached;
  if (!n) return true;
  if (kind === 'safety') return true;
  if (isQuietHoursNow(n.quietHours)) return false;
  if (kind === 'messages' && !n.messages) return false;
  if (kind === 'matches' && !n.matches) return false;
  if (kind === 'likes' && !n.likes) return false;
  if (kind === 'interest' && !n.interestAlerts) return false;
  return true;
}

export function shouldVibrateInApp(kind: NotifyKind = 'generic'): boolean {
  const n = cached;
  if (!n) return true;
  if (kind === 'interest') return n.interestVibrate;
  return n.sound;
}

export function shouldPlaySoundInApp(): boolean {
  return cached?.sound !== false;
}
