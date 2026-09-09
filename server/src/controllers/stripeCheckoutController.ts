/**
 * Stripe Checkout — replaces all former PayPal checkout flows.
 * POST /api/stripe/create-checkout-session → { url, sessionId }
 * POST /api/stripe/confirm-session → fulfills metadata after redirect
 */
import { Request, Response } from 'express';
import {
  formatEurCents,
  getStripe,
  isStripeConfigured,
  stripeFrontendBase,
} from '../lib/stripeClient.js';
import { AI_HELP_PRICE_EUR, grantPaidGuideHelpCredit } from '../models/guideHelp.js';
import { creditPlatformAiHelp, holdGuideSessionPayment, splitSessionPayment } from '../models/guideWallet.js';
import { getSessionById, markSessionPaid } from '../models/anonymousConfession.js';
import {
  TEXTING_HELP_PRICE_EUR,
  getTextingHelpSession,
  markTextingHelpPaid,
} from '../models/textingHelp.js';
import { SESSION_PRICE_EUR, getRequestById, updateRequestPayment, getGuideById } from '../models/improvement.js';
import { getHoldByRequestId } from '../models/paypalHolds.js';

type CheckoutKind =
  | 'ai_guide_help'
  | 'confession'
  | 'texting_help'
  | 'guide_request'
  | 'generic';

export async function createCheckoutSessionHandler(req: Request, res: Response) {
  try {
    if (!isStripeConfigured()) {
      return res.status(503).json({ error: 'Stripe is not configured. Set STRIPE_SECRET_KEY.' });
    }
    const userId = (req as any).userId as string | undefined;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const body = req.body || {};
    const kind = String(body.kind || body.type || 'generic') as CheckoutKind;
    const base = stripeFrontendBase(req);

    let amountEur = Number(body.amountEur);
    let productName = String(body.productName || body.description || 'Hook Up payment');
    let successPath = String(body.successPath || '/home?stripe=success');
    let cancelPath = String(body.cancelPath || '/home?stripe=cancel');
    const metadata: Record<string, string> = {
      kind,
      userId,
      ...(body.metadata && typeof body.metadata === 'object'
        ? Object.fromEntries(
            Object.entries(body.metadata as Record<string, unknown>).map(([k, v]) => [k, String(v)])
          )
        : {}),
    };

    if (kind === 'ai_guide_help') {
      amountEur = AI_HELP_PRICE_EUR;
      productName = 'AI crew help (one time)';
      successPath = '/home?aiHelp=success&session_id={CHECKOUT_SESSION_ID}';
      cancelPath = '/home?aiHelp=cancel';
    } else if (kind === 'confession') {
      const sessionId = String(body.sessionId || metadata.sessionId || '');
      if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });
      const session = await getSessionById(sessionId);
      if (!session || session.seekerUserId !== userId) return res.status(404).json({ error: 'Session not found' });
      if (session.paymentStatus === 'paid') return res.status(400).json({ error: 'Already paid' });
      if (session.status !== 'awaiting_payment') {
        return res.status(400).json({ error: 'Session is not awaiting payment' });
      }
      amountEur = session.amountEur;
      productName =
        session.kind === 'ai' || session.aiGuideId ? 'AI confession booth' : 'Anonymous confession session';
      metadata.sessionId = sessionId;
      successPath = `/home?confession=success&sessionId=${encodeURIComponent(sessionId)}&session_id={CHECKOUT_SESSION_ID}`;
      cancelPath = '/home?confession=cancel&open=confession';
    } else if (kind === 'texting_help') {
      const sessionId = String(body.sessionId || metadata.sessionId || '');
      if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });
      const session = await getTextingHelpSession(sessionId);
      if (!session || session.userId !== userId) return res.status(404).json({ error: 'Session not found' });
      amountEur = TEXTING_HELP_PRICE_EUR;
      productName = 'Live texting help';
      metadata.sessionId = sessionId;
      successPath = `/home?textingHelp=success&sessionId=${encodeURIComponent(sessionId)}&session_id={CHECKOUT_SESSION_ID}`;
      cancelPath = '/home?textingHelp=cancel';
    } else if (kind === 'guide_request') {
      const requestId = String(body.requestId || metadata.requestId || '');
      if (!requestId) return res.status(400).json({ error: 'requestId is required' });
      const guideRequest = await getRequestById(requestId);
      if (!guideRequest || guideRequest.userId !== userId) return res.status(404).json({ error: 'Request not found' });
      if (guideRequest.status !== 'accepted') return res.status(400).json({ error: 'Request must be accepted first' });
      if (guideRequest.paymentStatus === 'confirmed' || guideRequest.paymentStatus === 'paid') {
        return res.status(400).json({ error: 'Already paid' });
      }
      amountEur = SESSION_PRICE_EUR;
      productName = 'Expert session (1 appointment)';
      metadata.requestId = requestId;
      successPath = `/home?stripe=success&kind=guide_request&requestId=${encodeURIComponent(requestId)}&session_id={CHECKOUT_SESSION_ID}`;
      cancelPath = '/home?stripe=cancel';
    } else if (!Number.isFinite(amountEur) || amountEur < 0.5) {
      return res.status(400).json({ error: 'amountEur is required (min €0.50)' });
    }

    const success_url = `${base}${successPath.startsWith('/') ? successPath : `/${successPath}`}`;
    const cancel_url = `${base}${cancelPath.startsWith('/') ? cancelPath : `/${cancelPath}`}`;

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: { name: productName.slice(0, 120) },
            unit_amount: formatEurCents(amountEur),
          },
          quantity: 1,
        },
      ],
      success_url,
      cancel_url,
      metadata,
      client_reference_id: userId.slice(0, 200),
    });

    if (!session.url) {
      return res.status(502).json({ error: 'Stripe did not return a checkout URL' });
    }

    res.json({
      url: session.url,
      sessionId: session.id,
      session: { url: session.url, id: session.id },
    });
  } catch (error: any) {
    console.error('Stripe create-checkout-session error:', error);
    res.status(500).json({ error: error.message || 'Stripe checkout failed' });
  }
}

export async function confirmCheckoutSessionHandler(req: Request, res: Response) {
  try {
    if (!isStripeConfigured()) {
      return res.status(503).json({ error: 'Stripe is not configured' });
    }
    const userId = (req as any).userId as string | undefined;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const checkoutSessionId = String(
      req.body?.sessionId || req.body?.checkoutSessionId || req.query.session_id || ''
    ).trim();
    if (!checkoutSessionId) return res.status(400).json({ error: 'sessionId is required' });

    const stripe = getStripe();
    const checkout = await stripe.checkout.sessions.retrieve(checkoutSessionId);
    if (checkout.payment_status !== 'paid') {
      return res.status(402).json({ error: 'Payment not complete' });
    }
    if (checkout.metadata?.userId && checkout.metadata.userId !== userId) {
      return res.status(403).json({ error: 'Payment belongs to another user' });
    }

    const kind = String(checkout.metadata?.kind || 'generic');

    if (kind === 'ai_guide_help') {
      const granted = await grantPaidGuideHelpCredit(userId, 1, `stripe:${checkoutSessionId}`);
      if (!granted.alreadyCredited) {
        await creditPlatformAiHelp({
          grossEur: AI_HELP_PRICE_EUR,
          userId,
          paymentMethod: 'stripe',
        });
      }
      return res.json({ paid: true, kind, checkoutSessionId });
    }

    if (kind === 'confession') {
      const sessionId = String(checkout.metadata?.sessionId || '');
      const existing = await getSessionById(sessionId);
      if (!existing || existing.seekerUserId !== userId) return res.status(404).json({ error: 'Session not found' });
      if (existing.paymentStatus === 'paid') {
        return res.json({ paid: true, kind, session: existing });
      }
      if (existing.kind === 'ai' || existing.aiGuideId) {
        await creditPlatformAiHelp({
          grossEur: existing.amountEur,
          userId,
          paymentMethod: 'stripe',
        });
      } else if (existing.guideUserId) {
        const already = await getHoldByRequestId(sessionId);
        if (!already) {
          await holdGuideSessionPayment({
            guideUserId: existing.guideUserId,
            grossEur: existing.amountEur,
            requestId: sessionId,
          });
        }
      }
      const session = await markSessionPaid(sessionId, `stripe:${checkoutSessionId}`);
      return res.json({ paid: true, kind, session });
    }

    if (kind === 'texting_help') {
      const sessionId = String(checkout.metadata?.sessionId || '');
      const paid = await markTextingHelpPaid(sessionId, 'stripe', { stripePaymentIntentId: checkoutSessionId });
      return res.json({ paid: true, kind, session: paid });
    }

    if (kind === 'guide_request') {
      const requestId = String(checkout.metadata?.requestId || '');
      const guideRequest = await getRequestById(requestId);
      if (!guideRequest || guideRequest.userId !== userId) return res.status(404).json({ error: 'Request not found' });
      if (guideRequest.paymentStatus !== 'confirmed' && guideRequest.paymentStatus !== 'paid') {
        await updateRequestPayment(requestId, `stripe:${checkoutSessionId}`);
        const guide = await getGuideById(guideRequest.guideId);
        if (guide) {
          await holdGuideSessionPayment({
            guideUserId: guide.userId,
            grossEur: SESSION_PRICE_EUR,
            requestId,
          });
        }
      }
      return res.json({ paid: true, kind, requestId, split: splitSessionPayment(SESSION_PRICE_EUR) });
    }

    res.json({ paid: true, kind, checkoutSessionId });
  } catch (error: any) {
    console.error('Stripe confirm-session error:', error);
    res.status(500).json({ error: error.message || 'Confirm failed' });
  }
}

export async function stripeStatusHandler(_req: Request, res: Response) {
  res.json({ stripeConfigured: isStripeConfigured() });
}
