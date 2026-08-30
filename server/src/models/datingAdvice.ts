import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

/** Who should answer this question (same love-interest peer group). */
export type AdviceAnswerCohort =
  | 'straight_male'
  | 'straight_female'
  | 'gay_male'
  | 'lesbian_female'
  | 'bi_male'
  | 'bi_female'
  | 'bi_other'
  | 'pan_all';

export interface AdviceReply {
  id: string;
  userId: string;
  userName: string;
  content: string;
  likeUserIds: string[];
  createdAt: string;
}

export interface AdviceAnswer {
  id: string;
  userId: string;
  userName: string;
  content: string;
  likeUserIds: string[];
  replies: AdviceReply[];
  createdAt: string;
}

export interface AdviceQuestion {
  id: string;
  userId: string;
  query: string;
  answerCohort: AdviceAnswerCohort;
  orientation: string;
  askerGender: string;
  lookingFor: string[];
  answers: AdviceAnswer[];
  city?: string;
  country?: string;
  lat?: number;
  lon?: number;
  monthKey: string;
  createdAt: string;
  winnerAnswerId?: string | null;
  winnerPaidAt?: string | null;
}

export interface AdviceUserMeta {
  userId: string;
  adviceCommentCount: number;
  firstCommentNotified: boolean;
}

const QUESTIONS_PATH = join(process.cwd(), 'server', 'data', 'advice-questions.json');
const META_PATH = join(process.cwd(), 'server', 'data', 'advice-user-meta.json');
const PAYOUTS_PATH = join(process.cwd(), 'server', 'data', 'advice-monthly-payouts.json');

export const ADVICE_PRIZE_EUR = 5;
export const ADVICE_GLOBAL_ENGAGEMENT = 5;

export function normalizeGender(g?: string | null): string {
  const g2 = (g || '').trim().toLowerCase();
  if (g2 === 'm' || g2 === 'man' || g2 === 'male') return 'male';
  if (g2 === 'f' || g2 === 'woman' || g2 === 'female') return 'female';
  return g2 || 'unknown';
}

/** Map asker gender + orientation → peer group that should answer. */
export function computeAnswerCohort(
  orientation: string,
  gender: string | null | undefined
): AdviceAnswerCohort {
  const g = normalizeGender(gender);
  const o = (orientation || 'straight').toLowerCase();

  if (o === 'pansexual') return 'pan_all';
  if (o === 'bisexual') {
    if (g === 'male') return 'bi_male';
    if (g === 'female') return 'bi_female';
    return 'bi_other';
  }
  if (o === 'gay') return g === 'female' ? 'bi_other' : 'gay_male';
  if (o === 'lesbian') return g === 'male' ? 'bi_other' : 'lesbian_female';
  if (g === 'male') return 'straight_male';
  if (g === 'female') return 'straight_female';
  return 'pan_all';
}

export function cohortLabel(c: AdviceAnswerCohort): string {
  const labels: Record<AdviceAnswerCohort, string> = {
    straight_male: 'straight guys',
    straight_female: 'straight girls',
    gay_male: 'gay guys',
    lesbian_female: 'lesbian women',
    bi_male: 'bi guys',
    bi_female: 'bi women',
    bi_other: 'bi / other',
    pan_all: 'everyone',
  };
  return labels[c] || c;
}

function monthKey(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

async function readQuestions(): Promise<AdviceQuestion[]> {
  try {
    return JSON.parse(await readFile(QUESTIONS_PATH, 'utf-8'));
  } catch {
    return [];
  }
}

async function writeQuestions(list: AdviceQuestion[]): Promise<void> {
  const dir = join(process.cwd(), 'server', 'data');
  await mkdir(dir, { recursive: true });
  await writeFile(QUESTIONS_PATH, JSON.stringify(list, null, 2));
}

async function readMeta(): Promise<AdviceUserMeta[]> {
  try {
    return JSON.parse(await readFile(META_PATH, 'utf-8'));
  } catch {
    return [];
  }
}

async function writeMeta(list: AdviceUserMeta[]): Promise<void> {
  const dir = join(process.cwd(), 'server', 'data');
  await mkdir(dir, { recursive: true });
  await writeFile(META_PATH, JSON.stringify(list, null, 2));
}

async function readPayoutLog(): Promise<string[]> {
  try {
    return JSON.parse(await readFile(PAYOUTS_PATH, 'utf-8'));
  } catch {
    return [];
  }
}

async function writePayoutLog(keys: string[]): Promise<void> {
  const dir = join(process.cwd(), 'server', 'data');
  await mkdir(dir, { recursive: true });
  await writeFile(PAYOUTS_PATH, JSON.stringify(keys, null, 2));
}

export async function createAdviceQuestion(params: {
  userId: string;
  query: string;
  orientation: string;
  gender: string | null | undefined;
  lookingFor: string[];
  city?: string;
  country?: string;
  lat?: number;
  lon?: number;
}): Promise<AdviceQuestion> {
  const questions = await readQuestions();
  const q: AdviceQuestion = {
    id: Date.now().toString() + Math.random().toString(36).slice(2, 5),
    userId: params.userId,
    query: params.query.trim(),
    answerCohort: computeAnswerCohort(params.orientation, params.gender),
    orientation: params.orientation,
    askerGender: normalizeGender(params.gender),
    lookingFor: params.lookingFor,
    city: params.city?.trim(),
    country: params.country?.trim(),
    lat: params.lat,
    lon: params.lon,
    answers: [],
    monthKey: monthKey(),
    createdAt: new Date().toISOString(),
  };
  questions.unshift(q);
  await writeQuestions(questions);
  return q;
}

export async function getQuestionById(id: string): Promise<AdviceQuestion | null> {
  const questions = normalizeAnswers(await readQuestions());
  return questions.find((q) => q.id === id) || null;
}

function normalizeAnswers(list: AdviceQuestion[]): AdviceQuestion[] {
  for (const q of list) {
    for (const a of q.answers) {
      if (!Array.isArray(a.replies)) a.replies = [];
    }
  }
  return list;
}

function engagementScore(q: AdviceQuestion): number {
  let score = 0;
  for (const a of q.answers) {
    score += 2 + a.likeUserIds.length;
    for (const r of a.replies || []) {
      score += 1 + r.likeUserIds.length;
    }
  }
  return score;
}

function isLocalQuestion(
  q: AdviceQuestion,
  viewerCity?: string,
  viewerCountry?: string
): boolean {
  const vc = (viewerCity || '').toLowerCase().trim();
  const vco = (viewerCountry || '').toLowerCase().trim();
  const qc = (q.city || '').toLowerCase().trim();
  const qco = (q.country || '').toLowerCase().trim();
  if (vc && qc && (vc.includes(qc) || qc.includes(vc))) return true;
  if (vco && qco && (vco === qco || vco.includes(qco) || qco.includes(vco))) return true;
  return !vc && !vco;
}

export async function getRankedAdviceFeed(
  cohort: AdviceAnswerCohort,
  viewerCity?: string,
  viewerCountry?: string,
  limit = 50
): Promise<AdviceQuestion[]> {
  let list = normalizeAnswers(await readQuestions());
  list = list.filter(
    (q) => q.answerCohort === cohort || cohort === 'pan_all' || q.answerCohort === 'pan_all'
  );
  list = list.filter((q) => {
    if (isLocalQuestion(q, viewerCity, viewerCountry)) return true;
    return engagementScore(q) >= ADVICE_GLOBAL_ENGAGEMENT;
  });
  list.sort((a, b) => {
    const aLocal = isLocalQuestion(a, viewerCity, viewerCountry) ? 1 : 0;
    const bLocal = isLocalQuestion(b, viewerCity, viewerCountry) ? 1 : 0;
    if (aLocal !== bLocal) return bLocal - aLocal;
    const eng = engagementScore(b) - engagementScore(a);
    if (eng !== 0) return eng;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
  return list.slice(0, limit);
}

export async function getQuestionsForCohort(cohort: AdviceAnswerCohort, limit = 50): Promise<AdviceQuestion[]> {
  return getRankedAdviceFeed(cohort, undefined, undefined, limit);
}

export async function searchQuestions(
  query: string,
  cohort?: AdviceAnswerCohort,
  viewerCity?: string,
  viewerCountry?: string
): Promise<AdviceQuestion[]> {
  const q = query.trim().toLowerCase();
  let list = normalizeAnswers(await readQuestions());
  if (cohort) {
    list = list.filter((x) => x.answerCohort === cohort || x.answerCohort === 'pan_all' || cohort === 'pan_all');
  }
  if (q) {
    list = list.filter((x) => x.query.toLowerCase().includes(q));
  }
  list = list.filter((item) => {
    if (isLocalQuestion(item, viewerCity, viewerCountry)) return true;
    return engagementScore(item) >= ADVICE_GLOBAL_ENGAGEMENT;
  });
  list.sort((a, b) => {
    const aLocal = isLocalQuestion(a, viewerCity, viewerCountry) ? 1 : 0;
    const bLocal = isLocalQuestion(b, viewerCity, viewerCountry) ? 1 : 0;
    if (aLocal !== bLocal) return bLocal - aLocal;
    return engagementScore(b) - engagementScore(a);
  });
  return list.slice(0, 30);
}

export async function addAdviceAnswer(
  questionId: string,
  answer: Omit<AdviceAnswer, 'id' | 'likeUserIds' | 'createdAt' | 'replies'>
): Promise<{ question: AdviceQuestion; answer: AdviceAnswer; firstComment: boolean } | null> {
  const questions = await readQuestions();
  const qi = questions.findIndex((q) => q.id === questionId);
  if (qi === -1) return null;

  const entry: AdviceAnswer = {
    ...answer,
    id: Date.now().toString(),
    likeUserIds: [],
    replies: [],
    createdAt: new Date().toISOString(),
  };
  questions[qi].answers.push(entry);
  await writeQuestions(questions);

  const metaList = await readMeta();
  let meta = metaList.find((m) => m.userId === answer.userId);
  const firstComment = !meta || meta.adviceCommentCount === 0;
  if (!meta) {
    meta = { userId: answer.userId, adviceCommentCount: 0, firstCommentNotified: false };
    metaList.push(meta);
  }
  meta.adviceCommentCount += 1;
  await writeMeta(metaList);

  return { question: questions[qi], answer: entry, firstComment };
}

export async function addAdviceReply(
  questionId: string,
  answerId: string,
  reply: Omit<AdviceReply, 'id' | 'likeUserIds' | 'createdAt'>
): Promise<{ question: AdviceQuestion; reply: AdviceReply } | null> {
  const questions = normalizeAnswers(await readQuestions());
  const qi = questions.findIndex((q) => q.id === questionId);
  if (qi === -1) return null;
  const ai = questions[qi].answers.findIndex((a) => a.id === answerId);
  if (ai === -1) return null;
  const entry: AdviceReply = {
    ...reply,
    id: Date.now().toString() + Math.random().toString(36).slice(2, 4),
    likeUserIds: [],
    createdAt: new Date().toISOString(),
  };
  if (!questions[qi].answers[ai].replies) questions[qi].answers[ai].replies = [];
  questions[qi].answers[ai].replies.push(entry);
  await writeQuestions(questions);
  return { question: questions[qi], reply: entry };
}

export async function likeAdviceReply(
  questionId: string,
  answerId: string,
  replyId: string,
  likerUserId: string
): Promise<AdviceReply | null> {
  const questions = normalizeAnswers(await readQuestions());
  const q = questions.find((x) => x.id === questionId);
  if (!q) return null;
  const a = q.answers.find((x) => x.id === answerId);
  if (!a) return null;
  const r = (a.replies || []).find((x) => x.id === replyId);
  if (!r) return null;
  if (!r.likeUserIds.includes(likerUserId)) r.likeUserIds.push(likerUserId);
  await writeQuestions(questions);
  return r;
}

export async function likeAdviceAnswer(
  questionId: string,
  answerId: string,
  likerUserId: string
): Promise<AdviceAnswer | null> {
  const questions = normalizeAnswers(await readQuestions());
  const q = questions.find((x) => x.id === questionId);
  if (!q) return null;
  const a = q.answers.find((x) => x.id === answerId);
  if (!a) return null;
  if (!a.likeUserIds.includes(likerUserId)) a.likeUserIds.push(likerUserId);
  await writeQuestions(questions);
  return a;
}

/** Users in same cohort who should be notified (excluding asker). */
export async function getUsersInCohort(cohort: AdviceAnswerCohort, excludeUserId: string): Promise<string[]> {
  const { readPreferences } = await import('./discover.js');
  const { getUserById } = await import('./user.js');
  const prefs = await readPreferences();
  const ids: string[] = [];

  for (const p of prefs) {
    if (p.userId === excludeUserId) continue;
    const u = await getUserById(p.userId);
    if (!u) continue;
    const c = computeAnswerCohort(p.orientation, u.gender);
    if (c === cohort || cohort === 'pan_all' || c === 'pan_all') {
      ids.push(p.userId);
    }
  }
  return ids;
}

export async function markFirstCommentNotified(userId: string): Promise<void> {
  const metaList = await readMeta();
  const meta = metaList.find((m) => m.userId === userId);
  if (meta) meta.firstCommentNotified = true;
  else metaList.push({ userId, adviceCommentCount: 1, firstCommentNotified: true });
  await writeMeta(metaList);
}

/** Run monthly €5 payout per cohort for previous month (idempotent). */
export async function runMonthlyAdvicePayouts(): Promise<
  Array<{ cohort: AdviceAnswerCohort; winnerUserId: string; answerId: string; amountEur: number }>
> {
  const now = new Date();
  const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const targetMonth = monthKey(prev);
  const payoutKey = `paid:${targetMonth}`;
  const log = await readPayoutLog();
  if (log.includes(payoutKey)) return [];

  const questions = await readQuestions();
  const monthQs = questions.filter((q) => q.monthKey === targetMonth);
  const cohorts: AdviceAnswerCohort[] = [
    'straight_male',
    'straight_female',
    'gay_male',
    'lesbian_female',
    'bi_male',
    'bi_female',
    'bi_other',
    'pan_all',
  ];

  const { creditAdvicePrize } = await import('./guideWallet.js');
  const winners: Array<{ cohort: AdviceAnswerCohort; winnerUserId: string; answerId: string; amountEur: number }> = [];

  for (const cohort of cohorts) {
    const cohortQs = monthQs.filter((q) => q.answerCohort === cohort);
    let best: { userId: string; answerId: string; likes: number; questionId: string } | null = null;

    for (const q of cohortQs) {
      for (const a of q.answers) {
        const likes = a.likeUserIds.length;
        if (!best || likes > best.likes) {
          best = { userId: a.userId, answerId: a.id, likes, questionId: q.id };
        }
      }
    }

    if (!best || best.likes < 1) continue;

    await creditAdvicePrize(best.userId, ADVICE_PRIZE_EUR, best.answerId, cohort, targetMonth);

    const qi = questions.findIndex((x) => x.id === best!.questionId);
    if (qi >= 0) {
      questions[qi].winnerAnswerId = best.answerId;
      questions[qi].winnerPaidAt = new Date().toISOString();
    }

    winners.push({
      cohort,
      winnerUserId: best.userId,
      answerId: best.answerId,
      amountEur: ADVICE_PRIZE_EUR,
    });
  }

  if (winners.length) {
    await writeQuestions(questions);
    await writePayoutLog([...log, payoutKey]);
  }

  return winners;
}

export { monthKey };
