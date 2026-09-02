import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export type ChatIntent = 'serious' | 'casual' | 'friends';

const PATH = join(process.cwd(), 'server', 'data', 'chat-intents.json');

type Store = Record<string, Record<string, ChatIntent>>;

async function readStore(): Promise<Store> {
  try {
    return JSON.parse(await readFile(PATH, 'utf-8'));
  } catch {
    return {};
  }
}

async function writeStore(store: Store): Promise<void> {
  await mkdir(join(process.cwd(), 'server', 'data'), { recursive: true });
  await writeFile(PATH, JSON.stringify(store, null, 2));
}

export async function getChatIntents(userId: string): Promise<Record<string, ChatIntent>> {
  const store = await readStore();
  return store[userId] || {};
}

export async function setChatIntent(
  userId: string,
  otherUserId: string,
  intent: ChatIntent | null
): Promise<Record<string, ChatIntent>> {
  const store = await readStore();
  const mine = { ...(store[userId] || {}) };
  if (!intent) delete mine[otherUserId];
  else mine[otherUserId] = intent;
  store[userId] = mine;
  await writeStore(store);
  return mine;
}

export function isChatIntent(v: unknown): v is ChatIntent {
  return v === 'serious' || v === 'casual' || v === 'friends';
}
