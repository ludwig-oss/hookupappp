export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
export const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;
export const USERNAME_HINT = 'Letters, numbers, and _ (3–20 characters)';

/** Normalize while typing: lowercase, keep a–z, 0–9, and underscore. */
export function normalizeUsernameInput(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, USERNAME_MAX);
}

export function isValidUsername(value: string): boolean {
  return USERNAME_REGEX.test(value.trim().toLowerCase());
}

/** Login field: keep Gmail intact; usernames still strip to a–z / 0–9 / _. */
export function normalizeLoginIdentifier(value: string): string {
  const v = value.trim();
  if (v.includes('@')) return v.toLowerCase().slice(0, 254);
  return normalizeUsernameInput(value);
}
