import { Request, Response } from 'express';
import Stripe from 'stripe';
import {
  createConfessionSession,
  createAiConfessionSession,
  getSessionById,
  getSessionsForUser,
  getPendingGuideSessions,
  getGuidePrefs,
  setGuideConfessionAvailability,
  markSessionPaid,
  creditConfessionPayment,
  guideAcceptSession,
  guideRespondAppointment,
  addConfessionMessage,
  endConfessionSession,
  retryGuideMatching,
  sanitizeSessionForClient,
  listBlurredConfessionGuides,
  listConfessionAiGuides,
  getVoiceCallForClient,
  setVoiceCallOffer,
  setVoiceCallAnswer,
  addVoiceCallIce,
  hangupVoiceCall,
  SEEKER_SAFETY_AGREEMENT,
  GUIDE_NDA_AGREEMENT,
  AI_SEEKER_TERMS,
} from '../models/anonymousConfession.js';
import { getGuideByUserId } from '../models/improvement.js';
import { getOrCreateWallet, holdGuideSessionPayment, splitSessionPayment, creditPlatformAiHelp } from '../models/guideWallet.js';
import { createAuthorizationHold, getHoldByRequestId } from '../models/paypalHolds.js';
import {
  buildAuthorizeOrderPayload,
  buildCaptureOrderPayload,
  findPayPalLink,
  isPayPalConfigured,
  parseAuthorizationFromOrder,
  paypalRequest,
} from '../lib/paypal.js';
import { sendPushToUser } from '../realtime/push.js';
import { notifyConfessionRequest, notifyConfessionMessage } from '../realtime/notifications.js';
import { sanitizeMessageContent, LIMITS } from '../utils/sanitize.js';

function stripeClient(): Stripe | null {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-06-20.acacia' as '2023-10-16',
  });
}

function frontendBase(req: Request): string {
  const fromEnv = (process.env.FRONTEND_URL || '').trim().replace(/\/$/, '');
  const origin = String(req.headers.origin || '').replace(/\/$/, '');
  if (origin && /hookupapp\.dev|vercel\.app|localhost/i.test(origin)) return origin;
  if (fromEnv) return fromEnv;
  return 'https://hookupapp.dev';
}

function paymentsStatus() {
  const paypalConfigured = isPayPalConfigured();
  const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY);
  return {
    paypalConfigured,
    stripeConfigured,
    demoPayAllowed: !paypalConfigured && !stripeConfigured,
  };
}

export async function getConfessionInfoHandler(_req: Request, res: Response) {
  res.json({
    seekerSafetyAgreement: SEEKER_SAFETY_AGREEMENT,
    guideNdaAgreement: GUIDE_NDA_AGREEMENT,
    aiSeekerTerms: AI_SEEKER_TERMS,
    prices: [5, 10],
    split: { guidePercent: 80, platformPercent: 20 },
    aiSplit: { guidePercent: 0, platformPercent: 100 },
    aiGuides: listConfessionAiGuides(),
    ...paymentsStatus(),
  });
}

export async function getGuideConfessionPrefsHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).userId as string;
    const guide = await getGuideByUserId(userId);
    const prefs = await getGuidePrefs(userId);
    const pending = guide?.isActive ? await getPendingGuideSessions(userId) : [];
    res.json({
      isGuide: !!guide?.isActive,
      prefs,
      pendingSessions: pending.map((s) => sanitizeSessionForClient(s, userId)),
      guideNdaAgreement: GUIDE_NDA_AGREEMENT,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed' });
  }
}

export async function updateGuideConfessionPrefsHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).userId as string;
    const { enabled, ndaSignature } = req.body as { enabled?: boolean; ndaSignature?: string };
    const prefs = await setGuideConfessionAvailability(userId, !!enabled, ndaSignature);
    res.json({ message: enabled ? 'Anonymous confession support enabled' : 'Disabled', prefs });
  } catch (e: any) {
    res.status(400).json({ error: e.message || 'Failed' });
  }
}

export async function listConfessionGuidesHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).userId as string;
    const scope = req.query.scope as string;
    if (scope !== 'local' && scope !== 'international') {
      return res.status(400).json({ error: 'Choose local or international guides' });
    }
    const guides = await listBlurredConfessionGuides(userId, scope);
    res.json({ guides, scope });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed' });
  }
}

export async function createSessionHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).userId as string;
    const { amountEur, safetySignature, guideId, appointmentAt, guideScope, kind, aiGuideId } = req.body as {
      amountEur?: number;
      safetySignature?: string;
      guideId?: string;
      appointmentAt?: string;
      guideScope?: string;
      kind?: string;
      aiGuideId?: string;
    };
    if (amountEur !== 5 && amountEur !== 10) {
      return res.status(400).json({ error: 'Choose €5 or €10 for your confession session' });
    }
    if (!safetySignature?.trim()) {
      return res.status(400).json({ error: 'Sign the safety agreement before continuing' });
    }

    if (kind === 'ai' || aiGuideId) {
      if (!aiGuideId) return res.status(400).json({ error: 'Choose an AI confession helper' });
      const session = await createAiConfessionSession({
        seekerUserId: userId,
        amountEur,
        safetySignature: safetySignature.trim(),
        aiGuideId,
      });
      return res.json({
        session: sanitizeSessionForClient(session, userId),
        seekerSafetyAgreement: SEEKER_SAFETY_AGREEMENT,
        aiSeekerTerms: AI_SEEKER_TERMS,
      });
    }

    if (!guideId) {
      return res.status(400).json({ error: 'Choose an anonymous guide' });
    }
    if (!appointmentAt) {
      return res.status(400).json({ error: 'Choose a date and time for your appointment' });
    }
    if (guideScope !== 'local' && guideScope !== 'international') {
      return res.status(400).json({ error: 'Choose local or international guides' });
    }

    const session = await createConfessionSession({
      seekerUserId: userId,
      amountEur: amountEur,
      safetySignature: safetySignature.trim(),
      guideId,
      appointmentAt,
      guideScope,
    });

    if (session.guideUserId) {
      notifyConfessionRequest(session.guideUserId, { sessionId: session.id });
      sendPushToUser(session.guideUserId, {
        title: 'Confession appointment requested',
        body: `Anonymous seeker requested ${new Date(session.appointmentAt!).toLocaleString()} — accept to continue.`,
        data: { type: 'confession_request', sessionId: session.id },
      }).catch(() => {});
    }

    res.json({
      session: sanitizeSessionForClient(session, userId),
      seekerSafetyAgreement: SEEKER_SAFETY_AGREEMENT,
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message || 'Failed' });
  }
}

export async function listSessionsHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).userId as string;
    const sessions = await getSessionsForUser(userId);
    res.json({ sessions: sessions.map((s) => sanitizeSessionForClient(s, userId)) });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed' });
  }
}

export async function getSessionHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).userId as string;
    let session = await getSessionById(req.params.sessionId);
    if (!session) return res.status(404).json({ error: 'Not found' });
    if (session.seekerUserId !== userId && session.guideUserId !== userId) {
      return res.status(403).json({ error: 'Not part of this session' });
    }

    if (session.paymentStatus === 'paid' && !session.guideUserId) {
      session = (await retryGuideMatching(session.id)) || session;
      if (session.guideUserId) {
        notifyConfessionRequest(session.guideUserId, { sessionId: session.id });
        sendPushToUser(session.guideUserId, {
          title: 'Anonymous confession requested',
          body: 'Someone needs confidential support. Sign your NDA and accept when ready.',
          data: { type: 'confession_request', sessionId: session.id },
        }).catch(() => {});
      }
    }

    res.json({ session: sanitizeSessionForClient(session, userId) });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed' });
  }
}

export async function createPayPalOrderHandler(req: Request, res: Response) {
  try {
    if (!isPayPalConfigured()) {
      return res.status(503).json({
        error:
          'PayPal is not configured on the server. Add PAYPAL_CLIENT_ID and PAYPAL_SECRET on Render (hookupappp), then redeploy.',
        ...paymentsStatus(),
      });
    }
    const userId = (req as any).userId as string;
    const session = await getSessionById(req.params.sessionId);
    if (!session || session.seekerUserId !== userId) return res.status(404).json({ error: 'Session not found' });
    if (session.paymentStatus === 'paid') return res.status(400).json({ error: 'Already paid' });
    if (session.status !== 'awaiting_payment') {
      return res.status(400).json({ error: 'Your guide must accept the appointment before you can pay' });
    }

    const isAi = session.kind === 'ai' || Boolean(session.aiGuideId);
    const base = frontendBase(req);
    const returnUrl = `${base}/home?confession=success&sessionId=${encodeURIComponent(session.id)}`;
    const cancelUrl = `${base}/home?confession=cancel&open=confession`;

    let orderPayload: Record<string, unknown>;
    let sellerMerchantId: string | null = null;
    if (isAi) {
      orderPayload = buildCaptureOrderPayload({
        amountEur: session.amountEur,
        description: 'AI confession session (app account)',
        customId: session.id,
        returnUrl,
        cancelUrl,
        brandName: 'Hook Up Confession',
      });
    } else {
      const sellerWallet = session.guideUserId ? await getOrCreateWallet(session.guideUserId) : null;
      sellerMerchantId = sellerWallet?.paypalMerchantId || null;
      const { platformFee } = splitSessionPayment(session.amountEur);
      orderPayload = buildAuthorizeOrderPayload({
        amountEur: session.amountEur,
        platformFeeEur: platformFee,
        description: 'Anonymous confession session',
        customId: session.id,
        returnUrl,
        cancelUrl,
        brandName: 'Hook Up Confession',
        sellerMerchantId,
      });
    }

    const orderRes = await paypalRequest<{ id?: string; links?: Array<{ rel: string; href?: string }> }>({
      method: 'POST',
      path: '/v2/checkout/orders',
      body: orderPayload,
      sellerMerchantId,
      requestId: `confession-order-${session.id}`,
    });

    if (!orderRes.ok) {
      console.error('Confession PayPal order failed:', orderRes.raw);
      return res.status(502).json({ error: 'PayPal order failed. Check PayPal credentials and sandbox mode.' });
    }
    const approveLink = findPayPalLink(orderRes.data.links, 'approve') || findPayPalLink(orderRes.data.links, 'payer-action');
    res.json({
      orderId: orderRes.data.id,
      sessionId: session.id,
      approvalUrl: approveLink,
      intent: isAi ? 'CAPTURE' : 'AUTHORIZE',
    });
  } catch (e: any) {
    console.error('Confession PayPal create error:', e);
    res.status(500).json({ error: e.message || 'Failed' });
  }
}

export async function capturePayPalOrderHandler(req: Request, res: Response) {
  try {
    if (!isPayPalConfigured()) {
      return res.status(503).json({ error: 'PayPal is not configured', ...paymentsStatus() });
    }
    const userId = (req as any).userId as string;
    const { orderId, sessionId } = req.body as { orderId?: string; sessionId?: string };
    if (!orderId || !sessionId) return res.status(400).json({ error: 'orderId and sessionId required' });

    const existing = await getSessionById(sessionId);
    if (!existing || existing.seekerUserId !== userId) return res.status(404).json({ error: 'Session not found' });
    if (existing.paymentStatus === 'paid') {
      return res.json({ message: 'Already paid', session: sanitizeSessionForClient(existing, userId) });
    }

    const isAi = existing.kind === 'ai' || Boolean(existing.aiGuideId);
    const alreadyHeld = await getHoldByRequestId(sessionId);

    if (isAi) {
      const cap = await paypalRequest({
        method: 'POST',
        path: `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
        body: {},
        requestId: `confession-cap-${orderId}`,
      });
      if (!cap.ok) {
        console.error('Confession AI PayPal capture failed:', cap.raw);
        return res.status(402).json({ error: 'Payment capture failed' });
      }
      await creditPlatformAiHelp({
        grossEur: existing.amountEur,
        userId,
        paymentMethod: 'paypal',
      });
    } else if (!alreadyHeld) {
      const authRes = await paypalRequest<{
        id?: string;
        purchase_units?: Array<{
          payments?: { authorizations?: Array<{ id?: string; expiration_time?: string; status?: string }> };
        }>;
      }>({
        method: 'POST',
        path: `/v2/checkout/orders/${encodeURIComponent(orderId)}/authorize`,
        body: {},
        requestId: `confession-auth-${orderId}`,
      });
      if (!authRes.ok) return res.status(402).json({ error: 'Payment authorization failed' });

      const parsed = parseAuthorizationFromOrder({ id: orderId, ...authRes.data });
      if (!parsed) return res.status(402).json({ error: 'PayPal did not return an authorization id' });

      if (existing.guideUserId && existing.kind !== 'ai' && !existing.aiGuideId) {
        const sellerWallet = await getOrCreateWallet(existing.guideUserId);
        const { guideShare, platformFee } = splitSessionPayment(existing.amountEur);
        await createAuthorizationHold({
          userId: existing.guideUserId,
          orderId,
          authorizationId: parsed.authorizationId,
          requestId: sessionId,
          sessionId,
          payerUserId: userId,
          grossEur: existing.amountEur,
          platformFeeEur: platformFee,
          guideShareEur: guideShare,
          currency: 'EUR',
          merchantId: sellerWallet.paypalMerchantId,
          expiresAt: parsed.expiresAt,
        });
        await holdGuideSessionPayment({
          guideUserId: existing.guideUserId,
          grossEur: existing.amountEur,
          requestId: sessionId,
        });
      }
    }

    let session = await markSessionPaid(sessionId, orderId);
    if (session.status === 'pending_guide_nda' && session.guideUserId) {
      notifyConfessionRequest(session.guideUserId, { sessionId: session.id });
      sendPushToUser(session.guideUserId, {
        title: 'Anonymous confession — paid & ready',
        body: `Someone paid €${session.amountEur}. Open the booth when you are ready.`,
        data: { type: 'confession_request', sessionId: session.id },
      }).catch(() => {});
    } else if (session.status === 'active') {
      notifyConfessionMessage(session.seekerUserId, { sessionId: session.id, preview: 'Your guide is ready.' });
    }

    res.json({
      message: session.status === 'active'
        ? session.kind === 'ai' || session.aiGuideId
          ? 'Payment received. Your AI helper is ready in the private booth.'
          : 'Payment received. The confession booth is open — say what you need to share.'
        : 'Payment received. Your guide will open the booth shortly.',
      session: sanitizeSessionForClient(session, userId),
    });
  } catch (e: any) {
    console.error('Confession PayPal capture error:', e);
    res.status(500).json({ error: e.message || 'Failed' });
  }
}

export async function createConfessionStripeCheckoutHandler(req: Request, res: Response) {
  try {
    const stripe = stripeClient();
    if (!stripe) return res.status(503).json({ error: 'Card pay is not configured', ...paymentsStatus() });
    const userId = (req as any).userId as string;
    const session = await getSessionById(req.params.sessionId);
    if (!session || session.seekerUserId !== userId) return res.status(404).json({ error: 'Session not found' });
    if (session.paymentStatus === 'paid') return res.status(400).json({ error: 'Already paid' });
    if (session.status !== 'awaiting_payment') {
      return res.status(400).json({ error: 'Session is not awaiting payment' });
    }
    const base = frontendBase(req);
    const checkout = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name:
                session.kind === 'ai' || session.aiGuideId
                  ? 'AI confession booth'
                  : 'Anonymous confession session',
            },
            unit_amount: Math.round(session.amountEur * 100),
          },
          quantity: 1,
        },
      ],
      success_url: `${base}/home?confession=success&sessionId=${encodeURIComponent(session.id)}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/home?confession=cancel&open=confession`,
      metadata: { type: 'confession', sessionId: session.id, userId },
    });
    res.json({ url: checkout.url, checkoutSessionId: checkout.id });
  } catch (e: any) {
    console.error('Confession Stripe checkout error:', e);
    res.status(500).json({ error: e.message || 'Stripe failed' });
  }
}

export async function confirmConfessionStripeHandler(req: Request, res: Response) {
  try {
    const stripe = stripeClient();
    if (!stripe) return res.status(503).json({ error: 'Card pay is not configured' });
    const userId = (req as any).userId as string;
    const { sessionId, checkoutSessionId } = req.body as { sessionId?: string; checkoutSessionId?: string };
    if (!sessionId || !checkoutSessionId) {
      return res.status(400).json({ error: 'sessionId and checkoutSessionId required' });
    }
    const existing = await getSessionById(sessionId);
    if (!existing || existing.seekerUserId !== userId) return res.status(404).json({ error: 'Session not found' });
    if (existing.paymentStatus === 'paid') {
      return res.json({ message: 'Already paid', session: sanitizeSessionForClient(existing, userId) });
    }
    const checkout = await stripe.checkout.sessions.retrieve(checkoutSessionId);
    if (checkout.payment_status !== 'paid' || checkout.metadata?.sessionId !== sessionId) {
      return res.status(402).json({ error: 'Payment not complete' });
    }
    if (existing.kind === 'ai' || existing.aiGuideId) {
      await creditPlatformAiHelp({
        grossEur: existing.amountEur,
        userId,
        paymentMethod: 'stripe',
      });
    }
    const session = await markSessionPaid(sessionId, `stripe:${checkoutSessionId}`);
    res.json({
      message: 'Payment received. Booth is open.',
      session: sanitizeSessionForClient(session, userId),
    });
  } catch (e: any) {
    console.error('Confession Stripe confirm error:', e);
    res.status(500).json({ error: e.message || 'Confirm failed' });
  }
}

export async function confirmConfessionDemoPayHandler(req: Request, res: Response) {
  try {
    if (isPayPalConfigured() || process.env.STRIPE_SECRET_KEY) {
      return res.status(400).json({ error: 'Use PayPal or card to pay' });
    }
    const userId = (req as any).userId as string;
    const session = await getSessionById(req.params.sessionId);
    if (!session || session.seekerUserId !== userId) return res.status(404).json({ error: 'Session not found' });
    if (session.paymentStatus === 'paid') {
      return res.json({ message: 'Already paid', session: sanitizeSessionForClient(session, userId) });
    }
    if (session.status !== 'awaiting_payment') {
      return res.status(400).json({ error: 'Session is not awaiting payment' });
    }
    if (session.kind === 'ai' || session.aiGuideId) {
      await creditPlatformAiHelp({
        grossEur: session.amountEur,
        userId,
        paymentMethod: 'demo',
      });
    }
    const paid = await markSessionPaid(session.id, `demo:${Date.now()}`);
    res.json({
      message: 'Local payment recorded. Booth is open. Add PayPal keys on Render for live PayPal.',
      session: sanitizeSessionForClient(paid, userId),
    });
  } catch (e: any) {
    console.error('Confession demo pay error:', e);
    res.status(500).json({ error: e.message || 'Demo pay failed' });
  }
}

export async function guideRespondAppointmentHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).userId as string;
    const { accept } = req.body as { accept?: boolean };
    const session = await guideRespondAppointment(req.params.sessionId, userId, accept !== false);

    if (accept !== false && session.status === 'awaiting_payment') {
      notifyConfessionMessage(session.seekerUserId, {
        sessionId: session.id,
        preview: 'Your guide accepted the appointment — pay to open the booth.',
      });
      sendPushToUser(session.seekerUserId, {
        title: 'Confession appointment accepted',
        body: `Pay €${session.amountEur} to open your anonymous session.`,
        data: { type: 'confession_payment', sessionId: session.id },
      }).catch(() => {});
    } else if (accept === false) {
      notifyConfessionMessage(session.seekerUserId, {
        sessionId: session.id,
        preview: 'Your guide could not take that time. Choose another guide.',
      });
    }

    res.json({ session: sanitizeSessionForClient(session, userId) });
  } catch (e: any) {
    res.status(400).json({ error: e.message || 'Failed' });
  }
}

export async function guideAcceptHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).userId as string;
    const { ndaSignature } = req.body as { ndaSignature?: string };
    if (!ndaSignature?.trim()) return res.status(400).json({ error: 'Sign the guide NDA to accept' });

    const session = await guideAcceptSession(req.params.sessionId, userId, ndaSignature.trim());
    await creditConfessionPayment(session);

    notifyConfessionMessage(session.seekerUserId, { sessionId: session.id, preview: 'Your guide is ready.' });
    sendPushToUser(session.seekerUserId, {
      title: 'Your anonymous guide is here',
      body: 'The confession booth is open. Neither of you can see who the other is.',
      data: { type: 'confession_active', sessionId: session.id },
    }).catch(() => {});

    res.json({ session: sanitizeSessionForClient(session, userId) });
  } catch (e: any) {
    res.status(400).json({ error: e.message || 'Failed' });
  }
}

export async function postMessageHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).userId as string;
    const content = sanitizeMessageContent(req.body.content, LIMITS.COMMENT);
    if (!content) return res.status(400).json({ error: 'Message required' });

    const result = await addConfessionMessage(req.params.sessionId, userId, content);
    if (result.blocked) {
      return res.status(403).json({ blocked: true, error: result.blockReason });
    }
    if (!result.message) return res.status(400).json({ error: 'Message not sent' });

    const session = result.session;
    const recipientId = session.seekerUserId === userId ? session.guideUserId : session.seekerUserId;
    if (recipientId) {
      notifyConfessionMessage(recipientId, { sessionId: session.id, preview: content.slice(0, 80) });
      sendPushToUser(recipientId, {
        title: 'Anonymous confession',
        body: content.slice(0, 60) + (content.length > 60 ? '…' : ''),
        data: { type: 'confession_message', sessionId: session.id },
      }).catch(() => {});
    }

    res.json({
      message: result.message,
      session: sanitizeSessionForClient(session, userId),
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message || 'Failed' });
  }
}

export async function endSessionHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).userId as string;
    const session = await endConfessionSession(req.params.sessionId, userId);
    res.json({ session: sanitizeSessionForClient(session, userId) });
  } catch (e: any) {
    res.status(400).json({ error: e.message || 'Failed' });
  }
}

export async function getVoiceCallHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).userId as string;
    const session = await getSessionById(req.params.sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json({ call: getVoiceCallForClient(session, userId) });
  } catch (e: any) {
    res.status(400).json({ error: e.message || 'Failed' });
  }
}

export async function postVoiceCallOfferHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).userId as string;
    const { sdp } = req.body as { sdp?: string };
    if (!sdp) return res.status(400).json({ error: 'Offer required' });
    const session = await setVoiceCallOffer(req.params.sessionId, userId, { type: 'offer', sdp });
    const recipientId = session.seekerUserId === userId ? session.guideUserId : session.seekerUserId;
    if (recipientId) {
      notifyConfessionMessage(recipientId, { sessionId: session.id, preview: 'Incoming veiled voice call' });
      sendPushToUser(recipientId, {
        title: 'Confession booth',
        body: 'Incoming veiled voice call — tap to answer. You will not hear their real voice.',
        data: { type: 'confession_call', sessionId: session.id },
      }).catch(() => {});
    }
    res.json({ call: getVoiceCallForClient(session, userId) });
  } catch (e: any) {
    res.status(400).json({ error: e.message || 'Failed' });
  }
}

export async function postVoiceCallAnswerHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).userId as string;
    const { sdp } = req.body as { sdp?: string };
    if (!sdp) return res.status(400).json({ error: 'Answer required' });
    const session = await setVoiceCallAnswer(req.params.sessionId, userId, { type: 'answer', sdp });
    res.json({ call: getVoiceCallForClient(session, userId) });
  } catch (e: any) {
    res.status(400).json({ error: e.message || 'Failed' });
  }
}

export async function postVoiceCallIceHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).userId as string;
    const { candidate } = req.body as { candidate?: string };
    if (!candidate) return res.status(400).json({ error: 'Candidate required' });
    const session = await addVoiceCallIce(req.params.sessionId, userId, candidate);
    res.json({ call: getVoiceCallForClient(session, userId) });
  } catch (e: any) {
    res.status(400).json({ error: 'Failed' });
  }
}

export async function hangupVoiceCallHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).userId as string;
    const session = await hangupVoiceCall(req.params.sessionId, userId);
    res.json({ call: getVoiceCallForClient(session, userId) });
  } catch (e: any) {
    res.status(400).json({ error: e.message || 'Failed' });
  }
}
