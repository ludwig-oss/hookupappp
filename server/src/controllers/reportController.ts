import { Request, Response } from 'express';
import {
  createReport,
  getReportsByReporter,
  getAllReports,
  updateReportStatus,
} from '../models/reports.js';
import { blockUser, getUserById, getUserByUsername } from '../models/user.js';
import { sanitizeForStorage, parseReportCategory, LIMITS } from '../utils/sanitize.js';

/** GET /api/reports/lookup?q=usernameOrId — resolve to userId and name for reporting. */
export const lookupUserForReport = async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string)?.trim();
    if (!q) {
      return res.status(400).json({ error: 'Query "q" is required' });
    }
    let user = await getUserByUsername(q);
    if (!user) user = await getUserById(q);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ userId: user.id, name: user.name, username: user.username });
  } catch (error) {
    console.error('Lookup user for report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createUserReport = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { reportedUserId, reportedUsername, category, description } = req.body;

    if (!category) {
      return res.status(400).json({ error: 'Category is required' });
    }

    let targetUserId = reportedUserId;
    if (!targetUserId && reportedUsername) {
      const q = String(reportedUsername).trim();
      let target = await getUserByUsername(q);
      if (!target) target = await getUserById(q);
      if (!target) {
        return res.status(404).json({ error: 'User not found with that ID or username' });
      }
      targetUserId = target.id;
    }
    if (!targetUserId) {
      return res.status(400).json({ error: 'Reported user ID or username is required' });
    }

    const reporter = await getUserById(userId);
    if (!reporter) return res.status(401).json({ error: 'Unauthorized' });
    if (targetUserId === userId) {
      return res.status(400).json({ error: 'You cannot report yourself' });
    }

    const safeCategory = parseReportCategory(category);
    if (!safeCategory) {
      return res.status(400).json({ error: 'Category is required' });
    }

    const report = await createReport({
      reporterId: userId,
      reportedUserId: targetUserId,
      category: safeCategory,
      description: sanitizeForStorage(description, LIMITS.REPORT_DESCRIPTION),
    });

    // Auto-block for serious categories so reporter is protected immediately
    if (['harassment', 'violence', 'underage'].includes(safeCategory)) {
      await blockUser(userId, targetUserId);
    }

    res.json({ report });
  } catch (error) {
    console.error('Create report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getMyReports = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const reports = await getReportsByReporter(userId);
    res.json({ reports });
  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAllUserReports = async (req: Request, res: Response) => {
  try {
    // This would typically require admin privileges
    const reports = await getAllReports();
    res.json({ reports });
  } catch (error) {
    console.error('Get all reports error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateReport = async (req: Request, res: Response) => {
  try {
    const { reportId } = req.params;
    const { status, resolution } = req.body;
    const reviewedBy = (req as any).userId;

    const report = await updateReportStatus(reportId, status, reviewedBy, resolution);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json({ report });
  } catch (error) {
    console.error('Update report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};



