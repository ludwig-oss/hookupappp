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
  guideRespondAppointment,
  addConfessionMessage,
  endConfessionSession,
  retryGuideMatching,
  sanitizeSessionForClient,
  listBlurredConfessionGuides,
  getVoiceCallForClient,
  setVoiceCallOffer,
  setVoiceCallAnswer,
  addVoiceCallIce,
  hangupVoiceCall,
  SEEKER_SAFETY_AGREEMENT,
  GUIDE_NDA_AGREEMENT,
} from '../models/anonymousConfession.js';
import { getGuideByUserId } from '../models/improvement.js';
import { getOrCreateWallet, holdGuideSessionPayment, splitSessionPayment } from '../models/guideWallet.js';
import { createAuthorizationHold, getHoldByRequestId } from '../models/paypalHolds.js';
import {
  buildAuthorizeOrderPayload,
  findPayPalLink,
  isPayPalConfigured,
  parseAuthorizationFromOrder,
  paypalRequest,
} from '../lib/paypal.js';
import { sendPushToUser } from '../realtime/push.js';
import { notifyConfessionRequest, notifyConfessionMessage } from '../realtime/notifications.js';
import { sanitizeMessageContent, LIMITS } from '../utils/sanitize.js';

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
    const { amountEur, safetySignature, guideId, appointmentAt, guideScope } = req.body as {
      amountEur?: number;
      safetySignature?: string;
      guideId?: string;
      appointmentAt?: string;
      guideScope?: string;
    };
    if (amountEur !== 5 && amountEur !== 10) {
      return res.status(400).json({ error: 'Choose €5 or €10 for your confession session' });
    }
    if (!safetySignature?.trim()) {
      return res.status(400).json({ error: 'Sign the safety agreement before continuing' });
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
      return res.status(503).json({ error: 'PayPal is not configured. Set PAYPAL_CLIENT_ID and PAYPAL_SECRET.' });
    }
    const userId = (req as any).userId as string;
    const session = await getSessionById(req.params.sessionId);
    if (!session || session.seekerUserId !== userId) return res.status(404).json({ error: 'Session not found' });
    if (session.paymentStatus === 'paid') return res.status(400).json({ error: 'Already paid' });
    if (session.status !== 'awaiting_payment') {
      return res.status(400).json({ error: 'Your guide must accept the appointment before you can pay' });
    }

    const sellerWallet = session.guideUserId ? await getOrCreateWallet(session.guideUserId) : null;
    const { platformFee } = splitSessionPayment(session.amountEur);
    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
    const orderPayload = buildAuthorizeOrderPayload({
      amountEur: session.amountEur,
      platformFeeEur: platformFee,
      description: 'Anonymous confession session',
      customId: session.id,
      returnUrl: `${frontendUrl}/home?confession=success&sessionId=${session.id}`,
      cancelUrl: `${frontendUrl}/home?confession=cancel`,
      brandName: 'ASWP Confession Booth',
      sellerMerchantId: sellerWallet?.paypalMerchantId || null,
    });

    const orderRes = await paypalRequest<{ id?: string; links?: Array<{ rel: string; href?: string }> }>({
      method: 'POST',
      path: '/v2/checkout/orders',
      body: orderPayload,
      sellerMerchantId: sellerWallet?.paypalMerchantId || null,
      requestId: `confession-order-${session.id}`,
    });

    if (!orderRes.ok) return res.status(502).json({ error: 'PayPal order failed' });
    const approveLink = findPayPalLink(orderRes.data.links, 'approve') || findPayPalLink(orderRes.data.links, 'payer-action');
    res.json({ orderId: orderRes.data.id, sessionId: session.id, approvalUrl: approveLink, intent: 'AUTHORIZE' });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed' });
  }
}

export async function capturePayPalOrderHandler(req: Request, res: Response) {
  try {
    if (!isPayPalConfigured()) {
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

    const alreadyHeld = await getHoldByRequestId(sessionId);
    if (!alreadyHeld) {
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

      if (existing.guideUserId) {
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
        ? 'Payment received. The confession booth is open — say what you need to share.'
        : 'Payment received. Your guide will open the booth shortly.',
      session: sanitizeSessionForClient(session, userId),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed' });
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
