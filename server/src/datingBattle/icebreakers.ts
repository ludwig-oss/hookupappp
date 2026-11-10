import type { Prompt } from './types.js';

/** Hardcoded seeds. They are served once per user, then never again. */
export const SEED_PROMPTS: Prompt[] = [
  { id: 'seed-why-not', text: "Why shouldn't someone date you?" },
  {
    id: 'seed-last-relationship',
    text: 'When was the last time you were in a serious relationship and why did it end?',
  },
  { id: 'seed-flirt', text: 'Show me how you flirt.' },
  { id: 'seed-toxic-scale', text: 'On a scale of 1 to 10, how toxic/racist are you?' },
];

const WHO = [
  'your ex',
  'the last person you ghosted',
  'your closest friend',
  'the one who rejected you',
  'a date who got bored',
  'someone you still text',
  'the person who knows your worst story',
  'your younger self',
  'the friend who tells you the truth',
  'a stranger you almost kissed',
  'the partner who stopped trying',
  'the one you kept forgiving',
  'your group chat',
  'the date you oversold yourself to',
  'the person you performed for',
  'the last good thing you ruined',
];

const WHAT = [
  'jealousy',
  'money',
  'boredom',
  'ego',
  'loneliness',
  'anger',
  'chemistry',
  'lying',
  'ambition',
  'commitment',
  'attention',
  'insecurity',
  'pride',
  'fear',
];

const ASKS: Array<(subject: string) => string> = [
  (s) => `What's the version of ${s} you edit out before a first date?`,
  (s) => `Be specific and a little unkind to yourself: what did ${s} teach you that you still haven't fixed?`,
  (s) => `If ${s} walked into this battle, what would they expose in the first minute?`,
  (s) => `When did ${s} last make you act like someone you don't respect?`,
  (s) => `What would you confess about ${s} if you knew this date was already over?`,
  (s) => `Don't perform. What is the embarrassing truth about ${s}?`,
  (s) => `How does ${s} show up when you want someone to stay?`,
  (s) => `What do you hope they never ask about ${s}?`,
  (s) => `Finish it out loud: the worst moment with ${s} was…`,
  (s) => `Who got hurt the last time you let ${s} drive a decision?`,
  (s) => `What do you still rehearse about ${s} when you can't sleep?`,
  (s) => `If this match only gets one honest answer, make it about ${s}.`,
  (s) => `What rule about ${s} do you break and then defend?`,
  (s) => `Show the unpolished version: how do you behave around ${s}?`,
  (s) => `What apology about ${s} is still sitting in your drafts?`,
  (s) => `Rate the damage ${s} still does, then explain the number.`,
];

let catalog: Prompt[] | null = null;

export function promptCatalog(): Prompt[] {
  if (catalog) return catalog;
  const generated: Prompt[] = [];
  for (let w = 0; w < WHO.length; w += 1) {
    for (let t = 0; t < WHAT.length; t += 1) {
      const subject = `${WHO[w]} and ${WHAT[t]}`;
      for (let a = 0; a < ASKS.length; a += 1) {
        generated.push({
          id: `gen-${w}-${t}-${a}`,
          text: ASKS[a](subject),
        });
      }
    }
  }
  catalog = generated;
  return catalog;
}

export function nextPrompt(seen: Set<string>): Prompt {
  for (const seed of SEED_PROMPTS) {
    if (!seen.has(seed.id)) return seed;
  }
  const items = promptCatalog();
  for (const item of items) {
    if (!seen.has(item.id)) return item;
  }
  for (let pass = 2; pass < 50; pass += 1) {
    for (const item of items) {
      const id = `${item.id}#${pass}`;
      if (seen.has(id)) continue;
      return { id, text: `${item.text} Answer it from a different year of your life.` };
    }
  }
  const id = `overflow-${seen.size}`;
  return { id, text: `Say the thing about yourself you have never put in a chat. Variation ${seen.size}.` };
}
