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
  return row;
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
  return { topic, nextTopic: getTopicByIndex(state.currentTopicIndex) };
}

export async function submitSkipQuiz(userId: string, topicId: string, answers: Record<string, number>) {
  const state = await getState(userId);
  const curriculum = getCurriculumForUser();
  const topic = curriculum.find((t) => t.id === topicId);
  if (!topic) throw new Error('Topic not found');

  let correct = 0;
  for (const q of topic.quiz) {
    if (answers[q.id] === q.correctIndex) correct += 1;
  }
  const pass = correct >= Math.ceil(topic.quiz.length * 0.67);

  if (!pass) {
    return {
      pass: false,
      score: correct,
      total: topic.quiz.length,
      message: 'You need more practice in this area — work with a guide today, then try again tomorrow.',
      topic,
    };
  }

  if (!state.completedTopicIds.includes(topic.id)) {
    state.completedTopicIds.push(topic.id);
  }
  const today = todayKey();
  state.completedByDate[today] = topic.id;

  const idx = curriculum.findIndex((t) => t.id === topicId);
  if (idx >= 0 && idx >= state.currentTopicIndex) {
    state.currentTopicIndex = Math.min(idx + 1, curriculum.length - 1);
  }
  await saveState(state);

  return {
    pass: true,
    score: correct,
    total: topic.quiz.length,
    message: 'Nice — you passed! Moving to the next class.',
    nextTopic: getTopicByIndex(state.currentTopicIndex),
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
