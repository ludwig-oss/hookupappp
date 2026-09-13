/**
 * Content moderation: TikTok-style safety filter + Love Life Feed niche gatekeeper.
 * Dating / relationship / attraction content only on the feed.
 */

export const LOVE_FEED_BLOCKED_HARMFUL =
  '*Post Blocked: Violative Content Detected.*\n\nThis submission violates Community Safety Standards. Continued attempts will result in account moderation.';

export const LOVE_FEED_SUPPRESSED_OFF_TOPIC =
  '*Post Suppressed: Content not related to Dating & Relationship Dynamics.*\n\nCommunity Guidelines require all submissions to focus on attraction, love life, or relationship coaching. Please recalibrate your prompt.';

const BANNED_PATTERNS: RegExp[] = [
  // Threats / violence / self-harm (incl. algospeak)
  /\b(kill\s+you|kill\s+yourself|kys|die\s+already|hope you die|wish you were dead)\b/i,
  /\b(go\s+kill\s+yourself|hang\s+yourself|end\s+your\s+life)\b/i,
  /\b(unalive|unaliving|sewerslide|sewer\s*slide|self[\s-]?harm)\b/i,
  /\b(rape|raping|rapist)\b/i,
  /\b(beat\s+you\s+up|hurt\s+you\s+bad|come\s+find\s+you)\b/i,
  // Hate / slurs (representative — expand as needed)
  /\b(n[i1]gg[ae]r|f[a4]gg?ot|tranny|retard|r[e3]t[a4]rd)\b/i,
  // Underage / illegal
  /\b(underage|under\s+18|minor\s+sex|child\s+porn|cp\b)/i,
  // Doxing / coercion
  /\b(I\s+know\s+where\s+you\s+live|I\s+have\s+your\s+address)\b/i,
];

const BANNED_WORDS = new Set([
  'kys',
  'rape',
  'rapist',
  'molest',
  'pedophile',
  'unalive',
  'unaliving',
  'sewerslide',
]);

/** Signals that content belongs in Love Life Feed */
const DATING_TOPIC_RE =
  /\b(dat(e|ing|es)|relationship|relationships|love\s*life|boyfriend|girlfriend|husband|wife|fiancé|fiance|marriage|married|wedding|crush|attraction|attractive|chemistry|flirt|flirting|hook.?up|situationship|exclusive|commitment|break.?up|broke\s+up|ex\b|ghost(ed|ing)?|breadcrumbing|love.?bomb|red\s*flag|green\s*flag|boundaries|texting|dm\b|rizz|courtship|romance|romantic|partner|spouse|anniversary|engagement|propose|proposal|tinder|bumble|hinge|match(es|ing)?|compatibility|intimacy|affection|jealous|jealousy|cheating|cheat(er|ed)?|loyalty|trust\b|healing|self.?worth|looksmax|looksmaxxing|glow.?up|first\s+date|second\s+date|third\s+date|meetup|meet.?up|dating\s+app|poly|monogamy|open\s+relationship|heartbreak|heartbroken|lonely|loneliness|single\s+again|moving\s+on|soft\s+launch|hard\s+launch|talking\s+stage|situationship|orbit(er|ing)?|simping|simp\b|friend.?zone|orbiting|orbit)\b/i;

/** Strong off-niche domains — suppress unless dating signals dominate */
const OFF_TOPIC_RE =
  /\b(bitcoin|btc\b|ethereum|eth\s|crypto(currency)?|nft\b|blockchain|forex|stock\s+market|nasdaq|speedrun|fortnite|minecraft|valorant|call\s+of\s+duty|league\s+of\s+legends|pokemon|calculus|algebra|quantum\s+physics|cooking\s+recipe|recipe\s+for|gardening|car\s+engine|oil\s+change|tax\s+return|irs\b|docker\s+compose|kubernetes|react\s+native\s+tutorial|leetcode|coding\s+interview|javascript\s+framework|typescript\s+generics|sql\s+injection|css\s+grid|machine\s+learning\s+model|gpu\s+benchmark)\b/i;

/** Tech/coding without dating product context */
const TECH_WITHOUT_DATING_RE =
  /\b(write\s+(me\s+)?(a\s+)?(script|function|api|endpoint|router|class)|build\s+(me\s+)?(a\s+)?(website|app|bot|server)|debug\s+this|fix\s+this\s+bug|implement\s+oauth|deploy\s+to\s+vercel)\b/i;

const SHORT_ENGAGEMENT_RE =
  /^(this\.?|facts?\.?|true\.?|real\.?|same\.?|mood\.?|needed\s+this\.?|so\s+true\.?|exactly\.?|agree\.?|100\.?|preach\.?|yes\.?|yep\.?|lol\.?|❤️|💕|🔥|👏)+$/i;

export type ModerationResult = {
  allowed: boolean;
  reason?: string;
  code?: 'harmful' | 'off_topic';
};

function stripMediaNoise(content: string): string {
  if (!content || typeof content !== 'string') return '';
  const trimmed = content.trim();
  if (trimmed.startsWith('data:') && trimmed.length > 100) return '';
  if (trimmed.startsWith('HOOKUPGIF:')) return '';
  if (/^https?:\/\//i.test(trimmed) && !/\s/.test(trimmed)) return '';
  return trimmed;
}

function hasHarmfulLanguage(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  for (const re of BANNED_PATTERNS) {
    if (re.test(text)) return true;
  }
  const words = lower.split(/\s+/).map((w) => w.replace(/[^a-z0-9]/g, ''));
  for (const word of words) {
    if (BANNED_WORDS.has(word)) return true;
  }
  return false;
}

function datingSignalCount(text: string): number {
  if (!text) return 0;
  const matches = text.match(
    new RegExp(DATING_TOPIC_RE.source, 'gi')
  );
  return matches?.length || 0;
}

/**
 * General check (messages, legacy). Harmful language only.
 */
export function checkContent(content: string): ModerationResult {
  if (!content || typeof content !== 'string') return { allowed: true };
  const trimmed = content.trim();
  if (trimmed.startsWith('data:') && trimmed.length > 100) return { allowed: true };
  if (trimmed.startsWith('HOOKUPGIF:')) return { allowed: true };
  if (hasHarmfulLanguage(trimmed)) {
    return {
      allowed: false,
      code: 'harmful',
      reason: LOVE_FEED_BLOCKED_HARMFUL,
    };
  }
  return { allowed: true };
}

/**
 * Love Life Feed gatekeeper: harmful filter + dating/relationship niche fence.
 * Technical help is only allowed when the text clearly serves a dating/relationship tool.
 */
export function checkLoveFeedSubmission(
  parts: { title?: string | null; content?: string | null; tags?: string[] | null; isComment?: boolean },
): ModerationResult {
  const title = (parts.title || '').trim();
  const rawContent = parts.content || '';
  const textBody = stripMediaNoise(rawContent);
  const tags = (parts.tags || []).filter(Boolean).join(' ');
  const combined = [title, textBody, tags].filter(Boolean).join(' ').trim();

  if (hasHarmfulLanguage(combined) || hasHarmfulLanguage(title) || hasHarmfulLanguage(textBody)) {
    return { allowed: false, code: 'harmful', reason: LOVE_FEED_BLOCKED_HARMFUL };
  }

  // Media-only with no caption/title/tags — require dating framing
  if (!combined) {
    return { allowed: false, code: 'off_topic', reason: LOVE_FEED_SUPPRESSED_OFF_TOPIC };
  }

  // Short comment reactions stay allowed (still passed harmful check above)
  if (parts.isComment && (combined.length <= 40 || SHORT_ENGAGEMENT_RE.test(combined))) {
    return { allowed: true };
  }

  const datingHits = datingSignalCount(combined);
  const offTopic = OFF_TOPIC_RE.test(combined);
  const techBare = TECH_WITHOUT_DATING_RE.test(combined) && datingHits === 0;

  if (offTopic && datingHits === 0) {
    return { allowed: false, code: 'off_topic', reason: LOVE_FEED_SUPPRESSED_OFF_TOPIC };
  }
  if (techBare) {
    return { allowed: false, code: 'off_topic', reason: LOVE_FEED_SUPPRESSED_OFF_TOPIC };
  }

  // Require at least one dating/relationship signal for posts (and longer comments)
  if (datingHits === 0) {
    return { allowed: false, code: 'off_topic', reason: LOVE_FEED_SUPPRESSED_OFF_TOPIC };
  }

  return { allowed: true };
}
