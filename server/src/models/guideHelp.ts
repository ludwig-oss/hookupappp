import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { getUserSubscription } from './premium.js';

export const FREE_GUIDE_HELPS = 5;
export const AI_HELP_PRICE_EUR = Number(process.env.AI_HELP_PRICE_EUR || 9.9);

const DB_PATH = join(process.cwd(), 'server', 'data', 'guide-help.json');

export type GuideHelpKind = 'fashion' | 'appearance' | 'intimacy' | 'termact' | 'lesson' | 'date-tips';

export interface GuideHelpAccount {
  userId: string;
  freeUsed: number;
  paidCredits: number;
  lastHelpAt: string | null;
  lastKind: GuideHelpKind | null;
  processedPaymentIds?: string[];
}

export interface GuideHelpStatus {
  allowed: boolean;
  isPremium: boolean;
  freeUsed: number;
  freeRemaining: number;
  paidCredits: number;
  priceEur: number;
  code?: 'OK' | 'GUIDE_HELP_REQUIRED';
}

async function readAll(): Promise<GuideHelpAccount[]> {
  try {
    return JSON.parse(await readFile(DB_PATH, 'utf-8'));
  } catch {
    return [];
  }
}

async function writeAll(list: GuideHelpAccount[]): Promise<void> {
  const dir = join(process.cwd(), 'server', 'data');
  await mkdir(dir, { recursive: true });
  await writeFile(DB_PATH, JSON.stringify(list, null, 2));
}

function emptyAccount(userId: string): GuideHelpAccount {
  return { userId, freeUsed: 0, paidCredits: 0, lastHelpAt: null, lastKind: null, processedPaymentIds: [] };
}

export async function getGuideHelpAccount(userId: string): Promise<GuideHelpAccount> {
  const list = await readAll();
  return list.find((a) => a.userId === userId) || emptyAccount(userId);
}

async function saveAccount(acc: GuideHelpAccount): Promise<GuideHelpAccount> {
  const list = await readAll();
  const i = list.findIndex((a) => a.userId === acc.userId);
  if (i >= 0) list[i] = acc;
  else list.push(acc);
  await writeAll(list);
  return acc;
}

export async function isGuideHelpPremium(userId: string): Promise<boolean> {
  const sub = await getUserSubscription(userId);
  return Boolean(sub);
}

export async function getGuideHelpStatus(userId: string): Promise<GuideHelpStatus> {
  const isPremium = await isGuideHelpPremium(userId);
  const acc = await getGuideHelpAccount(userId);
  const freeRemaining = Math.max(0, FREE_GUIDE_HELPS - acc.freeUsed);
  const allowed = isPremium || acc.paidCredits > 0 || freeRemaining > 0;
  return {
    allowed,
    isPremium,
    freeUsed: acc.freeUsed,
    freeRemaining,
    paidCredits: acc.paidCredits,
    priceEur: AI_HELP_PRICE_EUR,
    code: allowed ? 'OK' : 'GUIDE_HELP_REQUIRED',
  };
}

export async function consumeGuideHelp(
  userId: string,
  kind: GuideHelpKind
): Promise<GuideHelpStatus> {
  const isPremium = await isGuideHelpPremium(userId);
  const acc = await getGuideHelpAccount(userId);
  if (isPremium) {
    acc.lastHelpAt = new Date().toISOString();
    acc.lastKind = kind;
    await saveAccount(acc);
    return getGuideHelpStatus(userId);
  }
  if (acc.paidCredits > 0) {
    acc.paidCredits -= 1;
    acc.lastHelpAt = new Date().toISOString();
    acc.lastKind = kind;
    await saveAccount(acc);
    return getGuideHelpStatus(userId);
  }
  if (acc.freeUsed < FREE_GUIDE_HELPS) {
    acc.freeUsed += 1;
    acc.lastHelpAt = new Date().toISOString();
    acc.lastKind = kind;
    await saveAccount(acc);
    return getGuideHelpStatus(userId);
  }
  return {
    allowed: false,
    isPremium: false,
    freeUsed: acc.freeUsed,
    freeRemaining: 0,
    paidCredits: 0,
    priceEur: AI_HELP_PRICE_EUR,
    code: 'GUIDE_HELP_REQUIRED',
  };
}

export async function grantPaidGuideHelpCredit(
  userId: string,
  count = 1,
  paymentId?: string
): Promise<{ account: GuideHelpAccount; alreadyCredited: boolean }> {
  const acc = await getGuideHelpAccount(userId);
  if (paymentId && (acc.processedPaymentIds || []).includes(paymentId)) {
    return { account: acc, alreadyCredited: true };
  }
  acc.paidCredits += count;
  if (paymentId) acc.processedPaymentIds = [...(acc.processedPaymentIds || []), paymentId];
  return { account: await saveAccount(acc), alreadyCredited: false };
}
