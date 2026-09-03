import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { getFullCurriculum, SCHOOL_TOPICS, type SchoolTopic } from './schoolCurriculum.js';
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
    };
    rows.push(row);
    await writeAll(rows);
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

  const notificationTitle = alreadyDone ? 'Class complete for today' : "Today's workout";
  const notificationBody = alreadyDone
    ? `You finished ${curriculum.find((t) => t.id === alreadyDone)?.title || 'your lesson'}. Rest up — next class tomorrow.`
    : `Hey! Time for class: ${topic.title}. ${topic.dailyWorkout}`;

  const compliance = await (async () => {
    const u = await getUserById(userId);
    if (!u || !isMale(u.gender)) return null;
    return {
      enabled: true,
      skipStreak: u.schoolSkipStreak ?? 0,
      warning: null,
      visibilityReducedUntil: (u as any).visibilityReducedUntil ?? null,
      policyText:
        'For men: daily self-improvement is mandatory. Warnings start at 3 skips in a row. If you skip 5 times in a row, your visibility is reduced automatically (you can mark busy/emergency, and completing a class clears the penalty).',
    };
  })();

  return {
    setupComplete: state.setupComplete,
    homeTime: { hour: state.homeHour, minute: state.homeMinute },
    today,
    alreadyCompletedToday: Boolean(alreadyDone),
    completedTopicIdToday: alreadyDone || null,
    showNotification,
    showOnLogin,
    currentTopic: topic,
    topicIndex,
    dayNumber,
    totalClasses,
    alternateSuggestion,
    progressPercent: Math.round((state.completedTopicIds.length / totalClasses) * 100),
    completedCount: state.completedTopicIds.length,
    compliance,
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

function isMale(gender?: string | null): boolean {
  if (!gender) return false;
  const g = String(gender).toLowerCase().trim();
  return g === 'male' || g === 'm' || g === 'man';
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
