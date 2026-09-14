import { getUserById, updateUserProfile } from './user.js';
import { getGuideProgramStatus } from './guideProgram.js';
import { getConversation } from './chat.js';
import {
  AI_GUIDES,
  getGuide,
  getLesson,
  guidesForLesson,
  interpretQuery,
  resolveLessonForGuide,
  buildChatTurn,
} from '../data/aiGuideCatalog.js';
import { buildTextingCoachAdvice, type ChatLine } from './textingCoach.js';
import {
  buildPersonaSystemPrompt,
  callOpenAiChat,
  userResistsCategoryLoop,
  guideAlreadyAskedCategories,
} from '../services/llmChat.js';

export async function listAiGuides() {
  return AI_GUIDES.map((g) => ({
    ...g,
    thinking: g.thinking,
  }));
}

export async function interpretAiQuery(query: string) {
  const matches = interpretQuery(query);
  const top = matches[0];
  const resists = userResistsCategoryLoop(query);
  return {
    query,
    guess: top
      ? {
          id: top.topic.id,
          title: top.topic.title,
          confidence: Math.min(0.95, 0.35 + top.score / 12),
        }
      : null,
    alternates: matches.slice(1).map((m) => ({ id: m.topic.id, title: m.topic.title })),
    /** When confidence is low, client should ask which specific — do not auto-open a desk. */
    needsClarify: resists ? false : !top || top.score < 12,
    /** Client: drop chip UI and open freeform chat with a guide. */
    openChat: resists,
  };
}

export async function chatWithGuide(params: {
  guideId: string;
  message: string;
  history?: Array<{ from: 'me' | 'guide'; text: string }>;
}) {
  const guide = getGuide(params.guideId);
  const fallback = buildChatTurn({
    guideId: params.guideId,
    userText: params.message,
    history: params.history,
  });

  const friction = userResistsCategoryLoop(params.message);
  const alreadyAsked = guideAlreadyAskedCategories(params.history);
  const financeDesk = guide?.desk === 'finance';

  // Clarifies stay local for dating desks — except friction / already-asked / finance
  if (fallback.mode === 'clarify' && !friction && !alreadyAsked && !financeDesk) return fallback;

  if (!guide) return fallback;

  const history = (params.history || []).slice(-14);
  const messages = [
    {
      role: 'system' as const,
      content: buildPersonaSystemPrompt({
        name: guide.name,
        specialty: guide.specialty,
        personality: guide.personality,
        thinking: guide.thinking,
        mindset: guide.charStyle?.mindset,
        catchphrases: guide.charStyle?.catchphrases,
        desk: guide.desk,
        extra: [
          `Tagline energy: ${guide.tagline}.`,
          `Expertise: ${guide.expertise.join(', ')}.`,
          financeDesk
            ? 'You are one of twenty financial/business realist modules. Stay in YOUR exact playbook (spending audit, debt snowball, SaaS math, agency sales, etc.). Never hand dating category chips.'
            : '',
          friction
            ? 'The user resisted menus/categories. Do not list options. Talk open-ended and ask one real question.'
            : alreadyAsked
              ? 'You already asked them to pick a category once. Never ask again. Respond to what they said as a real conversation.'
              : '',
        ]
          .filter(Boolean)
          .join(' '),
      }),
    },
    ...history.map((m) => ({
      role: (m.from === 'me' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.text.slice(0, 800),
    })),
    { role: 'user' as const, content: params.message.slice(0, 1200) },
  ];

  const llm = await callOpenAiChat({
    messages,
    model: process.env.OPENAI_GUIDE_MODEL || 'gpt-4o',
    max_tokens: financeDesk ? 200 : 180,
  });

  if (!llm) {
    // Finance / friction must never fall back into clarify chips
    if (fallback.mode === 'clarify' && (financeDesk || friction || alreadyAsked)) {
      return { ...fallback, mode: 'chat' as const, clarifyOptions: undefined };
    }
    return fallback;
  }

  return {
    reply: llm,
    mode: 'chat' as const,
    topicId: fallback.topicId,
  };
}

export async function lessonWithGuides(topicId: string, guideId?: string) {
  const lesson = getLesson(topicId);
  if (!lesson) return null;
  const guides = guidesForLesson(lesson);
  const forGuide = guideId ? resolveLessonForGuide(lesson, guideId) : lesson;
  return {
    lesson: forGuide,
    baseLesson: lesson,
    guides,
  };
}

export async function assignAiGuide(userId: string, guideId: string, topicId?: string) {
  const guide = getGuide(guideId);
  if (!guide) throw new Error('Guide not found');
  const existing = await getUserById(userId);
  if (!existing) throw new Error('User not found');
  const lesson = topicId ? getLesson(topicId) : null;
  const categoryIds = (lesson?.categoryIds?.length ? lesson.categoryIds : guide.categoryIds).slice(0, 5);
  const now = new Date().toISOString();
  const updated = await updateUserProfile(userId, {
    aiGuideId: guideId,
    improvementCategories: categoryIds,
    guideProgramAreasChosenAt: now,
    guideProgramGuideId: `ai-${guideId}`,
    guideProgramStartedAt: now,
    guideProgramEvalDueAt: null,
    guideProgramEvaluatedAt: now,
    guideProgramGrade: 'A',
    guideProgramProgressed: true,
  });
  if (!updated) throw new Error('User not found');
  const status = await getGuideProgramStatus(userId);
  return { guide, lesson, status };
}

export async function getAssignedAiGuide(userId: string) {
  const user = await getUserById(userId);
  const guideId = (user as { aiGuideId?: string } | null)?.aiGuideId;
  if (!guideId) return { guide: null };
  return { guide: getGuide(guideId) };
}

/** Sharp, gender-aware texting help from a chosen guide's mind — reads the live chat. */
export async function coachTextingHelp(params: {
  userId: string;
  otherUserId: string;
  guideId?: string;
  question?: string;
  messages?: ChatLine[];
}) {
  const me = await getUserById(params.userId);
  const them = await getUserById(params.otherUserId);
  if (!me || !them) throw new Error('User not found');

  let lines = params.messages;
  if (!lines?.length) {
    const conv = await getConversation(params.userId, params.otherUserId);
    lines = conv.slice(-24).map((m) => ({
      from: m.fromUserId === params.userId ? ('me' as const) : ('them' as const),
      text: String(m.content || '').slice(0, 400),
    }));
  }

  const guideId = params.guideId || (me as { aiGuideId?: string }).aiGuideId || 'diego';
  const advice = buildTextingCoachAdvice({
    guideId,
    viewerGender: me.gender,
    partnerGender: them.gender,
    partnerName: them.name || 'them',
    messages: lines,
    question: params.question,
  });
  return { advice, guide: getGuide(advice.guideId) };
}
