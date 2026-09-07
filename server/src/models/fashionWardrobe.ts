import { mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';

export interface WardrobeItem {
  id: string;
  userId: string;
  group: string;
  lookId: string;
  title: string;
  imageUrl: string;
  pieces: string[];
  event: string;
  savedAt: string;
  winner?: boolean;
}

interface WardrobeFile {
  items: WardrobeItem[];
}

const DB_PATH = join(process.cwd(), 'server', 'data', 'fashionWardrobes.json');

async function readAll(): Promise<WardrobeFile> {
  try {
    const raw = await readFile(DB_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as WardrobeFile;
    if (!Array.isArray(parsed.items)) return { items: [] };
    return parsed;
  } catch {
    return { items: [] };
  }
}

async function writeAll(data: WardrobeFile): Promise<void> {
  await mkdir(join(process.cwd(), 'server', 'data'), { recursive: true });
  await writeFile(DB_PATH, JSON.stringify(data, null, 2));
}

export async function listWardrobe(userId: string): Promise<WardrobeItem[]> {
  const db = await readAll();
  return db.items.filter((i) => i.userId === userId);
}

export async function saveWardrobeItem(item: Omit<WardrobeItem, 'id' | 'savedAt'>): Promise<WardrobeItem> {
  const db = await readAll();
  const row: WardrobeItem = {
    ...item,
    id: `fw-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    savedAt: new Date().toISOString(),
  };
  db.items.push(row);
  await writeAll(db);
  return row;
}

export async function deleteWardrobeItem(userId: string, id: string): Promise<boolean> {
  const db = await readAll();
  const next = db.items.filter((i) => !(i.id === id && i.userId === userId));
  if (next.length === db.items.length) return false;
  db.items = next;
  await writeAll(db);
  return true;
}
