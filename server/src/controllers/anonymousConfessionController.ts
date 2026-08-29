import { Request, Response } from 'express';
import {
  createConfessionSession,
  getSessionById,
  getSessionsForUser,
  getPendingGuideSessions,
  getGuidePrefs,
  setGuideConfessionAvailability,
  markSessionPaid,
  creditConfessionPayment,
  guideAcceptSession,
  addConfessionMessage,
  endConfessionSession,
  retryGuideMatching,
  sanitizeSessionForClient,
  SEEKER_SAFETY_AGREEMENT,
  GUIDE_NDA_AGREEMENT,
} from '../models/anonymousConfession.js';
import { getGuideByUserId } from '../models/improvement.js';
import { sendPushToUser } from '../realtime/push.js';
import { notifyConfessionRequest, notifyConfessionMessage } from '../realtime/notifications.js';
import { sanitizeMessageContent, LIMITS } from '../utils/sanitize.js';

const PAYPAL_API_BASE = process.env.PAYPAL_SANDBOX === 'false' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || '';
const PAYPAL_SECRET = process.env.PAYPAL_SECRET || '';

async function getPayPalAccessToken(): Promise<string> {
  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`).toString('base64');
  const res = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${auth}`,
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error('PayPal auth failed');
  const data = (await res.json()) as { access_token?: string };
  return data.access_token || '';
}

export async function getConfessionInfoHandler(_req: Request, res: Response) {
  res.json({
    seekerSafetyAgreement: SEEKER_SAFETY_AGREEMENT,
    guideNdaAgreement: GUIDE_NDA_AGREEMENT,
    prices: [5, 10],
    split: { guidePercent: 80, platformPercent: 20 },
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

export async function createSessionHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).userId as string;
    const { amountEur, safetySignature } = req.body as { amountEur?: number; safetySignature?: string };
    if (amountEur !== 5 && amountEur !== 10) {
      return res.status(400).json({ error: 'Choose €5 or €10 for your confession session' });
    }
    if (!safetySignature?.trim()) {
      return res.status(400).json({ error: 'Sign the safety agreement before continuing' });
    }

    const session = await createConfessionSession({
      seekerUserId: userId,
      amountEur: amountEur,
      safetySignature: safetySignature.trim(),
    });

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
    if (!PAYPAL_CLIENT_ID || !PAYPAL_SECRET) {
      return res.status(503).json({ error: 'PayPal is not configured. Set PAYPAL_CLIENT_ID and PAYPAL_SECRET.' });
    }
    const userId = (req as any).userId as string;
    const session = await getSessionById(req.params.sessionId);
    if (!session || session.seekerUserId !== userId) return res.status(404).json({ error: 'Session not found' });
    if (session.paymentStatus === 'paid') return res.status(400).json({ error: 'Already paid' });

    const accessToken = await getPayPalAccessToken();
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const orderPayload = {
      intent: 'CAPTURE',
      purchase_units: [{
        amount: { currency_code: 'EUR', value: String(session.amountEur) },
        description: 'Anonymous confession session',
        custom_id: session.id,
      }],
      application_context: {
        return_url: `${frontendUrl}/home?confession=success&sessionId=${session.id}`,
        cancel_url: `${frontendUrl}/home?confession=cancel`,
        brand_name: 'ASWP Confession Booth',
      },
    };

    const orderRes = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(orderPayload),
    });

    if (!orderRes.ok) return res.status(502).json({ error: 'PayPal order failed' });
    const order = (await orderRes.json()) as { id?: string; links?: Array<{ rel: string; href?: string }> };
    const approveLink = order.links?.find((l) => l.rel === 'approve')?.href;
    res.json({ orderId: order.id, sessionId: session.id, approvalUrl: approveLink });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed' });
  }
}

export async function capturePayPalOrderHandler(req: Request, res: Response) {
  try {
    if (!PAYPAL_CLIENT_ID || !PAYPAL_SECRET) {
      return res.status(503).json({ error: 'PayPal is not configured' });
    }
    const userId = (req as any).userId as string;
    const { orderId, sessionId } = req.body as { orderId?: string; sessionId?: string };
    if (!orderId || !sessionId) return res.status(400).json({ error: 'orderId and sessionId required' });

    const existing = await getSessionById(sessionId);
    if (!existing || existing.seekerUserId !== userId) return res.status(404).json({ error: 'Session not found' });
    if (existing.paymentStatus === 'paid') {
      return res.json({ message: 'Already paid', session: sanitizeSessionForClient(existing, userId) });
    }

    const accessToken = await getPayPalAccessToken();
    const captureRes = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    });
    if (!captureRes.ok) return res.status(402).json({ error: 'Payment capture failed' });

    let session = await markSessionPaid(sessionId, orderId);
    if (session.guideUserId) {
      notifyConfessionRequest(session.guideUserId, { sessionId: session.id });
      sendPushToUser(session.guideUserId, {
        title: 'Anonymous confession — guide needed',
        body: `Someone paid €${session.amountEur} for confidential support. Accept after signing your NDA.`,
        data: { type: 'confession_request', sessionId: session.id },
      }).catch(() => {});
    }

    res.json({
      message: session.guideUserId
        ? 'Payment received. A guide was notified — session starts when they accept.'
        : 'Payment received. Waiting for an available anonymous guide…',
      session: sanitizeSessionForClient(session, userId),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed' });
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
