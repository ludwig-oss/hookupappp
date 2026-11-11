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
  buyUrl?: string;
  store?: string;
  price?: string;
}

export interface RedCarpetRacks {
  tops: RackPiece[];
  bottoms: RackPiece[];
  dresses: RackPiece[];
  shoes: RackPiece[];
  source: 'product' | 'studio';
  detail: string;
  supply: number;
}

type Recipe = { title: string; era: GarmentEra; slot: 'top' | 'bottom' | 'shoes'; fill: string; family: string; kind: string };

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
  { title: 'Yellow plaid heel', era: 'vintage', slot: 'shoes', fill: '#e6b800', family: 'plaid', kind: 'heel' },
  { title: 'Black leather heel', era: 'modern', slot: 'shoes', fill: '#111111', family: 'black', kind: 'heel' },
  { title: 'Ivory satin heel', era: 'vintage', slot: 'shoes', fill: '#f4efe6', family: 'ivory', kind: 'heel' },
  { title: 'Silver strappy sandal', era: 'modern', slot: 'shoes', fill: '#c5ccd4', family: 'silver', kind: 'sandal' },
  { title: 'Black ankle boot', era: 'modern', slot: 'shoes', fill: '#1a1a1a', family: 'evening', kind: 'boot' },
  { title: 'White leather sneaker', era: 'modern', slot: 'shoes', fill: '#f7f7f7', family: 'white', kind: 'sneaker' },
  { title: 'Indigo court shoe', era: 'modern', slot: 'shoes', fill: '#1d3d6e', family: 'denim', kind: 'court' },
];

const BLOCKED =
  /model|portrait|selfie|\bface\b|celebrity|oscar|gala|grammy|cannes|red carpet|sunglass|sunglasses|wearing|street style|on her|on him|runway look|nude|nudis|hentai|porn|nsfw|onlyfans|\bxxx\b|erotic|wallpaper|freepik|dreamstime|vecteezy|shutterstock|getty|alamy|istock/i;

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

function storeHost(link: string): string {
  try {
    return new URL(link).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

type ShopHit = { link?: string; product_link?: string; source?: string; price?: string };

async function shopFor(name: string, key: string): Promise<{ buyUrl: string; store: string; price: string } | null> {
  const url = new URL('https://serpapi.com/search.json');
  url.searchParams.set('engine', 'google_shopping');
  url.searchParams.set('q', name);
  url.searchParams.set('api_key', key);
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return null;
  const data = (await res.json()) as { shopping_results?: ShopHit[] };
  const row = (data.shopping_results || []).find((item) => String(item.product_link || item.link || '').startsWith('https://'));
  if (!row) return null;
  const buyUrl = String(row.product_link || row.link || '').trim();
  return { buyUrl, store: String(row.source || storeHost(buyUrl)), price: String(row.price || '') };
}

type ImageHit = { title?: string; original?: string; thumbnail?: string; link?: string };

function productQuery(recipe: Recipe): string {
  const framed = recipe.slot === 'shoes'
    ? ' pair side by side -feet -foot -sole -outsole -holding -single'
    : ' front collar -"full body" -back -rear -model';
  return `${recipe.title} front flat lay isolated white background -person -portrait${framed}`;
}

async function searchRecipe(recipe: Recipe, key: string): Promise<RackPiece | null> {
  const url = new URL('https://serpapi.com/search.json');
  url.searchParams.set('engine', 'google_images');
  url.searchParams.set('q', productQuery(recipe));
  url.searchParams.set('ijn', '0');
  url.searchParams.set('safe', 'active');
  url.searchParams.set('api_key', key);
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return null;
  const data = (await res.json()) as { images_results?: ImageHit[] };
  const shop = await shopFor(recipe.title, key).catch(() => null);
  for (const row of data.images_results || []) {
    const imageUrl = String(row.original || '').trim();
    const title = String(row.title || '');
    const hay = `${title} ${row.link || ''} ${imageUrl}`;
    if (!imageUrl.startsWith('https://')) continue;
    if (BLOCKED.test(hay) || badShot(hay, recipe.slot)) continue;
    if (recipe.slot === 'shoes' && /\b(feet|foot|legs|toes|wearing|sole|holding)\b/i.test(hay)) continue;
    if (!(await imageOk(imageUrl))) continue;
    const page = String(row.link || '').startsWith('https://') ? String(row.link) : '';
    return {
      id: `flat-${recipe.slot}-${hash(imageUrl)}`,
      slot: recipe.slot,
      title: recipe.title,
      imageUrl,
      sourceUrl: page,
      era: recipe.era,
      family: recipe.family,
      buyUrl: shop?.buyUrl || page || `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(recipe.title)}`,
      store: shop?.store || storeHost(page),
      price: shop?.price || '',
    };
  }
  return null;
}

function readText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        ca: systemCa(),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          Accept: 'text/html',
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      }
    );
    req.on('error', reject);
    req.setTimeout(12000, () => {
      req.destroy();
      reject(new Error('timeout'));
    });
  });
}

type WebHit = { imageUrl: string; title: string; page: string };

function dayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

async function webImages(query: string, first = 1): Promise<WebHit[]> {
  const url = `https://www.bing.com/images/async?q=${encodeURIComponent(query)}&first=${first}&count=35&adlt=strict`;
  const body = await readText(url);
  const decoded = body.replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  const hits: WebHit[] = [];
  const re = /"purl":"(https:[^"]+)"[\s\S]{0,2000}?"murl":"(https:[^"]+)"[\s\S]{0,600}?"t":"([^"]*)"/g;
  for (const match of decoded.matchAll(re)) {
    hits.push({
      page: match[1],
      imageUrl: match[2],
      title: match[3].replace(/[\uE000-\uE002]/g, ''),
    });
  }
  return hits;
}

function shopScore(page: string): number {
  if (/\/products?\/|\/shop\/|cdn\/shop|\/dp\//i.test(page)) return 2;
  if (/pinterest\.|pinimg\./i.test(page)) return 1;
  return 0;
}

export type ShopAudience = 'men' | 'women';

const WOMEN_WORD = /\b(women|woman|womens|womenswear|female|ladies|lady|girls?|feminine|skirt|dress|heels?|stiletto|corset|ballet|frock|blouse|bodysuit|camisole|bralette|crop top)\b|\/(?:women|womens|girls|female)(?:\/|-|_)/i;
const MEN_WORD = /\b(men|mens|men's|male|for men)\b/i;

export function shopAudience(gender: string | null | undefined): ShopAudience | null {
  const g = String(gender || '').toLowerCase().trim();
  if (g === 'female' || g === 'woman' || g === 'f' || g.startsWith('fem')) return 'women';
  if (g === 'male' || g === 'man' || g === 'm' || g.startsWith('masc')) return 'men';
  return null;
}

const COLORS = [
  'black', 'white', 'navy', 'grey', 'charcoal', 'brown', 'beige', 'camel', 'tan', 'olive',
  'burgundy', 'red', 'blue', 'green', 'pink', 'yellow', 'purple', 'orange', 'cream', 'khaki',
  'rust', 'teal', 'maroon', 'ivory', 'sand', 'indigo', 'slate', 'wine', 'cobalt', 'forest',
  'chocolate', 'stone', 'ink', 'pearl', 'copper', 'sage',
];
const ANGLES = ['front view', 'studio front', 'ghost mannequin front', 'flat lay front', 'product front on white'];
const DEPTHS = 160;
const TOP_KINDS = [
  'Nike hoodie', 'Adidas track jacket', 'Balenciaga hoodie',
  'streetwear graphic tee', 'oversized hoodie', 'varsity jacket',
  'denim trucker jacket', 'bomber jacket', 'jeweled leather vest',
  'spiked leather jacket', 'studded biker jacket', 'tracksuit jacket',
];
const BOTTOM_KINDS = [
  'Nike tech fleece pants', 'Adidas track pants', 'Balenciaga cargo pants',
  'baggy jeans', 'straight jeans', 'cargo pants', 'ripped jeans',
  'denim shorts', 'tracksuit pants', 'pyjama pants',
];
const SHOE_KINDS = [
  'Nike Air Force 1', 'Nike Dunk', 'Adidas Samba', 'Adidas Gazelle',
  'Balenciaga Track sneaker', 'Balenciaga Triple S', 'Jordan 1',
  'Nike sneakers', 'Adidas sneakers', 'studded leather boots',
];
const OVERALL_KINDS = ['studded overalls', 'ripped dungarees', 'painted jumpsuit', 'distressed coveralls'];
const DRESS_KINDS = ['painted slip dress', 'shredded knit dress', 'patched mini dress', 'deconstructed shirt dress', 'distressed column dress'];

type RackQuery = { slot: RackSlot; era: GarmentEra; q: string; first: number };

function hueOf(prompt: string): string | null {
  const found = prompt.match(/\bhue:([a-z]+)\b/)?.[1] || '';
  return COLORS.includes(found) ? found : null;
}

function slotOf(prompt: string): RackSlot | null {
  const found = prompt.match(/\bslot:(top|bottom|shoes|dress)\b/)?.[1] || '';
  return found === 'top' || found === 'bottom' || found === 'shoes' || found === 'dress' ? found : null;
}

function kindsFor(audience: ShopAudience): { slot: RackSlot; kind: string }[] {
  const tops = TOP_KINDS.map((kind) => ({ slot: 'top' as const, kind }));
  const bottoms = BOTTOM_KINDS.map((kind) => ({ slot: 'bottom' as const, kind }));
  const shoes = SHOE_KINDS.map((kind) => ({ slot: 'shoes' as const, kind }));
  const rows: { slot: RackSlot; kind: string }[] = [];
  const span = Math.max(tops.length, bottoms.length, shoes.length);
  for (let i = 0; i < span; i += 1) {
    if (tops[i]) rows.push(tops[i]);
    if (bottoms[i]) rows.push(bottoms[i]);
    if (shoes[i]) rows.push(shoes[i]);
  }
  rows.push(...OVERALL_KINDS.map((kind) => ({ slot: 'dress' as const, kind })));
  if (audience === 'women') rows.push(...DRESS_KINDS.map((kind) => ({ slot: 'dress' as const, kind })));
  return rows;
}

/** Distinct shop searches. Each one is a color, a garment, a front angle, and a deeper page of results. */
export function rackSupply(audience: ShopAudience): number {
  return kindsFor(audience).length * COLORS.length * ANGLES.length * DEPTHS;
}

function queryAt(audience: ShopAudience, n: number, hue: string | null, only: RackSlot | null = null): RackQuery {
  const kinds = kindsFor(audience).filter((row) => !only || row.slot === only);
  const colors = hue ? [hue] : COLORS;
  const kindCount = Math.max(1, kinds.length);
  const colorCount = Math.max(1, colors.length);
  const row = kinds[n % kindCount];
  const color = colors[n % colorCount];
  const angleIndex = Math.floor(n / colorCount) % ANGLES.length;
  const depth = Math.floor(n / kindCount) % DEPTHS;
  const who = audience === 'men' ? "men's" : "women's";
  const avoid = audience === 'men' ? '-women -woman -girl -girls -female -ladies -womenswear -blouse -dress -skirt -heel -back -rear' : '-mens -"for men" -male -back -rear';
  const mood = n % 2 === 0 ? 'diy street' : 'vintage punk';
  const kind = row.kind.replace(/ pair$/, '');
  const shot =
    row.slot === 'dress'
      ? 'full garment front view product photo'
        : row.slot === 'shoes'
          ? 'pair front view product photo'
          : row.slot === 'bottom'
            ? 'flat lay product photo'
            : 'front view product photo';
  return {
    slot: row.slot,
    era: n % 3 === 0 ? 'vintage' : 'modern',
    q: `"${kind}" ${color} ${who} ${mood} ${shot} ${avoid}`,
    first: 1 + depth * 12 + angleIndex * 4,
  };
}

function dailyQueries(audience: ShopAudience, page = 0, hue: string | null = null, only: RackSlot | null = null): RackQuery[] {
  const size = 6;
  return Array.from({ length: size }, (_, index) => queryAt(audience, page * size + index, hue, only));
}

function looksLikeShop(page: string, image: string): boolean {
  return /\/products?\/|cdn\/shop|\/dp\/|shopify|scene7|demandware|\/product\/|\/files\/|nike\.com|adidas\.com|balenciaga\.com|stockx|goat\.com|flightclub|jdsports|footlocker|finishline|sneakers/i.test(`${page} ${image}`);
}

const BAD_SHOE = /\b(sole|outsole|underside|bottom view|shoe bottom|single shoe|one shoe|in hand|holding)\b/i;

function badShot(hay: string, slot: RackSlot): boolean {
  const text = hay.toLowerCase();
  if (/\b(back view|rear view|from behind|backside|seen from behind|on model|worn by|lookbook|holding|in hand|handheld|hand holding|mirror|selfie)\b/.test(text)) {
    return true;
  }
  const stripped = text.replace(/background|backyard|backpack/g, '');
  if (/(?:^|[_\-/.])(back|rear)(?:[_\-/.]|$)/.test(stripped)) return true;
  if (slot === 'shoes' && BAD_SHOE.test(text)) return true;
  if (slot !== 'bottom' && /\b(full body|full-length|head to toe)\b/.test(text)) return true;
  if (slot !== 'shoes' && /\b(sole|outsole)\b/.test(text)) return true;
  return false;
}

function pieceFromHit(row: WebHit, slot: RackSlot, era: GarmentEra, audience: ShopAudience): RackPiece | null {
  const hay = `${row.title} ${row.page} ${row.imageUrl}`;
  if (!row.imageUrl.startsWith('https://') || !row.page.startsWith('https://')) return null;
  if (BLOCKED.test(hay) || badShot(hay, slot)) return null;
  if (audience === 'men' ? WOMEN_WORD.test(hay) || !MEN_WORD.test(hay) : MEN_WORD.test(hay) || !WOMEN_WORD.test(hay)) return null;
  if (slot === 'top' && /\b(feet|foot|toes|legs)\b/i.test(hay)) return null;
  if (slot === 'bottom' && /\b(sneakers?|loafers?|oxfords?|derbys?|heels?|boots|shoes|footwear)\b/i.test(row.title) && !/bootcut|boot-cut/i.test(row.title)) return null;
  if (!looksLikeShop(row.page, row.imageUrl)) return null;
  const title = row.title.split('|')[0].split(' - ')[0].replace(/\s+/g, ' ').trim().slice(0, 72);
  if (title.length < 3) return null;
  if (/\b(how to|must-haves|style guide|outfits that|and more|page \d+|discover)\b/i.test(title)) return null;
  if (/[-_](?:2|3|back|rear)\.(?:jpg|jpeg|png|webp)(?:$|\?)/i.test(row.imageUrl)) return null;
  if (/[a-z]1\.(?:jpg|jpeg|png|webp)(?:$|\?)/i.test(row.imageUrl)) return null;
  if (/\b(tables?|chairs?|desks?|sofas?|couches?|lamps?|furniture|cabinets?|stools?|benches|nightstands?|ottomans?|dressers?|headboards?|mattress(?:es)?|rugs?|curtains?)\b/i.test(`${title} ${row.page} ${row.imageUrl}`)) return null;
  if (/\b(chains?|necklaces?|bracelets?|pendants?|earrings?|anklets?|chokers?)\b/i.test(title)) return null;
  if (/\blogos?\b/i.test(title) || /logo/i.test(row.imageUrl)) return null;
  if (/\b(chains?|necklaces?|bracelets?)\b/i.test(row.imageUrl) && !/\b(vests?|jackets?|shirts?|coats?|jeans?|pants)\b/i.test(row.imageUrl)) return null;
  const shotName = `${title} ${row.imageUrl}`.replace(/background|backyard|backpack/gi, '');
  if (/\b(back view|rear view|from behind|backside|back pockets?|waistbands?|seen from behind)\b/i.test(shotName)) return null;
  if (/(?:^|[_\-/.])(back|rear)(?:[_\-/.]|$)/i.test(shotName)) return null;
  let imageName = row.imageUrl;
  try {
    imageName = decodeURIComponent(row.imageUrl);
  } catch {
    imageName = row.imageUrl;
  }
  const name = `${title} ${imageName}`.replace(/[-_+/]/g, ' ');
  const topWord = /\b(jackets?|coats?|blazers?|hoodies?|sweaters?|sweatshirts?|shirts?|tees?|vests?|bombers?|cardigans?|jerseys?)\b/i.test(name);
  const legWord = /\b(jeans?|pants|trousers|cargos?|shorts|joggers?|sweatpants|track pants|tracksuit pants|pyjama pants|pajama pants)\b/i.test(name);
  const shoeWord = /\b(shoes?|boots?|sneakers?|trainers?|loafers?|sandals?|dunks?|sambas?|gazelles?|jordans?|air force|triple s|runners?)\b/i.test(name);
  const oneWord = /\b(overalls?|dungarees?|jumpsuits?|boiler suits?|coveralls?|dresses?|playsuits?|rompers?)\b/i.test(name);
  const sleepSet = /\b(pyjamas?|pajamas?|tracksuits?)\b/i.test(name) && !topWord && !shoeWord;
  const clearTop = topWord && !shoeWord && !legWord && !oneWord;
  const clearBottom = (legWord || sleepSet) && !topWord && !shoeWord && !oneWord;
  const clearShoe = shoeWord && !topWord && !legWord && !oneWord;
  if (!oneWord && !clearTop && !clearBottom && !clearShoe) return null;
  let keptSlot: RackSlot;
  if (oneWord) keptSlot = 'dress';
  else if ((topWord && legWord) || (topWord && shoeWord) || (legWord && shoeWord)) return null;
  else if (topWord) keptSlot = 'top';
  else if (legWord || sleepSet) keptSlot = 'bottom';
  else if (shoeWord) keptSlot = 'shoes';
  else return null;
  if (keptSlot === 'shoes' && /xiangqing|_[3-9]\.(?:jpg|jpeg|png|webp)|sole|bottom-view|side-view/i.test(row.imageUrl)) return null;
  if (keptSlot === 'bottom' && /\b(worn|wearing|outfit|lookbook|ootd|on model|styled|person|feet|foot|sneakers?|trainers?|shoes)\b|full[- ]?length|on[- ]?body/i.test(`${title} ${row.imageUrl}`) && !/bootcut/i.test(title)) return null;
  return {
    id: `day-${keptSlot}-${hash(row.imageUrl)}`,
    slot: keptSlot,
    title,
    imageUrl: row.imageUrl,
    sourceUrl: row.page,
    era,
    buyUrl: row.page,
    store: storeHost(row.page),
    price: '',
  };
}

async function dailyPool(audience: ShopAudience, page = 0, prompt = ''): Promise<RackPiece[]> {
  const hue = hueOf(prompt);
  const only = slotOf(prompt);
  const slice = dailyQueries(audience, page, hue, only);
  const batches = await mapPool(slice, 4, async (row) => {
    const hits = await webImages(row.q, row.first).catch(() => [] as WebHit[]);
    const pieces: RackPiece[] = [];
    const seenTitle = new Set<string>();
    for (const hit of hits.sort((a, b) => shopScore(b.page) - shopScore(a.page))) {
      const piece = pieceFromHit(hit, row.slot, row.era, audience);
      if (!piece || pieces.some((item) => item.imageUrl === piece.imageUrl)) continue;
      const titleKey = piece.title.toLowerCase().replace(/[^a-z0-9]+/g, '');
      if (seenTitle.has(titleKey)) continue;
      if (!(await imageOk(piece.imageUrl))) continue;
      seenTitle.add(titleKey);
      pieces.push(piece);
    }
    return pieces;
  });
  const uniq = new Map<string, RackPiece>();
  for (const piece of batches.flat()) uniq.set(piece.imageUrl, piece);
  return [...uniq.values()];
}

async function searchWeb(recipe: Recipe): Promise<RackPiece | null> {
  const hits = (await webImages(productQuery(recipe))).sort((a, b) => shopScore(b.page) - shopScore(a.page));
  for (const row of hits) {
    const hay = `${row.title} ${row.page} ${row.imageUrl}`;
    if (!row.imageUrl.startsWith('https://')) continue;
    if (BLOCKED.test(hay) || badShot(hay, recipe.slot)) continue;
    if (recipe.slot === 'shoes' && /\b(feet|foot|legs|toes|wearing|sole|holding)\b/i.test(hay)) continue;
    if (!(await imageOk(row.imageUrl))) continue;
    return {
      id: `web-${recipe.slot}-${hash(row.imageUrl)}`,
      slot: recipe.slot,
      title: recipe.title,
      imageUrl: row.imageUrl,
      sourceUrl: row.page,
      era: recipe.era,
      family: recipe.family,
      buyUrl: row.page,
      store: storeHost(row.page),
      price: '',
    };
  }
  return null;
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      out[index] = await fn(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return out;
}

export async function fetchRedCarpetRacks(prompt: string, audience: ShopAudience = 'men', page = 0): Promise<RedCarpetRacks> {
  const key = process.env.SERPAPI_API_KEY?.trim() || process.env.SERPAPI_KEY?.trim() || '';
  const cacheKey = `${key ? 'flat' : 'daily'}:${audience}:p${page}:${dayStamp()}:${prompt.trim().toLowerCase()}`;
  const hit = cache.get(cacheKey);
  const ttl = key ? TTL_MS : 6 * 60 * 60 * 1000;
  if (hit && Date.now() - hit.at < ttl) return hit.racks;

  const live = key
    ? (await Promise.all(RECIPES.map((recipe) => searchRecipe(recipe, key).catch(() => null)))).filter(
        (piece): piece is RackPiece => Boolean(piece)
      )
    : await dailyPool(audience, page, prompt);
  const racks: RedCarpetRacks = {
    tops: live.filter((piece) => piece.slot === 'top'),
    bottoms: live.filter((piece) => piece.slot === 'bottom'),
    dresses: live.filter((piece) => piece.slot === 'dress'),
    shoes: live.filter((piece) => piece.slot === 'shoes'),
    source: live.length ? 'product' : 'studio',
    detail: live.length ? `Shops for ${dayStamp()}` : 'Could not load product photos.',
    supply: rackSupply(audience),
  };
  cache.set(cacheKey, { at: Date.now(), racks });
  return racks;
}
