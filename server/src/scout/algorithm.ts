/** EA FC 3-style scout: experience decides how many names a cycle returns, judgment drops weak profiles. Gender is never an input. */

export function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

/** Years in the profession become a 0–100 experience score. 12 years or more is the cap. */
export function experienceScore(years: number): number {
  const safe = Number.isFinite(years) ? Math.max(0, years) : 0;
  return clampScore(safe * 8);
}

/** Bigger experience, longer shortlist. */
export function listSizeForExperience(experience: number): number {
  const score = clampScore(experience);
  if (score < 21) return 3;
  if (score < 41) return 5;
  if (score < 61) return 8;
  if (score < 81) return 12;
  return 18;
}

/** Higher judgment raises the quality floor and removes low-quality profiles. */
export function qualityFloor(judgment: number): number {
  return clampScore(20 + (clampScore(judgment) / 100) * 50);
}

export function profileQuality(years: number, hasBio: boolean, hasCity: boolean): number {
  const base = Math.min(70, Math.max(0, years) * 6);
  return clampScore(base + (hasBio ? 15 : 0) + (hasCity ? 15 : 0));
}

export interface ScoutCandidate<T> {
  item: T;
  quality: number;
}

/** Cross-gender by design: callers must not pass gender into this filter. */
export function scoutCycle<T>(candidates: ScoutCandidate<T>[], experience: number, judgment: number): T[] {
  const floor = qualityFloor(judgment);
  const size = listSizeForExperience(experience);
  return candidates
    .filter((candidate) => candidate.quality >= floor)
    .sort((a, b) => b.quality - a.quality)
    .slice(0, size)
    .map((candidate) => candidate.item);
}
