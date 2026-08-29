import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export type CoupleActivityType =
  | 'quiz'
  | 'game_xo'
  | 'game_other'
  | 'watch_together'
  | 'surprise_gift'
  | 'blind_date'
  | 'gratitude'
  | 'appreciation'
  | 'deep_convo'
  | 'check_in_positive'
  | 'walk_together'
  | 'cook_together'
  | 'memory_share'
  | 'future_dream'
  | 'voice_love'
  | 'would_you_rather'
  | 'this_or_that'
  | 'two_truths_lie'
  | 'emoji_story'
  | 'love_language'
  | 'song_dedication'
  | 'date_night_plan'
  | 'compliment_duel'
  | 'bucket_list'
  | 'deep_question';

export interface CoupleHealthBoost {
  id: string;
  relationshipId: string;
  userId: string;
  activity: CoupleActivityType;
  points: number;
  label: string;
  createdAt: string;
}

export const ACTIVITY_POINTS: Record<CoupleActivityType, number> = {
  quiz: 8,
  game_xo: 12,
  game_other: 8,
  watch_together: 10,
  surprise_gift: 12,
  blind_date: 14,
  gratitude: 9,
  appreciation: 10,
  deep_convo: 7,
  check_in_positive: 11,
  walk_together: 10,
  cook_together: 11,
  memory_share: 8,
  future_dream: 9,
  voice_love: 10,
  would_you_rather: 8,
  this_or_that: 7,
  two_truths_lie: 9,
  emoji_story: 8,
  love_language: 10,
  song_dedication: 8,
  date_night_plan: 9,
  compliment_duel: 9,
  bucket_list: 8,
  deep_question: 7,
};

export const ACTIVITY_LABELS: Record<CoupleActivityType, string> = {
  quiz: 'Couple quiz',
  game_xo: 'Tic-Tac-Toe',
  game_other: 'Couple game',
  watch_together: 'Watch together',
  surprise_gift: 'Surprise / gift',
  blind_date: 'Blind date plan',
  gratitude: 'Gratitude message',
  appreciation: 'Appreciation list',
  deep_convo: 'Quality conversation',
  check_in_positive: 'Positive check-in',
  walk_together: 'Walk together',
  cook_together: 'Cook together',
  memory_share: 'Shared memory',
  future_dream: 'Future dream date',
  voice_love: 'Voice love note',
  would_you_rather: 'Would you rather',
  this_or_that: 'This or that',
  two_truths_lie: 'Two truths & a lie',
  emoji_story: 'Emoji story',
  love_language: 'Love language check-in',
  song_dedication: 'Song dedication',
  date_night_plan: 'Date night plan',
  compliment_duel: 'Compliment duel',
  bucket_list: 'Couple bucket list',
  deep_question: 'Deep question',
};

/** Quick actions shown in couple hub — each raises the health bar. */
export const COUPLE_BONDING_ACTIVITIES: Array<{
  id: CoupleActivityType;
  emoji: string;
  title: string;
  prompt: string;
  messageTemplate: string;
}> = [
  {
    id: 'gratitude',
    emoji: '🙏',
    title: 'Gratitude swap',
    prompt: 'Tell your partner one thing you are grateful for today.',
    messageTemplate: 'Gratitude: I am thankful for you because…',
  },
  {
    id: 'appreciation',
    emoji: '💝',
    title: '3 appreciations',
    prompt: 'Name three things you appreciate about them right now.',
    messageTemplate: 'Three things I appreciate about you: 1) … 2) … 3) …',
  },
  {
    id: 'memory_share',
    emoji: '📸',
    title: 'Favorite memory',
    prompt: 'Share a memory that still makes you smile.',
    messageTemplate: 'Favorite memory with you: …',
  },
  {
    id: 'future_dream',
    emoji: '✨',
    title: 'Dream together',
    prompt: 'Describe a date you want us to have in the future.',
    messageTemplate: 'Dream date I want with you someday: …',
  },
  {
    id: 'walk_together',
    emoji: '🚶',
    title: 'Plan a walk',
    prompt: 'Pick a time to walk together (in person or on call while walking).',
    messageTemplate: 'Want to walk together? I am free … — we can chat on the phone while we walk.',
  },
  {
    id: 'cook_together',
    emoji: '🍳',
    title: 'Cook together',
    prompt: 'Same recipe, video call, eat together.',
    messageTemplate: 'Let us cook the same recipe on video call tonight — I will pick …',
  },
  {
    id: 'voice_love',
    emoji: '🎤',
    title: 'Voice love note',
    prompt: 'Send a short voice message saying what you love about them.',
    messageTemplate: '🎤 Sending you a voice love note — check my next message!',
  },
];

/** 10 extra couple games & bonding ideas (app picks — raises health bar). */
export const COUPLE_EXTRA_ACTIVITIES: Array<{
  id: CoupleActivityType;
  category: 'game' | 'bonding';
  emoji: string;
  title: string;
  prompt: string;
  messageTemplate: string;
}> = [
  {
    id: 'would_you_rather',
    category: 'game',
    emoji: '🎲',
    title: 'Would you rather',
    prompt: 'Pick one — your partner answers next.',
    messageTemplate:
      '🎲 Would you rather: always know what I am thinking, OR never have a boring day together again?',
  },
  {
    id: 'this_or_that',
    category: 'game',
    emoji: '⚡',
    title: 'This or that',
    prompt: 'Fast choices — learn tiny preferences about each other.',
    messageTemplate: '⚡ This or that: sunrise date 🌅 or stargazing night 🌙?',
  },
  {
    id: 'two_truths_lie',
    category: 'game',
    emoji: '🃏',
    title: 'Two truths & a lie',
    prompt: 'Share 3 statements — partner guesses the lie.',
    messageTemplate:
      '🃏 Two truths & a lie: 1) … 2) … 3) … — which one is the lie?',
  },
  {
    id: 'emoji_story',
    category: 'game',
    emoji: '😄',
    title: 'Emoji story',
    prompt: 'Tell a mini love story using only emojis.',
    messageTemplate: '😄 Emoji story about us: 💑☕🌧️🏠❤️ — your turn!',
  },
  {
    id: 'love_language',
    category: 'bonding',
    emoji: '💬',
    title: 'Love language moment',
    prompt: 'Say how you feel loved — words, time, touch, gifts, or acts of service.',
    messageTemplate:
      '💬 Love language check-in: I feel most loved when you … — what about you?',
  },
  {
    id: 'song_dedication',
    category: 'bonding',
    emoji: '🎵',
    title: 'Song dedication',
    prompt: 'Send a song link or title that reminds you of them.',
    messageTemplate: '🎵 This song reminds me of you: … — listen when you can?',
  },
  {
    id: 'date_night_plan',
    category: 'bonding',
    emoji: '🌙',
    title: 'Plan date night',
    prompt: 'Suggest a concrete plan — day, time, and vibe.',
    messageTemplate: '🌙 Date night plan: this … at … — dress code: cozy / fancy / adventure?',
  },
  {
    id: 'compliment_duel',
    category: 'bonding',
    emoji: '💕',
    title: 'Compliment duel',
    prompt: 'Trade three genuine compliments — no repeats.',
    messageTemplate:
      '💕 Compliment duel — my three for you: 1) … 2) … 3) … — hit me back with yours!',
  },
  {
    id: 'bucket_list',
    category: 'bonding',
    emoji: '📝',
    title: 'Bucket list item',
    prompt: 'Add one thing you want to do together this year.',
    messageTemplate: '📝 Couple bucket list: I want us to … before the year ends. Add yours!',
  },
  {
    id: 'deep_question',
    category: 'bonding',
    emoji: '🔮',
    title: 'Deep question',
    prompt: 'One thoughtful question to go beyond small talk.',
    messageTemplate:
      '🔮 Deep question: What is one dream you have not told me about yet — big or small?',
  },
];

const BOOSTS_PATH = join(process.cwd(), 'server', 'data', 'relationship-health-boosts.json');

async function readBoosts(): Promise<CoupleHealthBoost[]> {
  try {
    return JSON.parse(await readFile(BOOSTS_PATH, 'utf-8'));
  } catch {
    return [];
  }
}

async function writeBoosts(list: CoupleHealthBoost[]): Promise<void> {
  await mkdir(join(process.cwd(), 'server', 'data'), { recursive: true });
  await writeFile(BOOSTS_PATH, JSON.stringify(list, null, 2));
}

export async function recordHealthBoost(params: {
  relationshipId: string;
  userId: string;
  activity: CoupleActivityType;
}): Promise<{ boost: CoupleHealthBoost; totalBoostPoints: number }> {
  const list = await readBoosts();
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const recentSame = list.filter(
    (b) =>
      b.relationshipId === params.relationshipId &&
      b.userId === params.userId &&
      b.activity === params.activity &&
      new Date(b.createdAt).getTime() >= dayAgo
  );
  // Allow 2 boosts per activity type per user per day (e.g. multiple quiz rounds)
  if (recentSame.length >= 2) {
    const total = sumBoostPoints(list, params.relationshipId);
    return { boost: recentSame[recentSame.length - 1], totalBoostPoints: total };
  }

  const points = ACTIVITY_POINTS[params.activity];
  if (points == null) {
    const total = sumBoostPoints(list, params.relationshipId);
    throw new Error(`Unknown activity: ${params.activity}`);
  }

  const boost: CoupleHealthBoost = {
    id: Date.now().toString() + Math.random().toString(36).slice(2, 5),
    relationshipId: params.relationshipId,
    userId: params.userId,
    activity: params.activity,
    points,
    label: ACTIVITY_LABELS[params.activity],
    createdAt: new Date().toISOString(),
  };
  list.push(boost);
  // Keep last 500 per relationship
  const trimmed = list.filter((b) => b.relationshipId === params.relationshipId).slice(-500);
  const other = list.filter((b) => b.relationshipId !== params.relationshipId);
  await writeBoosts([...other, ...trimmed]);
  return { boost, totalBoostPoints: sumBoostPoints([...other, ...trimmed], params.relationshipId) };
}

export function sumBoostPoints(boosts: CoupleHealthBoost[], relationshipId: string, days = 7): number {
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  const sum = boosts
    .filter((b) => b.relationshipId === relationshipId && new Date(b.createdAt).getTime() >= since)
    .reduce((s, b) => s + b.points, 0);
  return Math.min(40, sum); // cap activity bonus
}

export async function getRecentBoosts(relationshipId: string, limit = 8): Promise<CoupleHealthBoost[]> {
  const list = await readBoosts();
  return list
    .filter((b) => b.relationshipId === relationshipId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}

export async function getBoostPointsForRelationship(relationshipId: string): Promise<number> {
  const list = await readBoosts();
  return sumBoostPoints(list, relationshipId);
}

const MESSAGE_ACTIVITY_RULES: Array<{ pattern: RegExp; activity: CoupleActivityType }> = [
  { pattern: /🎬 watch together/i, activity: 'watch_together' },
  { pattern: /^quiz:/i, activity: 'quiz' },
  { pattern: /🎮.*tic-tac-toe/i, activity: 'game_xo' },
  { pattern: /💑 blind date idea:/i, activity: 'blind_date' },
  { pattern: /^gratitude:/i, activity: 'gratitude' },
  { pattern: /^three things i appreciate/i, activity: 'appreciation' },
  { pattern: /^favorite memory with you/i, activity: 'memory_share' },
  { pattern: /^dream date i want/i, activity: 'future_dream' },
  { pattern: /walk together/i, activity: 'walk_together' },
  { pattern: /cook the same recipe/i, activity: 'cook_together' },
  { pattern: /voice love note/i, activity: 'voice_love' },
  { pattern: /^🎲 would you rather/i, activity: 'would_you_rather' },
  { pattern: /^⚡ this or that/i, activity: 'this_or_that' },
  { pattern: /^🃏 two truths/i, activity: 'two_truths_lie' },
  { pattern: /^😄 emoji story/i, activity: 'emoji_story' },
  { pattern: /^💬 love language check-in/i, activity: 'love_language' },
  { pattern: /^🎵 this song reminds me/i, activity: 'song_dedication' },
  { pattern: /^🌙 date night plan/i, activity: 'date_night_plan' },
  { pattern: /^💕 compliment duel/i, activity: 'compliment_duel' },
  { pattern: /^📝 couple bucket list/i, activity: 'bucket_list' },
  { pattern: /^🔮 deep question/i, activity: 'deep_question' },
];

export function isValidCoupleActivity(activity: string): activity is CoupleActivityType {
  return activity in ACTIVITY_POINTS;
}

/** Sync boosts from chat messages so health rises when convo gets good again. */
export async function syncBoostsFromMessages(
  relationshipId: string,
  userId: string,
  messages: { content: string; createdAt: Date | string; fromUserId?: string }[]
): Promise<number> {
  const list = await readBoosts();
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentMsgs = messages.filter((m) => new Date(m.createdAt).getTime() >= weekAgo);

  for (const msg of recentMsgs) {
    const from = msg.fromUserId || userId;
    for (const rule of MESSAGE_ACTIVITY_RULES) {
      if (!rule.pattern.test(msg.content)) continue;
      const already = list.some(
        (b) =>
          b.relationshipId === relationshipId &&
          b.activity === rule.activity &&
          b.userId === from &&
          Math.abs(new Date(b.createdAt).getTime() - new Date(msg.createdAt).getTime()) < 60000
      );
      if (!already) {
        list.push({
          id: Date.now().toString() + Math.random().toString(36).slice(2, 5),
          relationshipId,
          userId: from,
          activity: rule.activity,
          points: ACTIVITY_POINTS[rule.activity],
          label: ACTIVITY_LABELS[rule.activity],
          createdAt: new Date(msg.createdAt).toISOString(),
        });
      }
    }
  }

  // Deep convo: 6+ messages in 2 hours with avg length > 40
  const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
  const burst = recentMsgs.filter((m) => new Date(m.createdAt).getTime() >= twoHoursAgo);
  if (burst.length >= 6) {
    const avgLen = burst.reduce((s, m) => s + m.content.length, 0) / burst.length;
    if (avgLen > 40) {
      const hasDeep = list.some(
        (b) => b.relationshipId === relationshipId && b.activity === 'deep_convo' && new Date(b.createdAt).getTime() >= twoHoursAgo
      );
      if (!hasDeep) {
        list.push({
          id: Date.now().toString() + '-deep',
          relationshipId,
          userId,
          activity: 'deep_convo',
          points: ACTIVITY_POINTS.deep_convo,
          label: ACTIVITY_LABELS.deep_convo,
          createdAt: new Date().toISOString(),
        });
      }
    }
  }

  await writeBoosts(list);
  return sumBoostPoints(list, relationshipId);
}
