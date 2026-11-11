import https from 'https';
import tls from 'tls';

export type RackSlot = 'top' | 'bottom' | 'dress' | 'shoes';
export type GarmentEra = 'vintage' | 'modern';

export interface RackPiece {
  id: string;
  slot: RackSlot;
  title: string;
  imageUrl: string;
  sourceUrl: string;
  era: GarmentEra;
  family?: string;
}

export interface RedCarpetRacks {
  tops: RackPiece[];
  bottoms: RackPiece[];
  dresses: RackPiece[];
  shoes: RackPiece[];
  source: 'product' | 'studio';
  detail: string;
}

type Recipe = { title: string; era: GarmentEra; slot: 'top' | 'bottom'; fill: string; family: string; kind: string };

/** Iconic award-show shapes, stored as garment descriptions only. Never shown as a credit. */
const RECIPES: Recipe[] = [
  { title: 'Yellow plaid cropped blazer', era: 'vintage', slot: 'top', fill: '#e6b800', family: 'plaid', kind: 'blazer' },
  { title: 'Vintage velvet corset', era: 'vintage', slot: 'top', fill: '#6b1d36', family: 'evening', kind: 'corset' },
  { title: 'Ivory silk blouse', era: 'vintage', slot: 'top', fill: '#f7f1e3', family: 'ivory', kind: 'blouse' },
  { title: 'Modern oversized leather bomber', era: 'modern', slot: 'top', fill: '#1c1c1c', family: 'black', kind: 'bomber' },
  { title: 'Black fine knit', era: 'modern', slot: 'top', fill: '#111111', family: 'black', kind: 'knit' },
  { title: 'White structured shirt', era: 'modern', slot: 'top', fill: '#f4f4f4', family: 'white', kind: 'shirt' },
  { title: '90s plaid mini skirt', era: 'vintage', slot: 'bottom', fill: '#e6b800', family: 'plaid', kind: 'skirt' },
  { title: 'Vintage column skirt', era: 'vintage', slot: 'bottom', fill: '#3d2914', family: 'evening', kind: 'column' },
  { title: 'Metallic silver pleated mini skirt', era: 'modern', slot: 'bottom', fill: '#c5ccd4', family: 'silver', kind: 'pleat' },
  { title: 'Black straight trouser', era: 'modern', slot: 'bottom', fill: '#161616', family: 'black', kind: 'trouser' },
  { title: 'Indigo straight denim', era: 'modern', slot: 'bottom', fill: '#1d3d6e', family: 'denim', kind: 'denim' },
  { title: 'Cream slip skirt', era: 'vintage', slot: 'bottom', fill: '#efe6d6', family: 'ivory', kind: 'slip' },
];

const BLOCKED =
  /pinterest|model|portrait|selfie|\bface\b|celebrity|oscar|gala|grammy|cannes|red carpet|sunglass|sunglasses|wearing|street style|on her|on him|runway look/i;

const imageOkCache = new Map<string, boolean>();
const TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { at: number; racks: RedCarpetRacks }>();

function hash(value: string): string {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) h = (h * 33 + value.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function systemCa(): string[] | undefined {
  return (tls as typeof tls & { getCACertificates?: (scope?: string) => string[] }).getCACertificates?.('system');
}

function imageOk(url: string): Promise<boolean> {
  if (url.startsWith('data:')) return Promise.resolve(true);
  const cached = imageOkCache.get(url);
  if (cached != null) return Promise.resolve(cached);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      imageOkCache.set(url, ok);
      resolve(ok);
    };
    const req = https.get(url, { ca: systemCa(), headers: { Accept: 'image/*' } }, (res) => {
      const ok = (res.statusCode || 0) >= 200 && (res.statusCode || 0) < 300;
      res.resume();
      finish(ok);
    });
    req.on('error', () => finish(false));
    req.setTimeout(8000, () => {
      req.destroy();
      finish(false);
    });
  });
}

/** Flat clothing drawing. No person, no face, no sunglasses. */
function studioGarment(recipe: Recipe): string {
  const plaid = `<pattern id="plaid" width="16" height="16" patternUnits="userSpaceOnUse"><rect width="16" height="16" fill="${recipe.fill}"/><path d="M0 0H16M0 8H16M0 0V16M8 0V16" stroke="#111" stroke-width="2"/><path d="M0 4H16M4 0V16" stroke="#111" stroke-width="1"/></pattern>`;
  const drawings: Record<string, string> = {
    blazer: `${plaid}<path d="M78 52 L120 28 L162 52 L198 96 L172 110 L154 72 V214 H86 V72 L68 110 L42 96 Z" fill="url(#plaid)" stroke="#111" stroke-width="3"/><path d="M120 28 L102 86 L120 100 L138 86 Z" fill="#111"/><circle cx="120" cy="128" r="3.5" fill="#111"/><circle cx="120" cy="156" r="3.5" fill="#111"/>`,
    corset: `<path d="M92 36 H148 L160 230 H80 Z" fill="${recipe.fill}" stroke="#111" stroke-width="3"/><path d="M104 40 V226 M120 36 V230 M136 40 V226" stroke="#f3d2dc" stroke-width="2" fill="none"/>`,
    blouse: `<path d="M74 58 L120 34 L166 58 L196 108 L168 118 L150 78 V200 H90 V78 L72 118 L44 108 Z" fill="${recipe.fill}" stroke="#111" stroke-width="3"/><path d="M104 58 Q120 92 136 58" fill="none" stroke="#111" stroke-width="3"/>`,
    bomber: `<path d="M70 62 L120 36 L170 62 L206 112 L176 128 L156 84 V196 H84 V84 L64 128 L34 112 Z" fill="${recipe.fill}" stroke="#111" stroke-width="3"/><path d="M84 184 H156 V208 H84 Z" fill="#2a2a2a"/><path d="M48 108 H78 V128 H48 Z M162 108 H192 V128 H162 Z" fill="#2a2a2a"/>`,
    knit: `<path d="M78 50 L120 32 L162 50 L190 100 L166 112 L150 70 V214 H90 V70 L74 112 L50 100 Z" fill="${recipe.fill}" stroke="#111" stroke-width="3"/>`,
    shirt: `<path d="M76 54 L120 30 L164 54 L198 104 L170 116 L152 72 V220 H88 V72 L70 116 L42 104 Z" fill="${recipe.fill}" stroke="#111" stroke-width="3"/><path d="M104 54 L120 96 L136 54" fill="#fff" stroke="#111" stroke-width="3"/><circle cx="120" cy="120" r="3" fill="#111"/><circle cx="120" cy="148" r="3" fill="#111"/><circle cx="120" cy="176" r="3" fill="#111"/>`,
    skirt: `${plaid}<path d="M86 24 H154 L196 250 H44 Z" fill="url(#plaid)" stroke="#111" stroke-width="3"/><path d="M100 24 L78 250 M120 24 V250 M140 24 L162 250" stroke="#111" stroke-width="1.6" fill="none"/>`,
    column: `<path d="M96 24 H144 L156 250 H84 Z" fill="${recipe.fill}" stroke="#111" stroke-width="3"/>`,
    pleat: `<path d="M80 24 H160 L200 250 H40 Z" fill="${recipe.fill}" stroke="#111" stroke-width="3"/><path d="M92 24 L70 250 M108 24 L96 250 M120 24 V250 M132 24 L144 250 M148 24 L170 250" stroke="#6d7580" stroke-width="1.4" fill="none"/>`,
    trouser: `<path d="M86 20 H154 L166 120 L150 250 H118 L120 120 L102 250 H70 L86 120 Z" fill="${recipe.fill}" stroke="#111" stroke-width="3"/>`,
    denim: `<path d="M86 20 H154 L168 118 L152 250 H118 L120 118 L100 250 H68 L84 118 Z" fill="${recipe.fill}" stroke="#0c2244" stroke-width="3"/><path d="M92 48 H148" stroke="#d6c07a" stroke-width="4"/>`,
    slip: `<path d="M90 24 H150 L186 250 H54 Z" fill="${recipe.fill}" stroke="#111" stroke-width="3"/>`,
  };
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 270">${drawings[recipe.kind] || drawings.shirt}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function studioPiece(recipe: Recipe, index: number): RackPiece {
  return {
    id: `studio-${recipe.slot}-${index}`,
    slot: recipe.slot,
    title: recipe.title,
    imageUrl: studioGarment(recipe),
    sourceUrl: '',
    era: recipe.era,
    family: recipe.family,
  };
}

function studioRacks(): RedCarpetRacks {
  const tops = RECIPES.filter((r) => r.slot === 'top').map(studioPiece);
  const bottoms = RECIPES.filter((r) => r.slot === 'bottom').map(studioPiece);
  return { tops, bottoms, dresses: [], shoes: [], source: 'studio', detail: '' };
}

type ImageHit = { title?: string; original?: string; thumbnail?: string; link?: string };

function productQuery(name: string): string {
  return `${name} flat lay isolated white background -model -face -portrait -sunglasses -person`;
}

async function searchRecipe(recipe: Recipe, key: string): Promise<RackPiece | null> {
  const url = new URL('https://serpapi.com/search.json');
  url.searchParams.set('engine', 'google_images');
  url.searchParams.set('q', productQuery(recipe.title));
  url.searchParams.set('ijn', '0');
  url.searchParams.set('safe', 'active');
  url.searchParams.set('api_key', key);
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return null;
  const data = (await res.json()) as { images_results?: ImageHit[] };
  for (const row of data.images_results || []) {
    const imageUrl = String(row.original || '').trim();
    const title = String(row.title || '');
    const hay = `${title} ${row.link || ''} ${imageUrl}`;
    if (!imageUrl.startsWith('https://')) continue;
    if (BLOCKED.test(hay)) continue;
    if (!(await imageOk(imageUrl))) continue;
    return {
      id: `flat-${recipe.slot}-${hash(imageUrl)}`,
      slot: recipe.slot,
      title: recipe.title,
      imageUrl,
      sourceUrl: '',
      era: recipe.era,
      family: recipe.family,
    };
  }
  return null;
}

export async function fetchRedCarpetRacks(prompt: string): Promise<RedCarpetRacks> {
  const key = process.env.SERPAPI_API_KEY?.trim() || process.env.SERPAPI_KEY?.trim() || '';
  const cacheKey = `${key ? 'flat' : 'studio'}:${prompt.trim().toLowerCase()}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.racks;

  const studio = studioRacks();
  if (!key) {
    cache.set(cacheKey, { at: Date.now(), racks: studio });
    return studio;
  }

  const found = await Promise.all(RECIPES.map((recipe) => searchRecipe(recipe, key).catch(() => null)));
  const live = found.filter((piece): piece is RackPiece => Boolean(piece));
  const tops = live.filter((p) => p.slot === 'top');
  const bottoms = live.filter((p) => p.slot === 'bottom');
  const racks: RedCarpetRacks = {
    tops: tops.length ? tops : studio.tops,
    bottoms: bottoms.length ? bottoms : studio.bottoms,
    dresses: [],
    shoes: [],
    source: live.length ? 'product' : 'studio',
    detail: '',
  };
  cache.set(cacheKey, { at: Date.now(), racks });
  return racks;
}
