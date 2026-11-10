/**
 * Age matrix from the product rules. Buckets are exclusive so each rule stays intact
 * where the written ranges touch (22 and 30):
 * - 18–21: girls in the 18–22 group, or women 30–33
 * - 22–29: girls up to 3 years younger, or older women through 33
 * - 30+: women 18–24, or women 40–50
 * A woman sees a man only when his bucket includes her age. That is the mirror.
 */

export type DatingSide = 'male' | 'female';

export interface AgeBand {
  min: number;
  max: number;
}

const BUILDING =
  /\b(still working on myself|working on myself|working on themselves|starting (a|my|the)|youtube|figuring (it|myself|life) out|not ready|side hustle|saving up|just graduated|in school|building my|learning to)\b/i;

export function datingSide(gender?: string | null): DatingSide | null {
  const g = String(gender || '').toLowerCase().trim();
  if (g === 'female' || g === 'woman' || g === 'f' || g.startsWith('fem')) return 'female';
  if (g === 'male' || g === 'man' || g === 'm' || g.startsWith('masc')) return 'male';
  return null;
}

export function boyAgeBands(age: number): AgeBand[] {
  if (age >= 30) return [{ min: 18, max: 24 }, { min: 40, max: 50 }];
  if (age >= 22) {
    return [
      { min: Math.max(18, age - 3), max: age },
      { min: age, max: 33 },
    ];
  }
  if (age >= 18) return [{ min: 18, max: 22 }, { min: 30, max: 33 }];
  return [];
}

export function ageInBands(age: number, bands: AgeBand[]): boolean {
  return bands.some((band) => age >= band.min && age <= band.max);
}

/** True when a man of `boyAge` is allowed to be shown a woman of `girlAge`. */
export function agesAlign(boyAge: number, girlAge: number): boolean {
  if (!Number.isFinite(boyAge) || !Number.isFinite(girlAge)) return false;
  if (boyAge < 18 || girlAge < 18) return false;
  return ageInBands(girlAge, boyAgeBands(boyAge));
}

export function isWorkingOnSelf(input: {
  workingOnSelf?: boolean;
  futurePlans?: string;
  bestQuality?: string;
}): boolean {
  if (input.workingOnSelf) return true;
  return BUILDING.test(`${input.futurePlans || ''} ${input.bestQuality || ''}`);
}

/** Ratings are stored out of 100. 95+ is the 10/10 band. No ratings means not top-tier. */
export function isTopTierAccount(overall: number, attractiveness: number, totalRatings: number): boolean {
  if (totalRatings < 1) return false;
  return overall >= 95 || attractiveness >= 95;
}

/** Rarely rejected: at least 4 rounds and 15% or fewer of them ended in a rejection. */
export function isRarelyRejected(roundsJoined: number, rejectionsReceived: number): boolean {
  if (roundsJoined < 4) return false;
  return rejectionsReceived / roundsJoined <= 0.15;
}

export function pairAllowed(input: {
  boyAge: number;
  girlAge: number;
  boyWorkingOnSelf: boolean;
  girlTopTier: boolean;
  girlRarelyRejected: boolean;
}): boolean {
  if (!agesAlign(input.boyAge, input.girlAge)) return false;
  if (input.boyWorkingOnSelf && (input.girlTopTier || input.girlRarelyRejected)) return false;
  return true;
}
