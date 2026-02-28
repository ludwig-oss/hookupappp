declare module 'web-push' {
  export interface RequestOptions {
    vapidDetails?: { subject: string; publicKey: string; privateKey: string };
    TTL?: number;
    urgency?: 'very-low' | 'low' | 'normal' | 'high';
  }
  export function setVapidDetails(
    mailto: string,
    publicKey: string,
    privateKey: string
  ): void;
  export function sendNotification(
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
    payload: string,
    options?: RequestOptions
  ): Promise<{ statusCode: number }>;
  export function generateVAPIDKeys(): { publicKey: string; privateKey: string };
}
