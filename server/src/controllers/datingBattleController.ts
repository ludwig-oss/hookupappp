import { Request, Response } from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import {
  formatEurCents,
  getStripe,
  isStripeConfigured,
  stripeFrontendBase,
} from '../lib/stripeClient.js';
import { PACK_PRICE_EUR } from '../datingBattle/constants.js';
import { BattleError, completeCoach, confirmBattle, ejectBattle, getBattleState, grantDatingBattlePack, advancePrompt, resolveBattle, saveBattleProfile, shuffleBattle, spotlightCards, startBattle } from '../datingBattle/service.js';
import type { ProfileInput } from '../datingBattle/types.js';

function userIdOf(req: Request): string | null {
  const id = (req as AuthRequest).userId;
  return id ? String(id) : null;
}

function sendError(res: Response, error: unknown) {
  if (error instanceof BattleError) {
    res.status(error.status).json(error.body);
    return;
  }
  console.error('Dating battle error:', error);
  res.status(500).json({ error: 'Internal server error' });
}

export async function getState(req: Request, res: Response) {
  try {
    const userId = userIdOf(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    res.json(await getBattleState(userId));
  } catch (error) {
    sendError(res, error);
  }
}

export async function putProfile(req: Request, res: Response) {
  try {
    const userId = userIdOf(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const body = (req.body || {}) as Partial<ProfileInput>;
    res.json(await saveBattleProfile(userId, body));
  } catch (error) {
    sendError(res, error);
  }
}

export async function postStart(req: Request, res: Response) {
  try {
    const userId = userIdOf(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    res.json(await startBattle(userId, typeof req.body?.mode === 'string' ? req.body.mode : undefined));
  } catch (error) {
    sendError(res, error);
  }
}

export async function postShuffle(req: Request, res: Response) {
  try {
    const userId = userIdOf(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    res.json(await shuffleBattle(userId, String(req.body?.reason || ''), typeof req.body?.mode === 'string' ? req.body.mode : undefined));
  } catch (error) {
    sendError(res, error);
  }
}

export async function postConfirm(req: Request, res: Response) {
  try {
    const userId = userIdOf(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    res.json(await confirmBattle(userId, String(req.params.battleId || '')));
  } catch (error) {
    sendError(res, error);
  }
}

export async function postEject(req: Request, res: Response) {
  try {
    const userId = userIdOf(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    res.json(await ejectBattle(userId, String(req.params.battleId || ''), String(req.body?.reason || '')));
  } catch (error) {
    sendError(res, error);
  }
}

export async function postPrompt(req: Request, res: Response) {
  try {
    const userId = userIdOf(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    res.json(await advancePrompt(userId, String(req.params.battleId || '')));
  } catch (error) {
    sendError(res, error);
  }
}

export async function postResolve(req: Request, res: Response) {
  try {
    const userId = userIdOf(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    res.json(await resolveBattle(userId, String(req.params.battleId || '')));
  } catch (error) {
    sendError(res, error);
  }
}

export async function postCoach(req: Request, res: Response) {
  try {
    const userId = userIdOf(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    res.json(await completeCoach(userId, req.body || {}));
  } catch (error) {
    sendError(res, error);
  }
}

export async function postSpotlight(req: Request, res: Response) {
  try {
    const userId = userIdOf(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const userIds = Array.isArray(req.body?.userIds) ? req.body.userIds.map((id: unknown) => String(id)) : [];
    res.json({ cards: await spotlightCards(userIds) });
  } catch (error) {
    sendError(res, error);
  }
}

export async function postCheckout(req: Request, res: Response) {
  try {
    const userId = userIdOf(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!isStripeConfigured()) {
      return res.status(503).json({
        error: 'Stripe is not configured. Set STRIPE_SECRET_KEY.',
        paywall: true,
        priceEur: PACK_PRICE_EUR,
      });
    }
    const base = stripeFrontendBase(req);
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: { name: 'Speed dating battles — 5 more rounds' },
            unit_amount: formatEurCents(PACK_PRICE_EUR),
          },
          quantity: 1,
        },
      ],
      success_url: `${base}/home?datingBattle=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/home?datingBattle=cancel`,
      metadata: { kind: 'dating_battle', userId },
      client_reference_id: userId.slice(0, 200),
    });
    if (!session.url) return res.status(502).json({ error: 'Stripe did not return a checkout URL' });
    res.json({ url: session.url, sessionId: session.id, priceEur: PACK_PRICE_EUR });
  } catch (error) {
    sendError(res, error);
  }
}

export async function postConfirmPayment(req: Request, res: Response) {
  try {
    const userId = userIdOf(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!isStripeConfigured()) return res.status(503).json({ error: 'Stripe is not configured' });
    const sessionId = String(req.body?.sessionId || req.body?.checkoutSessionId || '').trim();
    if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });
    const stripe = getStripe();
    const checkout = await stripe.checkout.sessions.retrieve(sessionId);
    if (checkout.payment_status !== 'paid') return res.status(402).json({ error: 'Payment not complete' });
    if (checkout.metadata?.userId && checkout.metadata.userId !== userId) {
      return res.status(403).json({ error: 'Payment belongs to another user' });
    }
    if (String(checkout.metadata?.kind || '') !== 'dating_battle') {
      return res.status(400).json({ error: 'This payment is not a dating battle pack.' });
    }
    const granted = await grantDatingBattlePack(userId, sessionId);
    res.json({ paid: true, ...granted });
  } catch (error) {
    sendError(res, error);
  }
}
