/**
 * Evaluation matrix: skin type + 5 blemish scores + structural/skin faults
 * mapped onto the 50-habit library.
 *
 * Scores are 0–1 from region stats. This is a grooming heuristic, not a diagnosis.
 */

import {
  BLEMISH_CLASSES,
  FAULT_LIBRARY,
  SKIN_TYPES,
  habitsForFaults,
  type BlemishClass,
  type FaultId,
  type SkinType,
  type WellnessHabit,
} from '../data/appearanceCatalog.js';
import type { AngleVerdict, FaceRegionStats } from './appearanceScan.js';

export interface BlemishScore {
  id: BlemishClass;
  score: number;
  present: boolean;
}

export interface FaultHit {
  id: FaultId;
  label: string;
  family: 'structure' | 'skin' | 'frame';
  score: number;
  evidence: string;
}

export interface AppearanceAnalysis {
  skinType: SkinType;
  skinConfidence: number;
  blemishes: BlemishScore[];
  faults: FaultHit[];
  plan: WellnessHabit[];
  summary: string;
}

function avg(nums: number[]): number {
  const ok = nums.filter((n) => Number.isFinite(n));
  if (!ok.length) return 0;
  return ok.reduce((a, b) => a + b, 0) / ok.length;
}

function pickSkin(front: FaceRegionStats | null, profiles: FaceRegionStats[]): { type: SkinType; confidence: number } {
  const shine = front?.tzoneShine ?? front?.shine ?? 0;
  const cheek = front?.cheekLuma ?? 0;
  const red = avg([front?.redBias || 0, ...profiles.map((p) => p.redBias)]);
  const contrast = front?.contrast ?? 0;
  if (red > 0.18 && shine < 0.55) return { type: 'sensitive', confidence: 0.62 + Math.min(0.25, red) };
  if (shine > 0.48 && cheek > 0 && cheek < 95) return { type: 'combination', confidence: 0.7 };
  if (shine > 0.58) return { type: 'oily', confidence: 0.68 };
  if (shine < 0.28 && contrast < 28) return { type: 'dry', confidence: 0.64 };
  return { type: 'combination', confidence: 0.55 };
}

function blemishScores(front: FaceRegionStats | null): BlemishScore[] {
  const red = front?.redBias ?? 0;
  const shine = front?.shine ?? 0;
  const under = front?.underEyeDelta ?? 0;
  const contrast = front?.contrast ?? 20;
  const raw: Record<BlemishClass, number> = {
    'inflammatory-acne': Math.min(1, red * 2.4),
    comedonal: Math.min(1, shine * 1.3 + (contrast > 40 ? 0.15 : 0)),
    'post-inflammatory-marks': Math.min(1, red * 1.1 + (contrast > 32 ? 0.2 : 0)),
    'rosacea-redness': Math.min(1, red * 2.1),
    'periorbital-darkness': Math.min(1, Math.max(0, under) * 2.2),
  };
  return BLEMISH_CLASSES.map((id) => ({
    id,
    score: Math.round(raw[id] * 100) / 100,
    present: raw[id] >= 0.28,
  }));
}

function faultHits(
  front: FaceRegionStats | null,
  left: FaceRegionStats | null,
  right: FaceRegionStats | null,
  skin: SkinType,
  blemishes: BlemishScore[]
): FaultHit[] {
  const profileOcc = avg([left?.occupancy || 0, right?.occupancy || 0]);
  const profileLuma = avg([left?.meanLuma || 0, right?.meanLuma || 0]);
  const byId = Object.fromEntries(blemishes.map((b) => [b.id, b.score])) as Record<BlemishClass, number>;
  const candidates: Omit<FaultHit, 'label' | 'family'>[] = [
    {
      id: 'submental-fullness',
      score: Math.min(1, 0.35 + (1 - (left?.occupancy || 0.4)) * 0.4 + (profileLuma < 90 ? 0.15 : 0)),
      evidence: 'Profile occupancy and under-chin shadow.',
    },
    {
      id: 'low-gonial-definition',
      score: Math.min(1, 0.3 + (1 - profileOcc) * 0.5),
      evidence: 'Jaw corner is soft in both profiles.',
    },
    {
      id: 'forward-head',
      score: Math.min(1, Math.abs(left?.leftRightBalance || 0) * 1.4 + Math.abs(right?.leftRightBalance || 0) * 1.4),
      evidence: 'Head sits ahead of the shoulder line in profile.',
    },
    {
      id: 'tzone-oil',
      score: skin === 'oily' || skin === 'combination' ? Math.min(1, (front?.tzoneShine || 0) * 1.4) : front?.tzoneShine || 0,
      evidence: 'T-zone highlight clip.',
    },
    {
      id: 'cheek-dryness',
      score: skin === 'dry' ? 0.7 : Math.min(1, (front?.cheekLuma || 120) < 70 ? 0.55 : 0.15),
      evidence: 'Cheek luminance vs T-zone.',
    },
    {
      id: 'barrier-reactivity',
      score: skin === 'sensitive' ? 0.72 : byId['rosacea-redness'] * 0.8,
      evidence: 'Red bias across the midface.',
    },
    { id: 'inflammatory-acne', score: byId['inflammatory-acne'], evidence: 'Raised red spots in frontal light.' },
    { id: 'comedonal', score: byId.comedonal, evidence: 'Texture and shine on nose and chin.' },
    { id: 'post-inflammatory-marks', score: byId['post-inflammatory-marks'], evidence: 'Flat leftover contrast.' },
    { id: 'rosacea-redness', score: byId['rosacea-redness'], evidence: 'Diffuse warmth on cheeks.' },
    { id: 'periorbital-darkness', score: byId['periorbital-darkness'], evidence: 'Under-eye darker than cheek.' },
    {
      id: 'sparse-brow',
      score: Math.min(1, 0.25 + ((front?.contrast || 20) < 18 ? 0.3 : 0)),
      evidence: 'Low contrast at the brow line.',
    },
    {
      id: 'heavy-lid-frame',
      score: Math.min(1, (front?.underEyeDelta || 0) * 1.1 + ((front?.contrast || 20) < 16 ? 0.25 : 0)),
      evidence: 'Eye socket contrast.',
    },
    {
      id: 'dull-complexion',
      score: Math.min(1, (front?.contrast || 20) < 18 ? 0.65 : 0.2),
      evidence: 'Flat global contrast.',
    },
  ];
  return candidates
    .map((c) => {
      const def = FAULT_LIBRARY.find((f) => f.id === c.id)!;
      return {
        ...c,
        score: Math.round(Math.min(1, Math.max(0, c.score)) * 100) / 100,
        label: def.label,
        family: def.family,
      };
    })
    .filter((f) => f.score >= 0.28)
    .sort((a, b) => b.score - a.score);
}

export function analyzeAppearance(angles: {
  frontal: AngleVerdict;
  leftProfile: AngleVerdict;
  rightProfile: AngleVerdict;
}): AppearanceAnalysis {
  const front = angles.frontal.metrics;
  const left = angles.leftProfile.metrics;
  const right = angles.rightProfile.metrics;
  const skin = pickSkin(front, [left, right].filter(Boolean) as FaceRegionStats[]);
  const blemishes = blemishScores(front);
  const faults = faultHits(front, left, right, skin.type, blemishes);
  const plan = habitsForFaults(faults.map((f) => f.id));
  const top = faults.slice(0, 3).map((f) => f.label.toLowerCase());
  const summary = top.length
    ? `Skin reads ${skin.type}. Lead faults: ${top.join(', ')}. Fifty habits are ranked for those faults — debloat, tongue posture, skin, and eye/brow frame. This is a simulation plan, not a diagnosis.`
    : `Skin reads ${skin.type}. No strong faults. Keep the full 50-step maintenance plan.`;
  return {
    skinType: skin.type,
    skinConfidence: Math.round(skin.confidence * 100) / 100,
    blemishes,
    faults,
    plan,
    summary,
  };
}

export function assertSkinTaxonomy(): void {
  if (SKIN_TYPES.length !== 4) throw new Error('Need 4 skin types');
  if (BLEMISH_CLASSES.length !== 5) throw new Error('Need 5 blemish classes');
}
