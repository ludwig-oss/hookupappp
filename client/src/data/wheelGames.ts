/** 24 dating mini-games: 4 themed sets of 6. Only 6 show on the wheel at a time; remix after every spin. */

export type WheelMechanic =
  | 'blind_date'
  | 'picture_pick'
  | 'compatibility_rush'
  | 'lucky_like'
  | 'speed_pick'
  | 'mystery_message';

export type WheelGame = {
  id: string;
  name: string;
  short: string;
  mechanic: WheelMechanic;
  blurb: string;
};

/** Set A — classic wheel */
const SET_A: WheelGame[] = [
  { id: 'blind_date', name: 'Blind Date', short: 'Blind', mechanic: 'blind_date', blurb: 'Voice icebreakers; faces stay blurred.' },
  { id: 'picture_pick', name: 'Picture Pick', short: 'Pick', mechanic: 'picture_pick', blurb: 'Choose a photo + vibe hint.' },
  { id: 'compatibility_rush', name: 'Compatibility Rush', short: 'Rush', mechanic: 'compatibility_rush', blurb: 'Quick vibe questions.' },
  { id: 'lucky_like', name: 'Lucky Like', short: 'Lucky', mechanic: 'lucky_like', blurb: 'One lucky interest shot.' },
  { id: 'speed_pick', name: 'Speed Pick', short: 'Speed', mechanic: 'speed_pick', blurb: 'Fast yes/no picks.' },
  { id: 'mystery_message', name: 'Mystery Message', short: 'Mystery', mechanic: 'mystery_message', blurb: 'Send a typed mystery line.' },
];

/** Set B — chaotic dating chaos */
const SET_B: WheelGame[] = [
  { id: 'ex_talk_ban', name: 'Ex-Talk Ban', short: 'ExBan', mechanic: 'compatibility_rush', blurb: 'Answer prompts — saying “ex” loses.' },
  { id: 'soft_launch', name: 'Soft Launch Roulette', short: 'Soft', mechanic: 'picture_pick', blurb: 'Pick who you’d soft-launch first.' },
  { id: 'situationship', name: 'Situationship Spin', short: 'Situ', mechanic: 'blind_date', blurb: 'Voice-only: define the vibe live.' },
  { id: 'red_flag_radar', name: 'Red Flag Radar', short: 'Red', mechanic: 'speed_pick', blurb: 'Spot the red flag in seconds.' },
  { id: 'green_flag_gauntlet', name: 'Green Flag Gauntlet', short: 'Green', mechanic: 'lucky_like', blurb: 'Reward the greenest flag.' },
  { id: 'orbit_intercept', name: 'Orbit Intercept', short: 'Orbit', mechanic: 'mystery_message', blurb: 'Intercept someone in your orbit.' },
];

/** Set C — spicy / chaotic fun */
const SET_C: WheelGame[] = [
  { id: 'lovebomb_defuse', name: 'Love-Bomb Defuse', short: 'Defuse', mechanic: 'compatibility_rush', blurb: 'Diffuses over-the-top lines.' },
  { id: 'breadcrumb_chase', name: 'Breadcrumb Chase', short: 'Crumb', mechanic: 'speed_pick', blurb: 'Chase or drop the breadcrumbs.' },
  { id: 'double_text_dare', name: 'Double-Text Dare', short: 'DblTxt', mechanic: 'mystery_message', blurb: 'Type the double-text you’d send.' },
  { id: 'ghost_protocol', name: 'Ghost Protocol', short: 'Ghost', mechanic: 'blind_date', blurb: 'Voice call before anyone ghosts.' },
  { id: 'soft_reject_flip', name: 'Soft-Reject Flip', short: 'Flip', mechanic: 'lucky_like', blurb: 'Turn a soft no into maybe.' },
  { id: 'chem_crash', name: 'Chemistry Crash Test', short: 'Crash', mechanic: 'picture_pick', blurb: 'Crash-test the spark with photos.' },
];

/** Set D — wild date energy */
const SET_D: WheelGame[] = [
  { id: 'first_date_roulette', name: 'First-Date Roulette', short: '1stDate', mechanic: 'blind_date', blurb: 'Voice plan a wild first date.' },
  { id: 'meet_cute_remix', name: 'Meet-Cute Remix', short: 'Cute', mechanic: 'mystery_message', blurb: 'Write your meet-cute opener.' },
  { id: 'pet_name_lottery', name: 'Pet-Name Lottery', short: 'Pet', mechanic: 'compatibility_rush', blurb: 'Survive the pet-name gauntlet.' },
  { id: 'playlist_confess', name: 'Playlist Confession', short: 'Playlist', mechanic: 'picture_pick', blurb: 'Confess via song energy pics.' },
  { id: 'awkward_silence', name: 'Awkward Silence Sprint', short: 'Silence', mechanic: 'speed_pick', blurb: 'Break the silence — fast.' },
  { id: 'forever_never', name: 'Forever-or-Never Vote', short: '4ever', mechanic: 'lucky_like', blurb: 'One vote: forever energy or never.' },
];

export const ALL_WHEEL_GAMES: WheelGame[] = [...SET_A, ...SET_B, ...SET_C, ...SET_D];

const SETS = [SET_A, SET_B, SET_C, SET_D];

const RECENT_KEY = 'highlights:recentWheelGameIds';

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function readRecentWheelIds(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function writeRecentWheelIds(ids: string[]): void {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(ids.slice(-20)));
  } catch {
    /* ignore */
  }
}

/**
 * Pick 6 games for the wheel.
 * Prefers games you haven't seen recently so all 24 rotate through.
 * Mixes sets: never all from one set when avoidable.
 */
export function pickWheelBatch(recentIds: string[] = []): WheelGame[] {
  const recent = new Set(recentIds);
  const fresh = ALL_WHEEL_GAMES.filter((g) => !recent.has(g.id));
  const pool = fresh.length >= 6 ? fresh : ALL_WHEEL_GAMES;

  // Try to pull from different sets for variety
  const bySet = SETS.map((set) => shuffle(set.filter((g) => pool.some((p) => p.id === g.id))));
  const picked: WheelGame[] = [];
  const used = new Set<string>();

  // Round-robin one from each set first
  for (let round = 0; round < 3 && picked.length < 6; round++) {
    for (const set of bySet) {
      if (picked.length >= 6) break;
      const next = set.find((g) => !used.has(g.id));
      if (next) {
        picked.push(next);
        used.add(next.id);
      }
    }
  }

  // Fill remainder from shuffled pool
  for (const g of shuffle(pool)) {
    if (picked.length >= 6) break;
    if (!used.has(g.id)) {
      picked.push(g);
      used.add(g.id);
    }
  }

  return shuffle(picked).slice(0, 6);
}

/** @deprecated use pickWheelBatch — kept for callers that pass bump */
export function getActiveWheelGames(_now = Date.now(), _remixBump = 0): WheelGame[] {
  return pickWheelBatch(readRecentWheelIds());
}

export function getWheelGameById(id: string): WheelGame | undefined {
  return ALL_WHEEL_GAMES.find((g) => g.id === id);
}

export function minutesUntilWheelRotate(_now = Date.now()): number {
  return 0; // remixed after every spin now
}

/** Games not on the wheel right now — for the “also in the pool” peek. */
export function peekRestOfPool(active: WheelGame[], limit = 12): WheelGame[] {
  const ids = new Set(active.map((g) => g.id));
  return ALL_WHEEL_GAMES.filter((g) => !ids.has(g.id)).slice(0, limit);
}
