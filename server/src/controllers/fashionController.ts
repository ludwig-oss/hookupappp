import { Request, Response } from 'express';
import { getGuide } from '../data/aiGuideCatalog.js';
import { getUserById } from '../models/user.js';
import { parseFashionIntent } from '../services/fashionIntent.js';
import { mixWardrobeIntoLook, pairForCompare, sourceLooks } from '../services/fashionSourcing.js';
import { critiqueLooks } from '../services/fashionCritic.js';
import { categoryForLook, runVirtualTryOn } from '../services/fashionTryOn.js';
import { deleteWardrobeItem, listWardrobe, saveWardrobeItem, type PieceSlot } from '../models/fashionWardrobe.js';
import type { FashionLook } from '../data/fashionCatalog.js';

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
  const critic = await critiqueLooks(a, b, intent, first);
  const ask =
    guideId === 'elena'
      ? `Got it — ${intent.event.replace('-', ' ')}. Two looks. Compare them full-size, then pick or shuffle.`
      : `I heard ${intent.event.replace('-', ' ')}. Two looks. ${first} is still in this call.`;

  return {
    prompt,
    guideLine: ask,
    intent,
    optionA: serializeLook(a),
    optionB: serializeLook(b),
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

export const tryOnHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string | undefined;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const user = await getUserById(userId);
    const garmentUrl = String(req.body?.garmentUrl || '').trim();
    if (!garmentUrl) return res.status(400).json({ error: 'garmentUrl is required' });
    const result = await runVirtualTryOn({
      personUrl: String(req.body?.personUrl || user?.profilePicture || '') || null,
      garmentUrl,
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
