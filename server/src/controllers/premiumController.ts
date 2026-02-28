import { Request, Response } from 'express';
import {
  getPremiumPlans,
  getPremiumPlan,
  getUserSubscription,
  createSubscription,
  cancelSubscription,
  getPaymentHistory,
} from '../models/premium.js';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-12-18.acacia' as '2023-10-16',
});

export const getPlans = async (req: Request, res: Response) => {
  try {
    const plans = await getPremiumPlans();
    res.json({ plans });
  } catch (error) {
    console.error('Get plans error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getStatus = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const subscription = await getUserSubscription(userId);
    res.json({ subscription, isPremium: !!subscription });
  } catch (error) {
    console.error('Get premium status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const subscribe = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { planId, paymentMethodId } = req.body;

    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(503).json({ error: 'Payments are not configured yet. Premium will be available soon.' });
    }

    if (!planId || !paymentMethodId) {
      return res.status(400).json({ error: 'Plan ID and payment method are required' });
    }

    const plan = await getPremiumPlan(planId);
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    // Create Stripe payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(plan.price * 100), // Convert to cents
      currency: plan.currency.toLowerCase(),
      payment_method: paymentMethodId,
      confirm: true,
      return_url: `${req.headers.origin || 'http://localhost:5173'}/settings?premium=success`,
    });

    if (paymentIntent.status === 'succeeded') {
      const subscription = await createSubscription(userId, planId, paymentIntent.id);
      res.json({ subscription, success: true });
    } else {
      res.status(400).json({ error: 'Payment failed' });
    }
  } catch (error: any) {
    console.error('Subscribe error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const cancel = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const cancelled = await cancelSubscription(userId);
    if (cancelled) {
      res.json({ message: 'Subscription cancelled successfully' });
    } else {
      res.status(404).json({ error: 'No active subscription found' });
    }
  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getHistory = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const history = await getPaymentHistory(userId);
    res.json({ history });
  } catch (error) {
    console.error('Get payment history error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};



