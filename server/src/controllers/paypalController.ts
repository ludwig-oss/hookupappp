import { Request, Response } from 'express';
import { SESSION_PRICE_EUR, getRequestById, updateRequestPayment, getGuideById } from '../models/improvement.js';
import { getOrCreateWallet, holdGuideSessionPayment, setWalletPaypalMerchant, setWalletPaypalOnboardingStatus, splitSessionPayment } from '../models/guideWallet.js';
import { createAuthorizationHold, getHoldByRequestId } from '../models/paypalHolds.js';
import {
  buildAuthorizeOrderPayload,
  findPayPalLink,
  isPayPalConfigured,
  parseAuthorizationFromOrder,
  paypalPartnerId,
  paypalRequest,
} from '../lib/paypal.js';

function frontendBase(): string {
  return (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
}

/** Partner onboarding so creators connect PayPal and we store their Merchant ID. */
export async function startPaypalOnboarding(req: Request, res: Response) {
  try {
    if (!isPayPalConfigured()) {
      return res.status(503).json({ error: 'PayPal is not configured. Set PAYPAL_CLIENT_ID and PAYPAL_SECRET.' });
    }
    const userId = (req as any).userId as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const trackingId = `guide-${userId}`.slice(0, 127);
    await setWalletPaypalOnboardingStatus(userId, 'pending', trackingId);

    const payload = {
      tracking_id: trackingId,
      operations: [
        {
          operation: 'API_INTEGRATION',
          api_integration_preference: {
            rest_api_integration: {
              integration_method: 'PAYPAL',
              integration_type: 'THIRD_PARTY',
              third_party_details: {
                features: ['PAYMENT', 'REFUND', 'PARTNER_FEE', 'DELAYED_FUNDS_DISBURSEMENT'],
              },
            },
          },
        },
      ],
      products: ['PPCP'],
      legal_consents: [{ type: 'SHARE_DATA_CONSENT', granted: true }],
      partner_config_override: {
        return_url: `${frontendBase()}/home?paypal_connect=return`,
        return_url_description: 'Return to your wallet',
        show_add_credit_card: true,
      },
    };

    const result = await paypalRequest<{ links?: Array<{ rel: string; href?: string }> }>({
      method: 'POST',
      path: '/v2/customer/partner-referrals',
      body: payload,
      requestId: `onboard-${trackingId}-${Date.now()}`,
    });
    if (!result.ok) {
      console.error('PayPal partner referral error:', result.raw);
      return res.status(502).json({ error: 'PayPal onboarding could not start. Check partner credentials (PAYPAL_PARTNER_ID, PAYPAL_BN_CODE).' });
    }

    const actionUrl = findPayPalLink(result.data.links, 'action_url');
    res.json({ actionUrl, trackingId, status: 'pending' });
  } catch (e: any) {
    console.error('PayPal onboarding start error:', e);
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
}

/** Save Merchant ID after PayPal redirects the creator back. */
export async function completePaypalOnboarding(req: Request, res: Response) {
  try {
    const userId = (req as any).userId as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const merchantIdInPayPal = String(
      req.body?.merchantIdInPayPal || req.body?.merchantId || req.query.merchantIdInPayPal || req.query.merchantId || ''
    ).trim();
    const permissionsGranted = String(req.body?.permissionsGranted || req.query.permissionsGranted || 'true') !== 'false';

    if (!merchantIdInPayPal) {
      return res.status(400).json({ error: 'merchantIdInPayPal is required' });
    }
    if (!permissionsGranted) {
      await setWalletPaypalOnboardingStatus(userId, 'denied');
      return res.status(400).json({ error: 'PayPal permissions were not granted' });
    }

    let status: 'active' | 'pending' | 'denied' = 'active';
    const partnerId = paypalPartnerId();
    if (partnerId) {
      const check = await paypalRequest<{
        payments_receivable?: boolean;
        primary_email_confirmed?: boolean;
        oauth_integrations?: unknown[];
      }>({
        method: 'GET',
        path: `/v1/customer/partners/${encodeURIComponent(partnerId)}/merchant-integrations/${encodeURIComponent(merchantIdInPayPal)}`,
        sellerMerchantId: merchantIdInPayPal,
      });
      if (check.ok) {
        const receivable = check.data.payments_receivable !== false;
        const emailOk = check.data.primary_email_confirmed !== false;
        status = receivable && emailOk ? 'active' : 'pending';
      }
    }

    const wallet = await setWalletPaypalMerchant(userId, {
      merchantId: merchantIdInPayPal,
      status,
    });
    res.json({
      message: status === 'active' ? 'PayPal connected' : 'PayPal connected — waiting for PayPal to finish activating the account',
      wallet,
      paypalConnected: status === 'active',
    });
  } catch (e: any) {
    console.error('PayPal onboarding complete error:', e);
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
}

/** Create a PayPal order with intent AUTHORIZE so funds are held until withdraw. */
export async function createPayPalOrder(req: Request, res: Response) {
  try {
    if (!isPayPalConfigured()) {
      return res.status(503).json({ error: 'PayPal is not configured. Set PAYPAL_CLIENT_ID and PAYPAL_SECRET.' });
    }
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { requestId } = req.body;
    if (!requestId) return res.status(400).json({ error: 'requestId is required' });

    const guideRequest = await getRequestById(requestId);
    if (!guideRequest || guideRequest.userId !== userId) return res.status(404).json({ error: 'Request not found' });
    if (guideRequest.status !== 'accepted') return res.status(400).json({ error: 'Request must be accepted first' });
    if (guideRequest.paymentStatus === 'confirmed') return res.status(400).json({ error: 'Already paid' });

    const guide = await getGuideById(guideRequest.guideId);
    const sellerWallet = guide ? await getOrCreateWallet(guide.userId) : null;
    const sellerMerchantId = sellerWallet?.paypalMerchantId || null;
    const { platformFee } = splitSessionPayment(SESSION_PRICE_EUR);

    const orderPayload = buildAuthorizeOrderPayload({
      amountEur: SESSION_PRICE_EUR,
      platformFeeEur: platformFee,
      description: 'Expert session (1 appointment)',
      customId: requestId,
      returnUrl: `${frontendBase()}/home?paypal=success&requestId=${requestId}`,
      cancelUrl: `${frontendBase()}/home?paypal=cancel`,
      brandName: 'ASWP Expert Session',
      sellerMerchantId,
    });

    const orderRes = await paypalRequest<{ id?: string; links?: Array<{ rel: string; href?: string }> }>({
      method: 'POST',
      path: '/v2/checkout/orders',
      body: orderPayload,
      sellerMerchantId,
      requestId: `order-${requestId}`,
    });

    if (!orderRes.ok) {
      console.error('PayPal create order error:', orderRes.raw);
      return res.status(502).json({ error: 'PayPal order failed' });
    }

    const approveLink = findPayPalLink(orderRes.data.links, 'approve') || findPayPalLink(orderRes.data.links, 'payer-action');
    res.json({ orderId: orderRes.data.id, requestId, approvalUrl: approveLink, intent: 'AUTHORIZE' });
  } catch (e: any) {
    console.error('Create PayPal order error:', e);
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
}

/**
 * After the buyer approves, authorize the order (hold funds).
 * Capture happens later on Withdraw.
 * Route kept as /capture so the existing client return URL still works.
 */
export async function capturePayPalOrder(req: Request, res: Response) {
  try {
    if (!isPayPalConfigured()) {
      return res.status(503).json({ error: 'PayPal is not configured' });
    }
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { orderId, requestId } = req.body;
    if (!orderId || !requestId) return res.status(400).json({ error: 'orderId and requestId are required' });

    const guideRequest = await getRequestById(requestId);
    if (!guideRequest || guideRequest.userId !== userId) return res.status(404).json({ error: 'Request not found' });
    if (guideRequest.status !== 'accepted') return res.status(400).json({ error: 'Request must be accepted' });
    if (guideRequest.paymentStatus === 'confirmed') return res.json({ message: 'Already paid', paid: true });

    const existingHold = await getHoldByRequestId(requestId);
    if (existingHold) {
      await updateRequestPayment(requestId, orderId);
      return res.json({ message: 'Already authorized', paid: true, requestId, held: true });
    }

    const authRes = await paypalRequest<{
      id?: string;
      purchase_units?: Array<{
        payments?: { authorizations?: Array<{ id?: string; expiration_time?: string; status?: string }> };
      }>;
    }>({
      method: 'POST',
      path: `/v2/checkout/orders/${encodeURIComponent(orderId)}/authorize`,
      body: {},
      requestId: `auth-${orderId}`,
    });

    if (!authRes.ok) {
      console.error('PayPal authorize error:', authRes.raw);
      return res.status(402).json({ error: 'Payment authorization failed' });
    }

    const parsed = parseAuthorizationFromOrder({ id: orderId, ...authRes.data });
    if (!parsed) {
      return res.status(402).json({ error: 'PayPal did not return an authorization id' });
    }

    await updateRequestPayment(requestId, orderId);

    const guide = await getGuideById(guideRequest.guideId);
    if (guide) {
      const sellerWallet = await getOrCreateWallet(guide.userId);
      const { guideShare, platformFee } = splitSessionPayment(SESSION_PRICE_EUR);
      await createAuthorizationHold({
        userId: guide.userId,
        orderId,
        authorizationId: parsed.authorizationId,
        requestId,
        payerUserId: userId,
        grossEur: SESSION_PRICE_EUR,
        platformFeeEur: platformFee,
        guideShareEur: guideShare,
        currency: 'EUR',
        merchantId: sellerWallet.paypalMerchantId,
        expiresAt: parsed.expiresAt,
      });
      await holdGuideSessionPayment({
        guideUserId: guide.userId,
        grossEur: SESSION_PRICE_EUR,
        requestId,
      });
    }

    res.json({
      message: 'Payment authorized — session is prepaid. Funds stay held until your guide withdraws.',
      paid: true,
      requestId,
      authorizationId: parsed.authorizationId,
      held: true,
      split: { guidePercent: 80, platformPercent: 20 },
    });
  } catch (e: any) {
    console.error('Authorize PayPal order error:', e);
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
}
