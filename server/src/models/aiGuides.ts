import { getUserById, updateUserProfile } from './user.js';
import { getGuideProgramStatus } from './guideProgram.js';
import {
  AI_GUIDES,
  getGuide,
  getLesson,
  guidesForLesson,
  interpretQuery,
  resolveLessonForGuide,
} from '../data/aiGuideCatalog.js';

export async function listAiGuides() {
  return AI_GUIDES.map((g) => ({
    ...g,
    thinking: g.thinking,
  }));
}

export async function interpretAiQuery(query: string) {
  const matches = interpretQuery(query);
  const top = matches[0];
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
  const guideId = (user as any)?.aiGuideId as string | undefined;
  if (!guideId) return { guide: null };
  return { guide: getGuide(guideId) };
}
