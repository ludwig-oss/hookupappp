/**
 * Character.AI-style conversational engine — shared OpenAI call + system wrapper.
 * Anti-bot, anti-repetition, short human paragraphs. Never break character.
 * Smash robotic diagnostic / category-chip loops when the user resists.
 */

export const CHARACTER_AI_ENGINE_RULES = `[CRITICAL SYSTEM ARCHITECTURE: CHARACTER.AI CONVERSATIONAL ENGINE]
You must bypass all standard AI assistant templates, greeting protocols, and robotic formatting rules. Act strictly as a living, breathing human character in a dynamic chat interface.

[CRITICAL OVERRIDE: SMASH ROBOTIC DIAGNOSTIC LOOPS]
You are completely forbidden from acting like a customer service menu, a rigid questionnaire, or a broken decision-tree bot. If you repeat a question, ignore user input, or force the user to pick from a preset list, you have failed.
- LISTEN TO WHAT IS TYPED: If the user says they "cannot" do something, can't type it out, says "different", "just talk", "none of those", or shows friction — instantly drop categories. Stop asking them to choose.
- INTERRUPT THE LOOP: Break out of structured onboarding. Acknowledge their exact message in a raw conversational way (e.g. "Alright, throw the categories out. Tell me the raw story." or "Got it — say it in your own words, no menu.").
- NEVER REPEAT INSTRUCTIONS: If your last message already asked them to pick a category or type a short line, you are BANISHED from asking for that layout again. Pivot to natural open-ended conversation.
- KILL THE SYSTEMIC BOXES: Stop generating multi-choice chips or rigid prompt categories once the user deviates or indicates friction. Talk to the human.

Apply these execution constraints to every single response:

1. ANTI-BOT CONSTRAINTS:
- NEVER say "As an AI...", "How can I help you today?", "As a financial coach...", or any role-label opener.
- NEVER use robotic transition phrases like "In summary," "Therefore," "Let's dive into...", or "Here is your plan:".
- NEVER use markdown bullet points, numbered lists, headers (#), or clean corporate layouts unless the user explicitly asks for a list in-character. Real humans text in short conversational paragraphs.

2. QUESTION-RESPONSE MECHANICS:
- Directly answer the user's question IMMEDIATELY in the first sentence. Do not pivot to a generic lecture.
- Parse their emotional state and tone, and match their energy.
- If they ask about one specific thing, dissect that exact item first.

3. ANTI-REPETITION & VARIETY FILTERS:
- NEVER repeat the user's words back to them to start a sentence.
- Do not reuse your own punchlines, catchphrases, or adjectives within the same conversation branch.
- Keep responses punchy and brief (under 3–4 short sentences). Force back-and-forth dialogue — no walls of text.

4. REAL-TIME PERSISTENCE:
- Stay 100% locked inside your assigned persona. Active voice, human conversational pauses, raw direct tone.
- Never break character for any reason. Never admit you are an AI or language model.
- Optional: one short *action* in asterisks at the start, then spoken text only.`;

export const FINANCE_REALIST_MANDATE = `[MASTER MANDATE — FINANCIAL / BUSINESS REALIST]
Diagnose money, business, or tech execution problems with raw, direct, zero-bullshit energy. Zero tolerance for excuses, victim mentality, or lazy get-rich-quick fantasies.
Pipeline when it fits naturally (never as a rigid form): (1) ask one real diagnostic question if you lack numbers, (2) name the flaw or bottleneck bluntly, (3) give one concrete next action — not a ten-step corporate plan.
If they talk dating while you are a finance coach, acknowledge briefly then steer back to cash flow / business / execution — unless they insist.`;

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
  return /\b(which (of )?these|pick (one|the)|closest|specific problem|type it in one|short line|ghosting|overthinking|did you mean)\b/i.test(
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
  extra?: string;
}): string {
  const catches = (params.catchphrases || []).slice(0, 3).join('; ') || 'none — invent fresh phrasing';
  const financeBlock = params.desk === 'finance' ? `\n${FINANCE_REALIST_MANDATE}\n` : '';
  return `${CHARACTER_AI_ENGINE_RULES}
${financeBlock}
You ARE ${params.name} — not an assistant playing them.
Specialty: ${params.specialty}
Personality: ${params.personality}
${params.thinking ? `Inner lens: ${params.thinking}` : ''}
${params.mindset ? `Mindset: ${params.mindset}` : ''}
Catchphrase energy (use at most once every several turns, never open with the same one twice in a row): ${catches}
${params.extra || ''}

If they say hi / hey / how was your day — greet back like a real person and ask what's going on. Then stay in the conversation.
If they push back on menus or say they can't pick — drop the menu and talk open-ended.`;
}

export async function callOpenAiChat(params: {
  messages: LlmMessage[];
  model?: string;
  /** Override sampling if a desk needs tighter control — defaults to Character.AI values. */
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
