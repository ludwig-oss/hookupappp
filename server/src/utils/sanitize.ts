/**
 * Input sanitization: trim, length limits, strip control chars.
 * Use on user-provided strings before storing. React escapes on display.
 */

export const LIMITS = {
  MESSAGE: 5000,
  POST_CONTENT: 10000,
  POST_TITLE: 200,
  COMMENT: 2000,
  BIO: 500,
  NAME: 100,
  USERNAME: 20,
  CITY: 100,
  COUNTRY: 100,
  LOCATION: 300,
  EVENT_TITLE: 120,
  EVENT_DESCRIPTION: 2000,
  REPORT_DESCRIPTION: 2000,
  REVIEW: 2000,
  REPLY: 1000,
  TAG: 50,
  TAGS_MAX: 10,
  PROMPT: 500,
  REASON: 500,
  NOTES: 1000,
  EXPERIENCE: 5000,
  QUALIFICATIONS: 5000,
  MEDIA_DATA_URL: 6_000_000,
  HTTP_URL: 2048,
  PASSWORD_HINT: 200,
  PHONE: 30,
  PRECOMM_FIELD: 1000,
  SHORT_LABEL: 80,
} as const;

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

function stripControlChars(s: string): string {
  return s.replace(/[\x00-\x1F\x7F]/g, '');
}

/** Trim, strip control chars, limit length. */
export function sanitizeForStorage(input: unknown, maxLength: number = 2000): string {
  if (input == null) return '';
  const s = stripControlChars(String(input).trim());
  return s.slice(0, maxLength);
}

/** @deprecated Prefer sanitizeForStorage; escapes HTML entities for server-rendered HTML. */
export function sanitizeForDisplay(input: unknown, maxLength: number = 2000): string {
  return escapeHtml(sanitizeForStorage(input, maxLength));
}

/** Alias for sanitizeForStorage. */
export function sanitizeText(input: unknown, maxLength: number = 2000): string {
  return sanitizeForStorage(input, maxLength);
}

/** Chat/post body: plain text or allowed media URL / data URL. */
export function sanitizeMessageContent(input: unknown, maxTextLength: number = LIMITS.MESSAGE): string {
  if (input == null) return '';
  const trimmed = String(input).trim();
  if (!trimmed) return '';

  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('data:image/') ||
    lower.startsWith('data:video/') ||
    lower.startsWith('data:audio/')
  ) {
    return trimmed.slice(0, LIMITS.MEDIA_DATA_URL);
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return sanitizeHttpUrl(trimmed);
  }
  return sanitizeForStorage(trimmed, maxTextLength);
}

/** http(s) URLs only. */
export function sanitizeHttpUrl(input: unknown): string {
  if (input == null) return '';
  const s = String(input).trim().slice(0, LIMITS.HTTP_URL);
  if (!/^https?:\/\//i.test(s)) return '';
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    return u.href.slice(0, LIMITS.HTTP_URL);
  } catch {
    return '';
  }
}

/** Sanitize username: lowercase letters, numbers, underscore; length 3–20. Returns empty if invalid. */
export function sanitizeUsername(input: unknown): string {
  const s = String(input ?? '').trim().toLowerCase().slice(0, LIMITS.USERNAME);
  return /^[a-z0-9_]{3,20}$/.test(s) ? s : '';
}

/** Display name: trim, strip control chars, limit length. */
export function sanitizeName(input: unknown, maxLength: number = LIMITS.NAME): string {
  return sanitizeForStorage(input, maxLength);
}

export function sanitizeBio(input: unknown): string {
  return sanitizeForStorage(input, LIMITS.BIO);
}

export function sanitizeTags(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .slice(0, LIMITS.TAGS_MAX)
    .map((t) => sanitizeForStorage(t, LIMITS.TAG))
    .filter(Boolean);
}

export function sanitizeOptionalAge(input: unknown): number | undefined {
  if (input === undefined || input === null || input === '') return undefined;
  const n = typeof input === 'number' ? input : parseInt(String(input), 10);
  if (!Number.isFinite(n) || n < 18 || n > 120) return undefined;
  return n;
}

const PRECOMM_KEYS = [
  'whatLookingFor',
  'howWillMeet',
  'canAffordTravelProof',
  'willingToMoveWhere',
  'whereWork',
  'whereLive',
  'whereChill',
  'name',
  'familyFriends',
] as const;

export function sanitizePreCommFields(
  data: Record<string, unknown>
): Partial<Record<(typeof PRECOMM_KEYS)[number], string>> {
  const out: Partial<Record<(typeof PRECOMM_KEYS)[number], string>> = {};
  for (const key of PRECOMM_KEYS) {
    if (key in data) out[key] = sanitizeForStorage(data[key], LIMITS.PRECOMM_FIELD);
  }
  return out;
}

export function preCommFieldsWithDefaults(
  data: Record<string, unknown>
): Record<(typeof PRECOMM_KEYS)[number], string> {
  const safe = sanitizePreCommFields(data);
  return {
    whatLookingFor: safe.whatLookingFor ?? '',
    howWillMeet: safe.howWillMeet ?? '',
    canAffordTravelProof: safe.canAffordTravelProof ?? '',
    willingToMoveWhere: safe.willingToMoveWhere ?? '',
    whereWork: safe.whereWork ?? '',
    whereLive: safe.whereLive ?? '',
    whereChill: safe.whereChill ?? '',
    name: safe.name ?? '',
    familyFriends: safe.familyFriends ?? '',
  };
}

const REPORT_CATEGORIES = [
  'harassment', 'fake', 'inappropriate', 'spam', 'scam', 'underage', 'violence', 'other',
] as const;

export type SanitizedReportCategory = (typeof REPORT_CATEGORIES)[number];

export function parseReportCategory(input: unknown): SanitizedReportCategory | '' {
  const s = sanitizeForStorage(input, LIMITS.SHORT_LABEL);
  return (REPORT_CATEGORIES as readonly string[]).includes(s) ? (s as SanitizedReportCategory) : '';
}

const EVENT_TYPES = [
  'house_party', 'club', 'picnic', 'chilling', 'watch_football', 'drinks', 'other',
] as const;

export type SanitizedEventType = (typeof EVENT_TYPES)[number];

export function parseEventType(input: unknown): SanitizedEventType | '' {
  const s = sanitizeForStorage(input, LIMITS.SHORT_LABEL);
  return (EVENT_TYPES as readonly string[]).includes(s) ? (s as SanitizedEventType) : '';
}

export function sanitizeBuzzLocation(
  location: unknown
): { lat: number; lon: number; venue?: string; venueType?: string } | undefined {
  if (!location || typeof location !== 'object') return undefined;
  const loc = location as Record<string, unknown>;
  const lat = Number(loc.lat);
  const lon = Number(loc.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return undefined;
  return {
    lat,
    lon,
    venue: loc.venue != null ? sanitizeForStorage(loc.venue, LIMITS.LOCATION) : undefined,
    venueType: loc.venueType != null ? sanitizeForStorage(loc.venueType, LIMITS.SHORT_LABEL) : undefined,
  };
}
