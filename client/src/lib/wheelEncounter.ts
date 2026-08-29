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
  return users.filter((u) => !hasWheelUserActed(u.id));
}
