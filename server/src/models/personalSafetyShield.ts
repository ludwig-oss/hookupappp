import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { getAllUsers, getUserById } from './user.js';
import { sendPushToUser } from '../realtime/push.js';

export type ShieldTriggerMethod =
  | 'help_button'
  | 'secret_word'
  | 'screen_taps'
  | 'volume_taps'
  | 'custom_phrase';

export interface PersonalSafetyShieldSettings {
  userId: string;
  /** Ready to receive triggers when user is out. */
  armed: boolean;
  autoArmWhenOutside: boolean;
  /** Shout or type to trigger (e.g. "pineapple"). */
  activationSecret: string;
  /** @deprecated Cancel is a button; kept for older saved settings. */
  cancelSecret?: string;
  customActivationPhrase?: string;
  enableHelpButton: boolean;
  enableScreenTaps: boolean;
  screenTapCount: number;
  enableVolumeTaps: boolean;
  enableSecretWord: boolean;
  /** What you are wearing / how you look — shown to helpers. */
  appearanceDescription?: string;
  emergencyContactUserId?: string | null;
  lastArmedAt?: string | null;
  lastLocation?: { lat: number; lon: number; label?: string };
  updatedAt: string;
}

export interface SafetySignalAlert {
  id: string;
  userId: string;
  userName: string;
  lat: number;
  lon: number;
  appearanceDescription?: string;
  triggeredVia: ShieldTriggerMethod;
  status: 'active' | 'false_alarm' | 'resolved';
  /** Server keeps alerting even if phone is off or destroyed. */
  serverPersisted: boolean;
  notifyCount: number;
  lastNotifyAt: string;
  nextNotifyAt: string;
  createdAt: string;
  resolvedAt?: string | null;
  falseAlarmAt?: string | null;
  falseAlarmNotifiedAt?: string | null;
  /** Everyone who received the original alert — false-alarm button notifies this same list. */
  notifiedUserIds?: string[];
}

const SETTINGS_PATH = join(process.cwd(), 'server', 'data', 'personal-safety-shield-settings.json');
const SIGNALS_PATH = join(process.cwd(), 'server', 'data', 'safety-signal-alerts.json');

const NOTIFY_INTERVAL_MS = 3 * 60 * 1000; // re-ring every 3 min if phone lost
const NEARBY_RADIUS_KM = 12;

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function readSettings(): Promise<PersonalSafetyShieldSettings[]> {
  try {
    return JSON.parse(await readFile(SETTINGS_PATH, 'utf-8'));
  } catch {
    return [];
  }
}

async function writeSettings(list: PersonalSafetyShieldSettings[]): Promise<void> {
  await mkdir(join(process.cwd(), 'server', 'data'), { recursive: true });
  await writeFile(SETTINGS_PATH, JSON.stringify(list, null, 2));
}

async function readSignals(): Promise<SafetySignalAlert[]> {
  try {
    return JSON.parse(await readFile(SIGNALS_PATH, 'utf-8'));
  } catch {
    return [];
  }
}

async function writeSignals(list: SafetySignalAlert[]): Promise<void> {
  await mkdir(join(process.cwd(), 'server', 'data'), { recursive: true });
  await writeFile(SIGNALS_PATH, JSON.stringify(list, null, 2));
}

export function defaultShieldSettings(userId: string): PersonalSafetyShieldSettings {
  return {
    userId,
    armed: false,
    autoArmWhenOutside: true,
    activationSecret: '',
    cancelSecret: '',
    customActivationPhrase: '',
    enableHelpButton: true,
    enableScreenTaps: true,
    screenTapCount: 5,
    enableVolumeTaps: true,
    enableSecretWord: true,
    appearanceDescription: '',
    emergencyContactUserId: null,
    updatedAt: new Date().toISOString(),
  };
}

export async function getShieldSettings(userId: string): Promise<PersonalSafetyShieldSettings> {
  const list = await readSettings();
  const found = list.find((s) => s.userId === userId);
  if (found) return found;
  const d = defaultShieldSettings(userId);
  list.push(d);
  await writeSettings(list);
  return d;
}

export async function saveShieldSettings(
  userId: string,
  patch: Partial<Omit<PersonalSafetyShieldSettings, 'userId' | 'updatedAt'>>
): Promise<PersonalSafetyShieldSettings> {
  const list = await readSettings();
  let s = list.find((x) => x.userId === userId);
  if (!s) {
    s = defaultShieldSettings(userId);
    list.push(s);
  }
  Object.assign(s, patch, { updatedAt: new Date().toISOString() });
  await writeSettings(list);
  return s;
}

export async function armShield(userId: string, lat?: number, lon?: number): Promise<PersonalSafetyShieldSettings> {
  const patch: Partial<PersonalSafetyShieldSettings> = {
    armed: true,
    lastArmedAt: new Date().toISOString(),
  };
  if (typeof lat === 'number' && typeof lon === 'number') {
    patch.lastLocation = { lat, lon };
  }
  return saveShieldSettings(userId, patch);
}

export async function disarmShield(userId: string): Promise<PersonalSafetyShieldSettings> {
  return saveShieldSettings(userId, { armed: false });
}

function userCoords(u: { location?: { lat?: number; lon?: number } | null; lat?: number; lon?: number }): { lat: number; lon: number } | null {
  const lat = u.location?.lat ?? (u as { lat?: number }).lat;
  const lon = u.location?.lon ?? (u as { lon?: number }).lon;
  if (typeof lat === 'number' && typeof lon === 'number') return { lat, lon };
  return null;
}

async function notifyNearbyUsers(alert: SafetySignalAlert, isRepeat: boolean): Promise<{ count: number; userIds: string[] }> {
  const users = await getAllUsers();
  const userIds: string[] = [];
  const appearance = alert.appearanceDescription ? ` Wearing: ${alert.appearanceDescription.slice(0, 80)}` : '';

  for (const u of users) {
    if (u.id === alert.userId) continue;
    const coords = userCoords(u);
    if (!coords) continue;
    if (haversineKm(alert.lat, alert.lon, coords.lat, coords.lon) > NEARBY_RADIUS_KM) continue;

    userIds.push(u.id);
    sendPushToUser(u.id, {
      title: isRepeat ? '🆘 Safety signal still active' : '🆘 Someone nearby needs help',
      body: `${alert.userName} triggered a safety signal at ${alert.lat.toFixed(4)}, ${alert.lon.toFixed(4)}.${appearance} Open map if you can help.`,
      data: {
        type: 'safety_signal',
        alertId: alert.id,
        lat: String(alert.lat),
        lon: String(alert.lon),
        userId: alert.userId,
      },
    }).catch(() => {});
  }

  if (alert.userId) {
    const settings = await getShieldSettings(alert.userId);
    if (settings.emergencyContactUserId && !userIds.includes(settings.emergencyContactUserId)) {
      userIds.push(settings.emergencyContactUserId);
      sendPushToUser(settings.emergencyContactUserId, {
        title: isRepeat ? '🆘 Safety signal — still active' : '🆘 Your contact needs help',
        body: `${alert.userName} activated their safety signal.${appearance}`,
        data: { type: 'safety_signal_contact', alertId: alert.id, lat: String(alert.lat), lon: String(alert.lon) },
      }).catch(() => {});
    }
  }

  return { count: userIds.length, userIds };
}

export async function triggerSafetySignal(params: {
  userId: string;
  userName: string;
  lat: number;
  lon: number;
  via: ShieldTriggerMethod;
  phrase?: string;
}): Promise<{ alert: SafetySignalAlert; nearbyNotified: number; policeNumber: string }> {
  const settings = await getShieldSettings(params.userId);

  if (params.via === 'secret_word' || params.via === 'custom_phrase') {
    const phrase = (params.phrase || '').trim().toLowerCase();
    const activation = settings.activationSecret.trim().toLowerCase();
    const custom = (settings.customActivationPhrase || '').trim().toLowerCase();
    if (!phrase || (phrase !== activation && phrase !== custom)) {
      throw new Error('Activation phrase did not match your safety signal setup.');
    }
  }

  const signals = await readSignals();
  const existing = signals.find((s) => s.userId === params.userId && s.status === 'active');
  if (existing) {
    return { alert: existing, nearbyNotified: 0, policeNumber: '911' };
  }

  const now = new Date();
  const alert: SafetySignalAlert = {
    id: `sig-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    userId: params.userId,
    userName: params.userName,
    lat: params.lat,
    lon: params.lon,
    appearanceDescription: settings.appearanceDescription || undefined,
    triggeredVia: params.via,
    status: 'active',
    serverPersisted: true,
    notifyCount: 1,
    lastNotifyAt: now.toISOString(),
    nextNotifyAt: new Date(now.getTime() + NOTIFY_INTERVAL_MS).toISOString(),
    createdAt: now.toISOString(),
  };

  signals.push(alert);
  await writeSignals(signals);

  const notified = await notifyNearbyUsers(alert, false);
  alert.notifiedUserIds = notified.userIds;
  alert.notifyCount = 1;
  await writeSignals(signals);
  return { alert, nearbyNotified: notified.count, policeNumber: '911' };
}

export async function cancelSafetySignalFalseAlarm(
  userId: string
): Promise<{ alert: SafetySignalAlert; notified: number }> {
  const signals = await readSignals();
  const alert = signals.find((s) => s.userId === userId && s.status === 'active');
  if (!alert) throw new Error('No active safety signal.');

  alert.status = 'false_alarm';
  alert.falseAlarmAt = new Date().toISOString();

  const recipients = new Set(alert.notifiedUserIds || []);
  if (recipients.size === 0) {
    const users = await getAllUsers();
    for (const u of users) {
      if (u.id === userId) continue;
      const coords = userCoords(u);
      if (!coords) continue;
      if (haversineKm(alert.lat, alert.lon, coords.lat, coords.lon) > NEARBY_RADIUS_KM) continue;
      recipients.add(u.id);
    }
    const settings = await getShieldSettings(userId);
    if (settings.emergencyContactUserId) recipients.add(settings.emergencyContactUserId);
  }

  let notified = 0;
  for (const id of recipients) {
    if (id === userId) continue;
    notified++;
    sendPushToUser(id, {
      title: '✓ False alarm — all clear',
      body: `${alert.userName} cancelled their safety signal. False alarm — no help needed.`,
      data: { type: 'safety_signal_false_alarm', alertId: alert.id },
    }).catch(() => {});
  }

  alert.falseAlarmNotifiedAt = new Date().toISOString();
  await writeSignals(signals);
  return { alert, notified };
}

export async function resolveSafetySignal(userId: string, alertId: string): Promise<boolean> {
  const signals = await readSignals();
  const i = signals.findIndex((s) => s.id === alertId && s.userId === userId);
  if (i === -1) return false;
  signals[i].status = 'resolved';
  signals[i].resolvedAt = new Date().toISOString();
  await writeSignals(signals);
  return true;
}

/** Re-notify nearby users while signal active — survives phone off/destroyed. */
export async function processPersistentSafetySignals(): Promise<number> {
  const signals = await readSignals();
  const now = Date.now();
  let processed = 0;

  for (const alert of signals) {
    if (alert.status !== 'active' || !alert.serverPersisted) continue;
    if (new Date(alert.nextNotifyAt).getTime() > now) continue;
    if (now - new Date(alert.createdAt).getTime() > 24 * 60 * 60 * 1000) {
      alert.status = 'resolved';
      alert.resolvedAt = new Date().toISOString();
      continue;
    }

    alert.notifyCount += 1;
    alert.lastNotifyAt = new Date().toISOString();
    alert.nextNotifyAt = new Date(now + NOTIFY_INTERVAL_MS).toISOString();
    const again = await notifyNearbyUsers(alert, true);
    alert.notifiedUserIds = Array.from(new Set([...(alert.notifiedUserIds || []), ...again.userIds]));
    processed++;
  }

  await writeSignals(signals);
  return processed;
}

export async function getActiveSignalForUser(userId: string): Promise<SafetySignalAlert | null> {
  await processPersistentSafetySignals();
  const signals = await readSignals();
  return signals.find((s) => s.userId === userId && s.status === 'active') || null;
}

export async function getNearbyActiveSignals(lat: number, lon: number): Promise<SafetySignalAlert[]> {
  await processPersistentSafetySignals();
  const signals = await readSignals();
  return signals.filter(
    (s) => s.status === 'active' && haversineKm(lat, lon, s.lat, s.lon) <= NEARBY_RADIUS_KM
  );
}

export async function matchActivationPhrase(userId: string, phrase: string): Promise<boolean> {
  const settings = await getShieldSettings(userId);
  const p = phrase.trim().toLowerCase();
  return (
    (!!settings.activationSecret && p === settings.activationSecret.trim().toLowerCase()) ||
    (!!settings.customActivationPhrase && p === settings.customActivationPhrase.trim().toLowerCase())
  );
}

export function sanitizeSettingsForClient(s: PersonalSafetyShieldSettings) {
  return {
    armed: s.armed,
    autoArmWhenOutside: s.autoArmWhenOutside,
    hasActivationSecret: !!s.activationSecret,
    /** Owner-only — needed so this device can listen for the shouted word. */
    activationSecret: s.activationSecret || '',
    enableHelpButton: s.enableHelpButton,
    enableScreenTaps: s.enableScreenTaps,
    screenTapCount: s.screenTapCount,
    enableVolumeTaps: s.enableVolumeTaps,
    enableSecretWord: s.enableSecretWord,
    appearanceDescription: s.appearanceDescription || '',
    emergencyContactUserId: s.emergencyContactUserId,
    lastArmedAt: s.lastArmedAt,
    lastLocation: s.lastLocation,
    updatedAt: s.updatedAt,
  };
}

export async function validateShieldReady(userId: string): Promise<{ ready: boolean; missing: string[] }> {
  const s = await getShieldSettings(userId);
  const missing: string[] = [];
  if (!s.activationSecret) missing.push('activation word (voice detector)');
  if (!s.enableHelpButton && !s.enableScreenTaps && !s.enableVolumeTaps && !s.enableSecretWord) {
    missing.push('at least one trigger method');
  }
  return { ready: missing.length === 0, missing };
}
