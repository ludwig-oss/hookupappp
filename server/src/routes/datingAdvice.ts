import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  searchAdviceHandler,
  getAdviceFeedHandler,
  getAdviceQuestionHandler,
  postAdviceAnswerHandler,
  postAdviceReplyHandler,
  likeAdviceAnswerHandler,
  likeAdviceReplyHandler,
  runAdvicePayoutAdminHandler,
} from '../controllers/datingAdviceController.js';
import { requireAdmin } from '../middleware/requireAdmin.js';

const router = express.Router();

router.use(authenticateToken);

router.post('/search', searchAdviceHandler);
router.get('/feed', getAdviceFeedHandler);
router.get('/:questionId', getAdviceQuestionHandler);
router.post('/:questionId/answer', postAdviceAnswerHandler);
router.post('/:questionId/answers/:answerId/reply', postAdviceReplyHandler);
router.post('/:questionId/answers/:answerId/like', likeAdviceAnswerHandler);
router.post('/:questionId/answers/:answerId/replies/:replyId/like', likeAdviceReplyHandler);
router.post('/admin/run-payouts', requireAdmin, runAdvicePayoutAdminHandler);

export default router;
