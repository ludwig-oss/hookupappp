import express from 'express';
import {
  createDatingPost,
  getDatingPosts,
  getFeed,
  getBlowingUpCountHandler,
  likeDatingPost,
  commentOnPost,
  shareDatingPost,
  deleteDatingPost,
} from '../controllers/postsController.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireEmailVerified } from '../middleware/requireEmailVerified.js';

const router = express.Router();

// Public
router.get('/', getDatingPosts);
router.get('/feed', getFeed);
router.get('/blowing-up-count', getBlowingUpCountHandler);

router.use(authenticateToken);
router.use(requireEmailVerified);

router.post('/', createDatingPost);
router.post('/:postId/like', likeDatingPost);
router.post('/:postId/comment', commentOnPost);
router.post('/:postId/share', shareDatingPost);
router.delete('/:postId', deleteDatingPost);

export default router;




