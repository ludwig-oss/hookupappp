import { readFile, writeFile, mkdir, access } from 'fs/promises';
import { dirname, join } from 'path';

type SavedMap = Record<string, string[]>;

const CANDIDATES = [
  join(process.cwd(), 'data', 'saved-posts.json'),
  join(process.cwd(), 'server', 'data', 'saved-posts.json'),
];

async function resolvePath(): Promise<string> {
  for (const p of CANDIDATES) {
    try {
      await access(p);
      return p;
    } catch {
      /* next */
    }
  }
  const cwd = process.cwd().replace(/\\/g, '/');
  return cwd.endsWith('/server') ? CANDIDATES[0] : CANDIDATES[1];
}

async function readAll(): Promise<SavedMap> {
  try {
    const raw = await readFile(await resolvePath(), 'utf-8');
    const data = JSON.parse(raw);
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

async function writeAll(map: SavedMap): Promise<void> {
  const path = await resolvePath();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(map, null, 2));
}

export async function getSavedPostIds(userId: string): Promise<string[]> {
  const map = await readAll();
  return Array.isArray(map[userId]) ? map[userId] : [];
}

export async function savePostForUser(userId: string, postId: string): Promise<string[]> {
  const map = await readAll();
  const list = Array.isArray(map[userId]) ? map[userId] : [];
  if (!list.includes(postId)) list.unshift(postId);
  map[userId] = list.slice(0, 200);
  await writeAll(map);
  return map[userId];
}

export async function unsavePostForUser(userId: string, postId: string): Promise<string[]> {
  const map = await readAll();
  const list = (Array.isArray(map[userId]) ? map[userId] : []).filter((id) => id !== postId);
  map[userId] = list;
  await writeAll(map);
  return list;
}

export async function isPostSaved(userId: string, postId: string): Promise<boolean> {
  const list = await getSavedPostIds(userId);
  return list.includes(postId);
}
