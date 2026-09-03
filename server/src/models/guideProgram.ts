import { getUserById, updateUserProfile, type User } from './user.js';
import { getGuideByUserId, getRequestsByUserId, getRequestsByGuideId, IMPROVEMENT_CATEGORIES, COUPLE_GUIDE_CATEGORY_IDS } from './improvement.js';

const TWO_MONTHS_MS = 60 * 24 * 60 * 60 * 1000;
const MAX_CATEGORIES = 5;

export type GuideProgramGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface GuideProgramStatus {
  isGuide: boolean;
  needsOnboarding: boolean;
  needsGuidePick: boolean;
  waitingOnEval: boolean;
  needsCoupleGuide: boolean;
  canUseApp: boolean;
  categoryIds: string[];
  startedAt: string | null;
  evalDueAt: string | null;
  evaluatedAt: string | null;
  grade: string | null;
  progressed: boolean | null;
  guideId: string | null;
  message: string;
}

export interface PendingClientEval {
  userId: string;
  userName: string;
  categoryIds: string[];
  startedAt: string;
  evalDueAt: string;
}

function hasActiveGuideLink(requests: Awaited<ReturnType<typeof getRequestsByUserId>>): boolean {
  return requests.some((r) => r.status === 'pending' || r.status === 'accepted');
}

function acceptedRequest(requests: Awaited<ReturnType<typeof getRequestsByUserId>>) {
  return requests.find((r) => r.status === 'accepted') || null;
}

export async function getGuideProgramStatus(userId: string): Promise<GuideProgramStatus> {
  const user = await getUserById(userId);
  const empty: GuideProgramStatus = {
    isGuide: false,
    needsOnboarding: true,
    needsGuidePick: false,
    waitingOnEval: false,
    needsCoupleGuide: false,
    canUseApp: false,
    categoryIds: [],
    startedAt: null,
    evalDueAt: null,
    evaluatedAt: null,
    grade: null,
    progressed: null,
    guideId: null,
    message: 'Choose 1 to 5 areas where you have the most problems, then pick a guide. After that you can use the app.',
  };
  if (!user) {
    return {
      ...empty,
      needsOnboarding: false,
      canUseApp: true,
      message: '',
    };
  }

  const guideProfile = await getGuideByUserId(userId);
  const isGuide = Boolean(guideProfile?.isActive) || Boolean(user.qualifiedCoach);
  const categoryIds = Array.isArray(user.improvementCategories) ? user.improvementCategories : [];
  const requests = await getRequestsByUserId(userId);
  const linked = hasActiveGuideLink(requests);
  const accepted = acceptedRequest(requests);

  if (accepted && !user.guideProgramStartedAt && !user.guideProgramEvaluatedAt) {
    await startProgramOnGuideAccept(userId, accepted.guideId);
  }

  const fresh = (accepted && !user.guideProgramStartedAt && !user.guideProgramEvaluatedAt)
    ? await getUserById(userId)
    : user;
  const u = fresh || user;

  const startedAt = u.guideProgramStartedAt || null;
  const evalDueAt = u.guideProgramEvalDueAt || null;
  const evaluatedAt = u.guideProgramEvaluatedAt || null;

  if (isGuide) {
    return {
      isGuide: true,
      needsOnboarding: false,
      needsGuidePick: false,
      waitingOnEval: false,
      needsCoupleGuide: false,
      canUseApp: true,
      categoryIds,
      startedAt,
      evalDueAt,
      evaluatedAt,
      grade: u.guideProgramGrade || null,
      progressed: u.guideProgramProgressed ?? null,
      guideId: u.guideProgramGuideId || null,
      message: 'You are a guide — the app will ask you to grade clients after their 2 months.',
    };
  }

  // Signup still stores a default category; that is not a real problem-area choice.
  const areasChosen = Boolean(u.guideProgramAreasChosenAt) || linked;
  const needsOnboarding = !areasChosen;
  const needsGuidePick = areasChosen && !linked;
  const now = Date.now();
  const due = evalDueAt ? new Date(evalDueAt).getTime() : 0;
  const waitingOnEval = Boolean(startedAt && due && now >= due && !evaluatedAt);

  let message = '';
  if (needsOnboarding) {
    message = 'Choose 1 to 5 areas where you have the most problems, then pick a guide. You cannot skip this.';
  } else if (needsGuidePick) {
    message = 'Now choose a guide for those areas. After you send a request you can use the rest of the app.';
  } else if (waitingOnEval) {
    message = 'Your 2-month program is over. Your guide must grade whether you progressed before you continue.';
  } else if (evaluatedAt) {
    message = `Your guide graded you ${u.guideProgramGrade || ''}${
      u.guideProgramProgressed ? ' — they said you progressed.' : ' — they said you have not progressed yet.'
    } You can keep using the app.`;
  } else if (accepted) {
    message = 'Work with your guide. In 2 months they will grade your progress.';
  } else {
    message = 'Request sent. You can use the app while your guide responds. The 2-month evaluation starts when they accept.';
  }

  const canUseApp = !needsOnboarding && linked && !waitingOnEval;
  let needsCoupleGuide = false;
  try {
    const { getActiveRelationship } = await import('./relationship.js');
    const rel = await getActiveRelationship(userId);
    const coupleLinked = requests.some(
      (r) =>
        (r.status === 'pending' || r.status === 'accepted') &&
        COUPLE_GUIDE_CATEGORY_IDS.includes(r.category)
    );
    const iConfirmedEnd = rel
      ? rel.userId1 === userId
        ? Boolean(rel.user1ConfirmedEnd)
        : Boolean(rel.user2ConfirmedEnd)
      : false;
    needsCoupleGuide = Boolean(rel?.status === 'active') && !coupleLinked && !iConfirmedEnd;
  } catch {
    needsCoupleGuide = false;
  }

  return {
    isGuide: false,
    needsOnboarding,
    needsGuidePick,
    waitingOnEval,
    needsCoupleGuide,
    canUseApp,
    categoryIds,
    startedAt,
    evalDueAt,
    evaluatedAt,
    grade: u.guideProgramGrade || null,
    progressed: u.guideProgramProgressed ?? null,
    guideId: u.guideProgramGuideId || null,
    message,
  };
}

export async function saveProblemAreas(userId: string, categoryIds: string[]): Promise<GuideProgramStatus> {
  const unique = [...new Set(categoryIds.filter((id) => IMPROVEMENT_CATEGORIES.some((c) => c.id === id)))];
  if (unique.length < 1 || unique.length > MAX_CATEGORIES) {
    throw new Error('Pick between 1 and 5 problem areas.');
  }
  const existing = await getUserById(userId);
  if (!existing) throw new Error('Client not found.');
  await updateUserProfile(userId, {
    improvementCategories: unique,
    guideProgramAreasChosenAt: new Date().toISOString(),
  } as Partial<User>);
  return getGuideProgramStatus(userId);
}

export async function saveCoupleProblemAreas(userId: string, categoryIds: string[]): Promise<GuideProgramStatus> {
  const couple = [...new Set(categoryIds.filter((id) => COUPLE_GUIDE_CATEGORY_IDS.includes(id)))];
  if (couple.length < 1 || couple.length > MAX_CATEGORIES) {
    throw new Error('Pick between 1 and 5 couple problem areas.');
  }
  const existing = await getUserById(userId);
  if (!existing) throw new Error('Client not found.');
  const prev = Array.isArray(existing.improvementCategories) ? existing.improvementCategories : [];
  const merged = [...new Set([...prev, ...couple])];
  await updateUserProfile(userId, {
    improvementCategories: merged,
    guideProgramAreasChosenAt: existing.guideProgramAreasChosenAt || new Date().toISOString(),
  } as Partial<User>);
  return getGuideProgramStatus(userId);
}

/** 2-month clock starts when a guide accepts — not when the user only sends a request. */
export async function startProgramOnGuideAccept(userId: string, guideId: string): Promise<void> {
  const user = await getUserById(userId);
  if (!user) return;
  if (user.guideProgramEvaluatedAt) return;
  if (user.guideProgramStartedAt) return;
  const now = new Date();
  await updateUserProfile(userId, {
    guideProgramStartedAt: now.toISOString(),
    guideProgramEvalDueAt: new Date(now.getTime() + TWO_MONTHS_MS).toISOString(),
    guideProgramEvaluatedAt: null,
    guideProgramGrade: null,
    guideProgramProgressed: null,
    guideProgramGuideId: guideId,
  } as Partial<User>);
}

export async function getPendingEvalsForGuide(guideUserId: string): Promise<PendingClientEval[]> {
  const guide = await getGuideByUserId(guideUserId);
  if (!guide) return [];
  const requests = await getRequestsByGuideId(guide.id);
  const clientIds = [...new Set(requests.filter((r) => r.status === 'accepted').map((r) => r.userId))];
  const now = Date.now();
  const out: PendingClientEval[] = [];
  for (const uid of clientIds) {
    const u = await getUserById(uid);
    if (!u?.guideProgramEvalDueAt || u.guideProgramEvaluatedAt) continue;
    if (u.guideProgramGuideId && u.guideProgramGuideId !== guide.id) continue;
    const due = new Date(u.guideProgramEvalDueAt).getTime();
    if (!Number.isFinite(due) || now < due) continue;
    out.push({
      userId: u.id,
      userName: u.name || u.username || 'Client',
      categoryIds: u.improvementCategories || [],
      startedAt: u.guideProgramStartedAt || '',
      evalDueAt: u.guideProgramEvalDueAt,
    });
  }
  return out;
}

export async function evaluateClient(
  guideUserId: string,
  clientUserId: string,
  progressed: boolean,
  grade: GuideProgramGrade
): Promise<GuideProgramStatus> {
  const guide = await getGuideByUserId(guideUserId);
  if (!guide) throw new Error('Only guides can grade clients.');
  const client = await getUserById(clientUserId);
  if (!client) throw new Error('Client not found.');
  const requests = await getRequestsByGuideId(guide.id);
  const linked = requests.some((r) => r.userId === clientUserId && r.status === 'accepted');
  if (!linked) throw new Error('This person is not your client.');
  const grades: GuideProgramGrade[] = ['A', 'B', 'C', 'D', 'F'];
  if (!grades.includes(grade)) throw new Error('Grade must be A, B, C, D, or F.');
  const due = client.guideProgramEvalDueAt ? new Date(client.guideProgramEvalDueAt).getTime() : 0;
  if (!due || Date.now() < due) throw new Error('The 2-month program is not over yet.');
  await updateUserProfile(clientUserId, {
    guideProgramEvaluatedAt: new Date().toISOString(),
    guideProgramProgressed: progressed,
    guideProgramGrade: grade,
  } as Partial<User>);
  return getGuideProgramStatus(clientUserId);
}
