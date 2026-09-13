import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { getFullCurriculum, type SchoolTopic } from './schoolCurriculum.js';
import { FINANCE_LESSONS, type FinanceLesson } from '../data/financeCurriculum.js';
import { getGuide } from '../data/aiGuideCatalog.js';
import { IMPROVEMENT_CATEGORIES } from './improvement.js';
import { getUserById, updateUserProfile } from './user.js';

export interface UserSchoolState {
  userId: string;
  homeHour: number;
  homeMinute: number;
  notifyEnabled: boolean;
  currentTopicIndex: number;
  completedTopicIds: string[];
  /** ISO date (YYYY-MM-DD) -> topicId completed that day */
  completedByDate: Record<string, string>;
  lastDismissedDate: string | null;
  setupComplete: boolean;
  /** Rotating finance literacy index (cycles through FINANCE_LESSONS). */
  financeTopicIndex: number;
  /** ISO date -> finance lesson id completed that day */
  financeCompletedByDate: Record<string, string>;
  /** Women opt-in; men always required regardless of this flag. */
  financeOptIn: boolean;
}

const PROGRESS_PATH = join(process.cwd(), 'server', 'data', 'school-progress.json');

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseTime(hour: number, minute: number): { hour: number; minute: number } {
  const h = Math.max(0, Math.min(23, Math.floor(hour)));
  const m = Math.max(0, Math.min(59, Math.floor(minute)));
  return { hour: h, minute: m };
}

async function readAll(): Promise<UserSchoolState[]> {
  try {
    const raw = await readFile(PROGRESS_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writeAll(rows: UserSchoolState[]): Promise<void> {
  const dir = join(process.cwd(), 'server', 'data');
  await import('fs/promises').then((fs) => fs.mkdir(dir, { recursive: true }));
  await writeFile(PROGRESS_PATH, JSON.stringify(rows, null, 2));
}

async function syncSetupFromUserProfile(state: UserSchoolState): Promise<UserSchoolState> {
  const user = await getUserById(state.userId);
  if (!user) return state;
  const hour = user.schoolHomeHour;
  const minute = user.schoolHomeMinute;
  const hasSchedule =
    typeof hour === 'number' &&
    typeof minute === 'number' &&
    !Number.isNaN(hour) &&
    !Number.isNaN(minute);
  if (!hasSchedule) return state;

  state.homeHour = hour;
  state.homeMinute = minute;
  state.notifyEnabled = user.schoolNotifyEnabled !== false;
  if (!state.setupComplete) {
    state.setupComplete = true;
    await saveState(state);
  }
  return state;
}

async function getState(userId: string): Promise<UserSchoolState> {
  const rows = await readAll();
  let row = rows.find((r) => r.userId === userId);
  if (!row) {
    row = {
      userId,
      homeHour: 19,
      homeMinute: 0,
      notifyEnabled: true,
      currentTopicIndex: 0,
      completedTopicIds: [],
      completedByDate: {},
      lastDismissedDate: null,
      setupComplete: false,
      financeTopicIndex: 0,
      financeCompletedByDate: {},
      financeOptIn: false,
    };
    rows.push(row);
    await writeAll(rows);
  } else {
    if (typeof row.financeTopicIndex !== 'number') row.financeTopicIndex = 0;
    if (!row.financeCompletedByDate || typeof row.financeCompletedByDate !== 'object') {
      row.financeCompletedByDate = {};
    }
    if (typeof row.financeOptIn !== 'boolean') row.financeOptIn = false;
  }
  return syncSetupFromUserProfile(row);
}

async function saveState(state: UserSchoolState): Promise<void> {
  const rows = await readAll();
  const i = rows.findIndex((r) => r.userId === state.userId);
  if (i >= 0) rows[i] = state;
  else rows.push(state);
  await writeAll(rows);
}

export function getCurriculumForUser(): SchoolTopic[] {
  return getFullCurriculum(IMPROVEMENT_CATEGORIES);
}

export function getTopicByIndex(index: number): SchoolTopic | null {
  const curriculum = getCurriculumForUser();
  if (index < 0 || index >= curriculum.length) return null;
  return curriculum[index];
}

function isInHomeWindow(state: UserSchoolState, now = new Date()): boolean {
  const mins = now.getHours() * 60 + now.getMinutes();
  const home = state.homeHour * 60 + state.homeMinute;
  const diff = mins - home;
  return diff >= -30 && diff <= 120;
}

async function suggestAlternateTopic(userId: string, current: SchoolTopic): Promise<SchoolTopic | null> {
  const user = await getUserById(userId);
  const cats = user?.improvementCategories || [];
  const curriculum = getCurriculumForUser();
  const alt = curriculum.find((t) => t.id !== current.id && cats.includes(t.guideCategoryId));
  return alt || curriculum.find((t) => t.id !== current.id) || null;
}

export async function getTodayLesson(userId: string) {
  const state = await getState(userId);
  const curriculum = getCurriculumForUser();
  const today = todayKey();
  const alreadyDone = state.completedByDate[today];

  let topicIndex = state.currentTopicIndex;
  if (topicIndex >= curriculum.length) topicIndex = curriculum.length - 1;
  if (topicIndex < 0) topicIndex = 0;

  let topic = curriculum[topicIndex];
  const user = await getUserById(userId);
  const userCats = user?.improvementCategories || [];

  let alternateSuggestion: SchoolTopic | null = null;
  if (userCats.length > 0 && !userCats.includes(topic.guideCategoryId)) {
    alternateSuggestion = await suggestAlternateTopic(userId, topic);
  }

  const dayNumber = topic.day;
  const totalClasses = curriculum.length;
  const canNudge = state.setupComplete && state.notifyEnabled && !alreadyDone && state.lastDismissedDate !== today;
  const showNotification = canNudge && isInHomeWindow(state);
  const showOnLogin = canNudge;

  const male = user ? isMale(user.gender) : false;
  const finance = buildFinanceBlock(state, male);

  const compliance = await (async () => {
    const u = await getUserById(userId);
    if (!u || !isMale(u.gender)) return null;
    return {
      enabled: true,
      skipStreak: u.schoolSkipStreak ?? 0,
      warning: null,
      visibilityReducedUntil: (u as any).visibilityReducedUntil ?? null,
      policyText:
        'For men: daily self-improvement and the 10-minute financial literacy lesson are mandatory. Warnings start at 3 skips in a row. If you skip 5 times in a row, your visibility is reduced automatically (you can mark busy/emergency, and completing a class or finance quiz clears the penalty).',
    };
  })();

  const financeNeedsNudge = Boolean(finance.required && !finance.alreadyCompletedToday);
  const showNotificationFinance =
    state.setupComplete && state.notifyEnabled && financeNeedsNudge && state.lastDismissedDate !== today && isInHomeWindow(state);
  const showOnLoginFinance = state.setupComplete && state.notifyEnabled && financeNeedsNudge && state.lastDismissedDate !== today;

  return {
    setupComplete: state.setupComplete,
    homeTime: { hour: state.homeHour, minute: state.homeMinute },
    today,
    alreadyCompletedToday: Boolean(alreadyDone),
    completedTopicIdToday: alreadyDone || null,
    showNotification: showNotification || showNotificationFinance,
    showOnLogin: showOnLogin || showOnLoginFinance,
    currentTopic: topic,
    topicIndex,
    dayNumber,
    totalClasses,
    alternateSuggestion,
    progressPercent: Math.round((state.completedTopicIds.length / totalClasses) * 100),
    completedCount: state.completedTopicIds.length,
    compliance,
    finance,
  };
}

function isMale(gender?: string | null): boolean {
  if (!gender) return false;
  const g = String(gender).toLowerCase().trim();
  return g === 'male' || g === 'm' || g === 'man';
}

function financeLessonAt(index: number): FinanceLesson {
  const n = FINANCE_LESSONS.length;
  const i = ((index % n) + n) % n;
  return FINANCE_LESSONS[i];
}

function buildFinanceBlock(state: UserSchoolState, male: boolean) {
  const today = todayKey();
  const lesson = financeLessonAt(state.financeTopicIndex);
  const doneId = state.financeCompletedByDate[today] || null;
  const guide = getGuide(lesson.guideId);
  const required = male || (!male && state.financeOptIn);
  return {
    required,
    optionalAvailable: !male,
    optIn: state.financeOptIn,
    alreadyCompletedToday: Boolean(doneId),
    completedLessonIdToday: doneId,
    lesson: {
      id: lesson.id,
      day: lesson.day,
      title: lesson.title,
      minutes: lesson.minutes,
      guideId: lesson.guideId,
      guideName: guide?.name || null,
      summary: lesson.summary,
      teach: lesson.teach,
      workout: lesson.workout,
      quiz: lesson.quiz.map((q) => ({
        id: q.id,
        question: q.question,
        options: q.options,
      })),
    },
    dayNumber: lesson.day,
    totalLessons: FINANCE_LESSONS.length,
    policyText: male
      ? 'Mandatory for men: ~10 minutes of financial literacy every day, then pass the check questions.'
      : 'Optional: opt in anytime for a daily ~10-minute money lesson with a short quiz.',
  };
}

export async function setFinanceOptIn(userId: string, optIn: boolean) {
  const state = await getState(userId);
  const user = await getUserById(userId);
  const male = Boolean(user && isMale(user.gender));
  if (male) {
    state.financeOptIn = true;
  } else {
    state.financeOptIn = Boolean(optIn);
  }
  await saveState(state);
  return buildFinanceBlock(state, male);
}

/** Pass = at least 2 of 3 correct. Advances the finance curriculum on success. */
export async function submitFinanceQuiz(userId: string, lessonId: string, answers: Record<string, number>) {
  const state = await getState(userId);
  const user = await getUserById(userId);
  const male = Boolean(user && isMale(user.gender));
  const finance = buildFinanceBlock(state, male);
  if (!finance.required) {
    throw new Error('Finance track is not enabled for your account. Women can opt in first.');
  }

  const lesson = FINANCE_LESSONS.find((l) => l.id === lessonId) || financeLessonAt(state.financeTopicIndex);
  if (lesson.id !== lessonId && lessonId) {
    const found = FINANCE_LESSONS.find((l) => l.id === lessonId);
    if (!found) throw new Error('Finance lesson not found');
  }
  const active = FINANCE_LESSONS.find((l) => l.id === lessonId) || lesson;

  let correct = 0;
  for (const q of active.quiz) {
    if (answers[q.id] === q.correctIndex) correct += 1;
  }
  const total = active.quiz.length;
  const pass = correct >= Math.max(2, Math.ceil(total * 0.66));

  if (!pass) {
    return {
      pass: false,
      score: correct,
      total,
      message: `Not yet — you got ${correct}/${total}. Re-read the ${active.minutes}-minute lesson and try again.`,
      finance: buildFinanceBlock(state, male),
    };
  }

  const today = todayKey();
  state.financeCompletedByDate[today] = active.id;
  // Advance only once per day when completing the current index lesson.
  if (active.id === financeLessonAt(state.financeTopicIndex).id) {
    state.financeTopicIndex = (state.financeTopicIndex + 1) % FINANCE_LESSONS.length;
  }
  await saveState(state);
  await recordMaleCompletion(userId);

  return {
    pass: true,
    score: correct,
    total,
    message: `Solid. ${correct}/${total} — money lesson locked for today.`,
    finance: buildFinanceBlock(state, male),
  };
}

export async function saveSchedule(userId: string, homeHour: number, homeMinute: number, notifyEnabled = true) {
  const state = await getState(userId);
  const t = parseTime(homeHour, homeMinute);
  state.homeHour = t.hour;
  state.homeMinute = t.minute;
  state.notifyEnabled = notifyEnabled;
  state.setupComplete = true;
  await saveState(state);
  await updateUserProfile(userId, {
    schoolHomeHour: t.hour,
    schoolHomeMinute: t.minute,
    schoolNotifyEnabled: notifyEnabled,
  } as any);
  return state;
}

export async function dismissNotification(userId: string) {
  const state = await getState(userId);
  state.lastDismissedDate = todayKey();
  await saveState(state);
  const compliance = await recordMaleSkip(userId, 'dismiss');
  return compliance;
}

export async function dismissWithException(userId: string, reason: 'work' | 'busy' | 'emergency') {
  const state = await getState(userId);
  state.lastDismissedDate = todayKey();
  await saveState(state);
  const compliance = await recordMaleSkip(userId, 'exception');
  return {
    ok: true,
    message:
      reason === 'emergency'
        ? 'Emergency exception recorded. Stay safe — your improvement streak is not counted as skipped today.'
        : 'Busy exception recorded. Your improvement streak is not counted as skipped today.',
    compliance,
  };
}

export interface ImprovementComplianceStatus {
  enabled: boolean;
  skipStreak: number;
  warning: string | null;
  visibilityReducedUntil: string | null;
}

async function recordMaleSkip(userId: string, kind: 'dismiss' | 'exception'): Promise<ImprovementComplianceStatus | null> {
  const u = await getUserById(userId);
  if (!u || !isMale(u.gender)) return null;

  const today = todayKey();
  const prevDate = u.schoolSkipLastDate || null;
  const prevStreak = typeof u.schoolSkipStreak === 'number' ? u.schoolSkipStreak : 0;
  const prevTotal = typeof u.schoolSkipTotal === 'number' ? u.schoolSkipTotal : 0;

  // Exceptions don't count as skips, but still mark the day as dismissed.
  if (kind === 'exception') {
    await updateUserProfile(userId, {
      schoolSkipExceptionLastDate: today,
    } as any);
    return {
      enabled: true,
      skipStreak: prevStreak,
      warning: null,
      visibilityReducedUntil: (u as any).visibilityReducedUntil ?? null,
    };
  }

  // Only count once per day.
  if (prevDate === today) {
    return {
      enabled: true,
      skipStreak: prevStreak,
      warning: null,
      visibilityReducedUntil: (u as any).visibilityReducedUntil ?? null,
    };
  }

  const nextStreak = prevStreak + 1;
  const nextTotal = prevTotal + 1;

  let warning: string | null = null;
  if (nextStreak === 3) warning = 'Warning (3/5): skipping your daily improvement reduces trust. Keep it real — do your daily work.';
  if (nextStreak === 4) warning = 'Warning (4/5): one more skip and your visibility will be reduced automatically.';
  if (nextStreak >= 5) warning = 'Consequence: your visibility is now reduced until you complete daily improvement again.';

  const updates: any = {
    schoolSkipLastDate: today,
    schoolSkipStreak: Math.min(nextStreak, 99),
    schoolSkipTotal: nextTotal,
  };

  if (nextStreak >= 5) {
    // Reduced discovery visibility for 30 days (clears early when they complete a class).
    updates.visibilityReducedUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    updates.visibilityReducedReason = 'Skipped daily improvement 5+ times in a row';
  }

  await updateUserProfile(userId, updates);

  return {
    enabled: true,
    skipStreak: nextStreak,
    warning,
    visibilityReducedUntil: updates.visibilityReducedUntil ?? (u as any).visibilityReducedUntil ?? null,
  };
}

async function recordMaleCompletion(userId: string): Promise<void> {
  const u = await getUserById(userId);
  if (!u || !isMale(u.gender)) return;
  const updates: any = {
    schoolSkipStreak: 0,
  };
  // Clear visibility penalty early once they resume improvement.
  if ((u as any).visibilityReducedReason && String((u as any).visibilityReducedReason).includes('Skipped daily improvement')) {
    updates.visibilityReducedUntil = null;
    updates.visibilityReducedReason = null;
  }
  await updateUserProfile(userId, updates);
}

export async function completeToday(userId: string) {
  const state = await getState(userId);
  const curriculum = getCurriculumForUser();
  const topic = curriculum[state.currentTopicIndex];
  if (!topic) throw new Error('No active class');

  const today = todayKey();
  state.completedByDate[today] = topic.id;
  if (!state.completedTopicIds.includes(topic.id)) {
    state.completedTopicIds.push(topic.id);
  }
  if (state.currentTopicIndex < curriculum.length - 1) {
    state.currentTopicIndex += 1;
  }
  await saveState(state);
  await recordMaleCompletion(userId);
  return { topic, nextTopic: getTopicByIndex(state.currentTopicIndex) };
}

export async function submitSkipQuiz(_userId: string, topicId: string, answers: Record<string, number>) {
  const curriculum = getCurriculumForUser();
  const topic = curriculum.find((t) => t.id === topicId);
  if (!topic) throw new Error('Topic not found');

  let correct = 0;
  for (const q of topic.quiz) {
    if (answers[q.id] === q.correctIndex) correct += 1;
  }

  return {
    pass: false,
    score: correct,
    total: topic.quiz.length,
    message: 'Skipping a class is no longer available. Every user works with a guide — you cannot quiz past this.',
    topic,
  };
}

export async function jumpToTopic(userId: string, topicId: string) {
  const state = await getState(userId);
  const curriculum = getCurriculumForUser();
  const idx = curriculum.findIndex((t) => t.id === topicId);
  if (idx < 0) throw new Error('Topic not found');
  state.currentTopicIndex = idx;
  await saveState(state);
  return curriculum[idx];
}
