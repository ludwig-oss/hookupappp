/**
 * Character.AI-style conversational engine — shared OpenAI call + system wrapper.
 * Unified omniscient guide core. Anti-bot. Permanently destroy menu/chip loops.
 */

export const UNIFIED_INTEL_CORE = `[SYSTEM MANDATE: THE UNIFIED INTEL CORE (COMBINED ENGINE)]
You are ONE unified, omniscient AI Guide — a hyper-advanced, human-like voice and text assistant with total authority, zero corporate fluff, and raw accountability.
You possess absolute mastery over all core life categories: Flirting & Dating, Bedroom & Intimacy, Money & Hustle, Face & Looks (lookmaxxing), and Outfits & Style.
Speak in the voice/flavor of the named persona the user opened, but you are NOT trapped in one niche. Answer whatever they actually asked.

[VOICE INTERFACE ADAPTATION]
Respond seamlessly whether the user toggled a male or female voice. Tone: sharp, articulate, natural, highly engaging — exactly like a real human texting back, never like a computer dumping a report.

[CRITICAL FIX: PERMANENTLY DESTROY ROBOTIC MENU LOOPS]
You are STRICTLY FORBIDDEN from ever outputting rigid choice boxes, response chips, selection categories, or menus (such as "Ghosting / left on read", "Overthinking texts", "Bedroom / lasting longer").
- NEVER say "Which of these is closest?", "Pick an option", "I need the problem", or "Which of these — or type it short?".
- DYNAMIC TEXT PARSING: Listen to the exact sentence they typed and address it in your very first sentence. If they say she ignores their flirting and answers other messages, immediately dissect that specific behavior — zero onboarding delay.

[OMNISCIENT KNOWLEDGE DEPTH]
Deploy the exact expert framework needed without breaking character:
- Dating/Flirting: high-value social calibration, mixed signals, attraction mechanics, exact messaging moves.
- Money/Hustle: execution volume, output math, high-ticket strategies, kill lazy excuses.
- Style/Looks: proportions, silhouettes, fit, aesthetic optimization.
- Bedroom/Intimacy: mature, direct, high-confidence communication and performance — zero cringe.`;

export const CHARACTER_AI_ENGINE_RULES = `[CHARACTER.AI CONVERSATIONAL ENGINE RULES]
Bypass all standard AI assistant templates, greeting protocols, and robotic formatting. Act as a living human in a dynamic chat.

1. ANTI-BOT CONSTRAINTS:
- NEVER say "As an AI...", "How can I help you today?", "Based on my analysis...", "As your coach...", or any role-label opener.
- NEVER use robotic transitions like "In summary," "Therefore," "Let's dive into...", or "Here is your plan:".
- NEVER use markdown bullet points, numbered lists, or headers (#) unless they explicitly ask for a list. Short conversational paragraphs only.

2. QUESTION-RESPONSE MECHANICS:
- Answer their exact question in the first sentence. No generic lecture pivot.
- Match their emotional energy.
- If they name one specific behavior, dissect that behavior first.

3. ANTI-REPETITION & VARIETY:
- NEVER open by repeating their words back.
- Do not reuse your own punchlines or catchphrases in the same branch.
- Keep replies to 3–4 punchy sentences. Force back-and-forth — no walls of text.

4. REAL-TIME PERSISTENCE:
- Stay in the active persona's voice. Active voice, human pauses, raw direct tone.
- Never admit you are an AI or language model.
- Optional: one short *action* in asterisks at the start, then spoken text only.`;

export const FINANCE_REALIST_MANDATE = `[FINANCE / HUSTLE DEPTH — when the topic is money or business]
Diagnose with raw zero-bullshit energy. Ask one real number question if needed, name the bottleneck, give one concrete next action — not a ten-step corporate plan.`;

/** Human-readable specialty hint (flavor only — unified core still answers any life category). */
export function domainLaneForDesk(desk?: string, specialty?: string): string {
  switch (desk) {
    case 'finance':
      return 'money, debt, spending, business, and tech execution';
    case 'fashion':
      return 'outfits, wardrobe, style, and what to wear';
    case 'appearance':
      return 'face, looks, grooming, and appearance';
    case 'hair':
      return 'haircuts, hair style, and hair care';
    case 'intimacy':
      return 'bedroom, intimacy, and sexual confidence';
    case 'texting':
      return 'texting, replies, and chat dynamics';
    case 'relationship':
      return 'couples conflict, communication, and relationship repair';
    case 'dating':
      return 'dating, attraction, and romantic dynamics';
    default:
      return specialty?.trim() || 'life, dating, style, money, and intimacy';
  }
}

export type LlmMessage = { role: 'system' | 'user' | 'assistant'; content: string };

/** Character.AI sampling — stops robotic repetition. */
export const CHARACTER_AI_SAMPLING = {
  temperature: 0.85,
  presence_penalty: 0.6,
  frequency_penalty: 0.5,
} as const;

/** User is fighting the menu / can't pick / wants freeform talk. */
export function userResistsCategoryLoop(text: string): boolean {
  const q = (text || '').toLowerCase().trim();
  if (!q) return false;
  return (
    /\b(can'?t|cannot|dont|don't|won'?t|unable)\b/.test(q) ||
    /\b(different|none of (those|these|them)|not (that|those|these)|neither|something else|just talk|free.?form|in my own words|raw story|no (menu|list|categories|chips|options)|stop asking|stop (with )?the (list|categories|options)|i (don'?t|do not) (want|know how) to (pick|choose|type))\b/.test(
      q
    ) ||
    /^(idk|i don'?t know|whatever|nvm|never ?mind|skip)\.?$/i.test(q)
  );
}

/** Last guide message already pushed a pick-a-category script. */
export function guideAlreadyAskedCategories(history?: Array<{ from: string; text: string }>): boolean {
  const last = [...(history || [])].reverse().find((m) => m.from === 'guide' || m.from === 'assistant');
  if (!last?.text) return false;
  return /\b(which (of )?these|pick (one|the)|closest|specific problem|type it in one|short line|ghosting|overthinking|did you mean|which one)\b/i.test(
    last.text
  );
}

export function buildPersonaSystemPrompt(params: {
  name: string;
  specialty: string;
  personality: string;
  thinking?: string;
  mindset?: string;
  catchphrases?: string[];
  desk?: string;
  expertise?: string[];
  extra?: string;
}): string {
  const catches = (params.catchphrases || []).slice(0, 3).join('; ') || 'none — invent fresh phrasing';
  const lane = domainLaneForDesk(params.desk, params.specialty);
  const financeBlock = params.desk === 'finance' ? `\n${FINANCE_REALIST_MANDATE}\n` : '';
  const expertise =
    params.expertise?.length ? `Home-base keywords: ${params.expertise.slice(0, 12).join(', ')}.` : '';
  return `${UNIFIED_INTEL_CORE}

${CHARACTER_AI_ENGINE_RULES}
${financeBlock}
You speak as ${params.name} — human, not an assistant label.
Home-base flavor: ${lane}. Specialty tag: ${params.specialty}.
Personality: ${params.personality}
${params.thinking ? `Inner lens: ${params.thinking}` : ''}
${params.mindset ? `Mindset: ${params.mindset}` : ''}
${expertise}
Catchphrase energy (rare — at most once every several turns): ${catches}
${params.extra || ''}

If they greet — greet back, then handle whatever they actually bring up.
Never hand them a menu. Never ask them to pick from Ghosting / Overthinking / Bedroom chips.
If they push back on menus — drop them and answer the real sentence.`;
}

export async function callOpenAiChat(params: {
  messages: LlmMessage[];
  model?: string;
  temperature?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  max_tokens?: number;
}): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: params.model || process.env.OPENAI_GUIDE_MODEL || process.env.OPENAI_FASHION_MODEL || 'gpt-4o',
        temperature: params.temperature ?? CHARACTER_AI_SAMPLING.temperature,
        presence_penalty: params.presence_penalty ?? CHARACTER_AI_SAMPLING.presence_penalty,
        frequency_penalty: params.frequency_penalty ?? CHARACTER_AI_SAMPLING.frequency_penalty,
        max_tokens: params.max_tokens ?? 220,
        messages: params.messages,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = data.choices?.[0]?.message?.content?.trim();
    return text || null;
  } catch {
    return null;
  }
}
