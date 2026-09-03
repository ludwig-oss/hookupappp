import type { UserSettings } from '../models/settings.js';

export type NotifyCategory = 'messages' | 'matches' | 'likes' | 'interest' | 'safety';

export function isInQuietHours(quiet: { enabled: boolean; start: string; end: string }, now = new Date()): boolean {
  if (!quiet?.enabled) return false;
  const start = parseHm(quiet.start);
  const end = parseHm(quiet.end);
  if (start == null || end == null) return false;
  const cur = now.getHours() * 60 + now.getMinutes();
  if (start === end) return true;
  if (start < end) return cur >= start && cur < end;
  return cur >= start || cur < end;
}

function parseHm(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(value || '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || min > 59) return null;
  return h * 60 + min;
}

export function inferNotifyCategory(data?: Record<string, string>): NotifyCategory {
  const t = String(data?.type || '');
  if (t === 'new_message') return 'messages';
  if (t === 'new_match') return 'matches';
  if (t === 'new_like') return 'likes';
  if (t === 'new_interest') return 'interest';
  return 'safety';
}

export function shouldSendPush(settings: UserSettings, category: NotifyCategory): boolean {
  const n = settings.notifications;
  if (category === 'safety') return true;
  if (!n.push) return false;
  if (isInQuietHours(n.quietHours)) return false;
  if (category === 'messages' && !n.messages) return false;
  if (category === 'matches' && !n.matches) return false;
  if (category === 'likes' && !n.likes) return false;
  if (category === 'interest' && n.interestAlerts === false) return false;
  return true;
}

export function shouldSendEmail(settings: UserSettings, category: NotifyCategory): boolean {
  const n = settings.notifications;
  if (category === 'safety') return n.email !== false;
  if (!n.email) return false;
  if (isInQuietHours(n.quietHours)) return false;
  if (category === 'messages' && !n.messages) return false;
  if (category === 'matches' && !n.matches) return false;
  if (category === 'likes' && !n.likes) return false;
  if (category === 'interest' && n.interestAlerts === false) return false;
  return true;
}
