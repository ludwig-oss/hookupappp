import { Request, Response } from 'express';
import {
  getAllApplications,
  approveApplication,
  rejectApplication,
  getApplicationByUserId,
} from '../models/improvement.js';
import { getUserById } from '../models/user.js';

export const listCoachApplications = async (_req: Request, res: Response) => {
  try {
    const applications = await getAllApplications();
    const pending = applications.filter((a) => a.status === 'pending');
    const enriched = await Promise.all(
      pending.map(async (app) => {
        const u = await getUserById(app.userId);
        return {
          ...app,
          applicantName: u?.name || 'Unknown',
          applicantUsername: u?.username || '',
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
    const guide = await approveApplication(applicationId, reviewerId, stars);
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
    await rejectApplication(applicationId, reviewerId);
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
