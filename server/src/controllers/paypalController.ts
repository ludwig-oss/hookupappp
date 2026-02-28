import { Request, Response } from 'express';
import { SESSION_PRICE_EUR } from '../models/improvement.js';
import { getRequestById, updateRequestPayment } from '../models/improvement.js';

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
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`PayPal auth failed: ${err}`);
  }
  const data = (await res.json()) as { access_token?: string };
  return data.access_token || '';
}

/** Create a PayPal order for 10 EUR session; body: { requestId } */
export async function createPayPalOrder(req: Request, res: Response) {
  try {
    if (!PAYPAL_CLIENT_ID || !PAYPAL_SECRET) {
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

    const accessToken = await getPayPalAccessToken();
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const orderPayload = {
      intent: 'CAPTURE',
      purchase_units: [{
        amount: { currency_code: 'EUR', value: String(SESSION_PRICE_EUR) },
        description: 'Expert session (1 appointment)',
        custom_id: requestId,
      }],
      application_context: {
        return_url: `${frontendUrl}/home?paypal=success&requestId=${requestId}`,
        cancel_url: `${frontendUrl}/home?paypal=cancel`,
        brand_name: 'ASWP Expert Session',
      },
    };

    const orderRes = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(orderPayload),
    });

    if (!orderRes.ok) {
      const err = await orderRes.text();
      console.error('PayPal create order error:', err);
      return res.status(502).json({ error: 'PayPal order failed' });
    }

    const order = (await orderRes.json()) as { id?: string; links?: Array<{ rel: string; href?: string }> };
    const approveLink = order.links?.find((l) => l.rel === 'approve')?.href;
    res.json({ orderId: order.id, requestId, approvalUrl: approveLink });
  } catch (e: any) {
    console.error('Create PayPal order error:', e);
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
}

/** Capture PayPal order and mark request as paid; body: { orderId, requestId } */
export async function capturePayPalOrder(req: Request, res: Response) {
  try {
    if (!PAYPAL_CLIENT_ID || !PAYPAL_SECRET) {
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

    const accessToken = await getPayPalAccessToken();
    const captureRes = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!captureRes.ok) {
      const err = await captureRes.text();
      console.error('PayPal capture error:', err);
      return res.status(402).json({ error: 'Payment capture failed' });
    }

    await updateRequestPayment(requestId, orderId);
    res.json({ message: 'Payment successful', paid: true, requestId });
  } catch (e: any) {
    console.error('Capture PayPal order error:', e);
    res.status(500).json({ error: e.message || 'Internal server error' });
  }
}
