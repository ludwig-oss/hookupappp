/** 24 dating mini-games: 4 themed sets of 6. Only 6 show on the wheel at a time; sets mix over time. */

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

/** Rotate ~every 5 minutes so the other games show up without waiting forever. */
const ROTATE_MS = 5 * 60 * 1000;

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleWith<T>(arr: T[], rand: () => number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Returns exactly 6 games for the current window.
 * Usually 4 from the active set + 2 from other sets (so classics mix into wild sets and vice versa).
 * @param remixBump — add 1 each time the user taps “Remix” to force the next set mix immediately.
 */
export function getActiveWheelGames(now = Date.now(), remixBump = 0): WheelGame[] {
  const slot = Math.floor(now / ROTATE_MS) + Math.max(0, remixBump);
  const rand = mulberry32(slot * 9973 + 42);
  const primaryIdx = slot % SETS.length;
  const primary = SETS[primaryIdx];
  const others = SETS.filter((_, i) => i !== primaryIdx).flat();

  const fromPrimary = shuffleWith(primary, rand).slice(0, 4);
  const fromOthers = shuffleWith(others, rand).slice(0, 2);
  const mixed = shuffleWith([...fromPrimary, ...fromOthers], rand);

  while (mixed.length < 6) {
    const extra = ALL_WHEEL_GAMES[mixed.length % ALL_WHEEL_GAMES.length];
    if (!mixed.find((g) => g.id === extra.id)) mixed.push(extra);
    else break;
  }
  return mixed.slice(0, 6);
}

export function getWheelGameById(id: string): WheelGame | undefined {
  return ALL_WHEEL_GAMES.find((g) => g.id === id);
}

export function minutesUntilWheelRotate(now = Date.now()): number {
  const next = (Math.floor(now / ROTATE_MS) + 1) * ROTATE_MS;
  return Math.max(1, Math.ceil((next - now) / 60000));
}

/** Games not on the wheel right now — for the “also in the pool” peek. */
export function peekRestOfPool(active: WheelGame[], limit = 8): WheelGame[] {
  const ids = new Set(active.map((g) => g.id));
  return ALL_WHEEL_GAMES.filter((g) => !ids.has(g.id)).slice(0, limit);
}
