import { Request, Response } from 'express';
import {
  AI_HELP_PRICE_EUR,
  consumeGuideHelp,
  getGuideHelpStatus,
  grantPaidGuideHelpCredit,
  type GuideHelpKind,
} from '../models/guideHelp.js';
import { creditPlatformAiHelp } from '../models/guideWallet.js';
import { formatEurCents, getStripe, isStripeConfigured, stripeFrontendBase } from '../lib/stripeClient.js';

const KINDS: GuideHelpKind[] = ['fashion', 'appearance', 'intimacy', 'termact', 'lesson', 'date-tips', 'texting'];

function parseKind(raw: unknown): GuideHelpKind {
  const k = String(raw || 'lesson') as GuideHelpKind;
  return KINDS.includes(k) ? k : 'lesson';
}

export async function guideHelpStatusHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).userId as string;
    const status = await getGuideHelpStatus(userId);
    res.json({
      ...status,
      stripeConfigured: isStripeConfigured(),
    });
  } catch (error) {
    console.error('Guide help status error:', error);
    res.status(500).json({ error: 'Could not load help status.' });
  }
}

export async function consumeGuideHelpHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).userId as string;
    const kind = parseKind(req.body?.kind || req.query.kind);
    const status = await consumeGuideHelp(userId, kind);
    if (!status.allowed) {
      return res.status(402).json({
        ...status,
        stripeConfigured: isStripeConfigured(),
        error:
          'Free crew helps are used. Subscribe to Plus/Gold/Platinum for unlimited, or pay once with Stripe. Money goes to the app, not a human guide.',
      });
    }
    res.json({
      ...status,
      stripeConfigured: isStripeConfigured(),
    });
  } catch (error) {
    console.error('Guide help consume error:', error);
    res.status(500).json({ error: 'Could not use a help.' });
  }
}

/** @deprecated Prefer POST /api/stripe/create-checkout-session — kept as thin Stripe wrapper. */
export async function createGuideHelpStripeCheckout(req: Request, res: Response) {
  try {
    if (!isStripeConfigured()) return res.status(503).json({ error: 'Stripe is not configured' });
    const userId = (req as any).userId as string;
    const base = stripeFrontendBase(req);
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: { name: 'AI crew help (one time)' },
            unit_amount: formatEurCents(AI_HELP_PRICE_EUR),
          },
          quantity: 1,
        },
      ],
      success_url: `${base}/home?aiHelp=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/home?aiHelp=cancel`,
      metadata: { kind: 'ai_guide_help', userId },
    });
    res.json({ url: session.url, sessionId: session.id, priceEur: AI_HELP_PRICE_EUR });
  } catch (error: any) {
    console.error('AI help Stripe checkout error:', error);
    res.status(500).json({ error: error.message || 'Stripe failed' });
  }
}

export async function confirmGuideHelpStripe(req: Request, res: Response) {
  try {
    if (!isStripeConfigured()) return res.status(503).json({ error: 'Stripe is not configured' });
    const userId = (req as any).userId as string;
    const { sessionId } = req.body as { sessionId?: string };
    if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid' || session.metadata?.userId !== userId) {
      return res.status(402).json({ error: 'Payment not complete' });
    }
    const granted = await grantPaidGuideHelpCredit(userId, 1, `stripe:${sessionId}`);
    if (!granted.alreadyCredited) {
      await creditPlatformAiHelp({
        grossEur: AI_HELP_PRICE_EUR,
        userId,
        paymentMethod: 'stripe',
      });
    }
    res.json({ paid: true, status: await getGuideHelpStatus(userId) });
  } catch (error: any) {
    console.error('AI help Stripe confirm error:', error);
    res.status(500).json({ error: error.message || 'Confirm failed' });
  }
}
