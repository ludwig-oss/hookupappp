/**
 * Input sanitization to reduce XSS and injection risk.
 * Use on user-provided strings before storing or rendering.
 */

const HTML_ESCAPE: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '/': '&#x2F;',
};

function escapeHtml(str: string): string {
  return String(str).replace(/[&<>"'/]/g, (c) => HTML_ESCAPE[c] ?? c);
}

/** Trim and limit length. Use for display names, bios, short text. */
export function sanitizeText(input: unknown, maxLength: number = 2000): string {
  if (input == null) return '';
  const s = String(input).trim();
  return s.slice(0, maxLength);
}

/** Sanitize for safe HTML display (escape entities). */
export function sanitizeForDisplay(input: unknown, maxLength: number = 2000): string {
  const s = sanitizeText(input, maxLength);
  return escapeHtml(s);
}

/** Sanitize plain text for storage (trim + length). Use when you store and render with escaping on the client. */
export function sanitizeForStorage(input: unknown, maxLength: number = 2000): string {
  return sanitizeText(input, maxLength);
}

/** Sanitize username: alphanumeric + underscore only, length 3–20. Returns empty if invalid. */
export function sanitizeUsername(input: unknown): string {
  const s = String(input ?? '').trim().slice(0, 20);
  return /^[a-zA-Z0-9_]{3,20}$/.test(s) ? s : '';
}

/** Sanitize name: trim, limit length, strip control chars. */
export function sanitizeName(input: unknown, maxLength: number = 100): string {
  const s = String(input ?? '').trim().replace(/[\x00-\x1F\x7F]/g, '').slice(0, maxLength);
  return s;
}
