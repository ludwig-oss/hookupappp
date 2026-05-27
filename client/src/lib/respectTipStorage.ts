export interface RespectTipState {
  lastShownAt: string;
  lastTipIndex: number;
  seenCount: number;
}

const PREFIX = 'mens_respect_tip_v1_';

function key(userId: string): string {
  return `${PREFIX}${userId}`;
}

export function readRespectTipState(userId: string): RespectTipState | null {
  try {
    const raw = localStorage.getItem(key(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RespectTipState;
    if (!parsed.lastShownAt || typeof parsed.lastTipIndex !== 'number') return null;
    return {
      lastShownAt: parsed.lastShownAt,
      lastTipIndex: parsed.lastTipIndex,
      seenCount: typeof parsed.seenCount === 'number' ? parsed.seenCount : 0,
    };
  } catch {
    return null;
  }
}

function minDaysForSeenCount(seenCount: number): number {
  // “Couple times every month” early, then taper.
  if (seenCount < 6) return 10; // ~3/month
  if (seenCount < 12) return 20; // ~1–2/month
  if (seenCount < 18) return 45; // ~every 1.5 months
  return 120; // after “a while”, rare
}

export function shouldShowRespectTip(userId: string): boolean {
  const state = readRespectTipState(userId);
  if (!state) return true;
  const minDays = minDaysForSeenCount(state.seenCount);
  const elapsed = Date.now() - new Date(state.lastShownAt).getTime();
  return elapsed >= minDays * 24 * 60 * 60 * 1000;
}

export function nextRespectTipIndex(userId: string, tipCount: number): number {
  const state = readRespectTipState(userId);
  const prev = state?.lastTipIndex ?? -1;
  return (prev + 1) % tipCount;
}

export function recordRespectTipSeen(userId: string, tipIndex: number): void {
  const state = readRespectTipState(userId);
  const seenCount = (state?.seenCount ?? 0) + 1;
  const next: RespectTipState = {
    lastShownAt: new Date().toISOString(),
    lastTipIndex: tipIndex,
    seenCount,
  };
  localStorage.setItem(key(userId), JSON.stringify(next));
}

/** Short headline for the taper banner (always clear). */
export function taperHeadlineForUser(userId: string): string {
  const seen = readRespectTipState(userId)?.seenCount ?? 0;
  const days = minDaysForSeenCount(seen);
  if (days <= 10) return 'These show a couple times a month at first — then less over time.';
  if (days <= 20) return 'These reminders will show less over time.';
  return 'You’ll see these only occasionally from now on.';
}

export function taperMessageForUser(userId: string): string {
  const seen = readRespectTipState(userId)?.seenCount ?? 0;
  const days = minDaysForSeenCount(seen);
  if (days <= 10) {
    return 'After you’ve read a few, they appear less often automatically. You can always close with × and keep using the app.';
  }
  if (days <= 20) {
    return 'Frequency keeps dropping the more you’ve seen them. Press × anytime to dismiss.';
  }
  return 'You’re almost through the full set — future reminders will be rare.';
}

