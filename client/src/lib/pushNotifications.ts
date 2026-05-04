import axios from 'axios';
import { API_BASE } from '../api/config';

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch {
    return null;
  }
}

/**
 * Subscribe this device for Web Push (shows system notifications on phone/desktop when app is in background).
 * Requires browser permission and server VAPID keys.
 */
export async function subscribeUserToWebPush(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;

  const reg = await registerServiceWorker();
  if (!reg) return false;

  let perm = Notification.permission;
  if (perm === 'default') {
    perm = await Notification.requestPermission();
  }
  if (perm !== 'granted') return false;

  try {
    const { data } = await axios.get<{ publicKey?: string }>(`${API_BASE}/api/notifications/vapid-public`);
    if (!data?.publicKey) return false;

    const existing = await reg.pushManager.getSubscription();
    if (existing) {
      await axios.post(`${API_BASE}/api/notifications/push-subscribe`, {
        subscription: existing.toJSON(),
      });
      return true;
    }

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(data.publicKey),
    });

    await axios.post(`${API_BASE}/api/notifications/push-subscribe`, {
      subscription: sub.toJSON(),
    });
    return true;
  } catch {
    return false;
  }
}
