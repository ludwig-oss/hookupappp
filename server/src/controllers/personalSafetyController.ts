import { Request, Response } from 'express';
import {
  getShieldSettings,
  saveShieldSettings,
  armShield,
  disarmShield,
  triggerSafetySignal,
  cancelSafetySignalFalseAlarm,
  resolveSafetySignal,
  getActiveSignalForUser,
  getNearbyActiveSignals,
  matchActivationPhrase,
  sanitizeSettingsForClient,
  validateShieldReady,
  type ShieldTriggerMethod,
} from '../models/personalSafetyShield.js';
import { getUserById } from '../models/user.js';
import { sanitizeForStorage } from '../utils/sanitize.js';

export const getShieldSettingsHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const settings = await getShieldSettings(userId);
    const active = await getActiveSignalForUser(userId);
    const ready = await validateShieldReady(userId);
    res.json({
      settings: sanitizeSettingsForClient(settings),
      activeSignal: active
        ? {
            id: active.id,
            status: active.status,
            lat: active.lat,
            lon: active.lon,
            triggeredVia: active.triggeredVia,
            notifyCount: active.notifyCount,
            createdAt: active.createdAt,
          }
        : null,
      ready,
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateShieldSettingsHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const body = req.body as Record<string, unknown>;
    const patch: Record<string, unknown> = {};

    if (typeof body.autoArmWhenOutside === 'boolean') patch.autoArmWhenOutside = body.autoArmWhenOutside;
    if (typeof body.enableHelpButton === 'boolean') patch.enableHelpButton = body.enableHelpButton;
    if (typeof body.enableScreenTaps === 'boolean') patch.enableScreenTaps = body.enableScreenTaps;
    if (typeof body.enableVolumeTaps === 'boolean') patch.enableVolumeTaps = body.enableVolumeTaps;
    if (typeof body.enableSecretWord === 'boolean') patch.enableSecretWord = body.enableSecretWord;
    if (typeof body.screenTapCount === 'number') patch.screenTapCount = Math.min(10, Math.max(3, body.screenTapCount));
    if (typeof body.appearanceDescription === 'string') {
      patch.appearanceDescription = sanitizeForStorage(body.appearanceDescription, 300);
    }
    if (typeof body.emergencyContactUserId === 'string' || body.emergencyContactUserId === null) {
      patch.emergencyContactUserId = body.emergencyContactUserId;
    }
    if (typeof body.activationSecret === 'string' && body.activationSecret.length >= 3) {
      patch.activationSecret = sanitizeForStorage(body.activationSecret, 64);
    }
    if (typeof body.cancelSecret === 'string' && body.cancelSecret.length >= 3) {
      patch.cancelSecret = sanitizeForStorage(body.cancelSecret, 64);
    }
    if (typeof body.customActivationPhrase === 'string') {
      patch.customActivationPhrase = sanitizeForStorage(body.customActivationPhrase, 64);
    }

    const settings = await saveShieldSettings(userId, patch as any);
    const ready = await validateShieldReady(userId);
    res.json({ settings: sanitizeSettingsForClient(settings), ready });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const armShieldHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { lat, lon } = req.body;
    const ready = await validateShieldReady(userId);
    if (!ready.ready) {
      return res.status(400).json({ error: `Complete setup first: ${ready.missing.join(', ')}` });
    }
    const settings = await armShield(userId, lat, lon);
    res.json({
      settings: sanitizeSettingsForClient(settings),
      message: 'Safety shield armed — your triggers are active while you are out.',
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const disarmShieldHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const settings = await disarmShield(userId);
    res.json({ settings: sanitizeSettingsForClient(settings) });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const triggerSafetySignalHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { lat, lon, via, phrase } = req.body as {
      lat?: number;
      lon?: number;
      via?: ShieldTriggerMethod;
      phrase?: string;
    };
    if (typeof lat !== 'number' || typeof lon !== 'number') {
      return res.status(400).json({ error: 'lat and lon required' });
    }
    const user = await getUserById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const settings = await getShieldSettings(userId);
    const method = via || 'help_button';
    if (method === 'help_button' && !settings.enableHelpButton) {
      return res.status(403).json({ error: 'Help button trigger is disabled in your settings.' });
    }
    if ((method === 'screen_taps' || method === 'volume_taps') && !settings.armed) {
      return res.status(403).json({ error: 'Shield must be armed when you go out.' });
    }

    const result = await triggerSafetySignal({
      userId,
      userName: user.name || 'User',
      lat,
      lon,
      via: method,
      phrase,
    });

    res.json({
      alert: result.alert,
      nearbyNotified: result.nearbyNotified,
      policeNumber: result.policeNumber,
      message: `Safety signal sent — exact location shared with ${result.nearbyNotified} nearby users. Server keeps alerting even if your phone dies.`,
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Could not trigger signal' });
  }
};

export const cancelFalseAlarmHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { cancelPhrase } = req.body;
    if (!cancelPhrase) return res.status(400).json({ error: 'cancelPhrase required' });
    const result = await cancelSafetySignalFalseAlarm(userId, String(cancelPhrase));
    res.json({
      alert: result.alert,
      notified: result.notified,
      message: 'False alarm — nearby users notified that you are safe.',
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const resolveSignalHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { alertId } = req.body;
    if (!alertId) return res.status(400).json({ error: 'alertId required' });
    const ok = await resolveSafetySignal(userId, alertId);
    res.json({ ok });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const pollSafetySignalsHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { lat, lon } = req.query;
    const active = await getActiveSignalForUser(userId);
    let nearby: Awaited<ReturnType<typeof getNearbyActiveSignals>> = [];
    if (typeof lat === 'string' && typeof lon === 'string') {
      nearby = await getNearbyActiveSignals(parseFloat(lat), parseFloat(lon));
    }
    res.json({
      myActiveSignal: active,
      nearbySignals: nearby.map((s) => ({
        id: s.id,
        userName: s.userName,
        lat: s.lat,
        lon: s.lon,
        appearanceDescription: s.appearanceDescription,
        createdAt: s.createdAt,
        notifyCount: s.notifyCount,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const checkActivationPhraseHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { phrase } = req.body;
    if (!phrase) return res.status(400).json({ error: 'phrase required' });
    const match = await matchActivationPhrase(userId, String(phrase));
    res.json({ match });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};
