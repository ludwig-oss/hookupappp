import type { FashionEvent, FashionFormality, FashionGenderFit } from '../data/fashionCatalog.js';

export interface FashionIntent {
  event: FashionEvent;
  formality: FashionFormality;
  colors: string[];
  vibe: string;
  genderFit: FashionGenderFit;
  raw: string;
}

const EVENT_CUES: { event: FashionEvent; re: RegExp }[] = [
  { event: 'club', re: /\b(club|nightlife|bar crawl|concert|dj|dancing)\b/ },
  { event: 'wedding', re: /\b(wedding|guest|ceremony|reception)\b/ },
  { event: 'interview', re: /\b(interview|office|work|job|meeting|presentation)\b/ },
  { event: 'beach', re: /\b(beach|pool|swim|seaside|vacation)\b/ },
  { event: 'walk', re: /\b(walk|hike|park|stroll|connections walk)\b/ },
  { event: 'brunch', re: /\b(brunch|daytime|coffee date|lunch)\b/ },
  { event: 'dinner', re: /\b(dinner|restaurant|evening date|date night)\b/ },
  { event: 'first-date', re: /\b(first date|first-date|meet them|seeing them)\b/ },
  { event: 'casual', re: /\b(casual|hang|chill|errands|everyday)\b/ },
];

const COLOR_WORDS = [
  'black',
  'white',
  'navy',
  'blue',
  'red',
  'burgundy',
  'green',
  'olive',
  'cream',
  'beige',
  'brown',
  'gold',
  'silver',
  'grey',
  'gray',
  'pink',
  'purple',
];

export function parseFashionIntent(raw: string, gender?: string): FashionIntent {
  const q = (raw || '').toLowerCase();
  const hit = EVENT_CUES.find((c) => c.re.test(q));
  const event = hit?.event || (/\bdate\b/.test(q) ? 'first-date' : 'casual');
  const formality: FashionFormality =
    /\b(formal|black tie|interview|wedding|suit)\b/.test(q)
      ? 'high'
      : /\b(club|casual|beach|walk|sneaker)\b/.test(q)
        ? 'low'
        : event === 'interview' || event === 'wedding'
          ? 'high'
          : event === 'club' || event === 'beach' || event === 'walk' || event === 'casual'
            ? 'low'
            : 'mid';
  const colors = COLOR_WORDS.filter((c) => q.includes(c));
  const g = (gender || '').toLowerCase();
  const genderFit: FashionGenderFit = g === 'male' ? 'masc' : g === 'female' ? 'fem' : 'any';
  let vibe = 'balanced';
  if (/\b(sexy|hot|tight)\b/.test(q)) vibe = 'sharp';
  else if (/\b(comfy|comfortable|easy|chill)\b/.test(q)) vibe = 'easy';
  else if (/\b(classy|elegant|polished)\b/.test(q)) vibe = 'polished';
  return { event, formality, colors, vibe, genderFit, raw: raw.trim() };
}
