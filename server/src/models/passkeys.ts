import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export interface StoredPasskey {
  id: string;
  userId: string;
  credentialId: string;
  publicKey: string;
  counter: number;
  transports?: string[];
  createdAt: string;
}

const PASSKEYS_PATH = join(process.cwd(), 'server', 'data', 'passkeys.json');

async function readPasskeys(): Promise<StoredPasskey[]> {
  try {
    const data = await readFile(PASSKEYS_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function writePasskeys(list: StoredPasskey[]): Promise<void> {
  const dir = join(process.cwd(), 'server', 'data');
  await mkdir(dir, { recursive: true });
  await writeFile(PASSKEYS_PATH, JSON.stringify(list, null, 2));
}

export async function getPasskeysByUserId(userId: string): Promise<StoredPasskey[]> {
  const list = await readPasskeys();
  return list.filter((p) => p.userId === userId);
}

export async function getPasskeyByCredentialId(credentialId: string): Promise<StoredPasskey | null> {
  const list = await readPasskeys();
  return list.find((p) => p.credentialId === credentialId) || null;
}

export async function savePasskey(data: Omit<StoredPasskey, 'id' | 'createdAt'>): Promise<StoredPasskey> {
  const list = await readPasskeys();
  const entry: StoredPasskey = {
    ...data,
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
  };
  list.push(entry);
  await writePasskeys(list);
  return entry;
}

export async function updatePasskeyCounter(credentialId: string, counter: number): Promise<void> {
  const list = await readPasskeys();
  const pk = list.find((p) => p.credentialId === credentialId);
  if (pk) {
    pk.counter = counter;
    await writePasskeys(list);
  }
}

export async function deletePasskeysForUser(userId: string): Promise<void> {
  const list = await readPasskeys();
  await writePasskeys(list.filter((p) => p.userId !== userId));
}
