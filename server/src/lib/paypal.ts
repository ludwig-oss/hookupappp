/**
 * PayPal Commerce Platform (multiparty) client.
 * Secrets stay in env: PAYPAL_CLIENT_ID, PAYPAL_SECRET, PAYPAL_PARTNER_ID, PAYPAL_BN_CODE.
 */

export function paypalApiBase(): string {
  return process.env.PAYPAL_SANDBOX === 'false' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
}

export function paypalClientId(): string {
  return (process.env.PAYPAL_CLIENT_ID || '').trim();
}

export function paypalSecret(): string {
  return (process.env.PAYPAL_SECRET || '').trim();
}

export function paypalPartnerId(): string {
  return (process.env.PAYPAL_PARTNER_ID || process.env.PAYPAL_MERCHANT_ID || '').trim();
}

export function paypalBnCode(): string {
  return (process.env.PAYPAL_BN_CODE || '').trim();
}

export function isPayPalConfigured(): boolean {
  return Boolean(paypalClientId() && paypalSecret());
}

export function formatPayPalMoney(amount: number): string {
  return (Math.round(amount * 100) / 100).toFixed(2);
}

export function paypalAuthAssertion(sellerMerchantId?: string | null): string {
  const iss = paypalClientId();
  const payerId = (sellerMerchantId || paypalPartnerId()).trim();
  const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ iss, payer_id: payerId })).toString('base64url');
  return `${header}.${payload}.`;
}

function partnerHeaders(extra?: Record<string, string>, sellerMerchantId?: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extra,
  };
  const bn = paypalBnCode();
  if (bn) headers['PayPal-Partner-Attribution-Id'] = bn;
  if (paypalPartnerId() || sellerMerchantId) {
    headers['PayPal-Auth-Assertion'] = paypalAuthAssertion(sellerMerchantId);
  }
  return headers;
}

export async function getPayPalAccessToken(): Promise<string> {
  if (!isPayPalConfigured()) {
    throw new Error('PayPal is not configured. Set PAYPAL_CLIENT_ID and PAYPAL_SECRET.');
  }
  const auth = Buffer.from(`${paypalClientId()}:${paypalSecret()}`).toString('base64');
  const res = await fetch(`${paypalApiBase()}/v1/oauth2/token`, {
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

export async function paypalRequest<T = unknown>(opts: {
  method: 'GET' | 'POST' | 'PATCH';
  path: string;
  body?: unknown;
  sellerMerchantId?: string | null;
  requestId?: string;
}): Promise<{ ok: boolean; status: number; data: T; raw: string }> {
  const token = await getPayPalAccessToken();
  const headers = partnerHeaders(
    {
      Authorization: `Bearer ${token}`,
      ...(opts.requestId ? { 'PayPal-Request-Id': opts.requestId } : {}),
    },
    opts.sellerMerchantId
  );
  const res = await fetch(`${paypalApiBase()}${opts.path}`, {
    method: opts.method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const raw = await res.text();
  let data = {} as T;
  try {
    data = raw ? (JSON.parse(raw) as T) : ({} as T);
  } catch {
    data = {} as T;
  }
  return { ok: res.ok, status: res.status, data, raw };
}

export type PayPalLink = { rel: string; href?: string };

export function findPayPalLink(links: PayPalLink[] | undefined, rel: string): string | undefined {
  return links?.find((l) => l.rel === rel)?.href;
}

export function platformFeeInstruction(platformFeeEur: number): {
  disbursement_mode: 'INSTANT';
  platform_fees: Array<{ amount: { currency_code: string; value: string } }>;
} {
  return {
    disbursement_mode: 'INSTANT',
    platform_fees: [
      {
        amount: { currency_code: 'EUR', value: formatPayPalMoney(platformFeeEur) },
      },
    ],
  };
}

export function buildAuthorizeOrderPayload(opts: {
  amountEur: number;
  platformFeeEur: number;
  description: string;
  customId: string;
  returnUrl: string;
  cancelUrl: string;
  brandName: string;
  sellerMerchantId?: string | null;
}): Record<string, unknown> {
  const purchaseUnit: Record<string, unknown> = {
    reference_id: opts.customId.slice(0, 256),
    custom_id: opts.customId.slice(0, 127),
    description: opts.description.slice(0, 127),
    amount: { currency_code: 'EUR', value: formatPayPalMoney(opts.amountEur) },
  };
  if (opts.sellerMerchantId) {
    purchaseUnit.payee = { merchant_id: opts.sellerMerchantId };
    purchaseUnit.payment_instruction = platformFeeInstruction(opts.platformFeeEur);
  }
  return {
    intent: 'AUTHORIZE',
    purchase_units: [purchaseUnit],
    application_context: {
      return_url: opts.returnUrl,
      cancel_url: opts.cancelUrl,
      brand_name: opts.brandName,
      user_action: 'PAY_NOW',
    },
  };
}

export interface PayPalAuthorizationResult {
  authorizationId: string;
  orderId: string;
  expiresAt: string | null;
  status: string;
}

export function parseAuthorizationFromOrder(order: {
  id?: string;
  purchase_units?: Array<{
    payments?: {
      authorizations?: Array<{ id?: string; expiration_time?: string; status?: string }>;
    };
  }>;
}): PayPalAuthorizationResult | null {
  const auth = order.purchase_units?.[0]?.payments?.authorizations?.[0];
  if (!auth?.id) return null;
  return {
    authorizationId: auth.id,
    orderId: order.id || '',
    expiresAt: auth.expiration_time || null,
    status: auth.status || 'CREATED',
  };
}
