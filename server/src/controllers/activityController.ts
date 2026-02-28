import { Request, Response } from 'express';
import {
  getActiveUsersByRegion,
  sendInterest,
  acceptInterest,
  rejectInterest,
  getInterestsForUser,
  getInterestById,
  savePreCommProfile,
  getPreCommProfilesForInterest,
  canChatAfterPreComm,
} from '../models/activity.js';
import { getUserById, getAllUsers } from '../models/user.js';
import { maskUserForViewer } from '../lib/celebMask.js';
import { getNDAByInterest, hasSignedNDA, signNDA } from '../models/nda.js';

export async function getRegionUsers(req: Request, res: Response) {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const country = (req.query.country as string)?.trim();
    const city = (req.query.city as string)?.trim();
    const users = country
      ? await getActiveUsersByRegion(country, city || undefined)
      : await getAllUsers();
    const me = await getUserById(userId);
    const blocked = new Set(me?.blockedUsers || []);
    const filtered = users.filter((u: any) => u.id !== userId && !blocked.has(u.id));
    const withProfile = filtered.map((u: any) => {
      const base = {
        id: u.id,
        name: u.name,
        username: u.username,
        profilePicture: u.profilePicture ?? null,
        country: u.country,
        city: u.city,
        publicFigureVerified: !!(u.publicFigureVerified),
        revealToUserIds: u.revealToUserIds || [],
        photoVerifiedAt: u.photoVerifiedAt || null,
      };
      return maskUserForViewer(base, userId);
    });
    res.json({ users: withProfile });
  } catch (e: any) {
    console.error('Get region users error:', e);
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
}

export async function sendInterestHandler(req: Request, res: Response) {
  try {
    const fromUserId = (req as any).userId;
    if (!fromUserId) return res.status(401).json({ error: 'Unauthorized' });
    const { toUserId } = req.body;
    if (!toUserId) return res.status(400).json({ error: 'toUserId is required' });
    const interest = await sendInterest(fromUserId, toUserId);
    res.json({ message: 'Interest sent', interest });
  } catch (e: any) {
    console.error('Send interest error:', e);
    res.status(400).json({ error: e.message || 'Bad request' });
  }
}

export async function acceptInterestHandler(req: Request, res: Response) {
  try {
    const toUserId = (req as any).userId;
    if (!toUserId) return res.status(401).json({ error: 'Unauthorized' });
    const { interestId } = req.body;
    if (!interestId) return res.status(400).json({ error: 'interestId is required' });
    await acceptInterest(interestId, toUserId);
    res.json({ message: 'Interest accepted' });
  } catch (e: any) {
    console.error('Accept interest error:', e);
    res.status(400).json({ error: e.message || 'Bad request' });
  }
}

export async function rejectInterestHandler(req: Request, res: Response) {
  try {
    const toUserId = (req as any).userId;
    if (!toUserId) return res.status(401).json({ error: 'Unauthorized' });
    const { interestId } = req.body;
    if (!interestId) return res.status(400).json({ error: 'interestId is required' });
    await rejectInterest(interestId, toUserId);
    res.json({ message: 'Interest declined' });
  } catch (e: any) {
    console.error('Reject interest error:', e);
    res.status(400).json({ error: e.message || 'Bad request' });
  }
}

function otherUserBase(u: any) {
  return {
    id: u.id,
    name: u.name,
    username: u.username,
    profilePicture: u.profilePicture ?? null,
    country: u.country,
    city: u.city,
    publicFigureVerified: !!(u.publicFigureVerified),
    revealToUserIds: u.revealToUserIds || [],
    photoVerifiedAt: u.photoVerifiedAt || null,
  };
}

export async function getMyInterests(req: Request, res: Response) {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { sent, received } = await getInterestsForUser(userId);
    const sentWithUser = await Promise.all(
      sent.map(async i => {
        const u = await getUserById(i.toUserId);
        const base = u ? otherUserBase(u) : null;
        return { ...i, otherUser: base ? maskUserForViewer(base, userId) : null };
      })
    );
    const receivedWithUser = await Promise.all(
      received.map(async i => {
        const u = await getUserById(i.fromUserId);
        const base = u ? otherUserBase(u) : null;
        return { ...i, otherUser: base ? maskUserForViewer(base, userId) : null };
      })
    );
    res.json({ sent: sentWithUser, received: receivedWithUser });
  } catch (e: any) {
    console.error('Get my interests error:', e);
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
}

export async function savePreCommHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { interestId, ...data } = req.body;
    if (!interestId) return res.status(400).json({ error: 'interestId is required' });
    const profile = await savePreCommProfile(userId, interestId, data);
    res.json({ message: 'Saved', profile });
  } catch (e: any) {
    console.error('Save pre-comm error:', e);
    res.status(400).json({ error: e.message || 'Bad request' });
  }
}

export async function getPreCommForInterest(req: Request, res: Response) {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { interestId } = req.params;
    if (!interestId) return res.status(400).json({ error: 'interestId is required' });
    const interest = await getInterestById(interestId);
    if (!interest) return res.status(404).json({ error: 'Interest not found' });
    if (interest.fromUserId !== userId && interest.toUserId !== userId) return res.status(403).json({ error: 'Forbidden' });
    const profiles = await getPreCommProfilesForInterest(interestId);
    const canChat = await canChatAfterPreComm(interestId);
    res.json({ profiles, canChat });
  } catch (e: any) {
    console.error('Get pre-comm error:', e);
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
}

const NDA_AGREEMENT_TEXT = `I agree to keep confidential that I am in contact with this person. I understand I may be sued and required to pay damages if I expose their identity, share our chats, or reveal that we are talking without their permission. I sign this voluntarily and am eligible to be held legally responsible.`;

export async function getNDAStatusByUser(req: Request, res: Response) {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { otherUserId } = req.params;
    if (!otherUserId) return res.status(400).json({ error: 'otherUserId is required' });
    const { sent, received } = await getInterestsForUser(userId);
    const accepted = [...sent, ...received].find(
      (i) => i.status === 'accepted' && (i.fromUserId === otherUserId || i.toUserId === otherUserId)
    );
    if (!accepted) return res.json({ required: false, signed: false, interestId: null, agreementText: NDA_AGREEMENT_TEXT });
    const interest = await getInterestById(accepted.id);
    if (!interest) return res.json({ required: false, signed: false, interestId: null, agreementText: NDA_AGREEMENT_TEXT });
    const fromUser = await getUserById(interest.fromUserId);
    const toUser = await getUserById(interest.toUserId);
    const celebId = fromUser?.publicFigureVerified ? interest.fromUserId : toUser?.publicFigureVerified ? interest.toUserId : null;
    const signerId = celebId === interest.fromUserId ? interest.toUserId : interest.fromUserId;
    const required = !!celebId;
    const signed = await hasSignedNDA(accepted.id, signerId);
    const nda = signed ? await getNDAByInterest(accepted.id) : null;
    res.json({
      required,
      signed,
      interestId: accepted.id,
      agreementText: NDA_AGREEMENT_TEXT,
      celebrityUserId: celebId || undefined,
      nda: nda ? { id: nda.id, signedAt: nda.signedAt } : undefined,
    });
  } catch (e: any) {
    console.error('NDA status by user error:', e);
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
}

export async function getNDAStatus(req: Request, res: Response) {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { interestId } = req.params;
    if (!interestId) return res.status(400).json({ error: 'interestId is required' });
    const interest = await getInterestById(interestId);
    if (!interest) return res.status(404).json({ error: 'Interest not found' });
    if (interest.fromUserId !== userId && interest.toUserId !== userId) return res.status(403).json({ error: 'Forbidden' });
    if (interest.status !== 'accepted') {
      return res.json({ required: false, signed: false, agreementText: NDA_AGREEMENT_TEXT });
    }
    const fromUser = await getUserById(interest.fromUserId);
    const toUser = await getUserById(interest.toUserId);
    const celebId = fromUser?.publicFigureVerified ? interest.fromUserId : toUser?.publicFigureVerified ? interest.toUserId : null;
    const signerId = celebId === interest.fromUserId ? interest.toUserId : interest.fromUserId;
    const required = !!celebId;
    const signed = await hasSignedNDA(interestId, signerId);
    const nda = signed ? await getNDAByInterest(interestId) : null;
    res.json({
      required,
      signed,
      agreementText: NDA_AGREEMENT_TEXT,
      celebrityUserId: celebId || undefined,
      nda: nda ? { id: nda.id, signedAt: nda.signedAt } : undefined,
    });
  } catch (e: any) {
    console.error('NDA status error:', e);
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
}

export async function signNDAHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { interestId, signatureData, agreementText } = req.body;
    if (!interestId || !signatureData) return res.status(400).json({ error: 'interestId and signatureData are required' });
    const interest = await getInterestById(interestId);
    if (!interest) return res.status(404).json({ error: 'Interest not found' });
    if (interest.status !== 'accepted') return res.status(400).json({ error: 'Interest must be accepted first' });
    const fromUser = await getUserById(interest.fromUserId);
    const toUser = await getUserById(interest.toUserId);
    const celebId = fromUser?.publicFigureVerified ? interest.fromUserId : toUser?.publicFigureVerified ? interest.toUserId : null;
    if (!celebId) return res.status(400).json({ error: 'NDA is not required for this connection' });
    const signerId = celebId === interest.fromUserId ? interest.toUserId : interest.fromUserId;
    if (userId !== signerId) return res.status(403).json({ error: 'Only the non-verified user must sign the NDA' });
    const nda = await signNDA({
      interestId,
      celebrityUserId: celebId,
      signerUserId: userId,
      signatureData,
      agreementText: agreementText || NDA_AGREEMENT_TEXT,
    });
    res.json({ message: 'NDA signed', nda: { id: nda.id, signedAt: nda.signedAt } });
  } catch (e: any) {
    console.error('Sign NDA error:', e);
    res.status(400).json({ error: e.message || 'Bad request' });
  }
}
