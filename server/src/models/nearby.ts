import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

export type BuzzStatus = 'pending' | 'accepted' | 'rejected' | 'later' | 'cancelled';

export interface BuzzRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: BuzzStatus;
  createdAt: Date | string;
  updatedAt: Date | string;
  responseMessage?: string | null;
}

const DB_PATH = join(process.cwd(), 'server', 'data', 'buzz.json');

async function readBuzz(): Promise<BuzzRequest[]> {
  try {
    const data = await readFile(DB_PATH, 'utf-8');
    const items = JSON.parse(data);
    return items.map((b: BuzzRequest) => ({
      ...b,
      createdAt: b.createdAt ? new Date(b.createdAt) : new Date(),
      updatedAt: b.updatedAt ? new Date(b.updatedAt) : new Date(),
    }));
  } catch {
    return [];
  }
}

async function writeBuzz(items: BuzzRequest[]): Promise<void> {
  const dir = join(process.cwd(), 'server', 'data');
  await import('fs/promises').then(fs => fs.mkdir(dir, { recursive: true }));
  await writeFile(DB_PATH, JSON.stringify(items, null, 2));
}

export async function createBuzz(fromUserId: string, toUserId: string): Promise<BuzzRequest> {
  const items = await readBuzz();

  // Avoid duplicate pending requests
  const existing = items.find(
    b => b.fromUserId === fromUserId && b.toUserId === toUserId && b.status === 'pending'
  );
  if (existing) return existing;

  const buzz: BuzzRequest = {
    id: Date.now().toString(),
    fromUserId,
    toUserId,
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date(),
    responseMessage: null,
  };

  items.push(buzz);
  await writeBuzz(items);
  return buzz;
}

export async function getIncomingBuzz(toUserId: string): Promise<BuzzRequest[]> {
  const items = await readBuzz();
  return items
    .filter(b => b.toUserId === toUserId && b.status === 'pending')
    .sort((a, b) => {
      const da = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
      const db = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
      return db.getTime() - da.getTime();
    });
}

export async function getOutgoingBuzz(fromUserId: string): Promise<BuzzRequest[]> {
  const items = await readBuzz();
  return items
    .filter(b => b.fromUserId === fromUserId)
    .sort((a, b) => {
      const da = a.updatedAt instanceof Date ? a.updatedAt : new Date(a.updatedAt);
      const db = b.updatedAt instanceof Date ? b.updatedAt : new Date(b.updatedAt);
      return db.getTime() - da.getTime();
    });
}

export async function respondToBuzz(
  buzzId: string,
  toUserId: string,
  status: Exclude<BuzzStatus, 'pending'>,
  responseMessage?: string
): Promise<BuzzRequest | null> {
  const items = await readBuzz();
  const idx = items.findIndex(b => b.id === buzzId && b.toUserId === toUserId);
  if (idx === -1) return null;

  items[idx] = {
    ...items[idx],
    status,
    responseMessage: responseMessage ?? null,
    updatedAt: new Date(),
  };

  await writeBuzz(items);
  return items[idx];
}







