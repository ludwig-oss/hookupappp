import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

export type PremiumPlanType = 'monthly' | 'yearly' | 'lifetime';
export type PremiumTier = 'free' | 'plus' | 'gold' | 'platinum';
export type PremiumFeature =
  | 'unlimited_searches'
  | 'pitch_on_reject'
  | 'unlimited_countries'
  | 'guide_lawyer'
  | 'direct_pitch';

export interface PremiumPlan {
  id: string;
  name: string;
  type: PremiumPlanType;
  price: number;
  currency: string;
  features: string[];
  popular?: boolean;
  tier?: PremiumTier;
  headline?: string;
  weeklyPrice?: number;
  savePercent?: number;
  theme?: 'plus' | 'gold' | 'platinum';
}

export interface PremiumSubscription {
  userId: string;
  planId: string;
  planType: PremiumPlanType;
  status: 'active' | 'cancelled' | 'expired';
  startDate: Date | string;
  endDate: Date | string | null;
  autoRenew: boolean;
  paymentMethod: string;
  lastPaymentDate: Date | string | null;
  nextPaymentDate: Date | string | null;
}

export interface PaymentHistory {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  planId: string;
  planName: string;
  paymentDate: Date | string;
  status: 'completed' | 'pending' | 'failed';
  transactionId: string | null;
}

const PREMIUM_PATH = join(process.cwd(), 'server', 'data', 'premium.json');
const PAYMENTS_PATH = join(process.cwd(), 'server', 'data', 'payments.json');

const TIER_FEATURES: Record<Exclude<PremiumTier, 'free'>, PremiumFeature[]> = {
  plus: ['unlimited_searches', 'pitch_on_reject', 'unlimited_countries'],
  gold: ['unlimited_searches', 'pitch_on_reject', 'unlimited_countries', 'guide_lawyer'],
  platinum: ['unlimited_searches', 'pitch_on_reject', 'unlimited_countries', 'guide_lawyer', 'direct_pitch'],
};

const defaultPlans: PremiumPlan[] = [
  {
    id: 'plus_monthly',
    name: 'Plus',
    type: 'monthly',
    price: 68,
    currency: 'EUR',
    weeklyPrice: 15.69,
    savePercent: 59,
    theme: 'plus',
    tier: 'plus',
    headline: 'Unlimited date searches. Pitch after a no. Unlimited other-country interest.',
    features: [
      'Unlimited Date Arena searches (free accounts get 3 per month)',
      'Pitch yourself when someone declines your interest',
      'Unlimited search in other countries and show interest',
    ],
  },
  {
    id: 'gold_monthly',
    name: 'Gold',
    type: 'monthly',
    price: 114,
    currency: 'EUR',
    weeklyPrice: 26.31,
    savePercent: 58,
    theme: 'gold',
    tier: 'gold',
    popular: true,
    headline: 'A guide hand-picks a date and pitches for you like your lawyer.',
    features: [
      'Everything in Plus',
      'Summon a guide to hand-pick a potential date',
      'Private 3-person pitch room until they say yes or no',
      'Your guide gets a cut at the end of each month',
    ],
  },
  {
    id: 'platinum_monthly',
    name: 'Platinum',
    type: 'monthly',
    price: 189,
    currency: 'EUR',
    weeklyPrice: 43.62,
    savePercent: 70,
    theme: 'platinum',
    tier: 'platinum',
    headline: 'Pitch yourself directly — no interest tap required.',
    features: [
      'Everything in Gold',
      'Direct pitch without showing interest first',
      'They approve or reject your pitch',
    ],
  },
  // Aliases so older subscriptions keep working
  {
    id: 'premium_monthly',
    name: 'Plus',
    type: 'monthly',
    price: 68,
    currency: 'EUR',
    theme: 'plus',
    tier: 'plus',
    headline: 'Unlimited date searches. Pitch after a no. Unlimited other-country interest.',
    features: ['Unlimited Date Arena searches', 'Pitch after a decline', 'Unlimited other-country interest'],
  },
  {
    id: 'premium_yearly',
    name: 'Gold',
    type: 'yearly',
    price: 1140,
    currency: 'EUR',
    theme: 'gold',
    tier: 'gold',
    popular: true,
    features: ['Everything in Plus', 'Guide lawyer / hand-pick'],
  },
  {
    id: 'premium_lifetime',
    name: 'Platinum',
    type: 'lifetime',
    price: 1890,
    currency: 'EUR',
    theme: 'platinum',
    tier: 'platinum',
    features: ['Everything in Gold', 'Direct pitch'],
  },
];

const PUBLIC_PLAN_IDS = new Set(['plus_monthly', 'gold_monthly', 'platinum_monthly']);

export function planTier(planId: string | null | undefined): PremiumTier {
  if (!planId) return 'free';
  const plan = defaultPlans.find((p) => p.id === planId);
  return plan?.tier || 'free';
}

export function featuresForTier(tier: PremiumTier): PremiumFeature[] {
  if (tier === 'free') return [];
  return TIER_FEATURES[tier];
}

export async function getUserTier(userId: string): Promise<PremiumTier> {
  const sub = await getUserSubscription(userId);
  return planTier(sub?.planId);
}

export async function userHasFeature(userId: string, feature: PremiumFeature): Promise<boolean> {
  const tier = await getUserTier(userId);
  return featuresForTier(tier).includes(feature);
}

async function readSubscriptions(): Promise<PremiumSubscription[]> {
  try {
    const data = await readFile(PREMIUM_PATH, 'utf-8');
    const subscriptions = JSON.parse(data);
    return subscriptions.map((s: PremiumSubscription) => ({
      ...s,
      startDate: s.startDate ? new Date(s.startDate) : new Date(),
      endDate: s.endDate ? new Date(s.endDate) : null,
      lastPaymentDate: s.lastPaymentDate ? new Date(s.lastPaymentDate) : null,
      nextPaymentDate: s.nextPaymentDate ? new Date(s.nextPaymentDate) : null,
    }));
  } catch {
    return [];
  }
}

async function writeSubscriptions(subscriptions: PremiumSubscription[]): Promise<void> {
  const dir = join(process.cwd(), 'server', 'data');
  await import('fs/promises').then(fs => fs.mkdir(dir, { recursive: true }));
  await writeFile(PREMIUM_PATH, JSON.stringify(subscriptions, null, 2));
}

async function readPayments(): Promise<PaymentHistory[]> {
  try {
    const data = await readFile(PAYMENTS_PATH, 'utf-8');
    const payments = JSON.parse(data);
    return payments.map((p: PaymentHistory) => ({
      ...p,
      paymentDate: p.paymentDate ? new Date(p.paymentDate) : new Date(),
    }));
  } catch {
    return [];
  }
}

async function writePayments(payments: PaymentHistory[]): Promise<void> {
  const dir = join(process.cwd(), 'server', 'data');
  await import('fs/promises').then(fs => fs.mkdir(dir, { recursive: true }));
  await writeFile(PAYMENTS_PATH, JSON.stringify(payments, null, 2));
}

export async function getPremiumPlans(): Promise<PremiumPlan[]> {
  return defaultPlans.filter((p) => PUBLIC_PLAN_IDS.has(p.id));
}

export async function getPremiumPlan(planId: string): Promise<PremiumPlan | null> {
  return defaultPlans.find(p => p.id === planId) || null;
}

export async function getUserSubscription(userId: string): Promise<PremiumSubscription | null> {
  const subscriptions = await readSubscriptions();
  const subscription = subscriptions.find(s => s.userId === userId && s.status === 'active');
  
  if (subscription) {
    // Check if expired
    if (subscription.endDate && new Date(subscription.endDate) < new Date()) {
      subscription.status = 'expired';
      await writeSubscriptions(subscriptions);
      return null;
    }
    return subscription;
  }
  
  return null;
}

export async function createSubscription(userId: string, planId: string, transactionId: string): Promise<PremiumSubscription> {
  const subscriptions = await readSubscriptions();
  const plan = await getPremiumPlan(planId);
  
  if (!plan) {
    throw new Error('Plan not found');
  }
  
  // Cancel existing subscription
  const existing = subscriptions.find(s => s.userId === userId && s.status === 'active');
  if (existing) {
    existing.status = 'cancelled';
  }
  
  const startDate = new Date();
  let endDate: Date | null = null;
  
  if (plan.type === 'monthly') {
    endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);
  } else if (plan.type === 'yearly') {
    endDate = new Date(startDate);
    endDate.setFullYear(endDate.getFullYear() + 1);
  } else if (plan.type === 'lifetime') {
    endDate = null; // Never expires
  }
  
  const subscription: PremiumSubscription = {
    userId,
    planId,
    planType: plan.type,
    status: 'active',
    startDate,
    endDate,
    autoRenew: plan.type !== 'lifetime',
    paymentMethod: 'stripe',
    lastPaymentDate: startDate,
    nextPaymentDate: plan.type === 'lifetime' ? null : endDate,
  };
  
  subscriptions.push(subscription);
  await writeSubscriptions(subscriptions);
  
  // Add payment history
  await addPaymentHistory(userId, plan.price, plan.currency, planId, plan.name, transactionId);
  
  return subscription;
}

export async function cancelSubscription(userId: string): Promise<boolean> {
  const subscriptions = await readSubscriptions();
  const subscription = subscriptions.find(s => s.userId === userId && s.status === 'active');
  
  if (subscription) {
    subscription.status = 'cancelled';
    subscription.autoRenew = false;
    await writeSubscriptions(subscriptions);
    return true;
  }
  
  return false;
}

async function addPaymentHistory(userId: string, amount: number, currency: string, planId: string, planName: string, transactionId: string | null): Promise<void> {
  const payments = await readPayments();
  const payment: PaymentHistory = {
    id: Date.now().toString(),
    userId,
    amount,
    currency,
    planId,
    planName,
    paymentDate: new Date(),
    status: 'completed',
    transactionId,
  };
  payments.push(payment);
  await writePayments(payments);
}

export async function getPaymentHistory(userId: string): Promise<PaymentHistory[]> {
  const payments = await readPayments();
  return payments.filter(p => p.userId === userId).sort((a, b) => 
    new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()
  );
}



