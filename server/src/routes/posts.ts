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
import { requireEmailVerified } from '../middleware/requireEmailVerified.js';

const router = express.Router();

router.get('/', getDatingPosts);
router.get('/feed', optionalAuthenticateToken, getFeed);
router.get('/recommendations', optionalAuthenticateToken, getRecommendations);
router.get('/blowing-up-count', getBlowingUpCountHandler);

router.post('/upload-media', authenticateToken, uploadPostMedia);
router.post(
  '/upload-file',
  authenticateToken,
  express.raw({ type: '*/*', limit: '80mb' }),
  uploadPostFile
);
router.post('/', authenticateToken, createDatingPost);

router.use(authenticateToken);
router.use(requireEmailVerified);

router.post('/:postId/view', recordPostView);
router.post('/:postId/like', likeDatingPost);
router.post('/:postId/comment', commentOnPost);
router.post('/:postId/share', shareDatingPost);
router.delete('/:postId', deleteDatingPost);

export default router;
