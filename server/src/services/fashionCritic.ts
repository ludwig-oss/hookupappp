import type { FashionLook } from '../data/fashionCatalog.js';
import type { FashionIntent } from './fashionIntent.js';

export interface FashionCriticResult {
  winner: 'A' | 'B';
  scores: {
    A: { event: number; color: number; body: number; trend: number; total: number };
    B: { event: number; color: number; body: number; trend: number; total: number };
  };
  reasons: string[];
  skip: string;
  line: string;
}

function eventScore(look: FashionLook, intent: FashionIntent): number {
  if (look.event === intent.event) return 10;
  if (intent.event === 'first-date' && look.event === 'dinner') return 8;
  if (intent.event === 'dinner' && look.event === 'first-date') return 8;
  return 5;
}

function colorScore(look: FashionLook, intent: FashionIntent): number {
  if (!intent.colors.length) return 7;
  const hit = intent.colors.filter((c) => look.palette.some((p) => p.includes(c) || c.includes(p)));
  return Math.min(10, 5 + hit.length * 3);
}

function bodyScore(look: FashionLook): number {
  if (look.warp === 'tailored') return 8;
  if (look.warp === 'drape') return 7;
  return 6;
}

function trendScore(look: FashionLook): number {
  if (/logo|neon|costume/i.test(look.trendNotes)) return 5;
  if (/quiet|current|2026|knit/i.test(look.trendNotes)) return 9;
  return 7;
}

function pack(look: FashionLook, intent: FashionIntent) {
  const event = eventScore(look, intent);
  const color = colorScore(look, intent);
  const body = bodyScore(look);
  const trend = trendScore(look);
  return { event, color, body, trend, total: event + color + body + trend };
}

export async function critiqueLooks(
  optionA: FashionLook,
  optionB: FashionLook,
  intent: FashionIntent,
  guideFirstName: string
): Promise<FashionCriticResult> {
  const A = pack(optionA, intent);
  const B = pack(optionB, intent);
  let winner: 'A' | 'B' = A.total >= B.total ? 'A' : 'B';
  const winLook = winner === 'A' ? optionA : optionB;
  const loseLook = winner === 'A' ? optionB : optionA;

  const reasons = [
    `${winLook.title} fits ${intent.event.replace('-', ' ')} better — ${winLook.vibe}.`,
    `Color: ${winLook.palette.join(', ')} holds together. ${loseLook.title} is the backup, not the lead.`,
    winLook.trendNotes,
  ];
  const skip = `Skip adding extra accessories on ${winLook.title}. One signature is enough.`;
  let line = `${guideFirstName} here. Wear ${winLook.title}. ${reasons[0]} ${skip}`;

  const key = process.env.OPENAI_API_KEY;
  if (key) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: process.env.OPENAI_FASHION_MODEL || 'gpt-4o-mini',
          temperature: 0.4,
          messages: [
            {
              role: 'system',
              content:
                'You are a dating-app fashion critic. Pick A or B. Be specific about color, event, and fit. 4 short sentences. No brand essays.',
            },
            {
              role: 'user',
              content: JSON.stringify({
                event: intent.event,
                prompt: intent.raw,
                A: { title: optionA.title, pieces: optionA.pieces, palette: optionA.palette, vibe: optionA.vibe },
                B: { title: optionB.title, pieces: optionB.pieces, palette: optionB.palette, vibe: optionB.vibe },
                ruleWinner: winner,
              }),
            },
          ],
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        const text = data.choices?.[0]?.message?.content?.trim();
        if (text) {
          line = text;
          if (/\bwear b\b|\boption b\b|\bpick b\b/i.test(text) && winner === 'A') winner = 'B';
          if (/\bwear a\b|\boption a\b|\bpick a\b/i.test(text) && winner === 'B') winner = 'A';
        }
      }
    } catch {
      /* keep rule critic */
    }
  }

  return { winner, scores: { A, B }, reasons, skip, line };
}
