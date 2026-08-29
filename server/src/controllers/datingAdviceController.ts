import { Request, Response } from 'express';
import { getUserById } from '../models/user.js';
import { getUserPreference } from '../models/discover.js';
import {
  createAdviceQuestion,
  getQuestionById,
  getQuestionsForCohort,
  searchQuestions,
  addAdviceAnswer,
  likeAdviceAnswer,
  getUsersInCohort,
  computeAnswerCohort,
  cohortLabel,
  markFirstCommentNotified,
  runMonthlyAdvicePayouts,
  ADVICE_PRIZE_EUR,
} from '../models/datingAdvice.js';
import { sendPushToUser } from '../realtime/push.js';
import { notifyNewAdviceAnswer } from '../realtime/notifications.js';
import { sanitizeMessageContent, LIMITS } from '../utils/sanitize.js';
import { checkContent } from '../utils/moderation.js';

async function getAskerContext(userId: string) {
  const user = await getUserById(userId);
  const pref = await getUserPreference(userId);
  return {
    user,
    orientation: pref?.orientation || 'straight',
    lookingFor: pref?.lookingFor || ['dating'],
    gender: user?.gender,
    cohort: computeAnswerCohort(pref?.orientation || 'straight', user?.gender),
  };
}

export async function searchAdviceHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).userId as string;
    const { query } = req.body as { query?: string };
    if (!query?.trim()) return res.status(400).json({ error: 'Enter a dating question to search' });

    const content = sanitizeMessageContent(query, LIMITS.POST_CONTENT);
    const mod = checkContent(content);
    if (!mod.allowed) return res.status(400).json({ error: mod.reason || 'Not allowed' });

    const ctx = await getAskerContext(userId);
    const question = await createAdviceQuestion({
      userId,
      query: content,
      orientation: ctx.orientation,
      gender: ctx.gender,
      lookingFor: ctx.lookingFor,
    });

    const notifyIds = await getUsersInCohort(question.answerCohort, userId);
    const askerName = ctx.user?.name || 'Someone';
    const cohortName = cohortLabel(question.answerCohort);

    for (const uid of notifyIds.slice(0, 200)) {
      sendPushToUser(uid, {
        title: 'Dating advice needed',
        body: `${askerName} asked: "${content.slice(0, 80)}…" — ${cohortName} can help.`,
        data: { type: 'advice_question', questionId: question.id },
      }).catch(() => {});
    }

    res.json({
      question,
      message: `Posted! ${cohortName} were notified to answer.`,
      notifiedCount: notifyIds.length,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed' });
  }
}

export async function getAdviceFeedHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).userId as string;
    await runMonthlyAdvicePayouts().catch(() => {});

    const ctx = await getAskerContext(userId);
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const list = q.trim()
      ? await searchQuestions(q, ctx.cohort)
      : await getQuestionsForCohort(ctx.cohort);

    const enriched = await Promise.all(
      list.map(async (item) => {
        const u = await getUserById(item.userId);
        return {
          ...item,
          user: u
            ? { id: u.id, name: u.name, username: u.username, profilePicture: u.profilePicture }
            : null,
          cohortLabel: cohortLabel(item.answerCohort),
        };
      })
    );

    res.json({
      questions: enriched,
      yourCohort: ctx.cohort,
      cohortLabel: cohortLabel(ctx.cohort),
      prizeEur: ADVICE_PRIZE_EUR,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed' });
  }
}

export async function getAdviceQuestionHandler(req: Request, res: Response) {
  try {
    const q = await getQuestionById(req.params.questionId);
    if (!q) return res.status(404).json({ error: 'Not found' });
    const u = await getUserById(q.userId);
    res.json({
      question: {
        ...q,
        user: u ? { id: u.id, name: u.name, profilePicture: u.profilePicture } : null,
        cohortLabel: cohortLabel(q.answerCohort),
      },
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed' });
  }
}

export async function postAdviceAnswerHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).userId as string;
    const { questionId } = req.params;
    const content = sanitizeMessageContent(req.body.content, LIMITS.COMMENT);
    if (!content) return res.status(400).json({ error: 'Answer required' });

    const mod = checkContent(content);
    if (!mod.allowed) return res.status(400).json({ error: mod.reason || 'Not allowed' });

    const question = await getQuestionById(questionId);
    if (!question) return res.status(404).json({ error: 'Question not found' });

    const ctx = await getAskerContext(userId);
    if (
      ctx.cohort !== question.answerCohort &&
      question.answerCohort !== 'pan_all' &&
      ctx.cohort !== 'pan_all'
    ) {
      return res.status(403).json({
        error: `Only ${cohortLabel(question.answerCohort)} can answer this question.`,
      });
    }

    const user = await getUserById(userId);
    const result = await addAdviceAnswer(questionId, {
      userId,
      userName: user?.name || 'User',
      content,
    });
    if (!result) return res.status(404).json({ error: 'Question not found' });

    notifyNewAdviceAnswer(question.userId, {
      questionId,
      fromUserId: userId,
      preview: content.slice(0, 100),
    });

    sendPushToUser(question.userId, {
      title: 'New advice on your question',
      body: `${user?.name || 'Someone'} answered: "${content.slice(0, 60)}…"`,
      data: { type: 'advice_answer', questionId },
    }).catch(() => {});

    let firstTimeMessage: string | undefined;
    if (result.firstComment) {
      firstTimeMessage = `First time helping! If your advice gets the most likes this month in your group (${cohortLabel(question.answerCohort)}), you win €${ADVICE_PRIZE_EUR} added to your balance.`;
      await markFirstCommentNotified(userId);
      sendPushToUser(userId, {
        title: 'Advice reward tip',
        body: firstTimeMessage,
        data: { type: 'advice_first_comment' },
      }).catch(() => {});
    }

    res.json({ answer: result.answer, firstTimeMessage });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed' });
  }
}

export async function likeAdviceAnswerHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).userId as string;
    const { questionId, answerId } = req.params;
    const answer = await likeAdviceAnswer(questionId, answerId, userId);
    if (!answer) return res.status(404).json({ error: 'Not found' });
    res.json({ likes: answer.likeUserIds.length });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed' });
  }
}

export async function runAdvicePayoutAdminHandler(req: Request, res: Response) {
  try {
    const winners = await runMonthlyAdvicePayouts();
    res.json({ winners, message: 'Monthly advice prizes processed' });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed' });
  }
}
