import type { RackPiece, RedCarpetRacks } from '../../api/fashion';

type Look = { title: string; era: 'vintage' | 'modern'; slot: 'top' | 'bottom'; fill: string; family: string; kind: string };

const LOOKS: Look[] = [
  { title: 'Yellow plaid cropped blazer', era: 'vintage', slot: 'top', fill: '#e6b800', family: 'plaid', kind: 'blazer' },
  { title: 'Vintage velvet corset', era: 'vintage', slot: 'top', fill: '#6b1d36', family: 'evening', kind: 'corset' },
  { title: 'Ivory silk blouse', era: 'vintage', slot: 'top', fill: '#f7f1e3', family: 'ivory', kind: 'blouse' },
  { title: 'Black fine knit', era: 'modern', slot: 'top', fill: '#111111', family: 'black', kind: 'knit' },
  { title: '90s plaid mini skirt', era: 'vintage', slot: 'bottom', fill: '#e6b800', family: 'plaid', kind: 'skirt' },
  { title: 'Vintage column skirt', era: 'vintage', slot: 'bottom', fill: '#3d2914', family: 'evening', kind: 'column' },
  { title: 'Metallic silver pleated mini skirt', era: 'modern', slot: 'bottom', fill: '#c5ccd4', family: 'silver', kind: 'pleat' },
  { title: 'Black straight trouser', era: 'modern', slot: 'bottom', fill: '#161616', family: 'black', kind: 'trouser' },
];

function drawing(look: Look): string {
  const plaid = `<pattern id="plaid" width="16" height="16" patternUnits="userSpaceOnUse"><rect width="16" height="16" fill="${look.fill}"/><path d="M0 0H16M0 8H16M0 0V16M8 0V16" stroke="#111" stroke-width="2"/></pattern>`;
  const shapes: Record<string, string> = {
    blazer: `${plaid}<path d="M78 52 L120 28 L162 52 L198 96 L172 110 L154 72 V214 H86 V72 L68 110 L42 96 Z" fill="url(#plaid)" stroke="#111" stroke-width="3"/><path d="M120 28 L102 86 L120 100 L138 86 Z" fill="#111"/><circle cx="120" cy="128" r="3.5" fill="#111"/><circle cx="120" cy="156" r="3.5" fill="#111"/>`,
    corset: `<path d="M92 36 H148 L160 230 H80 Z" fill="${look.fill}" stroke="#111" stroke-width="3"/><path d="M104 40 V226 M120 36 V230 M136 40 V226" stroke="#f3d2dc" stroke-width="2" fill="none"/>`,
    blouse: `<path d="M74 58 L120 34 L166 58 L196 108 L168 118 L150 78 V200 H90 V78 L72 118 L44 108 Z" fill="${look.fill}" stroke="#111" stroke-width="3"/>`,
    knit: `<path d="M78 50 L120 32 L162 50 L190 100 L166 112 L150 70 V214 H90 V70 L74 112 L50 100 Z" fill="${look.fill}" stroke="#111" stroke-width="3"/>`,
    skirt: `${plaid}<path d="M86 24 H154 L196 250 H44 Z" fill="url(#plaid)" stroke="#111" stroke-width="3"/><path d="M100 24 L78 250 M120 24 V250 M140 24 L162 250" stroke="#111" stroke-width="1.6" fill="none"/>`,
    column: `<path d="M96 24 H144 L156 250 H84 Z" fill="${look.fill}" stroke="#111" stroke-width="3"/>`,
    pleat: `<path d="M80 24 H160 L200 250 H40 Z" fill="${look.fill}" stroke="#111" stroke-width="3"/>`,
    trouser: `<path d="M86 20 H154 L166 120 L150 250 H118 L120 120 L102 250 H70 L86 120 Z" fill="${look.fill}" stroke="#111" stroke-width="3"/>`,
  };
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 270">${shapes[look.kind]}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function piece(look: Look, index: number): RackPiece {
  return {
    id: `local-${look.slot}-${index}`,
    slot: look.slot,
    title: look.title,
    imageUrl: drawing(look),
    sourceUrl: '',
    era: look.era,
    family: look.family,
  };
}

export function localStudioRacks(): RedCarpetRacks {
  return {
    tops: LOOKS.filter((look) => look.slot === 'top').map(piece),
    bottoms: LOOKS.filter((look) => look.slot === 'bottom').map(piece),
    dresses: [],
    shoes: [],
    source: 'studio',
    detail: '',
  };
}
