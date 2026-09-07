import { Request, Response } from 'express';
import {
  getJourney,
  startJourney,
  completeStep,
  recordSaidHi,
  setHostMode,
  setHostMuted,
  syncSaidHiFromMessages,
  type ConnectionHostMode,
  type ConnectionJourneyRecord,
} from '../models/connectionJourney.js';
import {
  getStepById,
  getNextStepFromAssigned,
  getCurrentDayFromAssigned,
  getAllStepsForJourney,
  CONNECTION_JOURNEY_DAYS,
} from '../data/connectionJourneySteps.js';
import { getConversation } from '../models/chat.js';
import { getUserById } from '../models/user.js';

const MATCH_OPENER_RE = /you're matched!|\[safety\]|\[host\]/i;

function isRealChatMessage(content: string): boolean {
  const t = (content || '').trim();
  if (!t || t.startsWith('data:')) return false;
  if (MATCH_OPENER_RE.test(t)) return false;
  return true;
}

function serializeStep(step: ReturnType<typeof getStepById>) {
  if (!step) return null;
  return {
    id: step.id,
    day: 0,
    type: step.type,
    title: step.title,
    subtitle: step.subtitle,
    instructions: step.instructions,
    chatPrompt: step.chatPrompt,
    quizQuestion: step.quizQuestion,
    options: step.options,
    playAction: step.playAction,
  };
}

function derivePhase(
  journey: ConnectionJourneyRecord,
  viewerId: string
): 'say_hi' | 'connecting' | 'complete' {
  const assigned = journey.assignedStepIds ?? [];
  const completed = journey.completedStepIds ?? [];
  if (assigned.length > 0 && completed.length >= assigned.length) return 'complete';
  if (completed.length > 0) return 'connecting';
  const said = journey.saidHiUserIds ?? [];
  if (!said.includes(viewerId)) return 'say_hi';
  return 'connecting';
}

function buildHost(
  phase: 'say_hi' | 'connecting' | 'complete',
  hostMode: ConnectionHostMode,
  nextStep: ReturnType<typeof getStepById>,
  currentDay: number,
  partnerName: string,
  theySaidHi: boolean,
  iSaidHi: boolean,
  hostMuted: boolean
) {
  if (hostMuted) {
    return {
      headline: 'Host is off',
      body: 'You paused me. Turn me back on if you want a game or a nudge when it gets quiet.',
      actions: ['unmute'] as string[],
    };
  }

  if (phase === 'complete') {
    return {
      headline: "You've got something going",
      body: "You've done the mix — games, challenges, surprises. Keep talking. Nudge me if you want another round.",
      actions: [] as string[],
    };
  }

  if (phase === 'say_hi') {
    let body = `Hey you two — I'm your connection host. First: say Hi. Then I'll mix games, quizzes, and tiny challenges with room for you to just talk.`;
    if (theySaidHi && !iSaidHi) {
      body = `${partnerName} already said hi. Your turn — then we mix it up.`;
    } else if (iSaidHi && !theySaidHi) {
      body = `Nice. Waiting on ${partnerName} to say Hi too.`;
    }
    return {
      headline: 'Your host is here',
      body,
      actions: ['say_hi'],
    };
  }

  if (hostMode === 'quiet') {
    return {
      headline: 'You two talk',
      body: `I'll jump in if it goes quiet or you've been chatting a while — games and quizzes, not only questions. Pause me anytime.`,
      actions: ['host_asks', 'mute'],
    };
  }

  if (hostMode === 'their_turn') {
    return {
      headline: 'Your turn',
      body: `Ask ${partnerName} anything. I'll stay out of the way until it's quiet again.`,
      actions: ['host_asks', 'mute'],
    };
  }

  if (hostMode === 'offer') {
    return {
      headline: "Let's connect you",
      body: theySaidHi
        ? `Want to ask ${partnerName} something, should I start a game, or do you just want to talk?`
        : `${partnerName} hasn't said hi yet — you can still ask, play, or talk.`,
      actions: ['ask_them', 'host_asks', 'quiet', 'mute'],
    };
  }

  if (nextStep) {
    const kind =
      nextStep.type === 'game'
        ? 'Game'
        : nextStep.type === 'quiz'
          ? 'Quiz'
          : nextStep.type === 'challenge'
            ? 'Challenge'
            : nextStep.type === 'gift'
              ? 'Gift'
              : nextStep.type === 'surprise'
                ? 'Surprise'
                : 'Talk';
    return {
      headline: `${kind} · Day ${currentDay}`,
      body: `${nextStep.title}. ${nextStep.instructions}`,
      actions: nextStep.playAction
        ? ['play', 'share', 'did_it', 'quiet', 'mute']
        : ['share', 'did_it', 'quiet', 'mute'],
    };
  }

  return {
    headline: 'Want a round?',
    body: 'A game, a quiz, or I can stay quiet while you talk.',
    actions: ['host_asks', 'quiet', 'mute'],
  };
}

async function syncParticipants(userId: string, partnerUserId: string, journey: ConnectionJourneyRecord) {
  try {
    const messages = await getConversation(userId, partnerUserId);
    const ids = messages
      .filter((m) => isRealChatMessage(m.content))
      .map((m) => m.fromUserId);
    if (ids.length === 0) return journey;
    return (await syncSaidHiFromMessages(userId, partnerUserId, ids)) ?? journey;
  } catch {
    return journey;
  }
}

async function serializeResponse(
  userId: string,
  partnerUserId: string,
  journey: ConnectionJourneyRecord,
  extra: Record<string, unknown> = {}
) {
  const assigned = journey.assignedStepIds ?? [];
  const completed = journey.completedStepIds ?? [];
  const nextStep = getNextStepFromAssigned(assigned, completed);
  const currentDay = getCurrentDayFromAssigned(assigned, completed);
  const allSteps = getAllStepsForJourney(assigned, completed);
  const phase = derivePhase(journey, userId);
  const hostMode = journey.hostMode || 'offer';
  const saidHiUserIds = journey.saidHiUserIds ?? [];
  const partner = await getUserById(partnerUserId).catch(() => null);
  const partnerName = partner?.name || 'them';
  const host = buildHost(
    phase,
    hostMode,
    nextStep,
    currentDay,
    partnerName,
    saidHiUserIds.includes(partnerUserId),
    saidHiUserIds.includes(userId),
    Boolean(journey.hostMuted)
  );

  return {
    journey: {
      id: journey.id,
      startedAt: journey.startedAt,
      assignedStepIds: journey.assignedStepIds,
      completedStepIds: journey.completedStepIds,
      saidHiUserIds,
      hostMode,
      hostMuted: Boolean(journey.hostMuted),
    },
    nextStep: nextStep
      ? {
          ...serializeStep(nextStep),
          day: currentDay,
        }
      : null,
    currentDay,
    totalDays: CONNECTION_JOURNEY_DAYS,
    allSteps,
    phase,
    hostMode,
    saidHiUserIds,
    host,
    partnerName,
    hostMuted: Boolean(journey.hostMuted),
    ...extra,
  };
}

export const muteHostHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { partnerUserId, muted } = req.body as { partnerUserId?: string; muted?: boolean };
    if (!userId || !partnerUserId) {
      return res.status(400).json({ error: 'partnerUserId is required' });
    }
    let journey = await getJourney(userId, partnerUserId);
    if (!journey) journey = await startJourney(userId, partnerUserId);
    journey = (await setHostMuted(userId, partnerUserId, Boolean(muted))) ?? journey;
    res.json(await serializeResponse(userId, partnerUserId, journey));
  } catch (error) {
    console.error('Mute host error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/** GET /api/connection-journey/:partnerUserId — auto-starts the host journey. */
export const getJourneyHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { partnerUserId } = req.params;
    if (!userId || !partnerUserId) {
      return res.status(400).json({ error: 'partnerUserId is required' });
    }
    let journey = await getJourney(userId, partnerUserId);
    if (!journey) {
      journey = await startJourney(userId, partnerUserId);
    }
    journey = await syncParticipants(userId, partnerUserId, journey);
    res.json(await serializeResponse(userId, partnerUserId, journey));
  } catch (error) {
    console.error('Get connection journey error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/** POST /api/connection-journey/start — start journey with partner (assigns 7 random steps). */
export const startJourneyHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { partnerUserId } = req.body;
    if (!userId || !partnerUserId) {
      return res.status(400).json({ error: 'partnerUserId is required' });
    }
    let journey = await startJourney(userId, partnerUserId);
    journey = await syncParticipants(userId, partnerUserId, journey);
    res.json(await serializeResponse(userId, partnerUserId, journey));
  } catch (error) {
    console.error('Start connection journey error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/** POST /api/connection-journey/complete — mark step complete. */
export const completeStepHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { partnerUserId, stepId } = req.body;
    if (!userId || !partnerUserId || !stepId) {
      return res.status(400).json({ error: 'partnerUserId and stepId are required' });
    }
    const step = getStepById(stepId);
    if (!step) return res.status(400).json({ error: 'Invalid stepId' });
    const journey = await completeStep(userId, partnerUserId, stepId);
    if (!journey) return res.status(404).json({ error: 'Journey not found' });
    res.json(await serializeResponse(userId, partnerUserId, journey, { completedStepId: stepId }));
  } catch (error) {
    console.error('Complete step error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/** POST /api/connection-journey/said-hi — mark this user as having said hi. */
export const saidHiHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { partnerUserId } = req.body;
    if (!userId || !partnerUserId) {
      return res.status(400).json({ error: 'partnerUserId is required' });
    }
    let journey = await getJourney(userId, partnerUserId);
    if (!journey) journey = await startJourney(userId, partnerUserId);
    journey = (await recordSaidHi(userId, partnerUserId)) ?? journey;
    res.json(await serializeResponse(userId, partnerUserId, journey));
  } catch (error) {
    console.error('Said hi error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/** POST /api/connection-journey/host-choice — I'll ask vs host asks. */
export const hostChoiceHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { partnerUserId, choice } = req.body as { partnerUserId?: string; choice?: string };
    if (!userId || !partnerUserId) {
      return res.status(400).json({ error: 'partnerUserId is required' });
    }
    const mode: ConnectionHostMode =
      choice === 'ask_them'
        ? 'their_turn'
        : choice === 'offer'
          ? 'offer'
          : choice === 'quiet'
            ? 'quiet'
            : 'host_asks';
    let journey = await getJourney(userId, partnerUserId);
    if (!journey) journey = await startJourney(userId, partnerUserId);
    journey = (await setHostMode(userId, partnerUserId, mode)) ?? journey;
    res.json(await serializeResponse(userId, partnerUserId, journey));
  } catch (error) {
    console.error('Host choice error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
