import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

export type StolenReport = {
  id: string;
  username: string;
  userId: string | null;
  details: string;
  contact: string;
  createdAt: string;
  status: 'pending' | 'reviewed';
};

export type RecoverySelfie = {
  id: string;
  userId: string;
  username: string;
  image: string;
  faceMatched: boolean;
  createdAt: string;
};

const DIR = join(process.cwd(), 'server', 'data');
const STOLEN_PATH = join(DIR, 'stolen-account-reports.json');
const SELFIE_PATH = join(DIR, 'recovery-selfies.json');

async function readJson<T>(path: string): Promise<T[]> {
  try {
    const raw = await readFile(path, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeJson(path: string, data: unknown): Promise<void> {
  await mkdir(DIR, { recursive: true });
  await writeFile(path, JSON.stringify(data, null, 2));
}

export async function createStolenReport(input: Omit<StolenReport, 'id' | 'createdAt' | 'status'>): Promise<StolenReport> {
  const list = await readJson<StolenReport>(STOLEN_PATH);
  const row: StolenReport = {
    ...input,
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    status: 'pending',
  };
  list.push(row);
  await writeJson(STOLEN_PATH, list.slice(-200));
  return row;
}

export async function saveRecoverySelfie(input: Omit<RecoverySelfie, 'id' | 'createdAt'>): Promise<RecoverySelfie> {
  const list = await readJson<RecoverySelfie>(SELFIE_PATH);
  const row: RecoverySelfie = {
    ...input,
    id: uuidv4(),
    createdAt: new Date().toISOString(),
  };
  list.push(row);
  await writeJson(SELFIE_PATH, list.slice(-100));
  return row;
}
