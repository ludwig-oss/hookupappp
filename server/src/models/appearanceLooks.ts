import { mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';

export interface AppearanceSavedLook {
  id: string;
  userId: string;
  group: string;
  lookId: string;
  title: string;
  occasion: string;
  outfitTitle: string;
  hairTitle: string;
  pieces: string[];
  imageUrl: string;
  approved: boolean;
  savedAt: string;
}

interface FileShape {
  items: AppearanceSavedLook[];
}

const DB_PATH = join(process.cwd(), 'server', 'data', 'appearanceLooks.json');

async function readAll(): Promise<FileShape> {
  try {
    const raw = await readFile(DB_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as FileShape;
    if (!Array.isArray(parsed.items)) return { items: [] };
    return parsed;
  } catch {
    return { items: [] };
  }
}

async function writeAll(data: FileShape): Promise<void> {
  await mkdir(join(process.cwd(), 'server', 'data'), { recursive: true });
  await writeFile(DB_PATH, JSON.stringify(data, null, 2));
}

export async function listAppearanceLooks(userId: string): Promise<AppearanceSavedLook[]> {
  const db = await readAll();
  return db.items.filter((i) => i.userId === userId);
}

export async function saveAppearanceLook(
  item: Omit<AppearanceSavedLook, 'id' | 'savedAt'>
): Promise<AppearanceSavedLook> {
  const db = await readAll();
  const row: AppearanceSavedLook = {
    ...item,
    id: `al-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    savedAt: new Date().toISOString(),
  };
  db.items.push(row);
  await writeAll(db);
  return row;
}

export async function deleteAppearanceLook(userId: string, id: string): Promise<boolean> {
  const db = await readAll();
  const next = db.items.filter((i) => !(i.id === id && i.userId === userId));
  if (next.length === db.items.length) return false;
  db.items = next;
  await writeAll(db);
  return true;
}
