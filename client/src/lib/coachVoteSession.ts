const SESSION_KEY = 'coachVote:sessionId';
const SHOWN_PREFIX = 'coachVote:popup:';

function sessionId(): string {
  if (typeof sessionStorage === 'undefined') return 'default';
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function shouldShowCoachVotePopup(campaignId: string): boolean {
  if (typeof sessionStorage === 'undefined') return true;
  const key = `${SHOWN_PREFIX}${sessionId()}:${campaignId}`;
  return sessionStorage.getItem(key) !== '1';
}

export function markCoachVotePopupShown(campaignId: string): void {
  if (typeof sessionStorage === 'undefined') return;
  const key = `${SHOWN_PREFIX}${sessionId()}:${campaignId}`;
  sessionStorage.setItem(key, '1');
}

export function getSkippedPopupIds(): string[] {
  if (typeof sessionStorage === 'undefined') return [];
  const prefix = `${SHOWN_PREFIX}${sessionId()}:`;
  const ids: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const k = sessionStorage.key(i);
    if (k?.startsWith(prefix) && sessionStorage.getItem(k) === '1') {
      ids.push(k.slice(prefix.length));
    }
  }
  return ids;
}
