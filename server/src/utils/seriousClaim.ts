/** Detect reviews that make serious factual/legal accusations (innocent until proven guilty flow). */

const SERIOUS_CLAIM_PATTERNS: RegExp[] = [
  /\b(raped?|rape|sexual\s+assault|molest(ed|ing)?|abused?|abusive)\b/i,
  /\b(assault(ed|ing)?|attacked?|beat\s+(me|him|her)|violent(ly)?)\b/i,
  /\b(stole|stolen|theft|robbed?|scammed?|fraud|catfish)\b/i,
  /\b(drugged?|spiked?\s+my\s+drink|kidnap(ped)?)\b/i,
  /\b(stalk(ed|ing)?|harass(ed|ment)?|threat(en(ed)?)?)\b/i,
  /\b(convicted|arrested|criminal|illegal\s+act)\b/i,
  /\b(cheated\s+on|affair|unfaithful)\b/i,
  /\b(physically\s+hurt|hit\s+me|punched|choked)\b/i,
];

export function detectSeriousClaim(text: string): boolean {
  const t = (text || '').trim();
  if (!t) return false;
  return SERIOUS_CLAIM_PATTERNS.some((re) => re.test(t));
}

export const REVIEW_DISCLAIMER_TEXT =
  'False, misleading, or malicious reviews can lead to account suspension or a permanent ban. Serious accusations are shown as unproven until official court evidence is submitted. If you have a legal case, pursue it through the proper authorities.';
