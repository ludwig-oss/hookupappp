import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export type PaypalHoldStatus = 'authorized' | 'captured' | 'voided' | 'expired';

export interface PaypalAuthorizationHold {
  id: string;
  userId: string;
  orderId: string;
  authorizationId: string;
  requestId?: string;
  sessionId?: string;
  payerUserId?: string;
  grossEur: number;
  platformFeeEur: number;
  guideShareEur: number;
  currency: 'EUR';
  merchantId: string | null;
  status: PaypalHoldStatus;
  createdAt: string;
  expiresAt: string | null;
  capturedAt: string | null;
  captureId: string | null;
}

const HOLDS_PATH = join(process.cwd(), 'server', 'data', 'paypal-authorizations.json');

async function readHolds(): Promise<PaypalAuthorizationHold[]> {
  try {
    return JSON.parse(await readFile(HOLDS_PATH, 'utf-8'));
  } catch {
    return [];
  }
}

async function writeHolds(list: PaypalAuthorizationHold[]): Promise<void> {
  const dir = join(process.cwd(), 'server', 'data');
  await mkdir(dir, { recursive: true });
  await writeFile(HOLDS_PATH, JSON.stringify(list, null, 2));
}

export async function createAuthorizationHold(
  hold: Omit<PaypalAuthorizationHold, 'id' | 'createdAt' | 'capturedAt' | 'captureId' | 'status'> & {
    status?: PaypalHoldStatus;
  }
): Promise<PaypalAuthorizationHold> {
  const list = await readHolds();
  const existing = list.find(
    (h) => h.authorizationId === hold.authorizationId || (hold.requestId && h.requestId === hold.requestId && h.status === 'authorized')
  );
  if (existing) return existing;

  const row: PaypalAuthorizationHold = {
    ...hold,
    id: `${Date.now()}-${hold.authorizationId.slice(-8)}`,
    status: hold.status || 'authorized',
    createdAt: new Date().toISOString(),
    capturedAt: null,
    captureId: null,
  };
  list.push(row);
  await writeHolds(list);
  return row;
}

export async function listOpenHolds(userId: string): Promise<PaypalAuthorizationHold[]> {
  const now = Date.now();
  const list = await readHolds();
  const open = list.filter((h) => h.userId === userId && h.status === 'authorized');
  let dirty = false;
  for (const h of open) {
    if (h.expiresAt && new Date(h.expiresAt).getTime() < now) {
      h.status = 'expired';
      dirty = true;
    }
  }
  if (dirty) await writeHolds(list);
  return list
    .filter((h) => h.userId === userId && h.status === 'authorized')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function getHoldByRequestId(requestId: string): Promise<PaypalAuthorizationHold | null> {
  const list = await readHolds();
  return list.find((h) => h.requestId === requestId) || null;
}

export async function getHoldByAuthorizationId(authorizationId: string): Promise<PaypalAuthorizationHold | null> {
  const list = await readHolds();
  return list.find((h) => h.authorizationId === authorizationId) || null;
}

export async function markHoldCaptured(authorizationId: string, captureId: string): Promise<void> {
  const list = await readHolds();
  const h = list.find((x) => x.authorizationId === authorizationId);
  if (!h) return;
  h.status = 'captured';
  h.captureId = captureId;
  h.capturedAt = new Date().toISOString();
  await writeHolds(list);
}

export async function listHoldsForUser(userId: string): Promise<PaypalAuthorizationHold[]> {
  const list = await readHolds();
  return list.filter((h) => h.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
