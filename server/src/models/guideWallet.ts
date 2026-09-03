import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { formatPayPalMoney, isPayPalConfigured, paypalRequest, platformFeeInstruction } from '../lib/paypal.js';
import {
  listOpenHolds,
  listHoldsForUser,
  markHoldCaptured,
  type PaypalAuthorizationHold,
} from './paypalHolds.js';

/** Session split: 80% guide, 20% app fee */
export const GUIDE_EARNINGS_PERCENT = 80;
export const PLATFORM_FEE_PERCENT = 20;
export const MIN_WITHDRAWAL_EUR = 20;

export type PaypalOnboardingStatus = 'not_started' | 'pending' | 'active' | 'denied';

export interface GuideWallet {
  userId: string;
  availableBalanceEur: number;
  /** Authorized session holds waiting for Withdraw (capture). */
  heldBalanceEur: number;
  /** In-flight prize/admin withdrawals. */
  pendingBalanceEur: number;
  totalEarnedEur: number;
  totalWithdrawnEur: number;
  paypalEmail: string | null;
  paypalMerchantId: string | null;
  paypalOnboardingStatus: PaypalOnboardingStatus;
  paypalTrackingId: string | null;
  bankAccountLabel?: string | null;
  updatedAt: string;
}

export interface WalletTransaction {
  id: string;
  userId: string;
  type: 'session_earning' | 'hold_earning' | 'platform_fee' | 'withdrawal' | 'withdrawal_refund' | 'advice_prize' | 'platform_fee_deduct' | 'date_fine' | 'lawyer_cut';
  amountEur: number;
  netToGuideEur?: number;
  platformFeeEur?: number;
  requestId?: string;
  bookingId?: string;
  note?: string;
  createdAt: string;
}

export interface WithdrawalRequest {
  id: string;
  userId: string;
  amountEur: number;
  method: 'paypal';
  paypalEmail: string;
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  createdAt: string;
  processedAt: string | null;
  adminNote?: string;
  capturedAuthorizationIds?: string[];
  captureIds?: string[];
  payoutBatchId?: string | null;
}

const WALLETS_PATH = join(process.cwd(), 'server', 'data', 'guide-wallets.json');
const TX_PATH = join(process.cwd(), 'server', 'data', 'guide-wallet-transactions.json');
const WITHDRAWALS_PATH = join(process.cwd(), 'server', 'data', 'guide-withdrawals.json');

async function readWallets(): Promise<GuideWallet[]> {
  try {
    return JSON.parse(await readFile(WALLETS_PATH, 'utf-8'));
  } catch {
    return [];
  }
}

async function writeWallets(list: GuideWallet[]): Promise<void> {
  const dir = join(process.cwd(), 'server', 'data');
  await mkdir(dir, { recursive: true });
  await writeFile(WALLETS_PATH, JSON.stringify(list, null, 2));
}

async function readTransactions(): Promise<WalletTransaction[]> {
  try {
    return JSON.parse(await readFile(TX_PATH, 'utf-8'));
  } catch {
    return [];
  }
}

async function writeTransactions(list: WalletTransaction[]): Promise<void> {
  const dir = join(process.cwd(), 'server', 'data');
  await mkdir(dir, { recursive: true });
  await writeFile(TX_PATH, JSON.stringify(list, null, 2));
}

async function readWithdrawals(): Promise<WithdrawalRequest[]> {
  try {
    return JSON.parse(await readFile(WITHDRAWALS_PATH, 'utf-8'));
  } catch {
    return [];
  }
}

async function writeWithdrawals(list: WithdrawalRequest[]): Promise<void> {
  const dir = join(process.cwd(), 'server', 'data');
  await mkdir(dir, { recursive: true });
  await writeFile(WITHDRAWALS_PATH, JSON.stringify(list, null, 2));
}

export function splitSessionPayment(grossEur: number): { guideShare: number; platformFee: number } {
  const guideShare = Math.round(grossEur * (GUIDE_EARNINGS_PERCENT / 100) * 100) / 100;
  const platformFee = Math.round((grossEur - guideShare) * 100) / 100;
  return { guideShare, platformFee };
}

function normalizeWallet(w: GuideWallet): GuideWallet {
  return {
    userId: w.userId,
    availableBalanceEur: w.availableBalanceEur ?? 0,
    heldBalanceEur: w.heldBalanceEur ?? 0,
    pendingBalanceEur: w.pendingBalanceEur ?? 0,
    totalEarnedEur: w.totalEarnedEur ?? 0,
    totalWithdrawnEur: w.totalWithdrawnEur ?? 0,
    paypalEmail: w.paypalEmail ?? null,
    paypalMerchantId: w.paypalMerchantId ?? null,
    paypalOnboardingStatus: w.paypalOnboardingStatus ?? 'not_started',
    paypalTrackingId: w.paypalTrackingId ?? null,
    bankAccountLabel: w.bankAccountLabel ?? null,
    updatedAt: w.updatedAt || new Date().toISOString(),
  };
}

async function saveWallet(wallet: GuideWallet): Promise<GuideWallet> {
  const wallets = await readWallets();
  const next = normalizeWallet({ ...wallet, updatedAt: new Date().toISOString() });
  const idx = wallets.findIndex((x) => x.userId === wallet.userId);
  if (idx >= 0) wallets[idx] = next;
  else wallets.push(next);
  await writeWallets(wallets);
  return next;
}

export async function getOrCreateWallet(userId: string): Promise<GuideWallet> {
  const wallets = await readWallets();
  let w = wallets.find((x) => x.userId === userId);
  if (!w) {
    w = {
      userId,
      availableBalanceEur: 0,
      heldBalanceEur: 0,
      pendingBalanceEur: 0,
      totalEarnedEur: 0,
      totalWithdrawnEur: 0,
      paypalEmail: null,
      paypalMerchantId: null,
      paypalOnboardingStatus: 'not_started',
      paypalTrackingId: null,
      bankAccountLabel: null,
      updatedAt: new Date().toISOString(),
    };
    wallets.push(w);
    await writeWallets(wallets);
    return w;
  }
  const normalized = normalizeWallet(w);
  if (
    w.heldBalanceEur === undefined ||
    w.paypalMerchantId === undefined ||
    w.paypalOnboardingStatus === undefined
  ) {
    await saveWallet(normalized);
  }
  return normalized;
}

export async function setWalletPaypalEmail(userId: string, paypalEmail: string): Promise<GuideWallet> {
  const w = await getOrCreateWallet(userId);
  w.paypalEmail = paypalEmail.trim() || null;
  return saveWallet(w);
}

export async function setWalletPaypalMerchant(
  userId: string,
  params: {
    merchantId: string;
    status?: PaypalOnboardingStatus;
    trackingId?: string | null;
  }
): Promise<GuideWallet> {
  const w = await getOrCreateWallet(userId);
  w.paypalMerchantId = params.merchantId.trim() || null;
  w.paypalOnboardingStatus = params.status || (w.paypalMerchantId ? 'active' : w.paypalOnboardingStatus);
  if (params.trackingId !== undefined) w.paypalTrackingId = params.trackingId;
  return saveWallet(w);
}

export async function setWalletPaypalOnboardingStatus(
  userId: string,
  status: PaypalOnboardingStatus,
  trackingId?: string
): Promise<GuideWallet> {
  const w = await getOrCreateWallet(userId);
  w.paypalOnboardingStatus = status;
  if (trackingId) w.paypalTrackingId = trackingId;
  return saveWallet(w);
}

/** Credit guide after Stripe (or other immediate) prepay. Funds available immediately. */
export async function creditGuideSessionPayment(params: {
  guideUserId: string;
  grossEur: number;
  requestId?: string;
  bookingId?: string;
  paymentMethod: 'paypal' | 'stripe';
}): Promise<{ guideShare: number; platformFee: number }> {
  const { guideShare, platformFee } = splitSessionPayment(params.grossEur);
  const w = await getOrCreateWallet(params.guideUserId);
  w.availableBalanceEur = Math.round((w.availableBalanceEur + guideShare) * 100) / 100;
  w.totalEarnedEur = Math.round((w.totalEarnedEur + guideShare) * 100) / 100;
  await saveWallet(w);

  const txs = await readTransactions();
  const now = new Date().toISOString();
  txs.push({
    id: Date.now().toString() + '-earn',
    userId: params.guideUserId,
    type: 'session_earning',
    amountEur: params.grossEur,
    netToGuideEur: guideShare,
    platformFeeEur: platformFee,
    requestId: params.requestId,
    bookingId: params.bookingId,
    note: `Session prepay via ${params.paymentMethod}`,
    createdAt: now,
  });
  txs.push({
    id: Date.now().toString() + '-fee',
    userId: 'platform',
    type: 'platform_fee',
    amountEur: platformFee,
    platformFeeEur: platformFee,
    requestId: params.requestId,
    bookingId: params.bookingId,
    note: 'Platform fee (20%)',
    createdAt: now,
  });
  await writeTransactions(txs);

  const { sendPushToUser } = await import('../realtime/push.js');
  const { notifyWalletUpdate } = await import('../realtime/notifications.js');
  notifyWalletUpdate(params.guideUserId, {
    amountEur: guideShare,
    reason: `Session prepay (€${platformFee} platform fee deducted)`,
  });
  sendPushToUser(params.guideUserId, {
    title: '€' + guideShare + ' added to your balance',
    body: `Client prepaid session. App fee €${platformFee}. Withdraw in Settings → Account balance.`,
    data: { type: 'wallet_credit', amountEur: String(guideShare) },
  }).catch(() => {});

  return { guideShare, platformFee };
}

/** Credit after PayPal AUTHORIZE — held until the guide clicks Withdraw (capture). */
export async function holdGuideSessionPayment(params: {
  guideUserId: string;
  grossEur: number;
  requestId?: string;
  bookingId?: string;
}): Promise<{ guideShare: number; platformFee: number }> {
  const { guideShare, platformFee } = splitSessionPayment(params.grossEur);
  const w = await getOrCreateWallet(params.guideUserId);
  w.heldBalanceEur = Math.round((w.heldBalanceEur + guideShare) * 100) / 100;
  w.totalEarnedEur = Math.round((w.totalEarnedEur + guideShare) * 100) / 100;
  await saveWallet(w);

  const txs = await readTransactions();
  const now = new Date().toISOString();
  txs.push({
    id: Date.now().toString() + '-hold',
    userId: params.guideUserId,
    type: 'hold_earning',
    amountEur: params.grossEur,
    netToGuideEur: guideShare,
    platformFeeEur: platformFee,
    requestId: params.requestId,
    bookingId: params.bookingId,
    note: 'Session authorized — held until you withdraw',
    createdAt: now,
  });
  txs.push({
    id: Date.now().toString() + '-fee',
    userId: 'platform',
    type: 'platform_fee',
    amountEur: platformFee,
    platformFeeEur: platformFee,
    requestId: params.requestId,
    bookingId: params.bookingId,
    note: 'Platform fee (20%) reserved on hold',
    createdAt: now,
  });
  await writeTransactions(txs);

  const { sendPushToUser } = await import('../realtime/push.js');
  const { notifyWalletUpdate } = await import('../realtime/notifications.js');
  notifyWalletUpdate(params.guideUserId, {
    amountEur: guideShare,
    reason: `Session held (€${platformFee} app fee reserved until withdraw)`,
  });
  sendPushToUser(params.guideUserId, {
    title: '€' + guideShare + ' held in your wallet',
    body: `Client prepaid. Funds stay held until you tap Withdraw. App fee €${platformFee}.`,
    data: { type: 'wallet_hold', amountEur: String(guideShare) },
  }).catch(() => {});

  return { guideShare, platformFee };
}

/** Credit any user (date cancellation fine, monthly lawyer cut). Withdrawable in Settings. */
export async function creditUserBalance(params: {
  userId: string;
  amountEur: number;
  type: 'date_fine' | 'lawyer_cut' | 'advice_prize';
  note: string;
}): Promise<void> {
  const amount = Math.round(params.amountEur * 100) / 100;
  if (amount <= 0) return;
  const w = await getOrCreateWallet(params.userId);
  w.availableBalanceEur = Math.round((w.availableBalanceEur + amount) * 100) / 100;
  w.totalEarnedEur = Math.round((w.totalEarnedEur + amount) * 100) / 100;
  await saveWallet(w);

  const txs = await readTransactions();
  txs.push({
    id: Date.now().toString() + '-' + params.type,
    userId: params.userId,
    type: params.type,
    amountEur: amount,
    note: params.note,
    createdAt: new Date().toISOString(),
  });
  await writeTransactions(txs);

  const { sendPushToUser } = await import('../realtime/push.js');
  const { notifyWalletUpdate } = await import('../realtime/notifications.js');
  notifyWalletUpdate(params.userId, { amountEur: amount, reason: params.note });
  sendPushToUser(params.userId, {
    title: '€' + amount.toFixed(2) + ' added to your balance',
    body: params.note + ' Withdraw in Settings → Account.',
    data: { type: params.type, amountEur: String(amount) },
  }).catch(() => {});
}

/** Monthly dating advice prize — €5 to balance. */
export async function creditAdvicePrize(
  userId: string,
  amountEur: number,
  answerId: string,
  cohort: string,
  monthKey: string
): Promise<void> {
  const w = await getOrCreateWallet(userId);
  w.availableBalanceEur = Math.round((w.availableBalanceEur + amountEur) * 100) / 100;
  w.totalEarnedEur = Math.round((w.totalEarnedEur + amountEur) * 100) / 100;
  await saveWallet(w);

  const txs = await readTransactions();
  txs.push({
    id: Date.now().toString() + '-advice',
    userId,
    type: 'advice_prize',
    amountEur,
    note: `Best advice ${monthKey} (${cohort})`,
    createdAt: new Date().toISOString(),
  });
  await writeTransactions(txs);

  const { sendPushToUser } = await import('../realtime/push.js');
  const { notifyWalletUpdate } = await import('../realtime/notifications.js');
  notifyWalletUpdate(userId, { amountEur, reason: 'Monthly advice prize' });
  sendPushToUser(userId, {
    title: 'You won €' + amountEur + ' for best advice!',
    body: 'Prize added to your balance. Withdraw via PayPal or bank details in Settings.',
    data: { type: 'advice_prize', amountEur: String(amountEur) },
  }).catch(() => {});
}

export async function setWalletBankLabel(userId: string, bankAccountLabel: string): Promise<GuideWallet> {
  const w = await getOrCreateWallet(userId);
  w.bankAccountLabel = bankAccountLabel.trim() || null;
  return saveWallet(w);
}

export async function getWalletSummary(userId: string): Promise<{
  wallet: GuideWallet;
  recentTransactions: WalletTransaction[];
  pendingWithdrawals: WithdrawalRequest[];
  holds: PaypalAuthorizationHold[];
  paypalConnected: boolean;
}> {
  const wallet = await getOrCreateWallet(userId);
  const txs = await readTransactions();
  const withdrawals = await readWithdrawals();
  const holds = await listHoldsForUser(userId);
  return {
    wallet,
    recentTransactions: txs.filter((t) => t.userId === userId).slice(-20).reverse(),
    pendingWithdrawals: withdrawals.filter((w) => w.userId === userId && (w.status === 'pending' || w.status === 'processing')),
    holds,
    paypalConnected: Boolean(wallet.paypalMerchantId && wallet.paypalOnboardingStatus === 'active'),
  };
}

async function capturePaypalHold(hold: PaypalAuthorizationHold): Promise<string> {
  if (!isPayPalConfigured()) {
    throw new Error('PayPal is not configured. Set PAYPAL_CLIENT_ID and PAYPAL_SECRET.');
  }
  const body: Record<string, unknown> = {
    amount: { currency_code: 'EUR', value: formatPayPalMoney(hold.grossEur) },
    final_capture: true,
  };
  if (hold.merchantId) {
    body.payment_instruction = platformFeeInstruction(hold.platformFeeEur);
  }
  // Official Payments API path (v2/payments/authorizations/{id}/capture)
  const result = await paypalRequest<{ id?: string }>({
    method: 'POST',
    path: `/v2/payments/authorizations/${encodeURIComponent(hold.authorizationId)}/capture`,
    body,
    sellerMerchantId: hold.merchantId,
    requestId: `cap-${hold.authorizationId}`,
  });
  if (!result.ok) {
    throw new Error(`PayPal capture failed: ${result.raw.slice(0, 400)}`);
  }
  return result.data.id || hold.authorizationId;
}

async function payoutGuideShareToEmail(email: string, amountEur: number, batchId: string): Promise<string | null> {
  const result = await paypalRequest<{ batch_header?: { payout_batch_id?: string } }>({
    method: 'POST',
    path: '/v1/payments/payouts',
    body: {
      sender_batch_header: {
        sender_batch_id: batchId,
        email_subject: 'Your earnings withdrawal',
        email_message: 'Held session earnings have been released to your PayPal.',
      },
      items: [
        {
          recipient_type: 'EMAIL',
          amount: { value: formatPayPalMoney(amountEur), currency: 'EUR' },
          receiver: email,
          note: 'Session earnings withdrawal',
          sender_item_id: batchId.slice(0, 63),
        },
      ],
    },
    requestId: batchId,
  });
  if (!result.ok) {
    throw new Error(`PayPal payout failed: ${result.raw.slice(0, 400)}`);
  }
  return result.data.batch_header?.payout_batch_id || batchId;
}

export async function withdrawAndReleaseHolds(
  userId: string,
  amountEur: number,
  paypalEmail?: string
): Promise<{
  withdrawal: WithdrawalRequest;
  capturedAuthorizationIds: string[];
  leftoverWithdrawal: WithdrawalRequest | null;
}> {
  if (!amountEur || amountEur <= 0) throw new Error('amountEur is required');
  if (amountEur < MIN_WITHDRAWAL_EUR) {
    throw new Error(`Minimum withdrawal is €${MIN_WITHDRAWAL_EUR}`);
  }

  const wallet = await getOrCreateWallet(userId);
  const email = (paypalEmail || wallet.paypalEmail || '').trim();
  const openHolds = await listOpenHolds(userId);
  const heldTotal = Math.round(openHolds.reduce((sum, h) => sum + h.guideShareEur, 0) * 100) / 100;
  const withdrawable = Math.round((heldTotal + wallet.availableBalanceEur) * 100) / 100;
  if (withdrawable < amountEur) {
    throw new Error('Insufficient held + available balance');
  }

  const toCapture: PaypalAuthorizationHold[] = [];
  let remainingHoldTarget = Math.min(amountEur, heldTotal);
  for (const hold of openHolds) {
    if (remainingHoldTarget <= 0) break;
    toCapture.push(hold);
    remainingHoldTarget = Math.round((remainingHoldTarget - hold.guideShareEur) * 100) / 100;
  }

  if (toCapture.length > 0 && !isPayPalConfigured()) {
    throw new Error('PayPal is not configured. Set PAYPAL_CLIENT_ID and PAYPAL_SECRET.');
  }

  const capturedAuthorizationIds: string[] = [];
  const captureIds: string[] = [];
  let capturedGuideShare = 0;
  let payoutNeededEur = 0;

  for (const hold of toCapture) {
    const captureId = await capturePaypalHold(hold);
    await markHoldCaptured(hold.authorizationId, captureId);
    capturedAuthorizationIds.push(hold.authorizationId);
    captureIds.push(captureId);
    capturedGuideShare = Math.round((capturedGuideShare + hold.guideShareEur) * 100) / 100;
    if (!hold.merchantId) {
      payoutNeededEur = Math.round((payoutNeededEur + hold.guideShareEur) * 100) / 100;
    }
  }

  let payoutBatchId: string | null = null;
  if (payoutNeededEur > 0) {
    if (!email) throw new Error('Connect PayPal or set your PayPal email to receive funds captured to the platform');
    payoutBatchId = await payoutGuideShareToEmail(email, payoutNeededEur, `wd-${userId.slice(-6)}-${Date.now()}`);
  }

  const leftover = Math.round((amountEur - capturedGuideShare) * 100) / 100;
  wallet.heldBalanceEur = Math.max(0, Math.round((wallet.heldBalanceEur - capturedGuideShare) * 100) / 100);
  wallet.totalWithdrawnEur = Math.round((wallet.totalWithdrawnEur + capturedGuideShare) * 100) / 100;

  let leftoverWithdrawal: WithdrawalRequest | null = null;
  if (leftover > 0.009) {
    if (wallet.availableBalanceEur < leftover) {
      throw new Error('Insufficient available balance for the remaining amount');
    }
    if (!email) throw new Error('Set your PayPal email for prize / available-balance withdrawals');
    wallet.availableBalanceEur = Math.round((wallet.availableBalanceEur - leftover) * 100) / 100;
    wallet.pendingBalanceEur = Math.round((wallet.pendingBalanceEur + leftover) * 100) / 100;
    leftoverWithdrawal = {
      id: `${Date.now()}-avail`,
      userId,
      amountEur: leftover,
      method: 'paypal',
      paypalEmail: email,
      status: 'pending',
      createdAt: new Date().toISOString(),
      processedAt: null,
    };
  }

  await saveWallet(wallet);

  const withdrawal: WithdrawalRequest = {
    id: Date.now().toString(),
    userId,
    amountEur: capturedGuideShare,
    method: 'paypal',
    paypalEmail: email || wallet.paypalMerchantId || '',
    status: capturedGuideShare > 0 ? 'completed' : leftoverWithdrawal ? 'pending' : 'completed',
    createdAt: new Date().toISOString(),
    processedAt: capturedGuideShare > 0 ? new Date().toISOString() : null,
    capturedAuthorizationIds,
    captureIds,
    payoutBatchId,
    adminNote: capturedGuideShare > 0 ? 'Captured PayPal authorizations on withdraw' : undefined,
  };

  const withdrawals = await readWithdrawals();
  if (capturedGuideShare > 0) withdrawals.push(withdrawal);
  if (leftoverWithdrawal) withdrawals.push(leftoverWithdrawal);
  await writeWithdrawals(withdrawals);

  const txs = await readTransactions();
  if (capturedGuideShare > 0) {
    txs.push({
      id: Date.now().toString() + '-wd-cap',
      userId,
      type: 'withdrawal',
      amountEur: capturedGuideShare,
      note: `Withdraw captured ${capturedAuthorizationIds.length} held payment(s)`,
      createdAt: new Date().toISOString(),
    });
  }
  if (leftoverWithdrawal) {
    txs.push({
      id: Date.now().toString() + '-wd-avail',
      userId,
      type: 'withdrawal',
      amountEur: leftover,
      note: `Withdrawal request to ${email}`,
      createdAt: new Date().toISOString(),
    });
  }
  await writeTransactions(txs);

  return {
    withdrawal: capturedGuideShare > 0 ? withdrawal : leftoverWithdrawal!,
    capturedAuthorizationIds,
    leftoverWithdrawal,
  };
}

export async function requestWithdrawal(userId: string, amountEur: number, paypalEmail?: string): Promise<WithdrawalRequest> {
  const result = await withdrawAndReleaseHolds(userId, amountEur, paypalEmail);
  return result.withdrawal;
}

export async function getAllPendingWithdrawals(): Promise<WithdrawalRequest[]> {
  const list = await readWithdrawals();
  return list.filter((w) => w.status === 'pending' || w.status === 'processing');
}

export async function markWithdrawalCompleted(withdrawalId: string, adminNote?: string): Promise<void> {
  const withdrawals = await readWithdrawals();
  const w = withdrawals.find((x) => x.id === withdrawalId);
  if (!w) throw new Error('Withdrawal not found');

  w.status = 'completed';
  w.processedAt = new Date().toISOString();
  w.adminNote = adminNote;
  await writeWithdrawals(withdrawals);

  const wallets = await readWallets();
  const wallet = wallets.find((x) => x.userId === w.userId);
  if (wallet) {
    wallet.pendingBalanceEur = Math.max(0, Math.round((wallet.pendingBalanceEur - w.amountEur) * 100) / 100);
    wallet.totalWithdrawnEur = Math.round((wallet.totalWithdrawnEur + w.amountEur) * 100) / 100;
    wallet.updatedAt = new Date().toISOString();
    await writeWallets(wallets);
  }
}

export async function getPlatformRevenue(): Promise<number> {
  const txs = await readTransactions();
  return txs
    .filter((t) => t.type === 'platform_fee')
    .reduce((sum, t) => sum + t.amountEur, 0);
}
