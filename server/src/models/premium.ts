import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

export type PremiumPlanType = 'monthly' | 'yearly' | 'lifetime';

export interface PremiumPlan {
  id: string;
  name: string;
  type: PremiumPlanType;
  price: number;
  currency: string;
  features: string[];
  popular?: boolean;
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

const defaultPlans: PremiumPlan[] = [
  {
    id: 'premium_monthly',
    name: 'Premium Monthly',
    type: 'monthly',
    price: 9.99,
    currency: 'USD',
    features: [
      'Unlimited likes',
      'See who liked you',
      'Advanced filters',
      'Read receipts',
      'Priority support',
      'No ads',
    ],
  },
  {
    id: 'premium_yearly',
    name: 'Premium Yearly',
    type: 'yearly',
    price: 79.99,
    currency: 'USD',
    features: [
      'Everything in Monthly',
      'Save 33%',
      'Exclusive badges',
      'Profile boost',
      'Super likes',
    ],
    popular: true,
  },
  {
    id: 'premium_lifetime',
    name: 'Premium Lifetime',
    type: 'lifetime',
    price: 199.99,
    currency: 'USD',
    features: [
      'Everything in Yearly',
      'Lifetime access',
      'Exclusive lifetime badge',
      'Early access to features',
      'VIP support',
    ],
  },
];

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
  return defaultPlans;
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



