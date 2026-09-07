import { Request, Response } from 'express';
import { getGuide } from '../data/aiGuideCatalog.js';
import { getUserById } from '../models/user.js';
import { parseFashionIntent } from '../services/fashionIntent.js';
import { pairForCompare, sourceLooks } from '../services/fashionSourcing.js';
import { critiqueLooks } from '../services/fashionCritic.js';
import { categoryForLook, runVirtualTryOn } from '../services/fashionTryOn.js';
import { deleteWardrobeItem, listWardrobe, saveWardrobeItem } from '../models/fashionWardrobe.js';
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

export const styleLooksHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string | undefined;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const prompt = String(req.body?.prompt || req.body?.transcript || '').trim();
    if (prompt.length < 2) return res.status(400).json({ error: 'Tell me what you are dressing for.' });
    const user = await getUserById(userId);
    const guideId = String(req.body?.guideId || (user as { aiGuideId?: string })?.aiGuideId || 'elena');
    const guide = getGuide(guideId) || getGuide('elena');
    const first = (guide?.name || 'Elena').split(' ')[0];
    const intent = parseFashionIntent(prompt, user?.gender);
    const sourced = await sourceLooks(intent);
    const [a, b] = pairForCompare(sourced);
    const critic = await critiqueLooks(a, b, intent, first);
    const ask =
      guideId === 'elena'
        ? `Got it — ${intent.event.replace('-', ' ')}. Two looks. I will tell you which one wins.`
        : `I heard ${intent.event.replace('-', ' ')}. I pulled two looks. ${first} is still in this call.`;
    res.json({
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
    });
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
    res.json({ items, groups });
  } catch (error) {
    console.error('Fashion wardrobe list error:', error);
    res.status(500).json({ error: 'Could not load wardrobe' });
  }
};

export const saveWardrobeHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string | undefined;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const look = req.body?.look as { id?: string; title?: string; imageUrl?: string; tryOnUrl?: string; pieces?: string[]; event?: string } | undefined;
    if (!look?.id || !look.title) return res.status(400).json({ error: 'look is required' });
    const item = await saveWardrobeItem({
      userId,
      group: String(req.body?.group || 'Saved looks').slice(0, 40),
      lookId: look.id,
      title: look.title,
      imageUrl: String(look.tryOnUrl || look.imageUrl || ''),
      pieces: Array.isArray(look.pieces) ? look.pieces.map(String) : [],
      event: String(look.event || ''),
      winner: Boolean(req.body?.winner),
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
