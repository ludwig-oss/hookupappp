import { Request, Response } from 'express';
import Stripe from 'stripe';
import {
  AI_HELP_PRICE_EUR,
  consumeGuideHelp,
  getGuideHelpStatus,
  grantPaidGuideHelpCredit,
  type GuideHelpKind,
} from '../models/guideHelp.js';
import { creditPlatformAiHelp } from '../models/guideWallet.js';
import {
  findPayPalLink,
  formatPayPalMoney,
  isPayPalConfigured,
  paypalRequest,
} from '../lib/paypal.js';

const KINDS: GuideHelpKind[] = ['fashion', 'appearance', 'intimacy', 'termact', 'lesson', 'date-tips'];

function frontendBase(req: Request): string {
  return (process.env.FRONTEND_URL || String(req.headers.origin || 'http://localhost:5173')).replace(/\/$/, '');
}

function stripeClient(): Stripe | null {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-06-20.acacia' as '2023-10-16',
  });
}

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
      paypalConfigured: isPayPalConfigured(),
      stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
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
        paypalConfigured: isPayPalConfigured(),
        stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
        error: 'Free crew helps are used. Subscribe to Plus/Gold/Platinum for unlimited, or pay once. Money goes to the app, not a human guide.',
      });
    }
    res.json({
      ...status,
      paypalConfigured: isPayPalConfigured(),
      stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
    });
  } catch (error) {
    console.error('Guide help consume error:', error);
    res.status(500).json({ error: 'Could not use a help.' });
  }
}

export async function createGuideHelpPayPalOrder(req: Request, res: Response) {
  try {
    if (!isPayPalConfigured()) return res.status(503).json({ error: 'PayPal is not configured' });
    const userId = (req as any).userId as string;
    const customId = `ai-help-${userId}-${Date.now()}`.slice(0, 127);
    const base = frontendBase(req);
    const orderRes = await paypalRequest<{ id?: string; links?: Array<{ rel: string; href?: string }> }>({
      method: 'POST',
      path: '/v2/checkout/orders',
      body: {
        intent: 'CAPTURE',
        purchase_units: [
          {
            custom_id: customId,
            description: 'AI crew help (one time)',
            amount: { currency_code: 'EUR', value: formatPayPalMoney(AI_HELP_PRICE_EUR) },
          },
        ],
        application_context: {
          return_url: `${base}/home?aiHelp=success`,
          cancel_url: `${base}/home?aiHelp=cancel`,
          brand_name: 'ASWP',
          user_action: 'PAY_NOW',
        },
      },
      requestId: customId,
    });
    if (!orderRes.ok || !orderRes.data.id) {
      console.error('AI help PayPal order failed:', orderRes.raw);
      return res.status(502).json({ error: 'PayPal order failed' });
    }
    res.json({
      orderId: orderRes.data.id,
      approvalUrl: findPayPalLink(orderRes.data.links, 'approve'),
      priceEur: AI_HELP_PRICE_EUR,
    });
  } catch (error: any) {
    console.error('AI help PayPal create error:', error);
    res.status(500).json({ error: error.message || 'PayPal failed' });
  }
}

export async function captureGuideHelpPayPal(req: Request, res: Response) {
  try {
    if (!isPayPalConfigured()) return res.status(503).json({ error: 'PayPal is not configured' });
    const userId = (req as any).userId as string;
    const { orderId } = req.body as { orderId?: string };
    if (!orderId) return res.status(400).json({ error: 'orderId is required' });
    const cap = await paypalRequest({
      method: 'POST',
      path: `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
      body: {},
      requestId: `ai-help-cap-${orderId}`,
    });
    if (!cap.ok) {
      console.error('AI help PayPal capture failed:', cap.raw);
      return res.status(402).json({ error: 'Payment capture failed' });
    }
    const granted = await grantPaidGuideHelpCredit(userId, 1, `paypal:${orderId}`);
    if (!granted.alreadyCredited) {
      await creditPlatformAiHelp({
        grossEur: AI_HELP_PRICE_EUR,
        userId,
        paymentMethod: 'paypal',
      });
    }
    res.json({ paid: true, status: await getGuideHelpStatus(userId) });
  } catch (error: any) {
    console.error('AI help PayPal capture error:', error);
    res.status(500).json({ error: error.message || 'Capture failed' });
  }
}

export async function createGuideHelpStripeCheckout(req: Request, res: Response) {
  try {
    const stripe = stripeClient();
    if (!stripe) return res.status(503).json({ error: 'Stripe is not configured' });
    const userId = (req as any).userId as string;
    const base = frontendBase(req);
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: { name: 'AI crew help (one time)' },
            unit_amount: Math.round(AI_HELP_PRICE_EUR * 100),
          },
          quantity: 1,
        },
      ],
      success_url: `${base}/home?aiHelp=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/home?aiHelp=cancel`,
      metadata: { type: 'ai_guide_help', userId },
    });
    res.json({ url: session.url, sessionId: session.id, priceEur: AI_HELP_PRICE_EUR });
  } catch (error: any) {
    console.error('AI help Stripe checkout error:', error);
    res.status(500).json({ error: error.message || 'Stripe failed' });
  }
}

export async function confirmGuideHelpStripe(req: Request, res: Response) {
  try {
    const stripe = stripeClient();
    if (!stripe) return res.status(503).json({ error: 'Stripe is not configured' });
    const userId = (req as any).userId as string;
    const { sessionId } = req.body as { sessionId?: string };
    if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });
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

export async function confirmGuideHelpDemo(req: Request, res: Response) {
  try {
    if (isPayPalConfigured() || process.env.STRIPE_SECRET_KEY) {
      return res.status(400).json({ error: 'Use PayPal or card to pay' });
    }
    const userId = (req as any).userId as string;
    await grantPaidGuideHelpCredit(userId, 1, `demo:${userId}:${Date.now()}`);
    await creditPlatformAiHelp({
      grossEur: AI_HELP_PRICE_EUR,
      userId,
      paymentMethod: 'demo',
    });
    res.json({ paid: true, status: await getGuideHelpStatus(userId) });
  } catch (error) {
    console.error('AI help demo pay error:', error);
    res.status(500).json({ error: 'Demo pay failed' });
  }
}
