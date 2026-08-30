import { Request, Response } from 'express';
import { translateText } from '../utils/translate.js';
import { sanitizeMessageContent, LIMITS } from '../utils/sanitize.js';

export async function translateHandler(req: Request, res: Response) {
  try {
    const text = sanitizeMessageContent(req.body?.text, LIMITS.COMMENT);
    const targetLang = typeof req.body?.targetLang === 'string' ? req.body.targetLang : 'en';
    if (!text) return res.status(400).json({ error: 'Text required' });
    const translated = await translateText(text, targetLang);
    res.json({ translated, targetLang });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Translation failed';
    res.status(500).json({ error: msg });
  }
}
