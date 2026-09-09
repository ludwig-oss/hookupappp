/**
 * Shared Stripe client for hosted Checkout and PaymentIntents.
 * Secrets: STRIPE_SECRET_KEY (required), FRONTEND_URL for return links.
 */
import Stripe from 'stripe';
import type { Request } from 'express';

export function isStripeConfigured(): boolean {
  return Boolean((process.env.STRIPE_SECRET_KEY || '').trim());
}

export function getStripe(): Stripe {
  const key = (process.env.STRIPE_SECRET_KEY || '').trim();
  if (!key) {
    throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY.');
  }
  return new Stripe(key, {
    apiVersion: '2024-06-20.acacia' as '2023-10-16',
  });
}

export function stripeFrontendBase(req?: Request): string {
  const fromEnv = (process.env.FRONTEND_URL || '').trim().replace(/\/$/, '');
  const origin = String(req?.headers?.origin || '').replace(/\/$/, '');
  if (origin && /hookupapp\.dev|vercel\.app|localhost/i.test(origin)) return origin;
  if (fromEnv) return fromEnv;
  return 'https://hookupapp.dev';
}

export function formatEurCents(amountEur: number): number {
  return Math.round(amountEur * 100);
}
