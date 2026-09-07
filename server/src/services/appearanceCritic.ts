/**
 * Multimodal fashion critic for a complete look (outfit + hair).
 * Scores color theory, hair-to-outfit proportion, event fit, and trend notes.
 * Uses GPT-4o / OPENAI_FASHION_MODEL when OPENAI_API_KEY is set and image URLs exist.
 */

import type { CompleteLook } from './appearanceStyling.js';

export interface AppearanceCriticResult {
  winner: 'A' | 'B';
  scores: {
    A: { event: number; color: number; hairHarmony: number; trend: number; total: number };
    B: { event: number; color: number; hairHarmony: number; trend: number; total: number };
  };
  reasons: string[];
  skip: string;
  line: string;
  askLike: string;
}

function hairHarmony(look: CompleteLook): number {
  const { hair, outfit } = look;
  let n = 7;
  if (hair.density === 'voluminous' && outfit.warp === 'layer') n -= 2;
  if (hair.density === 'tight' && (outfit.formality === 'mid' || outfit.formality === 'high')) n += 2;
  if (hair.family === 'protective' && /leather|satin|column/i.test(outfit.title + outfit.pieces.join(' '))) n += 1;
  if (hair.family === 'slick' && outfit.formality === 'low') n -= 1;
  if (hair.notes && /helmet|pain/.test(hair.notes)) n -= 1;
  return Math.max(3, Math.min(10, n));
}

function eventFit(look: CompleteLook, occasion: string): number {
  if (look.outfit.event === occasion) return 10;
  if (occasion === 'first-date' && look.outfit.event === 'dinner') return 8;
  if (occasion === 'dinner' && look.outfit.event === 'first-date') return 8;
  return 5;
}

function colorFit(look: CompleteLook): number {
  const darkHair = /slick|crop|cornrow|crown|bun/.test(look.hair.id);
  const darkOutfit = look.outfit.palette.some((p) => /black|navy|charcoal|espresso/.test(p));
  if (darkHair && darkOutfit) return 8;
  if (look.hair.density === 'voluminous' && look.outfit.palette.includes('white')) return 8;
  return 7;
}

function trendFit(look: CompleteLook): number {
  if (/logo|neon|costume/i.test(look.outfit.trendNotes)) return 5;
  if (/quiet|current|2026|knit/i.test(look.outfit.trendNotes)) return 9;
  return 7;
}

function pack(look: CompleteLook, occasion: string) {
  const event = eventFit(look, occasion);
  const color = colorFit(look);
  const hair = hairHarmony(look);
  const trend = trendFit(look);
  return { event, color, hairHarmony: hair, trend, total: event + color + hair + trend };
}

export async function critiqueCompleteLooks(
  optionA: CompleteLook,
  optionB: CompleteLook,
  occasion: string,
  guideFirstName: string,
  imageUrls?: { a?: string | null; b?: string | null }
): Promise<AppearanceCriticResult> {
  const A = pack(optionA, occasion);
  const B = pack(optionB, occasion);
  let winner: 'A' | 'B' = A.total >= B.total ? 'A' : 'B';
  const win = winner === 'A' ? optionA : optionB;
  const lose = winner === 'A' ? optionB : optionA;
  const reasons = [
    `${win.outfit.title} with ${win.hair.title} fits ${occasion.replace('-', ' ')} — ${win.outfit.vibe}.`,
    `Hair-to-outfit: ${win.hair.density} ${win.hair.family} does not fight the ${win.outfit.warp} clothes. ${lose.outfit.title} is the spare.`,
    `Color: ${win.outfit.palette.join(', ')} holds. ${win.outfit.trendNotes}`,
  ];
  const skip = `One signature. Do not add extra jewelry on ${win.outfit.title}.`;
  let line = `${guideFirstName} here. Wear ${win.outfit.title} with ${win.hair.title}. ${reasons[0]} Do you like this look?`;

  const key = process.env.OPENAI_API_KEY;
  if (key) {
    try {
      const content: unknown[] = [
        {
          type: 'text',
          text: JSON.stringify({
            occasion,
            A: {
              outfit: optionA.outfit.title,
              pieces: optionA.outfit.pieces,
              palette: optionA.outfit.palette,
              hair: optionA.hair.title,
              hairFamily: optionA.hair.family,
            },
            B: {
              outfit: optionB.outfit.title,
              pieces: optionB.outfit.pieces,
              palette: optionB.outfit.palette,
              hair: optionB.hair.title,
              hairFamily: optionB.hair.family,
            },
            ruleWinner: winner,
            job: 'Pick A or B. Score color theory, hair-to-outfit proportion, event, trend. 4 short sentences. End with: Do you like this look?',
          }),
        },
      ];
      if (imageUrls?.a) content.push({ type: 'image_url', image_url: { url: imageUrls.a } });
      if (imageUrls?.b) content.push({ type: 'image_url', image_url: { url: imageUrls.b } });
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: process.env.OPENAI_FASHION_MODEL || 'gpt-4o-mini',
          temperature: 0.35,
          messages: [
            {
              role: 'system',
              content:
                'You are Elena, a dating-app appearance critic. Pick A or B. Be specific about color, hair proportion, event, and trend. No brand essays. Always ask: Do you like this look?',
            },
            { role: 'user', content },
          ],
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        const text = data.choices?.[0]?.message?.content?.trim();
        if (text) {
          line = /do you like this look/i.test(text) ? text : `${text} Do you like this look?`;
          if (/\bwear b\b|\boption b\b|\bpick b\b/i.test(text) && winner === 'A') winner = 'B';
          if (/\bwear a\b|\boption a\b|\bpick a\b/i.test(text) && winner === 'B') winner = 'A';
        }
      }
    } catch {
      /* keep rule critic */
    }
  }

  return { winner, scores: { A, B }, reasons, skip, line, askLike: 'Do you like this look?' };
}
