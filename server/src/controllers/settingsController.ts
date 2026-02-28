import { Request, Response } from 'express';
import { getUserSettings, updateUserSettings } from '../models/settings.js';

export const getSettings = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const settings = await getUserSettings(userId);
    res.json({ settings });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateSettings = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const updates = req.body;
    const settings = await updateUserSettings(userId, updates);
    res.json({ settings });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateNotifications = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const notifications = req.body;
    const settings = await getUserSettings(userId);
    const updated = await updateUserSettings(userId, {
      ...settings,
      notifications: { ...settings.notifications, ...notifications },
    });
    res.json({ settings: updated });
  } catch (error) {
    console.error('Update notifications error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updatePrivacy = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const privacy = req.body;
    const settings = await getUserSettings(userId);
    const updated = await updateUserSettings(userId, {
      ...settings,
      privacy: { ...settings.privacy, ...privacy },
    });
    res.json({ settings: updated });
  } catch (error) {
    console.error('Update privacy error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateFilters = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const filters = req.body;
    const settings = await getUserSettings(userId);
    const updated = await updateUserSettings(userId, {
      ...settings,
      filters: { ...settings.filters, ...filters },
    });
    res.json({ settings: updated });
  } catch (error) {
    console.error('Update filters error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateAccessibility = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const accessibility = req.body;
    const settings = await getUserSettings(userId);
    const updated = await updateUserSettings(userId, {
      ...settings,
      accessibility: { ...settings.accessibility, ...accessibility },
    });
    res.json({ settings: updated });
  } catch (error) {
    console.error('Update accessibility error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};



