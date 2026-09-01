import { Request, Response } from 'express';
import {
  getAllApplications,
  getApplicationById,
  approveApplication,
  rejectApplication,
} from '../models/improvement.js';
import { getUserById } from '../models/user.js';
import { notifyGuideApplicationDecision } from '../realtime/notifications.js';
import { sendPushToUser } from '../realtime/push.js';

export const listCoachApplications = async (_req: Request, res: Response) => {
  try {
    const applications = await getAllApplications();
    const pending = applications.filter((a) => a.status === 'pending');
    const enriched = await Promise.all(
      pending.map(async (app) => {
        const u = await getUserById(app.userId);
        return {
          ...app,
          widgetAnswers: app.widgetAnswers || [],
          proofPerCategory: app.proofPerCategory || {},
          applicantName: u?.name || 'Unknown',
          applicantUsername: u?.username || '',
          applicantPicture: u?.profilePicture || null,
          applicantAge: u?.age ?? null,
          applicantCity: u?.city ?? null,
          applicantCountry: u?.country ?? null,
        };
      })
    );
    res.json({ applications: enriched });
  } catch (error) {
    console.error('List coach applications error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const approveCoachApplicationAdmin = async (req: Request, res: Response) => {
  try {
    const reviewerId = (req as any).userId;
    const { applicationId, coachStarRating } = req.body;
    if (!applicationId) {
      return res.status(400).json({ error: 'applicationId is required' });
    }
    const stars =
      typeof coachStarRating === 'number' && coachStarRating >= 1 && coachStarRating <= 5
        ? coachStarRating
        : 4.5;
    const existing = await getApplicationById(applicationId);
    if (!existing) return res.status(404).json({ error: 'Application not found' });
    const guide = await approveApplication(applicationId, reviewerId, stars);
    const app = await getApplicationById(applicationId);
    if (app?.userId) {
      notifyGuideApplicationDecision(app.userId, { approved: true });
      sendPushToUser(app.userId, {
        title: 'You are a qualified guide',
        body: 'You were approved. You can start guiding others now from Compatibility.',
        data: { url: '/home' },
      }).catch(() => {});
    }
    res.json({ message: 'Coach approved — Qualified Coach badge assigned.', guide, coachStarRating: stars });
  } catch (error: any) {
    console.error('Approve coach application error:', error);
    res.status(400).json({ error: error.message || 'Could not approve' });
  }
};

export const rejectCoachApplicationAdmin = async (req: Request, res: Response) => {
  try {
    const reviewerId = (req as any).userId;
    const { applicationId } = req.body;
    if (!applicationId) {
      return res.status(400).json({ error: 'applicationId is required' });
    }
    const app = await getApplicationById(applicationId);
    if (!app) return res.status(404).json({ error: 'Application not found' });
    await rejectApplication(applicationId, reviewerId);
    notifyGuideApplicationDecision(app.userId, { approved: false });
    sendPushToUser(app.userId, {
      title: 'Guide application update',
      body: 'Your application was not approved. You can improve your proofs and try again later.',
      data: { url: '/home' },
    }).catch(() => {});
    res.json({ message: 'Application rejected.' });
  } catch (error: any) {
    console.error('Reject coach application error:', error);
    res.status(400).json({ error: error.message || 'Could not reject' });
  }
};

export const getCoachApplicationDetail = async (req: Request, res: Response) => {
  try {
    const appId = req.params.applicationId;
    const apps = await getAllApplications();
    const app = apps.find((a) => a.id === appId);
    if (!app) return res.status(404).json({ error: 'Application not found' });
    const u = await getUserById(app.userId);
    res.json({ application: app, applicant: u ? { id: u.id, name: u.name, username: u.username, country: u.country, city: u.city } : null });
  } catch (error) {
    console.error('Coach application detail error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
