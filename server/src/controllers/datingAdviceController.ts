import { Request, Response } from 'express';
import { getUserById } from '../models/user.js';
import { getUserPreference } from '../models/discover.js';
import {
  createAdviceQuestion,
  getQuestionById,
  getRankedAdviceFeed,
  searchQuestions,
  addAdviceAnswer,
  addAdviceReply,
  likeAdviceAnswer,
  likeAdviceReply,
  getUsersInCohort,
  computeAnswerCohort,
  cohortLabel,
  markFirstCommentNotified,
  runMonthlyAdvicePayouts,
  ADVICE_PRIZE_EUR,
  type AdviceQuestion,
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
    city: user?.city,
    country: user?.country,
  };
}

function maskAdviceQuestion(q: AdviceQuestion, viewerId: string) {
  const isAsker = q.userId === viewerId;
  return {
    ...q,
    answers: q.answers.map((a) => ({
      ...a,
      userName: a.userId === viewerId ? a.userName : 'Community member',
      replies: (a.replies || []).map((r) => ({
        ...r,
        userName: r.userId === viewerId ? r.userName : 'Community member',
      })),
    })),
    user: isAsker
      ? { id: q.userId, name: 'You (hidden from others)', profilePicture: null, blurred: true }
      : { id: 'anonymous', name: 'Anonymous', profilePicture: null, blurred: true },
    cohortLabel: cohortLabel(q.answerCohort),
    isLocal: undefined as boolean | undefined,
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
      city: ctx.city,
      country: ctx.country,
      lat: ctx.user?.location?.lat,
      lon: ctx.user?.location?.lon,
    });

    const notifyIds = await getUsersInCohort(question.answerCohort, userId);
    const cohortName = cohortLabel(question.answerCohort);

    void (async () => {
      for (const uid of notifyIds.slice(0, 200)) {
        await sendPushToUser(uid, {
          title: 'Dating advice needed nearby',
          body: `Someone in ${ctx.city || 'your area'} asked — ${cohortName} can help.`,
          data: { type: 'advice_question', questionId: question.id },
        }).catch(() => {});
      }
    })();

    res.json({
      question: maskAdviceQuestion(question, userId),
      message: `Posted! ${cohortName} in your area were notified.`,
      notifiedCount: notifyIds.length,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to post question' });
  }
}

export async function getAdviceFeedHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).userId as string;
    void runMonthlyAdvicePayouts().catch(() => {});

    const ctx = await getAskerContext(userId);
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const list = q.trim()
      ? await searchQuestions(q, ctx.cohort, ctx.city, ctx.country)
      : await getRankedAdviceFeed(ctx.cohort, ctx.city, ctx.country);

    const enriched = list.map((item) => maskAdviceQuestion(item, userId));

    res.json({
      questions: enriched,
      yourCohort: ctx.cohort,
      cohortLabel: cohortLabel(ctx.cohort),
      prizeEur: ADVICE_PRIZE_EUR,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to load feed' });
  }
}

export async function getAdviceQuestionHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).userId as string;
    const q = await getQuestionById(req.params.questionId);
    if (!q) return res.status(404).json({ error: 'Not found' });
    res.json({ question: maskAdviceQuestion(q, userId) });
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
      body: `Someone replied: "${content.slice(0, 60)}…"`,
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

export async function postAdviceReplyHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).userId as string;
    const { questionId, answerId } = req.params;
    const content = sanitizeMessageContent(req.body.content, LIMITS.COMMENT);
    if (!content) return res.status(400).json({ error: 'Comment required' });

    const mod = checkContent(content);
    if (!mod.allowed) return res.status(400).json({ error: mod.reason || 'Not allowed' });

    const question = await getQuestionById(questionId);
    if (!question) return res.status(404).json({ error: 'Question not found' });

    const user = await getUserById(userId);
    const result = await addAdviceReply(questionId, answerId, {
      userId,
      userName: user?.name || 'User',
      content,
    });
    if (!result) return res.status(404).json({ error: 'Answer not found' });

    if (question.userId !== userId) {
      sendPushToUser(question.userId, {
        title: 'New comment on your advice thread',
        body: content.slice(0, 80),
        data: { type: 'advice_reply', questionId },
      }).catch(() => {});
    }

    res.json({ reply: result.reply });
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

export async function likeAdviceReplyHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).userId as string;
    const { questionId, answerId, replyId } = req.params;
    const reply = await likeAdviceReply(questionId, answerId, replyId, userId);
    if (!reply) return res.status(404).json({ error: 'Not found' });
    res.json({ likes: reply.likeUserIds.length });
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
