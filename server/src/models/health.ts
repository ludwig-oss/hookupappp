import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

export type HealthTestResult = 'clear' | 'positive' | 'pending';

export interface HealthTest {
  id: string;
  condition: string; // e.g. "HIV", "Chlamydia", "Syphilis", "Hepatitis B", "Flu", etc.
  result: HealthTestResult;
  testedAt: string; // ISO date
  doctorName: string;
  doctorClinic: string;
  verificationInfo: string; // How to verify the doctor/tests are legit (e.g. clinic registration, medical board)
  approvedByDoctor: boolean;
}

export interface HealthResults {
  userId: string;
  tests: HealthTest[];
  lastUpdated: string; // ISO date
}

export interface HealthViewRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  respondedAt?: string | null;
}

const HEALTH_RESULTS_PATH = join(process.cwd(), 'server', 'data', 'health-results.json');
const HEALTH_REQUESTS_PATH = join(process.cwd(), 'server', 'data', 'health-view-requests.json');

async function readHealthResults(): Promise<HealthResults[]> {
  try {
    const data = await readFile(HEALTH_RESULTS_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function writeHealthResults(arr: HealthResults[]): Promise<void> {
  const dir = join(process.cwd(), 'server', 'data');
  await import('fs/promises').then((fs) => fs.mkdir(dir, { recursive: true }));
  await writeFile(HEALTH_RESULTS_PATH, JSON.stringify(arr, null, 2), 'utf-8');
}

async function readViewRequests(): Promise<HealthViewRequest[]> {
  try {
    const data = await readFile(HEALTH_REQUESTS_PATH, 'utf-8');
    const list = JSON.parse(data);
    return (list || []).map((r: HealthViewRequest) => ({
      ...r,
      requestedAt: r.requestedAt,
      respondedAt: r.respondedAt || null,
    }));
  } catch {
    return [];
  }
}

async function writeViewRequests(arr: HealthViewRequest[]): Promise<void> {
  const dir = join(process.cwd(), 'server', 'data');
  await import('fs/promises').then((fs) => fs.mkdir(dir, { recursive: true }));
  await writeFile(HEALTH_REQUESTS_PATH, JSON.stringify(arr, null, 2), 'utf-8');
}

export async function getHealthResults(userId: string): Promise<HealthResults | null> {
  const arr = await readHealthResults();
  return arr.find((r) => r.userId === userId) || null;
}

export async function upsertHealthResults(userId: string, tests: HealthTest[]): Promise<HealthResults> {
  const arr = await readHealthResults();
  const existing = arr.findIndex((r) => r.userId === userId);
  const now = new Date().toISOString();
  const record: HealthResults = {
    userId,
    tests,
    lastUpdated: now,
  };
  if (existing >= 0) {
    arr[existing] = record;
  } else {
    arr.push(record);
  }
  await writeHealthResults(arr);
  return record;
}

export async function addOrUpdateTest(userId: string, test: Partial<HealthTest> & Pick<HealthTest, 'condition' | 'result' | 'testedAt' | 'doctorName' | 'doctorClinic' | 'verificationInfo' | 'approvedByDoctor'>): Promise<HealthResults> {
  const current = await getHealthResults(userId);
  const tests = current?.tests || [];
  const id = test.id || Date.now().toString();
  const existingIdx = tests.findIndex((t) => t.id === id);
  const newTest: HealthTest = {
    id,
    condition: test.condition,
    result: test.result,
    testedAt: test.testedAt,
    doctorName: test.doctorName,
    doctorClinic: test.doctorClinic,
    verificationInfo: test.verificationInfo,
    approvedByDoctor: test.approvedByDoctor,
  };
  if (existingIdx >= 0) {
    tests[existingIdx] = newTest;
  } else {
    tests.push(newTest);
  }
  return upsertHealthResults(userId, tests);
}

export async function removeTest(userId: string, testId: string): Promise<HealthResults | null> {
  const current = await getHealthResults(userId);
  if (!current) return null;
  const tests = current.tests.filter((t) => t.id !== testId);
  if (tests.length === 0) {
    const arr = await readHealthResults();
    const filtered = arr.filter((r) => r.userId !== userId);
    await writeHealthResults(filtered);
    return null;
  }
  return upsertHealthResults(userId, tests);
}

export async function createViewRequest(fromUserId: string, toUserId: string): Promise<HealthViewRequest> {
  const requests = await readViewRequests();
  const existing = requests.find(
    (r) => r.fromUserId === fromUserId && r.toUserId === toUserId && r.status === 'pending'
  );
  if (existing) return existing;
  const req: HealthViewRequest = {
    id: Date.now().toString(),
    fromUserId,
    toUserId,
    status: 'pending',
    requestedAt: new Date().toISOString(),
    respondedAt: null,
  };
  requests.push(req);
  await writeViewRequests(requests);
  return req;
}

export async function getViewRequest(fromUserId: string, toUserId: string): Promise<HealthViewRequest | null> {
  const requests = await readViewRequests();
  return requests.find((r) => r.fromUserId === fromUserId && r.toUserId === toUserId) || null;
}

export async function getViewRequestsForUser(userId: string): Promise<{
  incoming: HealthViewRequest[];
  outgoing: HealthViewRequest[];
}> {
  const requests = await readViewRequests();
  return {
    incoming: requests.filter((r) => r.toUserId === userId),
    outgoing: requests.filter((r) => r.fromUserId === userId),
  };
}

export async function respondToViewRequest(
  requestId: string,
  toUserId: string,
  approve: boolean
): Promise<HealthViewRequest | null> {
  const requests = await readViewRequests();
  const idx = requests.findIndex((r) => r.id === requestId && r.toUserId === toUserId && r.status === 'pending');
  if (idx === -1) return null;
  requests[idx].status = approve ? 'approved' : 'rejected';
  requests[idx].respondedAt = new Date().toISOString();
  await writeViewRequests(requests);
  return requests[idx];
}

export async function canViewHealth(viewerUserId: string, targetUserId: string): Promise<boolean> {
  if (viewerUserId === targetUserId) return true;
  const requests = await readViewRequests();
  const req = requests.find(
    (r) => r.fromUserId === viewerUserId && r.toUserId === targetUserId && r.status === 'approved'
  );
  return !!req;
}
