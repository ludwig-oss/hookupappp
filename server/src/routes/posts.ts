import express from 'express';
import {
  createDatingPost,
  uploadPostMedia,
  uploadPostFile,
  getDatingPosts,
  getFeed,
  getRecommendations,
  recordPostView,
  getBlowingUpCountHandler,
  likeDatingPost,
  commentOnPost,
  shareDatingPost,
  deleteDatingPost,
} from '../controllers/postsController.js';
import { authenticateToken, optionalAuthenticateToken } from '../middleware/auth.js';
import { requirePhotoUnlocked } from '../middleware/requirePhotoUnlocked.js';
import {
  postInterest,
  postHealHold,
  postHealReady,
  getSingleAgain,
  getMyRoulette,
} from '../controllers/singleAgainController.js';

const router = express.Router();

router.get('/', optionalAuthenticateToken, getDatingPosts);
router.get('/feed', optionalAuthenticateToken, getFeed);
router.get('/recommendations', optionalAuthenticateToken, getRecommendations);
router.get('/blowing-up-count', getBlowingUpCountHandler);

router.post('/upload-media', authenticateToken, uploadPostMedia);
router.post(
  '/upload-file',
  authenticateToken,
  express.raw({ type: '*/*', limit: '100mb' }),
  uploadPostFile
);
router.post('/', authenticateToken, requirePhotoUnlocked, createDatingPost);

router.use(authenticateToken);

router.get('/single-again/mine', getMyRoulette);
router.get('/:postId/single-again', getSingleAgain);
router.post('/:postId/interest', postInterest);
router.post('/:postId/heal-hold', postHealHold);
router.post('/:postId/heal-ready', postHealReady);

router.post('/:postId/view', recordPostView);
router.post('/:postId/like', likeDatingPost);
router.post('/:postId/comment', commentOnPost);
router.post('/:postId/share', shareDatingPost);
router.delete('/:postId', deleteDatingPost);

export default router;
