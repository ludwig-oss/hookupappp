import { Request, Response } from 'express';
import Stripe from 'stripe';
import { getUserById } from '../models/user.js';
import {
  TEXTING_HELP_PRICE_EUR,
  addTextingHelpReview,
  answerTextingHelpSos,
  chooseTextingHelpGuide,
  createTextingHelpSession,
  getTextingHelpSession,
  listIncomingTextingHelpSos,
  markTextingHelpPaid,
  pickTextingHelpGuides,
} from '../models/textingHelp.js';
import { getGuideByUserId } from '../models/improvement.js';
import { creditGuideSessionPayment, splitSessionPayment } from '../models/guideWallet.js';
import {
  buildAuthorizeOrderPayload,
  findPayPalLink,
  isPayPalConfigured,
  paypalRequest,
} from '../lib/paypal.js';
import {
  notifyTextingHelpAnswered,
  notifyTextingHelpChosen,
  notifyTextingHelpSos,
} from '../realtime/notifications.js';
import { sendPushToUser } from '../realtime/push.js';

function frontendBase(): string {
  return (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
}

function stripeClient(): Stripe | null {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-06-20.acacia' as '2023-10-16',
  });
}

export async function startTextingHelp(req: Request, res: Response) {
  try {
    const userId = (req as any).userId as string;
    const { otherUserId } = req.body as { otherUserId?: string };
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!otherUserId) return res.status(400).json({ error: 'otherUserId is required' });
    const other = await getUserById(otherUserId);
    if (!other) return res.status(404).json({ error: 'User not found' });
    const session = await createTextingHelpSession(userId, otherUserId);
    res.json({
      session,
      priceEur: TEXTING_HELP_PRICE_EUR,
      paypalConfigured: isPayPalConfigured(),
      stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
    });
  } catch (error) {
    console.error('Start texting help error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getTextingHelpSessionHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).userId as string;
    const session = await getTextingHelpSession(req.params.sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    const isGuide = session.offeredGuideUserIds.includes(userId) || session.chosenGuideUserId === userId;
    if (session.userId !== userId && !isGuide) return res.status(403).json({ error: 'Forbidden' });
    res.json({ session, priceEur: TEXTING_HELP_PRICE_EUR });
  } catch (error) {
    console.error('Get texting help session error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function createTextingHelpPayPalOrder(req: Request, res: Response) {
  try {
    if (!isPayPalConfigured()) {
      return res.status(503).json({ error: 'PayPal is not configured' });
    }
    const userId = (req as any).userId as string;
    const { sessionId } = req.body as { sessionId?: string };
    if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });
    const session = await getTextingHelpSession(sessionId);
    if (!session || session.userId !== userId) return res.status(404).json({ error: 'Session not found' });
    if (session.status !== 'pending_payment') return res.json({ alreadyPaid: true, session });

    const { platformFee } = splitSessionPayment(TEXTING_HELP_PRICE_EUR);
    const orderPayload = buildAuthorizeOrderPayload({
      amountEur: TEXTING_HELP_PRICE_EUR,
      platformFeeEur: platformFee,
      description: 'Live texting help (guide SOS)',
      customId: sessionId,
      returnUrl: `${frontendBase()}/home?textingHelp=success&sessionId=${sessionId}`,
      cancelUrl: `${frontendBase()}/home?textingHelp=cancel`,
      brandName: 'ASWP Texting Help',
    });
    (orderPayload as { intent: string }).intent = 'CAPTURE';

    const orderRes = await paypalRequest<{ id?: string; links?: Array<{ rel: string; href?: string }> }>({
      method: 'POST',
      path: '/v2/checkout/orders',
      body: orderPayload,
      requestId: `texting-help-${sessionId}`,
    });
    if (!orderRes.ok || !orderRes.data.id) {
      console.error('Texting help PayPal order failed:', orderRes.raw);
      return res.status(502).json({ error: 'PayPal order failed' });
    }
    const approvalUrl = findPayPalLink(orderRes.data.links, 'approve');
    res.json({ orderId: orderRes.data.id, approvalUrl });
  } catch (error: any) {
    console.error('Texting help PayPal create error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

export async function captureTextingHelpPayPal(req: Request, res: Response) {
  try {
    if (!isPayPalConfigured()) return res.status(503).json({ error: 'PayPal is not configured' });
    const userId = (req as any).userId as string;
    const { sessionId, orderId } = req.body as { sessionId?: string; orderId?: string };
    if (!sessionId || !orderId) return res.status(400).json({ error: 'sessionId and orderId are required' });
    const session = await getTextingHelpSession(sessionId);
    if (!session || session.userId !== userId) return res.status(404).json({ error: 'Session not found' });
    if (session.status !== 'pending_payment') return res.json({ paid: true, session });

    const cap = await paypalRequest({
      method: 'POST',
      path: `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
      body: {},
      requestId: `texting-help-cap-${orderId}`,
    });
    if (!cap.ok) {
      console.error('Texting help PayPal capture failed:', cap.raw);
      return res.status(402).json({ error: 'Payment capture failed' });
    }
    const paid = await markTextingHelpPaid(sessionId, 'paypal', { paypalOrderId: orderId });
    res.json({ paid: true, session: paid });
  } catch (error: any) {
    console.error('Texting help PayPal capture error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

export async function createTextingHelpStripePayment(req: Request, res: Response) {
  try {
    const stripe = stripeClient();
    if (!stripe) return res.status(503).json({ error: 'Stripe is not configured' });
    const userId = (req as any).userId as string;
    const { sessionId } = req.body as { sessionId?: string };
    if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });
    const session = await getTextingHelpSession(sessionId);
    if (!session || session.userId !== userId) return res.status(404).json({ error: 'Session not found' });
    if (session.status !== 'pending_payment') return res.json({ alreadyPaid: true, session });

    const intent = await stripe.paymentIntents.create({
      amount: Math.round(TEXTING_HELP_PRICE_EUR * 100),
      currency: 'eur',
      automatic_payment_methods: { enabled: true },
      metadata: { type: 'texting_help', sessionId, userId },
    });
    res.json({ clientSecret: intent.client_secret, paymentIntentId: intent.id });
  } catch (error: any) {
    console.error('Texting help Stripe error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

export async function confirmTextingHelpStripePayment(req: Request, res: Response) {
  try {
    const stripe = stripeClient();
    if (!stripe) return res.status(503).json({ error: 'Stripe is not configured' });
    const userId = (req as any).userId as string;
    const { sessionId, paymentIntentId } = req.body as { sessionId?: string; paymentIntentId?: string };
    if (!sessionId || !paymentIntentId) return res.status(400).json({ error: 'sessionId and paymentIntentId are required' });
    const session = await getTextingHelpSession(sessionId);
    if (!session || session.userId !== userId) return res.status(404).json({ error: 'Session not found' });
    if (session.status !== 'pending_payment') return res.json({ paid: true, session });

    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (intent.status !== 'succeeded' || intent.metadata?.sessionId !== sessionId) {
      return res.status(402).json({ error: 'Payment not complete' });
    }
    const paid = await markTextingHelpPaid(sessionId, 'stripe', { stripePaymentIntentId: paymentIntentId });
    res.json({ paid: true, session: paid });
  } catch (error: any) {
    console.error('Texting help Stripe confirm error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

export async function confirmTextingHelpDemoPay(req: Request, res: Response) {
  try {
    if (isPayPalConfigured() || process.env.STRIPE_SECRET_KEY) {
      return res.status(400).json({ error: 'Use PayPal or card to pay €5' });
    }
    const userId = (req as any).userId as string;
    const { sessionId } = req.body as { sessionId?: string };
    if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });
    const session = await getTextingHelpSession(sessionId);
    if (!session || session.userId !== userId) return res.status(404).json({ error: 'Session not found' });
    const paid = await markTextingHelpPaid(sessionId, 'demo');
    res.json({ paid: true, session: paid });
  } catch (error) {
    console.error('Texting help demo pay error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function pingGuides(sessionId: string, guideUserIds: string[], fromUserId: string, fromName: string) {
  for (const gid of guideUserIds) {
    notifyTextingHelpSos(gid, { sessionId, fromUserId, fromName });
    sendPushToUser(
      gid,
      {
        title: 'Texting SOS — extra cash',
        body: `${fromName} needs live help texting someone. Answer first to appear on their wheel.`,
        data: { type: 'texting_help_sos', sessionId, fromUserId },
      },
      'safety'
    ).catch(() => {});
  }
}

export async function listTextingHelpGuides(req: Request, res: Response) {
  try {
    const userId = (req as any).userId as string;
    const sessionId = String(req.query.sessionId || '');
    const offset = Math.max(0, Number(req.query.offset || 0) || 0);
    const session = await getTextingHelpSession(sessionId);
    if (!session || session.userId !== userId) return res.status(404).json({ error: 'Session not found' });
    if (session.status === 'pending_payment') return res.status(402).json({ error: 'Pay €5 to see available guides' });
    const page = await pickTextingHelpGuides(session, offset);
    const me = await getUserById(userId);
    await pingGuides(session.id, page.guides.map((g) => g.userId), userId, me?.name || 'Someone');
    res.json(page);
  } catch (error) {
    console.error('List texting help guides error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function answerTextingHelp(req: Request, res: Response) {
  try {
    const userId = (req as any).userId as string;
    const { sessionId } = req.body as { sessionId?: string };
    if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });
    const meUser = await getUserById(userId);
    const guide = await getGuideByUserId(userId);
    if (!guide?.isActive && !meUser?.qualifiedCoach) {
      return res.status(403).json({ error: 'Only active guides can answer an SOS' });
    }
    const session = await answerTextingHelpSos(sessionId, userId);
    if (!session) return res.status(404).json({ error: 'SOS not found' });
    const me = await getUserById(userId);
    if (session.firstAnsweredGuideUserId === userId) {
      notifyTextingHelpAnswered(session.userId, {
        sessionId: session.id,
        guideUserId: userId,
        guideName: me?.name || 'A guide',
      });
      sendPushToUser(
        session.userId,
        {
          title: `${me?.name || 'A guide'} answered your SOS`,
          body: 'They are highlighted on the wheel — pick who you want to help you text.',
          data: { type: 'texting_help_answered', sessionId: session.id, guideUserId: userId },
        },
        'safety'
      ).catch(() => {});
    }
    res.json({ session, first: session.firstAnsweredGuideUserId === userId });
  } catch (error) {
    console.error('Answer texting help error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function chooseTextingHelp(req: Request, res: Response) {
  try {
    const userId = (req as any).userId as string;
    const { sessionId, guideUserId } = req.body as { sessionId?: string; guideUserId?: string };
    if (!sessionId || !guideUserId) return res.status(400).json({ error: 'sessionId and guideUserId are required' });
    const session = await chooseTextingHelpGuide(sessionId, userId, guideUserId);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.paymentMethod && session.paymentMethod !== 'demo') {
      await creditGuideSessionPayment({
        guideUserId,
        grossEur: TEXTING_HELP_PRICE_EUR,
        requestId: session.id,
        paymentMethod: session.paymentMethod === 'stripe' ? 'stripe' : 'paypal',
      }).catch((err) => console.error('Texting help wallet credit:', err));
    } else {
      await creditGuideSessionPayment({
        guideUserId,
        grossEur: TEXTING_HELP_PRICE_EUR,
        requestId: session.id,
        paymentMethod: 'paypal',
      }).catch((err) => console.error('Texting help wallet credit:', err));
    }
    notifyTextingHelpChosen(guideUserId, {
      sessionId: session.id,
      liveRoomUrl: session.liveRoomUrl || '',
    });
    sendPushToUser(
      guideUserId,
      {
        title: 'You got the texting SOS',
        body: 'They chose you. Join the live room and help them with the chat — extra cash is in your wallet.',
        data: { type: 'texting_help_chosen', sessionId: session.id, liveRoomUrl: session.liveRoomUrl || '' },
      },
      'safety'
    ).catch(() => {});
    res.json({ session });
  } catch (error) {
    console.error('Choose texting help error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function incomingTextingHelp(req: Request, res: Response) {
  try {
    const userId = (req as any).userId as string;
    const incoming = await listIncomingTextingHelpSos(userId);
    res.json({ incoming });
  } catch (error) {
    console.error('Incoming texting help error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function reviewTextingHelp(req: Request, res: Response) {
  try {
    const userId = (req as any).userId as string;
    const { sessionId, stars, text } = req.body as { sessionId?: string; stars?: number; text?: string };
    if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });
    const review = await addTextingHelpReview(sessionId, userId, Number(stars) || 5, text || '');
    if (!review) return res.status(400).json({ error: 'You can only review after a live session' });
    res.json({ review });
  } catch (error) {
    console.error('Review texting help error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
