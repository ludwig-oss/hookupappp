import { intervalDaysForUser } from '../data/datingTipInterval';

export type DatingTipAudience = 'mens' | 'womens';

const PREFIX = 'dating_tip_v1_';

export interface DatingTipStorageState {
  lastDismissedAt: string;
  tipIndex: number;
  intervalDays: number;
}

export function datingTipStorageKey(userId: string, audience: DatingTipAudience): string {
  return `${PREFIX}${audience}_${userId}`;
}

function migrateLegacyMensKey(userId: string): void {
  const legacy = `mens_dating_tip_v1_${userId}`;
  const next = datingTipStorageKey(userId, 'mens');
  try {
    const old = localStorage.getItem(legacy);
    if (old && !localStorage.getItem(next)) {
      localStorage.setItem(next, old);
      localStorage.removeItem(legacy);
    }
  } catch {
    /* ignore */
  }
}

export function readDatingTipState(userId: string, audience: DatingTipAudience): DatingTipStorageState | null {
  if (audience === 'mens') migrateLegacyMensKey(userId);
  try {
    const raw = localStorage.getItem(datingTipStorageKey(userId, audience));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DatingTipStorageState;
    if (!parsed.lastDismissedAt || typeof parsed.tipIndex !== 'number') return null;
    return {
      ...parsed,
      intervalDays: parsed.intervalDays || intervalDaysForUser(userId, audience),
    };
  } catch {
    return null;
  }
}

export function writeDatingTipDismiss(
  userId: string,
  audience: DatingTipAudience,
  tipIndex: number
): void {
  const state: DatingTipStorageState = {
    lastDismissedAt: new Date().toISOString(),
    tipIndex,
    intervalDays: intervalDaysForUser(userId, audience),
  };
  localStorage.setItem(datingTipStorageKey(userId, audience), JSON.stringify(state));
}

export function shouldShowDatingTip(userId: string, audience: DatingTipAudience): boolean {
  const state = readDatingTipState(userId, audience);
  if (!state) return true;
  const elapsed = Date.now() - new Date(state.lastDismissedAt).getTime();
  const required = state.intervalDays * 24 * 60 * 60 * 1000;
  return elapsed >= required;
}

export function nextTipIndex(userId: string, audience: DatingTipAudience, tipCount: number): number {
  const state = readDatingTipState(userId, audience);
  const prev = state?.tipIndex ?? -1;
  return (prev + 1) % tipCount;
}
