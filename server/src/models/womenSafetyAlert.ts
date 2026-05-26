import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { getAllUsers } from './user.js';
import { sendPushToUser } from '../realtime/push.js';

export interface WomenSafetyAlert {
  id: string;
  userId: string;
  userName: string;
  lat: number;
  lon: number;
  message: string;
  status: 'active' | 'resolved';
  createdAt: string;
  resolvedAt?: string;
}

const PATH = join(process.cwd(), 'server', 'data', 'women-safety-alerts.json');

async function readAll(): Promise<WomenSafetyAlert[]> {
  try {
    const data = await readFile(PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function writeAll(alerts: WomenSafetyAlert[]): Promise<void> {
  const dir = join(process.cwd(), 'server', 'data');
  await mkdir(dir, { recursive: true });
  await writeFile(PATH, JSON.stringify(alerts, null, 2));
}

function isWomanUser(gender?: string): boolean {
  if (!gender) return false;
  const g = gender.toLowerCase();
  return g === 'woman' || g === 'female' || g === 'women' || g.includes('woman') || g.includes('female');
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function createWomenSafetyAlert(input: {
  userId: string;
  userName: string;
  lat: number;
  lon: number;
  message?: string;
}): Promise<{ alert: WomenSafetyAlert; nearbyWomenNotified: number }> {
  const alerts = await readAll();
  const alert: WomenSafetyAlert = {
    id: Date.now().toString(),
    userId: input.userId,
    userName: input.userName,
    lat: input.lat,
    lon: input.lon,
    message: input.message || 'I feel unsafe and need help.',
    status: 'active',
    createdAt: new Date().toISOString(),
  };
  alerts.push(alert);
  await writeAll(alerts);

  const users = await getAllUsers();
  let nearbyWomenNotified = 0;
  const radiusKm = 15;

  for (const u of users) {
    if (u.id === input.userId || !isWomanUser(u.gender)) continue;
    const lat = (u as any).location?.lat ?? (u as any).lat;
    const lon = (u as any).location?.lon ?? (u as any).lon;
    if (typeof lat !== 'number' || typeof lon !== 'number') continue;
    if (haversineKm(input.lat, input.lon, lat, lon) > radiusKm) continue;

    nearbyWomenNotified++;
    sendPushToUser(u.id, {
      title: 'Nearby woman needs help',
      body: `${input.userName} triggered a safety alert nearby. Open the app if you can check in.`,
      data: { alertId: alert.id, type: 'women_sos', lat: String(input.lat), lon: String(input.lon) },
    }).catch(() => {});
  }

  return { alert, nearbyWomenNotified };
}

export async function getActiveAlertsNear(lat: number, lon: number, radiusKm = 15): Promise<WomenSafetyAlert[]> {
  const alerts = await readAll();
  const now = Date.now();
  return alerts.filter((a) => {
    if (a.status !== 'active') return false;
    if (now - new Date(a.createdAt).getTime() > 24 * 60 * 60 * 1000) return false;
    return haversineKm(lat, lon, a.lat, a.lon) <= radiusKm;
  });
}

export async function resolveWomenSafetyAlert(alertId: string, userId: string): Promise<boolean> {
  const alerts = await readAll();
  const i = alerts.findIndex((a) => a.id === alertId && a.userId === userId);
  if (i === -1) return false;
  alerts[i].status = 'resolved';
  alerts[i].resolvedAt = new Date().toISOString();
  await writeAll(alerts);
  return true;
}
