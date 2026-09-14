/** 24 wheel games: 6 classics + 18 unique chat challenges. One set of 6 on the wheel; advances after every spin. */

export type WheelMechanic =
  | 'blind_date'
  | 'picture_pick'
  | 'compatibility_rush'
  | 'lucky_like'
  | 'speed_pick'
  | 'mystery_message'
  | 'chat_challenge';

export type WheelGame = {
  id: string;
  name: string;
  short: string;
  mechanic: WheelMechanic;
  blurb: string;
};

/** Set A — classic match games (original 6) */
export const SET_A: WheelGame[] = [
  { id: 'blind_date', name: 'Blind Date', short: 'Blind', mechanic: 'blind_date', blurb: 'Voice icebreakers; faces stay blurred.' },
  { id: 'picture_pick', name: 'Picture Pick', short: 'Pick', mechanic: 'picture_pick', blurb: 'Choose a photo + vibe hint.' },
  { id: 'compatibility_rush', name: 'Compatibility Rush', short: 'Rush', mechanic: 'compatibility_rush', blurb: 'Quick vibe questions.' },
  { id: 'lucky_like', name: 'Lucky Like', short: 'Lucky', mechanic: 'lucky_like', blurb: 'One lucky interest shot.' },
  { id: 'speed_pick', name: 'Speed Pick', short: 'Speed', mechanic: 'speed_pick', blurb: 'Fast yes/no picks.' },
  { id: 'mystery_message', name: 'Mystery Message', short: 'Mystery', mechanic: 'mystery_message', blurb: 'Send a typed mystery line.' },
];

/** Set B — chat challenge pack 1 */
export const SET_B: WheelGame[] = [
  { id: 'predictive_text', name: 'Predictive Text Fate', short: 'PredTxt', mechanic: 'chat_challenge', blurb: 'Build replies from predictive word taps — then send.' },
  { id: 'one_word', name: 'One-Word Limit', short: '1Word', mechanic: 'chat_challenge', blurb: 'Exactly one word per reply. Make it count.' },
  { id: 'gif_roulette', name: 'GIF Roulette', short: 'GIF', mechanic: 'chat_challenge', blurb: 'No typing — only the first GIF that pops up.' },
  { id: 'rhyme_crime', name: 'Rhyme Crime', short: 'Rhyme', mechanic: 'chat_challenge', blurb: 'Every reply must rhyme with their last line.' },
  { id: 'job_interviewer', name: 'Job Interviewer', short: 'Hire', mechanic: 'chat_challenge', blurb: 'Treat the chat like a high-stakes hiring interview.' },
  { id: 'cryptic_riddle', name: 'Cryptic Riddle', short: 'Riddle', mechanic: 'chat_challenge', blurb: 'No straight answers — only riddles & deep questions.' },
];

/** Set C — chat challenge pack 2 */
export const SET_C: WheelGame[] = [
  { id: 'reality_villain', name: 'Reality Villain', short: 'Villain', mechanic: 'chat_challenge', blurb: 'Narrate strategy like you’re on The Bachelor.' },
  { id: 'emoji_only', name: 'Emoji Only', short: 'Emoji', mechanic: 'chat_challenge', blurb: 'Banned from words — emoji replies only.' },
  { id: 'hardcore_detective', name: 'Hardcore Detective', short: 'Detect', mechanic: 'chat_challenge', blurb: 'Treat everything they say like a crime clue.' },
  { id: 'letter_ban', name: 'Letter Ban', short: 'Ban', mechanic: 'chat_challenge', blurb: 'Spin bans a letter — don’t use it for 5 messages.' },
  { id: 'no_context_image', name: 'No-Context Image', short: 'NoCtx', mechanic: 'chat_challenge', blurb: 'Snap or pick a real photo. Send it. Refuse to explain it.' },
  { id: 'blind_compliment', name: 'Blind Compliment', short: 'Compliment', mechanic: 'chat_challenge', blurb: 'Compliment something bizarrely specific in their pics.' },
];

/** Set D — chat challenge pack 3 (fills to 24) */
export const SET_D: WheelGame[] = [
  { id: 'caps_lock_chaos', name: 'CAPS LOCK Chaos', short: 'CAPS', mechanic: 'chat_challenge', blurb: 'Every message must be ALL CAPS energy.' },
  { id: 'question_only', name: 'Question Only', short: '???', mechanic: 'chat_challenge', blurb: 'You may only answer with another question.' },
  { id: 'opposite_day', name: 'Opposite Day', short: 'Opp', mechanic: 'chat_challenge', blurb: 'Say the opposite of what you mean — they guess the truth.' },
  { id: 'seven_word_max', name: 'Seven-Word Max', short: '7Max', mechanic: 'chat_challenge', blurb: 'Hard cap: 7 words max per message.' },
  { id: 'soft_roast', name: 'Soft Roast', short: 'Roast', mechanic: 'chat_challenge', blurb: 'Roast them gently, then save it with a compliment.' },
  { id: 'future_ex', name: 'Future-Ex Forecast', short: '4cast', mechanic: 'chat_challenge', blurb: 'Predict your “breakup reason” as a joke — then pitch why you’d still match.' },
];

export const ALL_WHEEL_GAMES: WheelGame[] = [...SET_A, ...SET_B, ...SET_C, ...SET_D];

export const WHEEL_SETS = [SET_A, SET_B, SET_C, SET_D] as const;

export const SET_LABELS = [
  'Classic matches',
  'Chat challenges I',
  'Chat challenges II',
  'Chat challenges III',
] as const;

const SET_INDEX_KEY = 'highlights:wheelSetIndex';

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function readWheelSetIndex(): number {
  try {
    const raw = localStorage.getItem(SET_INDEX_KEY);
    // Default to Chat challenges I so new games show immediately
    if (raw == null) {
      localStorage.setItem(SET_INDEX_KEY, '1');
      return 1;
    }
    const n = Number(raw);
    return Number.isFinite(n) ? ((Math.floor(n) % WHEEL_SETS.length) + WHEEL_SETS.length) % WHEEL_SETS.length : 1;
  } catch {
    return 1;
  }
}

function writeWheelSetIndex(idx: number): void {
  try {
    localStorage.setItem(SET_INDEX_KEY, String(idx % WHEEL_SETS.length));
    localStorage.removeItem('highlights:wheelRemixBump');
    localStorage.removeItem('highlights:recentWheelGameIds');
  } catch {
    /* ignore */
  }
}

/** Force challenge pack after old remix junk / one-time bump to set B. */
export function getCurrentWheelSet(): { games: WheelGame[]; setIndex: number; label: string } {
  try {
    if (localStorage.getItem('highlights:wheelRemixBump') != null || localStorage.getItem('highlights:recentWheelGameIds') != null) {
      writeWheelSetIndex(1);
    }
    // One-shot: migrate anyone stuck on classic-only view into challenges
    if (localStorage.getItem('highlights:challengePackV1') == null) {
      writeWheelSetIndex(1);
      localStorage.setItem('highlights:challengePackV1', '1');
    }
  } catch {
    /* ignore */
  }
  const setIndex = readWheelSetIndex();
  return {
    games: shuffle([...WHEEL_SETS[setIndex]]),
    setIndex,
    label: SET_LABELS[setIndex],
  };
}

export function advanceWheelSet(): { games: WheelGame[]; setIndex: number; label: string } {
  const next = (readWheelSetIndex() + 1) % WHEEL_SETS.length;
  writeWheelSetIndex(next);
  return {
    games: shuffle([...WHEEL_SETS[next]]),
    setIndex: next,
    label: SET_LABELS[next],
  };
}

export function pickWheelBatch(_recentIds: string[] = []): WheelGame[] {
  return getCurrentWheelSet().games;
}

export function getActiveWheelGames(_now = Date.now(), _remixBump = 0): WheelGame[] {
  return getCurrentWheelSet().games;
}

export function getWheelGameById(id: string): WheelGame | undefined {
  return ALL_WHEEL_GAMES.find((g) => g.id === id);
}

export function minutesUntilWheelRotate(_now = Date.now()): number {
  return 0;
}

export function readRecentWheelIds(): string[] {
  return [];
}

export function writeRecentWheelIds(_ids: string[]): void {}

export function peekRestOfPool(active: WheelGame[], limit = 12): WheelGame[] {
  const ids = new Set(active.map((g) => g.id));
  return ALL_WHEEL_GAMES.filter((g) => !ids.has(g.id)).slice(0, limit);
}
