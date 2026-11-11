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
}

export interface RedCarpetRacks {
  tops: RackPiece[];
  bottoms: RackPiece[];
  dresses: RackPiece[];
  shoes: RackPiece[];
  source: 'product' | 'studio';
  detail: string;
}

type Recipe = { title: string; era: GarmentEra; slot: 'top' | 'bottom'; fill: string };

/** Iconic award-show shapes, stored as garment descriptions only. Never shown as a credit. */
const RECIPES: Recipe[] = [
  { title: 'Yellow plaid cropped blazer', era: 'vintage', slot: 'top', fill: '#f2c14e' },
  { title: 'Vintage velvet corset', era: 'vintage', slot: 'top', fill: '#6b1d36' },
  { title: 'Ivory silk blouse', era: 'vintage', slot: 'top', fill: '#f7f1e3' },
  { title: 'Modern oversized leather bomber', era: 'modern', slot: 'top', fill: '#1c1c1c' },
  { title: 'Black fine knit', era: 'modern', slot: 'top', fill: '#111111' },
  { title: 'White structured shirt', era: 'modern', slot: 'top', fill: '#f4f4f4' },
  { title: '90s plaid mini skirt', era: 'vintage', slot: 'bottom', fill: '#e2b93b' },
  { title: 'Vintage column skirt', era: 'vintage', slot: 'bottom', fill: '#3d2914' },
  { title: 'Metallic silver pleated mini skirt', era: 'modern', slot: 'bottom', fill: '#c0c6ce' },
  { title: 'Black straight trouser', era: 'modern', slot: 'bottom', fill: '#161616' },
  { title: 'Indigo straight denim', era: 'modern', slot: 'bottom', fill: '#1d3d6e' },
  { title: 'Cream slip skirt', era: 'vintage', slot: 'bottom', fill: '#efe6d6' },
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
  const top =
    recipe.slot === 'top'
      ? `<path d="M78 46 L100 30 L122 46 L146 78 L128 86 L116 62 V156 H84 V62 L72 86 L54 78 Z" fill="${recipe.fill}" stroke="#111" stroke-width="4"/>`
      : `<path d="M78 28 H122 L146 196 H54 Z" fill="${recipe.fill}" stroke="#111" stroke-width="4"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 220">${top}</svg>`;
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
