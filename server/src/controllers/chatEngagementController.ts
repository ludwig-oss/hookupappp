import { Request, Response } from 'express';
import {
  createProofOfLove,
  getPendingProofs,
  verifyProof,
  getRandomProofPrompt,
  createConnectionPrompt,
  getRandomConnectionPrompt,
  markPromptAsResponded,
  createChatChallenge,
  getActiveChallenges,
  updateChallenge,
  getRandomChallenge,
  shouldShowProofOfLove,
  shouldShowConnectionPrompt,
  shouldShowChallenge,
  readProofs,
  readConnectionPrompts,
  readChallenges,
} from '../models/chatEngagement.js';
import { sanitizeForStorage, sanitizeHttpUrl, LIMITS } from '../utils/sanitize.js';

export const submitProofOfLove = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || req.body.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { toUserId } = req.body;
    const prompt = sanitizeForStorage(req.body.prompt, LIMITS.PROMPT);
    const mediaUrl = sanitizeHttpUrl(req.body.mediaUrl) || sanitizeForStorage(req.body.mediaUrl, LIMITS.HTTP_URL);
    if (!toUserId || !prompt || !mediaUrl) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const proof = await createProofOfLove({
      fromUserId: userId,
      toUserId,
      prompt,
      mediaUrl,
    });

    res.json({ message: 'Proof submitted successfully', proof });
  } catch (error: any) {
    console.error('Submit proof error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const getMyPendingProofs = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || req.query.userId as string;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const proofs = await getPendingProofs(userId);
    res.json({ proofs });
  } catch (error) {
    console.error('Get pending proofs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const verifyProofOfLove = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || req.body.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { proofId, verified } = req.body;
    if (!proofId || typeof verified !== 'boolean') {
      return res.status(400).json({ error: 'Proof ID and verification status are required' });
    }

    const proof = await verifyProof(proofId, verified, userId);
    res.json({ message: verified ? 'Proof verified!' : 'Proof rejected', proof });
  } catch (error: any) {
    console.error('Verify proof error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const requestProofPrompt = async (req: Request, res: Response) => {
  try {
    const prompt = await getRandomProofPrompt();
    res.json({ prompt });
  } catch (error) {
    console.error('Get proof prompt error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const checkProofStatus = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || req.query.userId as string;
    const { otherUserId } = req.query;
    
    if (!userId || !otherUserId) {
      return res.status(400).json({ error: 'User IDs are required' });
    }

    const proofs = await readProofs();
    const lastProof = proofs
      .filter(p => p.fromUserId === userId && p.toUserId === otherUserId)
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())[0];

    const pendingProof = proofs.find(
      p => p.fromUserId === userId && 
      p.toUserId === otherUserId && 
      p.status === 'pending'
    );

    const shouldShow = shouldShowProofOfLove(lastProof?.submittedAt != null ? new Date(lastProof.submittedAt) : null);

    res.json({ 
      shouldShow,
      hasPendingProof: !!pendingProof,
      lastProofDate: lastProof?.submittedAt || null,
    });
  } catch (error) {
    console.error('Check proof status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getConnectionPrompt = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || req.query.userId as string;
    const { otherUserId } = req.query;
    
    if (!userId || !otherUserId) {
      return res.status(400).json({ error: 'User IDs are required' });
    }

    const prompt = await getRandomConnectionPrompt();
    const connectionPrompt = await createConnectionPrompt({
      userId1: userId,
      userId2: otherUserId as string,
      prompt,
    });

    res.json({ prompt: connectionPrompt });
  } catch (error) {
    console.error('Get connection prompt error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const checkConnectionPrompt = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || req.query.userId as string;
    const { otherUserId } = req.query;
    
    if (!userId || !otherUserId) {
      return res.status(400).json({ error: 'User IDs are required' });
    }

    // Check last prompt shown
    const prompts = await readConnectionPrompts();
    const lastPrompt = prompts
      .filter(p => (p.userId1 === userId && p.userId2 === otherUserId) || 
                   (p.userId1 === otherUserId && p.userId2 === userId))
      .sort((a, b) => new Date(b.shownAt).getTime() - new Date(a.shownAt).getTime())[0];

    const shouldShow = shouldShowConnectionPrompt(lastPrompt?.shownAt != null ? new Date(lastPrompt.shownAt) : null);

    res.json({ 
      shouldShow,
      lastPromptDate: lastPrompt?.shownAt || null,
    });
  } catch (error) {
    console.error('Check connection prompt error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const markPromptResponded = async (req: Request, res: Response) => {
  try {
    const { promptId } = req.body;
    if (!promptId) {
      return res.status(400).json({ error: 'Prompt ID is required' });
    }

    await markPromptAsResponded(promptId);
    res.json({ message: 'Prompt marked as responded' });
  } catch (error) {
    console.error('Mark prompt responded error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createChallenge = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || req.body.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { otherUserId, challengeType, gameState } = req.body;
    if (!otherUserId || !challengeType) {
      return res.status(400).json({ error: 'Other user ID and challenge type are required' });
    }

    const challenge = await createChatChallenge({
      userId1: userId,
      userId2: otherUserId,
      challengeType,
      gameState: gameState || {},
    });

    res.json({ message: 'Challenge created', challenge });
  } catch (error: any) {
    console.error('Create challenge error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const getChallenges = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || req.query.userId as string;
    const { otherUserId } = req.query;
    
    if (!userId || !otherUserId) {
      return res.status(400).json({ error: 'User IDs are required' });
    }

    const challenges = await getActiveChallenges(userId, otherUserId as string);
    res.json({ challenges });
  } catch (error) {
    console.error('Get challenges error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateChallengeState = async (req: Request, res: Response) => {
  try {
    const { challengeId, gameState, status, winner } = req.body;
    if (!challengeId) {
      return res.status(400).json({ error: 'Challenge ID is required' });
    }

    const updates: any = {};
    if (gameState !== undefined) updates.gameState = gameState;
    if (status !== undefined) {
      updates.status = status;
      if (status === 'completed') {
        updates.completedAt = new Date();
        if (winner) updates.winner = winner;
      }
    }

    const challenge = await updateChallenge(challengeId, updates);
    res.json({ message: 'Challenge updated', challenge });
  } catch (error: any) {
    console.error('Update challenge error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const getRandomChallengeType = async (req: Request, res: Response) => {
  try {
    const challenge = await getRandomChallenge();
    res.json({ challenge });
  } catch (error) {
    console.error('Get random challenge error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const checkChallengeStatus = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || req.query.userId as string;
    const { otherUserId } = req.query;
    
    if (!userId || !otherUserId) {
      return res.status(400).json({ error: 'User IDs are required' });
    }

    const challenges = await readChallenges();
    const lastChallenge = challenges
      .filter(c => ((c.userId1 === userId && c.userId2 === otherUserId) || 
                    (c.userId1 === otherUserId && c.userId2 === userId)) &&
                   c.status === 'completed')
      .sort((a, b) => new Date(b.completedAt || b.createdAt).getTime() - 
                     new Date(a.completedAt || a.createdAt).getTime())[0];

    const lastDate = lastChallenge?.completedAt ?? lastChallenge?.createdAt;
    const shouldShow = shouldShowChallenge(lastDate != null ? new Date(lastDate) : null);

    res.json({ 
      shouldShow,
      lastChallengeDate: lastChallenge?.completedAt || lastChallenge?.createdAt || null,
    });
  } catch (error) {
    console.error('Check challenge status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
