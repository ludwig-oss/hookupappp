/**
 * Web Push notifications: store subscriptions per user and send push when new message or new match.
 * Requires VAPID keys (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY) and optional VAPID_MAILTO in env.
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { getUserSettings } from '../models/settings.js';
import { getUserById } from '../models/user.js';
import { sendAppNotificationEmail } from '../utils/email.js';
import {
  inferNotifyCategory,
  shouldSendEmail,
  shouldSendPush,
  type NotifyCategory,
} from './notifyPrefs.js';

export interface PushSubscriptionRecord {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  expirationTime?: number | null;
}

const SUBSCRIPTIONS_PATH = join(process.cwd(), 'server', 'data', 'push-subscriptions.json');

async function readSubscriptions(): Promise<Record<string, PushSubscriptionRecord[]>> {
  try {
    const data = await readFile(SUBSCRIPTIONS_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

async function writeSubscriptions(subs: Record<string, PushSubscriptionRecord[]>): Promise<void> {
  const dir = join(process.cwd(), 'server', 'data');
  await mkdir(dir, { recursive: true });
  await writeFile(SUBSCRIPTIONS_PATH, JSON.stringify(subs, null, 2), 'utf-8');
}

export function isPushConfigured(): boolean {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY &&
    process.env.VAPID_PRIVATE_KEY
  );
}

/** Register a push subscription for a user (from browser PushManager.subscribe()). */
export async function addPushSubscription(userId: string, subscription: PushSubscriptionRecord): Promise<void> {
  const subs = await readSubscriptions();
  const list = subs[userId] ?? [];
  const exists = list.some((s) => s.endpoint === subscription.endpoint);
  if (!exists) {
    list.push(subscription);
    subs[userId] = list;
    await writeSubscriptions(subs);
  }
}

/** Remove a subscription (e.g. on logout). */
export async function removePushSubscription(userId: string, endpoint: string): Promise<void> {
  const subs = await readSubscriptions();
  const list = (subs[userId] ?? []).filter((s) => s.endpoint !== endpoint);
  if (list.length === 0) delete subs[userId];
  else subs[userId] = list;
  await writeSubscriptions(subs);
}

/** Send a push notification to all subscriptions of a user. Fire-and-forget. */
export async function sendPushToUser(
  userId: string,
  payload: { title: string; body?: string; data?: Record<string, string> },
  category?: NotifyCategory
): Promise<void> {
  const cat = category || inferNotifyCategory(payload.data);
  let settings;
  try {
    settings = await getUserSettings(userId);
  } catch {
    settings = null;
  }

  if (settings && !shouldSendPush(settings, cat)) {
    // still try email if push is off but email is on
  } else if (isPushConfigured()) {
    const subs = await readSubscriptions();
    const list = subs[userId];
    if (list?.length) {
      const webPush = await import('web-push');
      const vapidPublic = process.env.VAPID_PUBLIC_KEY!;
      const vapidPrivate = process.env.VAPID_PRIVATE_KEY!;
      const mailto = process.env.VAPID_MAILTO || 'mailto:support@example.com';
      webPush.default.setVapidDetails(mailto, vapidPublic, vapidPrivate);

      const vibrateOn =
        cat === 'interest'
          ? settings?.notifications.interestVibrate !== false
          : settings?.notifications.sound !== false;
      const silent = settings?.notifications.sound === false;

      const payloadObj: Record<string, string> = {
        title: payload.title,
        ...(payload.body != null && payload.body !== '' ? { body: payload.body } : {}),
        ...(payload.data || {}),
        vibrate: vibrateOn ? '1' : '0',
        silent: silent ? '1' : '0',
        type: payload.data?.type || cat,
      };
      const payloadStr = JSON.stringify(payloadObj);

      for (const sub of list) {
        try {
          await webPush.default.sendNotification(
            { endpoint: sub.endpoint, keys: sub.keys },
            payloadStr
          );
        } catch (err) {
          console.warn('Push send failed for', userId, (err as Error).message);
        }
      }
    }
  }

  if (settings && shouldSendEmail(settings, cat) && payload.title) {
    try {
      const user = await getUserById(userId);
      if (user?.email && !user.email.includes('@noreply.local')) {
        await sendAppNotificationEmail(
          user.email,
          user.name || user.username || 'there',
          payload.title,
          payload.body || payload.title
        );
      }
    } catch {
      /* email optional */
    }
  }
}
