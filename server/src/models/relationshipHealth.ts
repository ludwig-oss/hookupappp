import type { Relationship } from './relationship.js';

export type HealthLevel = 'great' | 'good' | 'low' | 'critical';

export interface RelationshipHealthSnapshot {
  score: number;
  baseScore: number;
  boostPoints: number;
  level: HealthLevel;
  label: string;
  message: string;
  needsChargeUp: boolean;
  messagesLast7Days: number;
  hoursSinceLastMessage: number;
  daysSinceDateTalk: number | null;
  suggestGuide: boolean;
  selfControlTip: string | null;
  recentBoosts?: Array<{ activity: string; points: number; label: string; createdAt: string }>;
}

const DATE_KEYWORDS = [
  'date', 'meet', 'dinner', 'coffee', 'movie', 'plan', 'weekend', 'together',
  'restaurant', 'walk', 'picnic', 'tonight', 'tomorrow', 'saturday', 'sunday',
];

export const BLIND_DATE_IDEAS = [
  'Blind taste test — each order something for the other without saying what',
  'Mystery walk — one person picks the direction at every corner for 20 minutes',
  'Theme night at home — dress as a decade (80s, 90s) and cook one dish blindfolded',
  'Swap phones for 30 minutes — each plans a mini surprise route on maps',
  'Book a class neither of you has tried (pottery, salsa, cooking)',
  'Visit a new neighborhood — no researching; pick the café with the best vibe from outside',
  'Write 3 date ideas on paper, shuffle, pick one blind',
  'Sunset picnic — partner packs the basket without telling you what is inside',
  'Arcade or mini-golf — loser plans the next surprise date',
  'Volunteer together for 2 hours, then debrief over hot chocolate',
  'Photo scavenger hunt — 5 items to find in the city in 45 minutes',
  'Staycation hotel night in your own city — check in without telling friends',
  'Blind playlist swap — each makes a 30-min playlist for the other',
  'Try a food market and only eat things you have never tried',
  'Board-game café — pick a game by cover art only',
];

export const SURPRISE_GIFT_IDEAS = [
  'Handwritten note left where they will find it tomorrow morning',
  'Their favorite snack showing up at their door with no explanation',
  'A photo album page of your favorite memories together',
  'Plan a micro-adventure they mentioned once in passing',
  'A playlist titled "Why I choose you" with 5 songs',
  'Book something they have been putting off (massage, class, show)',
  'DIY coupon book (breakfast in bed, chore-free evening, movie pick)',
  'Flowers or a plant with a note about growing together',
  'Order delivery from their comfort-food place after a hard day',
  'Surprise video montage from friends saying what they admire about you two',
];

export const SELF_CONTROL_TIPS = [
  'When temptation hits: avoid prolonged eye contact, change seats, or look down until the moment passes. Self-control protects what you built.',
  'Hard seasons create the deepest bonds. Choose your partner again today — small loyalty in tough moments compounds.',
  'If someone flirts while you are taken, keep replies short, mention your partner, and leave the situation. Boundaries are love in action.',
  'Move seats or step outside for air rather than entertaining what-ifs. The best relationships are built in boring, faithful moments.',
  'Remind yourself what you would lose: trust, your partner\'s peace, and the future you are building together.',
];

export function computeRelationshipHealth(
  messages: { content: string; createdAt: Date | string; fromUserId?: string }[],
  _rel?: Relationship | null,
  activityBoostPoints = 0
): RelationshipHealthSnapshot {
  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const recent = messages.filter((m) => new Date(m.createdAt).getTime() >= weekAgo);
  const last = messages.length ? messages[messages.length - 1] : null;
  const hoursSinceLast = last
    ? (now - new Date(last.createdAt).getTime()) / (1000 * 60 * 60)
    : 999;

  let lastDateTalk: Date | null = null;
  for (let i = messages.length - 1; i >= 0; i--) {
    const text = messages[i].content.toLowerCase();
    if (DATE_KEYWORDS.some((k) => text.includes(k))) {
      lastDateTalk = new Date(messages[i].createdAt);
      break;
    }
  }
  const daysSinceDateTalk = lastDateTalk
    ? (now - lastDateTalk.getTime()) / (1000 * 60 * 60 * 24)
    : null;

  let score = 78;
  if (recent.length >= 20) score += 12;
  else if (recent.length >= 10) score += 5;
  else if (recent.length < 4) score -= 22;
  else if (recent.length < 8) score -= 12;

  if (hoursSinceLast > 72) score -= 25;
  else if (hoursSinceLast > 48) score -= 18;
  else if (hoursSinceLast > 24) score -= 8;

  if (daysSinceDateTalk === null || daysSinceDateTalk > 21) score -= 18;
  else if (daysSinceDateTalk > 14) score -= 10;

  const baseScore = Math.max(0, Math.min(100, Math.round(score)));
  score = Math.min(100, baseScore + activityBoostPoints);

  let level: HealthLevel = 'good';
  if (score >= 75) level = 'great';
  else if (score >= 50) level = 'good';
  else if (score >= 30) level = 'low';
  else level = 'critical';

  const needsChargeUp = level === 'low' || level === 'critical';
  let label = 'Strong connection';
  let message = 'You two are showing up for each other. Keep it going.';
  if (activityBoostPoints > 0 && score > baseScore) {
    message = `Connection recharging — +${activityBoostPoints} from quizzes, gifts, games & quality time. Keep it up!`;
  }
  if (level === 'good') {
    label = 'Steady';
    if (activityBoostPoints <= 0) {
      message = 'Connection is okay — plan something small this week to recharge.';
    }
  }
  if (level === 'low') {
    label = 'Low — charge up';
    message = 'Vibes are fading — try a quiz, surprise gift, watch-together, or blind date to raise your bar.';
  }
  if (level === 'critical') {
    label = 'Needs attention';
    message = 'Health bar is critical. Play a game, share gratitude, or plan a date — each activity charges you up.';
  }
  if (level === 'great' && activityBoostPoints >= 15) {
    label = 'Charged up';
    message = 'You are investing in each other — the bar reflects your quizzes, gifts, and good convos. Beautiful.';
  }

  return {
    score,
    baseScore,
    boostPoints: activityBoostPoints,
    level,
    label,
    message,
    needsChargeUp,
    messagesLast7Days: recent.length,
    hoursSinceLastMessage: Math.round(hoursSinceLast),
    daysSinceDateTalk: daysSinceDateTalk != null ? Math.round(daysSinceDateTalk) : null,
    suggestGuide: score < 55,
    selfControlTip: needsChargeUp ? SELF_CONTROL_TIPS[Math.floor(Math.random() * SELF_CONTROL_TIPS.length)] : null,
  };
}

export function pickBlindDate(history: string[] = []): string {
  const pool = BLIND_DATE_IDEAS.filter((idea) => !history.includes(idea));
  const list = pool.length ? pool : BLIND_DATE_IDEAS;
  return list[Math.floor(Math.random() * list.length)];
}

export function pickSurpriseIdeas(): { forYou: string; forPartner: string } {
  const shuffled = [...SURPRISE_GIFT_IDEAS].sort(() => Math.random() - 0.5);
  return {
    forYou: shuffled[0] || SURPRISE_GIFT_IDEAS[0],
    forPartner: shuffled[1] || shuffled[0] || SURPRISE_GIFT_IDEAS[1],
  };
}

export const CHEAT_WARNING = {
  title: 'You are in a relationship',
  body: 'Opening this chat while taken can hurt trust. If you entertain others, you risk:',
  risks: [
    'Damaging the relationship health you built with your partner',
    'Your partner being notified of suspicious activity patterns',
    'Losing couple perks: blind dates, games, watch-together, and guide support',
    'Reputation flags if reports are filed — cheating violates community rules',
  ],
  selfControl:
    'Practice self-control: avoid eye contact with temptation, change seats, or look down. Hard times forge the best relationships — choose your partner.',
};

export const COUPLE_QUIZ = [
  { q: 'Ideal recharge together?', a: 'Cozy night in', b: 'Adventure outside' },
  { q: 'Love language today?', a: 'Words & quality time', b: 'Touch & acts of service' },
  { q: 'Next date vibe?', a: 'Food & conversation', b: 'Activity & laughter' },
];
