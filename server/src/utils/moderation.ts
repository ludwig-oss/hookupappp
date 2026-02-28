/**
 * Content moderation: block harmful or policy-violating text in messages and posts.
 * Checks plain text only (not media data URLs). Returns { allowed, reason }.
 */

const BANNED_PATTERNS: RegExp[] = [
  // Threats / violence
  /\b(kill\s+you|kill\s+yourself|kys|die\s+already|hope you die|wish you were dead)\b/i,
  /\b(rape|raping|rapist)\b/i,
  /\b(beat\s+you\s+up|hurt\s+you\s+bad|come\s+find\s+you)\b/i,
  // Hate / slurs (representative list – expand as needed)
  /\b(n[i1]gg[ae]r|f[a4]gg?ot|tranny|retard|r[e3]t[a4]rd)\b/i,
  // Underage / illegal
  /\b(underage|under\s+18|minor\s+sex|child\s+porn)\b/i,
  // Doxing / coercion
  /\b(I\s+know\s+where\s+you\s+live|I\s+have\s+your\s+address)\b/i,
  // Severe harassment
  /\b(go\s+kill\s+yourself|hang\s+yourself|end\s+your\s+life)\b/i,
];

/** Banned whole words (lowercase); checked as whole-word only to reduce false positives. */
const BANNED_WORDS = new Set([
  'kys', 'rape', 'rapist', 'molest', 'pedophile',
]);

/**
 * Check if content is allowed. Use for message text and post content.
 * Media (data: URLs) are not scanned; only text is checked.
 */
export function checkContent(content: string): { allowed: boolean; reason?: string } {
  if (!content || typeof content !== 'string') return { allowed: true };
  // Skip moderation for media-only content (data URLs)
  const trimmed = content.trim();
  if (trimmed.startsWith('data:') && trimmed.length > 100) return { allowed: true };
  const lower = trimmed.toLowerCase();
  for (const re of BANNED_PATTERNS) {
    if (re.test(trimmed)) {
      return { allowed: false, reason: 'This content violates our community guidelines.' };
    }
  }
  const words = lower.split(/\s+/).map(w => w.replace(/[^a-z0-9]/g, ''));
  for (const word of words) {
    if (BANNED_WORDS.has(word)) {
      return { allowed: false, reason: 'This content violates our community guidelines.' };
    }
  }
  return { allowed: true };
}
