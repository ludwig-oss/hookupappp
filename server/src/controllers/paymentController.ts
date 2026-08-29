import { Request, Response } from 'express';
import Stripe from 'stripe';
import { SESSION_PRICE_EUR } from '../models/improvement.js';
import { getRequestById, updateRequestPayment, getGuideById } from '../models/improvement.js';
import { creditGuideSessionPayment } from '../models/guideWallet.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-06-20.acacia' as '2023-10-16',
});

export const createPaymentIntent = async (req: Request, res: Response) => {
  try {
    const { amount, bookingId, currency = 'usd' } = req.body;

    if (!amount || !bookingId) {
      return res.status(400).json({ error: 'Amount and booking ID are required' });
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency,
      metadata: {
        bookingId,
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error: any) {
    console.error('Create payment intent error:', error);
    res.status(500).json({ error: error.message || 'Failed to create payment intent' });
  }
};

export const confirmPaymentWebhook = async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return res.status(400).send('Missing signature or webhook secret');
  }

  let event: Stripe.Event;

  try {
    // req.body should be raw buffer for webhook verification
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const bookingId = paymentIntent.metadata.bookingId;

    if (bookingId) {
      const { updateBookingPayment } = await import('../models/improvement.js');
      await updateBookingPayment(bookingId, paymentIntent.id);
    }
  }

  res.json({ received: true });
};

/** Stripe PaymentIntent for guide request prepay (card, Apple Pay, Google Pay via Stripe). */
export async function createGuideRequestStripePayment(req: Request, res: Response) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(503).json({ error: 'Stripe is not configured. Set STRIPE_SECRET_KEY.' });
    }
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { requestId } = req.body as { requestId?: string };
    if (!requestId) return res.status(400).json({ error: 'requestId is required' });

    const guideRequest = await getRequestById(requestId);
    if (!guideRequest || guideRequest.userId !== userId) {
      return res.status(404).json({ error: 'Request not found' });
    }
    if (guideRequest.status !== 'accepted') {
      return res.status(400).json({ error: 'Request must be accepted first' });
    }
    if (guideRequest.paymentStatus === 'confirmed') {
      return res.status(400).json({ error: 'Already paid' });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(SESSION_PRICE_EUR * 100),
      currency: 'eur',
      metadata: { requestId, type: 'guide_request' },
      automatic_payment_methods: { enabled: true },
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amountEur: SESSION_PRICE_EUR,
      split: { guidePercent: 80, platformPercent: 20 },
    });
  } catch (error: any) {
    console.error('Guide request Stripe payment error:', error);
    res.status(500).json({ error: error.message || 'Failed to create payment' });
  }
}

/** Confirm guide request paid via Stripe (client calls after success). */
export async function confirmGuideRequestStripePayment(req: Request, res: Response) {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { requestId, paymentIntentId } = req.body as { requestId?: string; paymentIntentId?: string };
    if (!requestId || !paymentIntentId) {
      return res.status(400).json({ error: 'requestId and paymentIntentId required' });
    }

    const guideRequest = await getRequestById(requestId);
    if (!guideRequest || guideRequest.userId !== userId) {
      return res.status(404).json({ error: 'Request not found' });
    }
    if (guideRequest.paymentStatus === 'confirmed') {
      return res.json({ message: 'Already paid', paid: true });
    }

    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (pi.status !== 'succeeded') {
      return res.status(402).json({ error: 'Payment not completed' });
    }
    if (pi.metadata?.requestId !== requestId) {
      return res.status(400).json({ error: 'Payment does not match request' });
    }

    await updateRequestPayment(requestId, paymentIntentId);
    const guide = await getGuideById(guideRequest.guideId);
    if (guide) {
      await creditGuideSessionPayment({
        guideUserId: guide.userId,
        grossEur: SESSION_PRICE_EUR,
        requestId,
        paymentMethod: 'stripe',
      });
    }

    res.json({
      message: 'Payment successful — session prepaid. Recording is forbidden.',
      paid: true,
    });
  } catch (error: any) {
    console.error('Confirm guide Stripe payment error:', error);
    res.status(500).json({ error: error.message || 'Failed' });
  }
}

