/** Remember wheel-game pass/interest so the same person is not shown again. */

const PREFIX = 'wheel:acted:';

export function markWheelUserActed(userId: string): void {
  if (!userId) return;
  try {
    localStorage.setItem(`${PREFIX}${userId}`, '1');
  } catch {
    /* ignore */
  }
}

export function hasWheelUserActed(userId: string): boolean {
  if (!userId) return false;
  try {
    return localStorage.getItem(`${PREFIX}${userId}`) === '1';
  } catch {
    return false;
  }
}

export function filterWheelUsers<T extends { id: string }>(users: T[]): T[] {
  const fresh = users.filter((u) => !hasWheelUserActed(u.id));
  // If we've exhausted everyone, reset the acted set so the wheel can play again
  if (!fresh.length && users.length) {
    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(PREFIX)) keys.push(k);
      }
      keys.forEach((k) => localStorage.removeItem(k));
    } catch {
      /* ignore */
    }
    return users;
  }
  return fresh;
}
