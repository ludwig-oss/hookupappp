import { Request, Response } from 'express';
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
import { creditGuideSessionPayment } from '../models/guideWallet.js';
import {
  formatEurCents,
  getStripe,
  isStripeConfigured,
  stripeFrontendBase,
} from '../lib/stripeClient.js';
import {
  notifyTextingHelpAnswered,
  notifyTextingHelpChosen,
  notifyTextingHelpSos,
} from '../realtime/notifications.js';
import { sendPushToUser } from '../realtime/push.js';

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
      stripeConfigured: isStripeConfigured(),
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

/** Hosted Stripe Checkout — returns { url, sessionId }. */
export async function createTextingHelpCheckout(req: Request, res: Response) {
  try {
    if (!isStripeConfigured()) {
      return res.status(503).json({ error: 'Stripe is not configured' });
    }
    const stripe = getStripe();
    const userId = (req as any).userId as string;
    const { sessionId } = req.body as { sessionId?: string };
    if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });
    const session = await getTextingHelpSession(sessionId);
    if (!session || session.userId !== userId) return res.status(404).json({ error: 'Session not found' });
    if (session.status !== 'pending_payment') return res.json({ alreadyPaid: true, session });

    const base = stripeFrontendBase(req);
    const checkout = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: { name: 'Live texting help (guide SOS)' },
            unit_amount: formatEurCents(TEXTING_HELP_PRICE_EUR),
          },
          quantity: 1,
        },
      ],
      success_url: `${base}/home?textingHelp=success&sessionId=${encodeURIComponent(sessionId)}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/home?textingHelp=cancel`,
      metadata: { type: 'texting_help', sessionId, userId },
    });
    res.json({ url: checkout.url, sessionId: checkout.id });
  } catch (error: any) {
    console.error('Texting help Stripe checkout error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

/** PaymentIntent flow (Elements) — kept for clients that still use clientSecret. */
export async function createTextingHelpStripePayment(req: Request, res: Response) {
  try {
    if (!isStripeConfigured()) return res.status(503).json({ error: 'Stripe is not configured' });
    const stripe = getStripe();
    const userId = (req as any).userId as string;
    const { sessionId } = req.body as { sessionId?: string };
    if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });
    const session = await getTextingHelpSession(sessionId);
    if (!session || session.userId !== userId) return res.status(404).json({ error: 'Session not found' });
    if (session.status !== 'pending_payment') return res.json({ alreadyPaid: true, session });

    const intent = await stripe.paymentIntents.create({
      amount: formatEurCents(TEXTING_HELP_PRICE_EUR),
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
    if (!isStripeConfigured()) return res.status(503).json({ error: 'Stripe is not configured' });
    const stripe = getStripe();
    const userId = (req as any).userId as string;
    const { sessionId, paymentIntentId, checkoutSessionId, session_id } = req.body as {
      sessionId?: string;
      paymentIntentId?: string;
      checkoutSessionId?: string;
      session_id?: string;
    };
    if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });
    const session = await getTextingHelpSession(sessionId);
    if (!session || session.userId !== userId) return res.status(404).json({ error: 'Session not found' });
    if (session.status !== 'pending_payment') return res.json({ paid: true, session });

    const checkoutId = checkoutSessionId || session_id;
    if (checkoutId) {
      const checkout = await stripe.checkout.sessions.retrieve(checkoutId);
      if (checkout.payment_status !== 'paid' || checkout.metadata?.sessionId !== sessionId) {
        return res.status(402).json({ error: 'Payment not complete' });
      }
      const paid = await markTextingHelpPaid(sessionId, 'stripe', {
        stripePaymentIntentId: String(checkout.payment_intent || checkoutId),
      });
      return res.json({ paid: true, session: paid });
    }

    if (!paymentIntentId) {
      return res.status(400).json({ error: 'paymentIntentId or checkoutSessionId is required' });
    }
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

export async function confirmTextingHelpDemoPay(_req: Request, res: Response) {
  return res.status(400).json({ error: 'Use Stripe Checkout to pay €5' });
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
    await creditGuideSessionPayment({
      guideUserId,
      grossEur: TEXTING_HELP_PRICE_EUR,
      requestId: session.id,
      paymentMethod: 'stripe',
    }).catch((err) => console.error('Texting help wallet credit:', err));
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
