import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

/** 128-d face descriptor from client face recognition model. */
export type FaceDescriptor = number[];

export interface StoredFaceProfile {
  id: string;
  userId: string;
  descriptor: FaceDescriptor;
  createdAt: string;
}

const FACES_PATH = join(process.cwd(), 'server', 'data', 'face-profiles.json');

/** Same person — looser match for login. */
export const FACE_MATCH_THRESHOLD = 0.55;

/** Block signup if another account is this similar (look-alike / duplicate). */
export const FACE_LOOKALIKE_THRESHOLD = 0.42;

/** Minimum gap between best and second-best match when identifying without username. */
export const FACE_IDENTIFY_GAP = 0.08;

async function readFaces(): Promise<StoredFaceProfile[]> {
  try {
    const raw = await readFile(FACES_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as StoredFaceProfile[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeFaces(list: StoredFaceProfile[]): Promise<void> {
  const dir = join(process.cwd(), 'server', 'data');
  await mkdir(dir, { recursive: true });
  await writeFile(FACES_PATH, JSON.stringify(list, null, 2));
}

export function euclideanDistance(a: FaceDescriptor, b: FaceDescriptor): number {
  if (a.length !== b.length || a.length === 0) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

export function isValidDescriptor(d: unknown): d is FaceDescriptor {
  return (
    Array.isArray(d) &&
    d.length === 128 &&
    d.every((n) => typeof n === 'number' && Number.isFinite(n))
  );
}

export async function saveFaceProfile(userId: string, descriptor: FaceDescriptor): Promise<StoredFaceProfile> {
  const list = await readFaces();
  const filtered = list.filter((f) => f.userId !== userId);
  const entry: StoredFaceProfile = {
    id: uuidv4(),
    userId,
    descriptor,
    createdAt: new Date().toISOString(),
  };
  filtered.push(entry);
  await writeFaces(filtered);
  return entry;
}

export async function getFaceProfileByUserId(userId: string): Promise<StoredFaceProfile | null> {
  const list = await readFaces();
  return list.find((f) => f.userId === userId) || null;
}

export async function findLookalikeConflict(descriptor: FaceDescriptor, excludeUserId?: string): Promise<StoredFaceProfile | null> {
  const list = await readFaces();
  let closest: StoredFaceProfile | null = null;
  let closestDist = Infinity;
  for (const profile of list) {
    if (excludeUserId && profile.userId === excludeUserId) continue;
    const dist = euclideanDistance(descriptor, profile.descriptor);
    if (dist < closestDist) {
      closestDist = dist;
      closest = profile;
    }
  }
  if (closest && closestDist < FACE_LOOKALIKE_THRESHOLD) return closest;
  return null;
}

export async function identifyByFace(descriptor: FaceDescriptor): Promise<{ userId: string; distance: number } | null> {
  const list = await readFaces();
  if (!list.length) return null;

  const ranked = list
    .map((p) => ({ userId: p.userId, distance: euclideanDistance(descriptor, p.descriptor) }))
    .sort((a, b) => a.distance - b.distance);

  const best = ranked[0];
  if (!best || best.distance > FACE_MATCH_THRESHOLD) return null;

  const second = ranked[1];
  if (second && second.distance - best.distance < FACE_IDENTIFY_GAP) {
    return null;
  }

  return best;
}

export async function verifyFaceForUser(userId: string, descriptor: FaceDescriptor): Promise<boolean> {
  const profile = await getFaceProfileByUserId(userId);
  if (!profile) return false;
  return euclideanDistance(descriptor, profile.descriptor) <= FACE_MATCH_THRESHOLD;
}
