import { isSimulatorEnabled, isSimulatorUserId, getSimulatorUsers } from './runtime.js';
import { createMessage } from '../models/chat.js';
import type { SafetySignalAlert } from '../models/personalSafetyShield.js';

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const CHECK_INS = [
  'Hey — I got a safety alert near you. Are you OK? Can you reply?',
  'Saw your safety signal. Do you need help? I’m nearby if you can text.',
  'Checking in from the app. Are you safe? Tell me if you want me to come or call someone.',
  'Got your location pin. Are you alright? Reply when you can.',
  'Help is looking out for you. Are you OK right now?',
];

function mapsLink(lat: number, lon: number): string {
  return `https://www.google.com/maps?q=${lat},${lon}`;
}

/** After a real user triggers the shield, nearby mock users message them (sim only). */
export async function spawnSimulatorSafetyResponders(alert: SafetySignalAlert): Promise<string[]> {
  if (!isSimulatorEnabled()) return [];
  const mocks = getSimulatorUsers().filter((m) => m.location && !isSimulatorUserId(alert.userId));
  const nearby = mocks
    .map((m) => ({
      m,
      d: haversineKm(alert.lat, alert.lon, m.location!.lat, m.location!.lon),
    }))
    .filter((x) => x.d <= 15)
    .sort((a, b) => a.d - b.d)
    .slice(0, 4);

  // If none near, relocate a few mocks and still message
  const actors =
    nearby.length > 0
      ? nearby.map((x) => x.m)
      : mocks.slice(0, 3).map((m) => ({
          ...m,
          location: {
            lat: alert.lat + (Math.random() - 0.5) * 0.01,
            lon: alert.lon + (Math.random() - 0.5) * 0.01,
            updatedAt: new Date(),
          },
        }));

  const ids: string[] = [];
  let i = 0;
  for (const actor of actors) {
    ids.push(actor.id);
    const delay = 800 + i * 1600;
    const line = `${CHECK_INS[i % CHECK_INS.length]} Your pin: ${alert.lat.toFixed(5)}, ${alert.lon.toFixed(5)} — ${mapsLink(alert.lat, alert.lon)}`;
    i += 1;
    setTimeout(() => {
      void createMessage({
        fromUserId: actor.id,
        toUserId: alert.userId,
        content: line,
      }).catch(() => {});
    }, delay);
  }
  return ids;
}
