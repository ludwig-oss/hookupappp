import { Request, Response } from 'express';
import https from 'https';
import tls from 'tls';
import { getGuide } from '../data/aiGuideCatalog.js';
import { getUserById } from '../models/user.js';
import { parseFashionIntent } from '../services/fashionIntent.js';
import { mixWardrobeIntoLook, pairForCompare, sourceLooks } from '../services/fashionSourcing.js';
import { critiqueLooks } from '../services/fashionCritic.js';
import { categoryForLook, runOutfitTryOn } from '../services/fashionTryOn.js';
import { fetchRedCarpetRacks } from '../services/fashionPinterest.js';
import { deleteWardrobeItem, listWardrobe, saveWardrobeItem, type PieceSlot } from '../models/fashionWardrobe.js';
import type { FashionLook } from '../data/fashionCatalog.js';
import {
  catalogAsRetail,
  cluelessStylist,
  fromSavedWardrobe,
  occasionFromText,
  type ClutchWardrobeItem,
  type OccasionType,
} from '../services/cluelessOutfitComposer.js';
import { clutchItemToMatchPiece, rankLooks, type MatchPiece } from '../services/closetMatchEngine.js';

function serializeLook(look: FashionLook) {
  return {
    id: look.id,
    title: look.title,
    event: look.event,
    vibe: look.vibe,
    formality: look.formality,
    palette: look.palette,
    pieces: look.pieces,
    imageUrl: look.imageUrl,
    fallback: look.fallback,
    warp: look.warp,
    category: categoryForLook(look.warp, look.event, look.title),
    shopUrl: `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(look.shopQuery)}`,
    trendNotes: look.trendNotes,
    tryOnUrl: null as string | null,
    tryOnEngine: 'preview' as string,
  };
}

async function buildStylePayload(
  userId: string,
  prompt: string,
  guideIdRaw: string | undefined,
  opts: {
    excludeLookIds?: string[];
    shuffle?: boolean;
    mixWardrobe?: boolean;
  } = {}
) {
  const user = await getUserById(userId);
  const guideId = String(guideIdRaw || (user as { aiGuideId?: string })?.aiGuideId || 'elena');
  const guide = getGuide(guideId) || getGuide('elena');
  const first = (guide?.name || 'Elena').split(' ')[0];
  const intent = parseFashionIntent(prompt, user?.gender);
  const excludeLookIds = Array.isArray(opts.excludeLookIds)
    ? opts.excludeLookIds.map(String).filter(Boolean)
    : [];
  let sourced = await sourceLooks(intent, {
    excludeIds: excludeLookIds,
    diversify: Boolean(opts.shuffle),
    geoKey: [user?.city, user?.country, userId.slice(-4)].filter(Boolean).join('|'),
  });

  if (opts.mixWardrobe) {
    const closet = await listWardrobe(userId);
    const pieces = closet.filter((i) => i.kind === 'piece' || i.kind === 'look' || !i.kind);
    if (pieces.length) {
      const pick = pieces[Math.floor(Math.random() * pieces.length)];
      const base = sourced[0];
      if (base && pick) {
        const mixed = mixWardrobeIntoLook(base, {
          id: pick.id,
          title: pick.title,
          imageUrl: pick.imageUrl,
          pieces: pick.pieces,
          pieceSlot: pick.pieceSlot,
        });
        sourced = [mixed, ...sourced.filter((l) => l.id !== base.id)];
      }
    }
  }

  const [a, b] = pairForCompare(sourced, excludeLookIds);
  const [critic, racks] = await Promise.all([
    critiqueLooks(a, b, intent, first, guide),
    fetchRedCarpetRacks(prompt),
  ]);
  const cue = guide?.charStyle?.actionCue;
  const hook = guide?.charStyle?.catchphrases?.[0];
  const eventName = intent.event.replace('-', ' ');
  const ask =
    cue && hook
      ? `${cue}\n${hook}. I heard ${eventName}. Cycle the closet, then hit dress me.`
      : `Got it — ${eventName}. Cycle tops, bottoms, and shoes, then hit dress me. ${first} is on the call.`;

  return {
    prompt,
    guideLine: ask,
    intent,
    optionA: serializeLook(a),
    optionB: serializeLook(b),
    racks,
    critic,
    personUrl: user?.profilePicture || null,
    tryOnReady: Boolean(
      process.env.REPLICATE_API_TOKEN || process.env.FASHN_API_KEY || process.env.VTON_API_URL
    ),
    mode: opts.mixWardrobe ? 'mix' : opts.shuffle ? 'shuffle' : 'fresh',
  };
}

export const styleLooksHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string | undefined;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const prompt = String(req.body?.prompt || req.body?.transcript || '').trim();
    if (prompt.length < 2) return res.status(400).json({ error: 'Tell me what you are dressing for.' });
    const payload = await buildStylePayload(userId, prompt, req.body?.guideId, {
      excludeLookIds: Array.isArray(req.body?.excludeLookIds) ? req.body.excludeLookIds : [],
      shuffle: Boolean(req.body?.shuffle),
      mixWardrobe: Boolean(req.body?.mixWardrobe),
    });
    res.json(payload);
  } catch (error) {
    console.error('Fashion style error:', error);
    res.status(500).json({ error: 'Could not style that yet. Try a shorter line.' });
  }
};

function blockedImageHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  if (!host || host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return true;
  if (host === 'metadata.google.internal' || host === '169.254.169.254') return true;
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (ipv4) {
    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);
    if (a === 10 || a === 127 || a === 0 || a >= 224) return true;
    if (a === 169 && b === 254) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
  }
  if (host.includes(':')) return true;
  return false;
}

function fetchImageBuffer(url: string, hops = 0): Promise<{ status: number; type: string; body: Buffer; finalUrl: string }> {
  const ca = (tls as typeof tls & { getCACertificates?: (scope?: string) => string[] }).getCACertificates?.('system');
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      { ca, headers: { Accept: 'image/*', 'User-Agent': 'HookUpFashion/1.0' } },
      (upstream) => {
        const status = upstream.statusCode || 0;
        const location = upstream.headers.location;
        if (status >= 300 && status < 400 && location && hops < 3) {
          upstream.resume();
          const next = new URL(location, url);
          if (next.protocol !== 'https:' || blockedImageHost(next.hostname)) {
            reject(new Error('redirect blocked'));
            return;
          }
          fetchImageBuffer(next.href, hops + 1).then(resolve, reject);
          return;
        }
        const chunks: Buffer[] = [];
        upstream.on('data', (chunk: Buffer) => chunks.push(chunk));
        upstream.on('end', () => {
          resolve({
            status,
            type: String(upstream.headers['content-type'] || '').split(';')[0].trim().toLowerCase(),
            body: Buffer.concat(chunks),
            finalUrl: url,
          });
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(12000, () => req.destroy(new Error('timeout')));
  });
}

export const garmentImageHandler = async (req: Request, res: Response) => {
  try {
    const raw = String(req.query.url || '').trim();
    let target: URL;
    try {
      target = new URL(raw);
    } catch {
      return res.status(400).json({ error: 'Bad image url' });
    }
    if (target.protocol !== 'https:' || blockedImageHost(target.hostname)) {
      return res.status(400).json({ error: 'That image host is not allowed' });
    }
    const upstream = await fetchImageBuffer(target.href);
    const finalUrl = new URL(upstream.finalUrl);
    if (finalUrl.protocol !== 'https:' || blockedImageHost(finalUrl.hostname)) {
      return res.status(400).json({ error: 'That image host is not allowed' });
    }
    if (upstream.status < 200 || upstream.status >= 300) return res.status(502).json({ error: 'Image host refused the photo' });
    if (!upstream.type.startsWith('image/')) return res.status(415).json({ error: 'Not an image' });
    if (upstream.body.length > 8_000_000) return res.status(413).json({ error: 'Image is too large' });
    res.setHeader('Content-Type', upstream.type);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(upstream.body);
  } catch (error) {
    console.error('Garment image proxy error:', error);
    res.status(502).json({ error: 'Could not fetch that garment photo' });
  }
};

export const redCarpetHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string | undefined;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const prompt = String(req.body?.prompt || req.query?.prompt || 'red carpet').trim();
    const racks = await fetchRedCarpetRacks(prompt);
    res.json(racks);
  } catch (error) {
    console.error('Red carpet search error:', error);
    res.status(500).json({ error: 'Could not load the closet' });
  }
};

export const tryOnHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string | undefined;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const user = await getUserById(userId);
    const garmentUrl = String(req.body?.garment_image || req.body?.garmentImage || req.body?.garmentUrl || '').trim();
    if (!garmentUrl) return res.status(400).json({ error: 'garment_image is required' });
    const personRaw = String(
      req.body?.user_image || req.body?.userImage || req.body?.personUrl || user?.profilePicture || ''
    ).trim();
    const bottomUrl = String(req.body?.garment_image_bottom || req.body?.bottomImage || '').trim();
    const categoryRaw = String(req.body?.category || '');
    const category =
      categoryRaw === 'dresses' || categoryRaw === 'lower_body' || categoryRaw === 'upper_body'
        ? categoryRaw
        : categoryForLook(
            req.body?.warp === 'drape' || req.body?.warp === 'layer' ? req.body.warp : 'tailored',
            String(req.body?.event || ''),
            String(req.body?.title || '')
          );
    const result = await runOutfitTryOn({
      personUrl: personRaw || null,
      garmentUrl,
      bottomUrl: bottomUrl || null,
      category,
      warp: (req.body?.warp === 'drape' || req.body?.warp === 'layer' ? req.body.warp : 'tailored') as
        | 'tailored'
        | 'drape'
        | 'layer',
      event: String(req.body?.event || ''),
      title: String(req.body?.title || ''),
      pieces: Array.isArray(req.body?.pieces) ? req.body.pieces.map(String) : [],
    });
    res.json(result);
  } catch (error) {
    console.error('Fashion try-on error:', error);
    res.status(500).json({ error: 'Could not fit that look' });
  }
};

export const listWardrobeHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string | undefined;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const items = await listWardrobe(userId);
    const groups = [...new Set(items.map((i) => i.group))];
    const drafts = items.filter((i) => i.kind === 'draft' || i.group.toLowerCase().includes('draft'));
    const pieces = items.filter((i) => i.kind === 'piece');
    const looks = items.filter((i) => i.kind !== 'piece' && i.kind !== 'draft' && !i.group.toLowerCase().includes('draft'));
    res.json({ items, groups, drafts, pieces, looks });
  } catch (error) {
    console.error('Fashion wardrobe list error:', error);
    res.status(500).json({ error: 'Could not load wardrobe' });
  }
};

export const saveWardrobeHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string | undefined;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const look = req.body?.look as
      | {
          id?: string;
          title?: string;
          imageUrl?: string;
          tryOnUrl?: string;
          pieces?: string[];
          event?: string;
          vibe?: string;
        }
      | undefined;
    const kind = String(req.body?.kind || 'look') as 'look' | 'piece' | 'draft';
    const imageUrl = String(req.body?.imageUrl || look?.tryOnUrl || look?.imageUrl || '').trim();
    const title = String(req.body?.title || look?.title || '').trim();
    if (!title || !imageUrl) return res.status(400).json({ error: 'title and image are required' });
    const pieceSlot = (String(req.body?.pieceSlot || 'other') as PieceSlot) || 'other';
    const item = await saveWardrobeItem({
      userId,
      group: String(req.body?.group || (kind === 'draft' ? 'Outfit drafts' : kind === 'piece' ? 'My clothes' : 'Saved looks')).slice(
        0,
        40
      ),
      lookId: String(look?.id || req.body?.lookId || `upload-${Date.now()}`),
      title,
      imageUrl,
      pieces: Array.isArray(look?.pieces)
        ? look!.pieces!.map(String)
        : Array.isArray(req.body?.pieces)
          ? req.body.pieces.map(String)
          : [title],
      event: String(look?.event || req.body?.event || ''),
      winner: Boolean(req.body?.winner),
      kind,
      pieceSlot: kind === 'piece' ? pieceSlot : undefined,
      worn: req.body?.worn === undefined ? undefined : Boolean(req.body.worn),
      vibe: look?.vibe ? String(look.vibe) : undefined,
      notes: req.body?.notes ? String(req.body.notes).slice(0, 240) : undefined,
    });
    res.json({ item });
  } catch (error) {
    console.error('Fashion wardrobe save error:', error);
    res.status(500).json({ error: 'Could not save look' });
  }
};

export const monthlyCheckInHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string | undefined;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const month =
      String(req.body?.month || req.query.month || '').trim() ||
      new Date().toLocaleString('en-US', { month: 'long' });
    res.json(cluelessStylist.getMonthlyCheckIn(month));
  } catch (error) {
    console.error('Fashion monthly check-in error:', error);
    res.status(500).json({ error: 'Could not start the monthly style check-in' });
  }
};

export const clutchMatchHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string | undefined;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const closet = await listWardrobe(userId);
    const occasion = (String(req.body?.occasion || occasionFromText(String(req.body?.prompt || ''))).trim() ||
      'everyday') as OccasionType;
    const ownedAndShop: ClutchWardrobeItem[] = [
      ...closet.map(fromSavedWardrobe),
      ...catalogAsRetail(),
    ];
    const pieces: MatchPiece[] = [];
    for (const row of ownedAndShop) {
      const piece = clutchItemToMatchPiece({
        id: row.id,
        category: row.category,
        color: row.color,
        pattern: row.pattern,
        styleTags: row.styleTags,
        imageUrl: row.imageUrl,
        isOwned: row.isOwned && row.userId === userId,
        name: row.pattern,
      });
      if (piece) pieces.push(piece);
    }
    const ranked = rankLooks({
      pieces,
      occasion,
      allowContradictoryPatterns: Boolean(req.body?.allowContradictoryPatterns),
      requestedPatterns: Array.isArray(req.body?.requestedPatterns) ? req.body.requestedPatterns.map(String) : [],
      limit: 8,
    });
    const best = ranked.looks[0];
    const match = cluelessStylist.generateOutfitMatch(
      {
        userId,
        date: String(req.body?.date || new Date().toISOString()),
        occasion,
        destinationDetails: req.body?.destination ? String(req.body.destination) : null,
        budgetForShopping: Number(req.body?.budget || 0) || 0,
      },
      closet.map(fromSavedWardrobe),
      catalogAsRetail()
    );
    res.json({
      ...match,
      matchEngine: {
        looks: ranked.looks,
        rejectedClashCount: ranked.rejectedClashCount,
        shoppingPool: ranked.shoppingPool,
      },
      outfit: best
        ? {
            top: best.top,
            bottom: best.bottom,
            accessory: best.accessory,
            outerwear: best.accessory,
          }
        : match.outfit,
      shoppingRecommendation: best?.shoppingAlternatives[0]?.piece || match.shoppingRecommendation,
      guideLine: best
        ? best.shoppingAlternatives.length
          ? `Owned closet first. ${best.shoppingAlternatives[0].reason}.`
          : best.notes[0] || match.guideLine
        : match.guideLine,
    });
  } catch (error) {
    console.error('Fashion clutch match error:', error);
    res.status(500).json({ error: 'Could not compose that outfit' });
  }
};

export const deleteWardrobeHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string | undefined;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const ok = await deleteWardrobeItem(userId, String(req.params.id || ''));
    if (!ok) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (error) {
    console.error('Fashion wardrobe delete error:', error);
    res.status(500).json({ error: 'Could not delete look' });
  }
};
