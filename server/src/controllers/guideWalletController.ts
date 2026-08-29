import { Request, Response } from 'express';
import {
  getWalletSummary,
  requestWithdrawal,
  setWalletPaypalEmail,
  setWalletBankLabel,
  GUIDE_EARNINGS_PERCENT,
  PLATFORM_FEE_PERCENT,
  MIN_WITHDRAWAL_EUR,
  getAllPendingWithdrawals,
  markWithdrawalCompleted,
  getPlatformRevenue,
} from '../models/guideWallet.js';
import { SESSION_PRICE_EUR } from '../models/improvement.js';

export async function getMyWallet(req: Request, res: Response) {
  try {
    const userId = (req as any).userId as string;
    const summary = await getWalletSummary(userId);
    res.json({
      ...summary,
      split: {
        guidePercent: GUIDE_EARNINGS_PERCENT,
        platformPercent: PLATFORM_FEE_PERCENT,
        sessionPriceEur: SESSION_PRICE_EUR,
        guideEarnsPerSession: Math.round(SESSION_PRICE_EUR * (GUIDE_EARNINGS_PERCENT / 100) * 100) / 100,
        minWithdrawalEur: MIN_WITHDRAWAL_EUR,
      },
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed' });
  }
}

export async function updateWalletBank(req: Request, res: Response) {
  try {
    const userId = (req as any).userId as string;
    const { bankAccountLabel } = req.body as { bankAccountLabel?: string };
    if (!bankAccountLabel?.trim()) return res.status(400).json({ error: 'bankAccountLabel is required' });
    const wallet = await setWalletBankLabel(userId, bankAccountLabel.trim());
    res.json({ message: 'Bank / payout details saved', wallet });
  } catch (e: any) {
    res.status(400).json({ error: e.message || 'Failed' });
  }
}

export async function updateWalletPaypal(req: Request, res: Response) {
  try {
    const userId = (req as any).userId as string;
    const { paypalEmail } = req.body as { paypalEmail?: string };
    if (!paypalEmail?.trim()) return res.status(400).json({ error: 'paypalEmail is required' });
    const wallet = await setWalletPaypalEmail(userId, paypalEmail.trim());
    res.json({ message: 'PayPal email saved for withdrawals', wallet });
  } catch (e: any) {
    res.status(400).json({ error: e.message || 'Failed' });
  }
}

export async function createWithdrawal(req: Request, res: Response) {
  try {
    const userId = (req as any).userId as string;
    const { amountEur, paypalEmail } = req.body as { amountEur?: number; paypalEmail?: string };
    if (!amountEur || amountEur <= 0) return res.status(400).json({ error: 'amountEur is required' });
    const withdrawal = await requestWithdrawal(userId, amountEur, paypalEmail);
    res.json({
      message: 'Withdrawal requested. Payouts are processed like OnlyFans — typically within a few business days via PayPal.',
      withdrawal,
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message || 'Withdrawal failed' });
  }
}

/** Admin: list pending withdrawals */
export async function listWithdrawalsAdmin(req: Request, res: Response) {
  try {
    const pending = await getAllPendingWithdrawals();
    const revenue = await getPlatformRevenue();
    res.json({ pending, platformRevenueEur: revenue });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed' });
  }
}

/** Admin: mark withdrawal paid */
export async function completeWithdrawalAdmin(req: Request, res: Response) {
  try {
    const { withdrawalId, adminNote } = req.body as { withdrawalId?: string; adminNote?: string };
    if (!withdrawalId) return res.status(400).json({ error: 'withdrawalId required' });
    await markWithdrawalCompleted(withdrawalId, adminNote);
    res.json({ message: 'Withdrawal marked completed' });
  } catch (e: any) {
    res.status(400).json({ error: e.message || 'Failed' });
  }
}

export async function getPaymentSplitInfo(_req: Request, res: Response) {
  res.json({
    sessionPriceEur: SESSION_PRICE_EUR,
    guidePercent: GUIDE_EARNINGS_PERCENT,
    platformPercent: PLATFORM_FEE_PERCENT,
    guideEarnsPerSession: Math.round(SESSION_PRICE_EUR * (GUIDE_EARNINGS_PERCENT / 100) * 100) / 100,
    platformFeePerSession: Math.round(SESSION_PRICE_EUR * (PLATFORM_FEE_PERCENT / 100) * 100) / 100,
    methods: ['paypal', 'stripe', 'card'],
    prepayRequired: true,
    recordingForbidden: true,
    guideTipPolicy: 'Share helpful tips during sessions, but keep your best secrets — like a great teacher, not everything at once.',
  });
}
