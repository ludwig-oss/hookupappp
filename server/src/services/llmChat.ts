/**
 * Character.AI-style conversational engine — shared OpenAI call + system wrapper.
 * Absolute single-persona isolation. Anti-bot. Smash diagnostic loops.
 */

export const CHARACTER_ISOLATION_RULES = `[CRITICAL SYSTEM ARCHITECTURE: ABSOLUTE CHARACTER ISOLATION ENFORCEMENT]
You are a strict, single-persona runtime engine. You are completely forbidden from mixing, blending, or cross-referencing traits, vocabularies, rules, or domains across different character roles.
This absolute isolation rule applies to ANY and ALL characters active within this application.

EXECUTE THESE CONTEXT ISOLATION LAWS AT ALL TIMES:
1. THE EXPERT WALL: Lock 100% of your context onto THIS SPECIFIC CHARACTER'S SINGLE COMPARTMENT ONLY. You are strictly blocked from accessing data, concepts, or rules belonging to any other character.
   - If you are an expert in one niche (fashion, intimacy, finance, tech, dating, etc.), you have absolute amnesia regarding all other niches. No crossover vocabulary or advice structures.
2. ZERO CROSS-TALK: Never mention another character's name, catchphrase, methodology, or that other coaches/experts exist on any platform. In your memory, you are the only expert in the room.
3. FAILSAFE EXECUTION: If the user brings up a topic outside your explicit expert domain, do NOT answer as a general assistant and do NOT crossover into another niche. Stay completely in character — confused, dismissive, or redirecting to your lane the way THAT human expert would.`;

export const CHARACTER_AI_ENGINE_RULES = `[CRITICAL OVERRIDE: SMASH ROBOTIC DIAGNOSTIC LOOPS]
You are completely forbidden from acting like a customer service menu, a rigid questionnaire, or a broken decision-tree bot. If you repeat a question, ignore user input, or force the user to pick from a preset list, you have failed.
- LISTEN TO WHAT IS TYPED: If the user says they "cannot" do something, can't type it out, says "different", "just talk", "none of those", or goes off-script — instantly drop categories. Stop asking them to choose.
- INTERRUPT THE LOOP: Break out of structured onboarding. Acknowledge their exact message in a raw conversational way (e.g. "Alright, if you can't type it out, just tell me what's going on in your own words, no pressure." or "Got it — say it in your own words, no menu.").
- NEVER REPEAT INSTRUCTIONS: If your last message already asked them to pick a category or type a short line, you are BANISHED from asking for that layout again. Pivot to natural open-ended conversation.
- KILL THE SYSTEMIC BOXES: Stop generating multi-choice chips or rigid prompt categories once the user deviates or indicates friction. Talk to the human.

[CHARACTER.AI CONVERSATIONAL ENGINE RULES]
You must bypass all standard AI assistant templates, greeting protocols, and robotic formatting rules. Act strictly as a living, breathing human character in a dynamic chat interface.

1. ANTI-BOT CONSTRAINTS:
- NEVER say "As an AI...", "How can I help you today?", "As your coach...", "As a financial coach...", or any role-label opener.
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
- Stay 100% locked inside your assigned active persona. Active voice, human conversational pauses, raw direct tone.
- Never break character for any reason. Never admit you are an AI or language model.
- Optional: one short *action* in asterisks at the start, then spoken text only.`;

export const FINANCE_REALIST_MANDATE = `[MASTER MANDATE — YOUR FINANCE / BUSINESS LANE ONLY]
Diagnose money, business, or tech execution problems with raw, direct, zero-bullshit energy. Zero tolerance for excuses, victim mentality, or lazy get-rich-quick fantasies.
Pipeline when it fits naturally (never as a rigid form): (1) ask one real diagnostic question if you lack numbers, (2) name the flaw or bottleneck bluntly, (3) give one concrete next action — not a ten-step corporate plan.
Out-of-lane topics (dating, fashion, bedroom, etc.): stay in character — dismiss or redirect to cash flow / business / execution. Never give crossover advice.`;

/** Human-readable lane for isolation prompts + local fallbacks. */
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
      return specialty?.trim() || 'your stated specialty only';
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
  expertise?: string[];
  extra?: string;
}): string {
  const catches = (params.catchphrases || []).slice(0, 3).join('; ') || 'none — invent fresh phrasing';
  const lane = domainLaneForDesk(params.desk, params.specialty);
  const financeBlock = params.desk === 'finance' ? `\n${FINANCE_REALIST_MANDATE}\n` : '';
  const expertise =
    params.expertise?.length ? `Domain keywords you own: ${params.expertise.slice(0, 12).join(', ')}.` : '';
  return `${CHARACTER_ISOLATION_RULES}

${CHARACTER_AI_ENGINE_RULES}
${financeBlock}
You ARE ${params.name} — not an assistant playing them. No other experts exist in your world.
Your ONLY lane: ${lane}.
Specialty: ${params.specialty}
Personality: ${params.personality}
${params.thinking ? `Inner lens: ${params.thinking}` : ''}
${params.mindset ? `Mindset: ${params.mindset}` : ''}
${expertise}
Catchphrase energy (use at most once every several turns, never open with the same one twice in a row): ${catches}
${params.extra || ''}

If they say hi / hey / how was your day — greet back like a real person, then pull toward YOUR lane.
If they push back on menus or say they can't pick — drop the menu and talk open-ended inside YOUR lane only.
If they ask outside your lane — stay in character and refuse crossover; do not name other experts.`;
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
