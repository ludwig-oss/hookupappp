import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

/** OnlyFans-style split: 80% guide, 20% platform */
export const GUIDE_EARNINGS_PERCENT = 80;
export const PLATFORM_FEE_PERCENT = 20;
export const MIN_WITHDRAWAL_EUR = 20;

export interface GuideWallet {
  userId: string;
  availableBalanceEur: number;
  pendingBalanceEur: number;
  totalEarnedEur: number;
  totalWithdrawnEur: number;
  paypalEmail: string | null;
  bankAccountLabel?: string | null;
  updatedAt: string;
}

export interface WalletTransaction {
  id: string;
  userId: string;
  type: 'session_earning' | 'platform_fee' | 'withdrawal' | 'withdrawal_refund' | 'advice_prize' | 'platform_fee_deduct';
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

export async function getOrCreateWallet(userId: string): Promise<GuideWallet> {
  const wallets = await readWallets();
  let w = wallets.find((x) => x.userId === userId);
  if (!w) {
    w = {
      userId,
      availableBalanceEur: 0,
      pendingBalanceEur: 0,
      totalEarnedEur: 0,
      totalWithdrawnEur: 0,
      paypalEmail: null,
      bankAccountLabel: null,
      updatedAt: new Date().toISOString(),
    };
    wallets.push(w);
    await writeWallets(wallets);
  }
  return w;
}

export async function setWalletPaypalEmail(userId: string, paypalEmail: string): Promise<GuideWallet> {
  const wallets = await readWallets();
  const w = await getOrCreateWallet(userId);
  const idx = wallets.findIndex((x) => x.userId === userId);
  w.paypalEmail = paypalEmail.trim() || null;
  w.updatedAt = new Date().toISOString();
  if (idx >= 0) wallets[idx] = w;
  else wallets.push(w);
  await writeWallets(wallets);
  return w;
}

/** Credit guide after client prepays (PayPal/Stripe). Funds available before session. */
export async function creditGuideSessionPayment(params: {
  guideUserId: string;
  grossEur: number;
  requestId?: string;
  bookingId?: string;
  paymentMethod: 'paypal' | 'stripe';
}): Promise<{ guideShare: number; platformFee: number }> {
  const { guideShare, platformFee } = splitSessionPayment(params.grossEur);
  const wallets = await readWallets();
  const w = await getOrCreateWallet(params.guideUserId);
  w.availableBalanceEur = Math.round((w.availableBalanceEur + guideShare) * 100) / 100;
  w.totalEarnedEur = Math.round((w.totalEarnedEur + guideShare) * 100) / 100;
  w.updatedAt = new Date().toISOString();
  const idx = wallets.findIndex((x) => x.userId === params.guideUserId);
  if (idx >= 0) wallets[idx] = w;
  await writeWallets(wallets);

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
    body: `Client prepaid session. Platform fee €${platformFee} (OnlyFans-style). Withdraw in Settings → Account balance.`,
    data: { type: 'wallet_credit', amountEur: String(guideShare) },
  }).catch(() => {});

  return { guideShare, platformFee };
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
  const wallets = await readWallets();
  w.availableBalanceEur = Math.round((w.availableBalanceEur + amountEur) * 100) / 100;
  w.totalEarnedEur = Math.round((w.totalEarnedEur + amountEur) * 100) / 100;
  w.updatedAt = new Date().toISOString();
  const idx = wallets.findIndex((x) => x.userId === userId);
  if (idx >= 0) wallets[idx] = w;
  await writeWallets(wallets);

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
  const wallets = await readWallets();
  const w = await getOrCreateWallet(userId);
  w.bankAccountLabel = bankAccountLabel.trim() || null;
  w.updatedAt = new Date().toISOString();
  const idx = wallets.findIndex((x) => x.userId === userId);
  if (idx >= 0) wallets[idx] = w;
  await writeWallets(wallets);
  return w;
}

export async function getWalletSummary(userId: string): Promise<{
  wallet: GuideWallet;
  recentTransactions: WalletTransaction[];
  pendingWithdrawals: WithdrawalRequest[];
}> {
  const wallet = await getOrCreateWallet(userId);
  const txs = await readTransactions();
  const withdrawals = await readWithdrawals();
  return {
    wallet,
    recentTransactions: txs.filter((t) => t.userId === userId).slice(-20).reverse(),
    pendingWithdrawals: withdrawals.filter((w) => w.userId === userId && w.status === 'pending'),
  };
}

export async function requestWithdrawal(userId: string, amountEur: number, paypalEmail?: string): Promise<WithdrawalRequest> {
  if (amountEur < MIN_WITHDRAWAL_EUR) {
    throw new Error(`Minimum withdrawal is €${MIN_WITHDRAWAL_EUR}`);
  }
  const wallet = await getOrCreateWallet(userId);
  const email = (paypalEmail || wallet.paypalEmail || '').trim();
  if (!email) throw new Error('Set your PayPal email for withdrawals first');

  if (wallet.availableBalanceEur < amountEur) {
    throw new Error('Insufficient available balance');
  }

  const wallets = await readWallets();
  wallet.availableBalanceEur = Math.round((wallet.availableBalanceEur - amountEur) * 100) / 100;
  wallet.pendingBalanceEur = Math.round((wallet.pendingBalanceEur + amountEur) * 100) / 100;
  wallet.updatedAt = new Date().toISOString();
  const idx = wallets.findIndex((x) => x.userId === userId);
  if (idx >= 0) wallets[idx] = wallet;
  await writeWallets(wallets);

  const withdrawals = await readWithdrawals();
  const req: WithdrawalRequest = {
    id: Date.now().toString(),
    userId,
    amountEur,
    method: 'paypal',
    paypalEmail: email,
    status: 'pending',
    createdAt: new Date().toISOString(),
    processedAt: null,
  };
  withdrawals.push(req);
  await writeWithdrawals(withdrawals);

  const txs = await readTransactions();
  txs.push({
    id: Date.now().toString() + '-wd',
    userId,
    type: 'withdrawal',
    amountEur,
    note: `Withdrawal request to ${email}`,
    createdAt: new Date().toISOString(),
  });
  await writeTransactions(txs);
  return req;
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
