import https from 'https';
import tls from 'tls';
import { FASHION_CATALOG } from '../data/fashionCatalog.js';

export type RackSlot = 'top' | 'bottom' | 'dress' | 'shoes';

export interface RackPiece {
  id: string;
  slot: RackSlot;
  title: string;
  imageUrl: string;
  sourceUrl: string;
}

export interface RedCarpetRacks {
  tops: RackPiece[];
  bottoms: RackPiece[];
  dresses: RackPiece[];
  shoes: RackPiece[];
  source: 'pinterest' | 'catalog';
  detail: string;
}

const QUERIES: Record<RackSlot, string> = {
  top: 'celebrity red carpet blazer jacket met gala oscars grammys fashion week',
  bottom: 'celebrity red carpet skirt trousers pants cannes grammys award show',
  dress: 'celebrity met gala oscars cannes grammys red carpet gown full look',
  shoes: 'celebrity red carpet heels shoes oscars cannes award show',
};

const imageOkCache = new Map<string, boolean>();

function imageOk(url: string): Promise<boolean> {
  const cached = imageOkCache.get(url);
  if (cached != null) return Promise.resolve(cached);
  const ca = (tls as typeof tls & { getCACertificates?: (scope?: string) => string[] }).getCACertificates?.('system');
  return new Promise((resolve) => {
    const req = https.get(url, { ca, headers: { Accept: 'image/*' } }, (res) => {
      const ok = (res.statusCode || 0) >= 200 && (res.statusCode || 0) < 300;
      res.resume();
      imageOkCache.set(url, ok);
      resolve(ok);
    });
    req.on('error', () => {
      imageOkCache.set(url, false);
      resolve(false);
    });
    req.setTimeout(8000, () => req.destroy());
  });
}

async function keepLive(list: RackPiece[]): Promise<RackPiece[]> {
  const flags = await Promise.all(list.map((piece) => imageOk(piece.imageUrl)));
  return list.filter((_, index) => flags[index]);
}
const TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { at: number; racks: RedCarpetRacks }>();

function hash(value: string): string {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) h = (h * 33 + value.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function slotOfPiece(name: string): RackSlot | null {
  if (/shoe|sneaker|heel|boot|flat|derby|loafer|sandal/i.test(name)) return 'shoes';
  if (/gown|dress|sundress|\bslip\b|\bmidi\b/i.test(name) && !/trouser|pant|jean|skirt/i.test(name)) return 'dress';
  if (/skirt|pant|trouser|jean|denim|short|\bbottom\b/i.test(name)) return 'bottom';
  if (/blazer|jacket|knit|shirt|tee|top|cami|oxford|overshirt|coat|hoodie/i.test(name)) return 'top';
  return null;
}

function cleanTitle(title: string, slot: RackSlot): string {
  const cleaned = title
    .replace(/\s*[|\-–—]\s*pinterest\b.*$/i, '')
    .replace(/pinterest/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  const clipped = cleaned.slice(0, 80);
  if (clipped.length >= 3) return clipped;
  if (slot === 'dress') return 'Red carpet gown';
  if (slot === 'shoes') return 'Red carpet shoes';
  if (slot === 'bottom') return 'Red carpet bottom';
  return 'Red carpet jacket';
}

function catalogRacks(): RedCarpetRacks {
  const buckets: Record<RackSlot, RackPiece[]> = { top: [], bottom: [], dress: [], shoes: [] };
  for (const look of FASHION_CATALOG) {
    look.pieces.forEach((piece, index) => {
      const slot = slotOfPiece(piece);
      if (!slot || buckets[slot].length >= 8) return;
      buckets[slot].push({
        id: `${look.id}-${index}`,
        slot,
        title: piece,
        imageUrl: look.imageUrl,
        sourceUrl: '',
      });
    });
  }
  return {
    tops: buckets.top,
    bottoms: buckets.bottom,
    dresses: buckets.dress,
    shoes: buckets.shoes,
    source: 'catalog',
    detail: 'Add SERPAPI_API_KEY to pull live Met Gala, Oscars, Grammys, and Cannes looks from Pinterest.',
  };
}

type ImageHit = {
  title?: string;
  original?: string;
  thumbnail?: string;
  link?: string;
  source?: string;
};

async function searchSlot(slot: RackSlot, prompt: string, key: string): Promise<RackPiece[]> {
  const q = `site:pinterest.com ${QUERIES[slot]} ${prompt}`.replace(/\s+/g, ' ').trim().slice(0, 200);
  const url = new URL('https://serpapi.com/search.json');
  url.searchParams.set('engine', 'google_images');
  url.searchParams.set('q', q);
  url.searchParams.set('ijn', '0');
  url.searchParams.set('safe', 'active');
  url.searchParams.set('api_key', key);
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return [];
  const data = (await res.json()) as { images_results?: ImageHit[] };
  const out: RackPiece[] = [];
  const seen = new Set<string>();
  for (const row of data.images_results || []) {
    const imageUrl = String(row.original || row.thumbnail || '').trim();
    if (!imageUrl.startsWith('https://') || seen.has(imageUrl)) continue;
    const hay = `${row.link || ''} ${imageUrl} ${row.source || ''}`;
    if (!/pinterest\.|pinimg\.com/i.test(hay)) continue;
    seen.add(imageUrl);
    out.push({
      id: `pin-${slot}-${hash(imageUrl)}`,
      slot,
      title: cleanTitle(String(row.title || ''), slot),
      imageUrl,
      sourceUrl: String(row.link || ''),
    });
    if (out.length >= 8) break;
  }
  return out;
}

export async function fetchRedCarpetRacks(prompt: string): Promise<RedCarpetRacks> {
  const key = process.env.SERPAPI_API_KEY?.trim() || process.env.SERPAPI_KEY?.trim() || '';
  const cacheKey = `${key ? 'live' : 'catalog'}:${prompt.trim().toLowerCase()}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.racks;

  const fallback = catalogRacks();
  if (!key) {
    const racks: RedCarpetRacks = {
      ...fallback,
      tops: await keepLive(fallback.tops),
      bottoms: await keepLive(fallback.bottoms),
      dresses: await keepLive(fallback.dresses),
      shoes: await keepLive(fallback.shoes),
    };
    cache.set(cacheKey, { at: Date.now(), racks });
    return racks;
  }

  const slots: RackSlot[] = ['top', 'bottom', 'dress', 'shoes'];
  const found = await Promise.all(
    slots.map((slot) => searchSlot(slot, prompt, key).catch(() => [] as RackPiece[]))
  );
  const [tops, bottoms, dresses, shoes] = found;
  const live = tops.length + bottoms.length + dresses.length + shoes.length > 0;
  const racks: RedCarpetRacks = {
    tops: await keepLive(tops.length ? tops : fallback.tops),
    bottoms: await keepLive(bottoms.length ? bottoms : fallback.bottoms),
    dresses: await keepLive(dresses.length ? dresses : fallback.dresses),
    shoes: await keepLive(shoes.length ? shoes : fallback.shoes),
    source: live ? 'pinterest' : 'catalog',
    detail: live
      ? 'Labels match the Pinterest image titles from red carpets and award shows.'
      : fallback.detail,
  };
  cache.set(cacheKey, { at: Date.now(), racks });
  return racks;
}
