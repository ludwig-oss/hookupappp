import { createHash } from 'crypto';
import type { HealthTest } from '../models/health.js';

export const HEALTH_LEGAL_TEXT =
  'I certify this is an authentic lab report from a licensed doctor or hospital in my area, with a visible clinic/hospital stamp. Forging or uploading fake results may result in a €4,000 fine, civil liability if a partner is harmed, and permanent account removal. I agree to update my STI proofs at least monthly.';

/** Core STI panels — upload one stamped report per condition. */
export const REQUIRED_STI_CONDITIONS = [
  'HIV',
  'Chlamydia',
  'Gonorrhea',
  'Syphilis',
  'Hepatitis B',
  'Hepatitis C',
  'Herpes (HSV)',
  'HPV',
  'Trichomoniasis',
] as const;

export const DAY_MS = 24 * 60 * 60 * 1000;
export const MAX_TEST_AGE_DAYS = 60;
export const REFRESH_INTERVAL_DAYS = 30;
export const WARN_DAYS_BEFORE = 7;

export function hashDocument(data: string): string {
  return createHash('sha256').update(data.slice(0, 120_000)).update(String(data.length)).digest('hex');
}

export type HealthComplianceStatus = {
  exempt: boolean;
  complete: boolean;
  limited: boolean;
  expiringSoon: boolean;
  missingConditions: string[];
  staleConditions: string[];
  expiringConditions: string[];
  lastUpdated: string | null;
  warningMessage: string | null;
  byCondition: Record<string, { test: HealthTest; daysSinceTest: number; status: 'ok' | 'expiring' | 'stale' | 'missing' }>;
};

function latestValidTests(tests: HealthTest[]): Map<string, HealthTest> {
  const now = Date.now();
  const map = new Map<string, HealthTest>();
  for (const t of tests) {
    if (!t.documentUrl || !t.signedAt) continue;
    const ageDays = (now - new Date(t.testedAt).getTime()) / DAY_MS;
    if (ageDays > MAX_TEST_AGE_DAYS) continue;
    const prev = map.get(t.condition);
    if (!prev || new Date(t.testedAt) > new Date(prev.testedAt)) {
      map.set(t.condition, t);
    }
  }
  return map;
}

export function computeHealthCompliance(tests: HealthTest[], inRelationship: boolean): HealthComplianceStatus {
  const byCondition: HealthComplianceStatus['byCondition'] = {};
  const now = Date.now();

  if (inRelationship) {
    return {
      exempt: true,
      complete: true,
      limited: false,
      expiringSoon: false,
      missingConditions: [],
      staleConditions: [],
      expiringConditions: [],
      lastUpdated: tests.length ? tests.map((t) => t.testedAt).sort().reverse()[0] : null,
      warningMessage: null,
      byCondition: {},
    };
  }

  const latest = latestValidTests(tests);
  const missingConditions: string[] = [];
  const staleConditions: string[] = [];
  const expiringConditions: string[] = [];

  for (const condition of REQUIRED_STI_CONDITIONS) {
    const test = latest.get(condition);
    if (!test) {
      missingConditions.push(condition);
      byCondition[condition] = { test: {} as HealthTest, daysSinceTest: 999, status: 'missing' };
      continue;
    }
    const daysSinceTest = (now - new Date(test.testedAt).getTime()) / DAY_MS;
    if (daysSinceTest > REFRESH_INTERVAL_DAYS) {
      staleConditions.push(condition);
      byCondition[condition] = { test, daysSinceTest, status: 'stale' };
    } else if (daysSinceTest >= REFRESH_INTERVAL_DAYS - WARN_DAYS_BEFORE) {
      expiringConditions.push(condition);
      byCondition[condition] = { test, daysSinceTest, status: 'expiring' };
    } else {
      byCondition[condition] = { test, daysSinceTest, status: 'ok' };
    }
  }

  const lastUpdated =
    tests.length > 0
      ? tests
          .map((t) => t.testedAt)
          .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
      : null;

  const limited = missingConditions.length > 0 || staleConditions.length > 0;
  const expiringSoon = expiringConditions.length > 0;
  let warningMessage: string | null = null;
  if (limited) {
    warningMessage =
      'Your STI proofs are missing or older than 30 days. Matches and some features are limited until you upload fresh stamped lab reports (within the last 2 months).';
  } else if (expiringSoon) {
    warningMessage = `Update your stamped lab reports within ${WARN_DAYS_BEFORE} days — for your safety and your matches.`;
  }

  return {
    exempt: false,
    complete: missingConditions.length === 0 && staleConditions.length === 0,
    limited,
    expiringSoon,
    missingConditions,
    staleConditions,
    expiringConditions,
    lastUpdated,
    warningMessage,
    byCondition,
  };
}

export function assessDocumentAuthenticity(
  documentData: string,
  userId: string,
  allResults: { userId: string; tests: HealthTest[] }[]
): { ok: true } | { ok: false; reason: string; suspend?: boolean } {
  if (!documentData || typeof documentData !== 'string') {
    return { ok: false, reason: 'Upload a photo of your stamped lab report.' };
  }
  if (documentData.length < 25_000) {
    return {
      ok: false,
      reason: 'Photo too small or unclear — upload a sharp photo of the full report with the hospital/clinic stamp visible.',
    };
  }

  const hash = hashDocument(documentData);
  for (const record of allResults) {
    for (const t of record.tests) {
      if (t.documentHash === hash && record.userId !== userId) {
        return {
          ok: false,
          reason: 'This document matches another account — suspected forgery. Account suspended pending review.',
          suspend: true,
        };
      }
    }
  }

  // Heuristic: identical document reused across many conditions at once is suspicious
  const sameUserHashes = allResults
    .find((r) => r.userId === userId)
    ?.tests.filter((t) => t.documentHash === hash).length;
  if (sameUserHashes && sameUserHashes > 4) {
    return { ok: false, reason: 'Use separate stamped reports per condition when possible.' };
  }

  return { ok: true };
}
