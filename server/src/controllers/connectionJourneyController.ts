import { Request, Response } from 'express';
import { getJourney, startJourney, completeStep } from '../models/connectionJourney.js';
import {
  getStepById,
  getNextStepFromAssigned,
  getCurrentDayFromAssigned,
  getAllStepsForJourney,
  CONNECTION_JOURNEY_DAYS,
} from '../data/connectionJourneySteps.js';

function serializeStep(step: ReturnType<typeof getStepById>) {
  if (!step) return null;
  return {
    id: step.id,
    day: 0, // filled by caller from position
    type: step.type,
    title: step.title,
    subtitle: step.subtitle,
    instructions: step.instructions,
    chatPrompt: step.chatPrompt,
    quizQuestion: step.quizQuestion,
    options: step.options,
  };
}

/** GET /api/connection-journey/:partnerUserId — get journey with partner (or null). */
export const getJourneyHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { partnerUserId } = req.params;
    if (!userId || !partnerUserId) {
      return res.status(400).json({ error: 'partnerUserId is required' });
    }
    const journey = await getJourney(userId, partnerUserId);
    if (!journey) {
      return res.json({
        journey: null,
        nextStep: null,
        currentDay: 1,
        totalDays: CONNECTION_JOURNEY_DAYS,
      });
    }
    const assigned = journey.assignedStepIds ?? [];
    const completed = journey.completedStepIds ?? [];
    const nextStep = getNextStepFromAssigned(assigned, completed);
    const currentDay = getCurrentDayFromAssigned(assigned, completed);
    const allSteps = getAllStepsForJourney(assigned, completed);
    res.json({
      journey: {
        id: journey.id,
        startedAt: journey.startedAt,
        assignedStepIds: journey.assignedStepIds,
        completedStepIds: journey.completedStepIds,
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
    });
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
    const journey = await startJourney(userId, partnerUserId);
    const assigned = journey.assignedStepIds ?? [];
    const completed = journey.completedStepIds ?? [];
    const nextStep = getNextStepFromAssigned(assigned, completed);
    const currentDay = getCurrentDayFromAssigned(assigned, completed);
    const allSteps = getAllStepsForJourney(assigned, completed);
    res.json({
      journey: {
        id: journey.id,
        startedAt: journey.startedAt,
        assignedStepIds: journey.assignedStepIds,
        completedStepIds: journey.completedStepIds,
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
    });
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
    const assigned = journey.assignedStepIds ?? [];
    const completed = journey.completedStepIds ?? [];
    const nextStep = getNextStepFromAssigned(assigned, completed);
    const currentDay = getCurrentDayFromAssigned(assigned, completed);
    const allSteps = getAllStepsForJourney(assigned, completed);
    res.json({
      journey: {
        id: journey.id,
        startedAt: journey.startedAt,
        assignedStepIds: journey.assignedStepIds,
        completedStepIds: journey.completedStepIds,
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
      completedStepId: stepId,
    });
  } catch (error) {
    console.error('Complete step error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
