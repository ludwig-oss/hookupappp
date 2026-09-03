import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import type { MeetupPlan } from './safety.js';
import { readMeetupPlansFromDisk, updateMeetupPlanFields } from './safety.js';

export interface LocationTrailPoint {
  id: string;
  lat: number;
  lon: number;
  recordedAt: string;
  dwellMinutes?: number;
  isIndoor?: boolean;
  accuracy?: number;
  label?: string;
}

export interface DateSafetyCheckIn {
  id: string;
  dueAt: string;
  respondedAt?: string | null;
  isSafe?: boolean | null;
  datePartnerOk?: boolean | null;
}

const CHECK_IN_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 hours
const DWELL_RADIUS_M = 45;
const MIN_DWELL_MINUTES = 3;

function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function verifyMeetupIdDocument(planId: string, userId: string, country?: string | null): Promise<MeetupPlan | null> {
  const plans = await readMeetupPlansFromDisk();
  const plan = plans.find((p) => p.id === planId && p.userId === userId);
  if (!plan) return null;
  if (!plan.idFrontVaultRef && !plan.idFrontImage) return null;

  const { getUserById } = await import('./user.js');
  const user = await getUserById(userId);
  const age = typeof user?.age === 'number' ? user.age : 0;
  const legal = age >= 18;

  await updateMeetupPlanFields(planId, {
    idVerificationStatus: legal ? 'verified' : 'rejected',
    idVerifiedAt: new Date().toISOString(),
    idVerificationCountry: country || user?.country || null,
  } as Partial<MeetupPlan>);

  const updated = (await readMeetupPlansFromDisk()).find((p) => p.id === planId);
  return updated || null;
}

export async function startDateTracking(planId: string, userId: string): Promise<MeetupPlan | null> {
  const plans = await readMeetupPlansFromDisk();
  const plan = plans.find((p) => p.id === planId && p.userId === userId);
  if (!plan) return null;
  if (plan.idVerificationStatus !== 'verified') {
    throw new Error('ID must be verified before your date. Hold your ID to the camera in the meetup plan so it can be scanned.');
  }
  if (!plan.trackingConsent) {
    throw new Error('You must consent to safety tracking during the date.');
  }

  const now = new Date();
  const firstCheckIn = new Date(now.getTime() + CHECK_IN_INTERVAL_MS);
  await updateMeetupPlanFields(planId, {
    dateSessionStatus: 'active',
    trackingStartedAt: now.toISOString(),
    nextSafetyCheckInAt: firstCheckIn.toISOString(),
    checkInIntervalHours: 2,
    locationTrail: plan.locationTrail || [],
    safetyCheckIns: plan.safetyCheckIns || [],
  } as Partial<MeetupPlan>);

  return (await readMeetupPlansFromDisk()).find((p) => p.id === planId) || null;
}

export async function appendLocationPoint(
  planId: string,
  userId: string,
  point: { lat: number; lon: number; accuracy?: number; isIndoor?: boolean }
): Promise<LocationTrailPoint | null> {
  const plans = await readMeetupPlansFromDisk();
  const plan = plans.find((p) => p.id === planId && p.userId === userId);
  if (!plan || plan.dateSessionStatus !== 'active') return null;

  const trail: LocationTrailPoint[] = [...(plan.locationTrail || [])];
  const now = new Date().toISOString();
  const last = trail[trail.length - 1];

  let dwellMinutes: number | undefined;
  if (last && haversineM(last.lat, last.lon, point.lat, point.lon) < DWELL_RADIUS_M) {
    const mins = (Date.now() - new Date(last.recordedAt).getTime()) / 60000;
    if (mins >= MIN_DWELL_MINUTES) {
      dwellMinutes = Math.round(mins);
      last.dwellMinutes = dwellMinutes;
      last.isIndoor = point.isIndoor ?? last.isIndoor;
    }
    await updateMeetupPlanFields(planId, { locationTrail: trail } as Partial<MeetupPlan>);
    return last;
  }

  const entry: LocationTrailPoint = {
    id: Date.now().toString(),
    lat: point.lat,
    lon: point.lon,
    recordedAt: now,
    accuracy: point.accuracy,
    isIndoor: point.isIndoor,
    label: dwellMinutes ? `Stopped ~${dwellMinutes} min` : undefined,
  };
  trail.push(entry);
  if (trail.length > 500) trail.splice(0, trail.length - 500);
  await updateMeetupPlanFields(planId, { locationTrail: trail } as Partial<MeetupPlan>);
  return entry;
}

export async function respondSafetyCheckIn(
  planId: string,
  userId: string,
  data: { isSafe: boolean; datePartnerOk?: boolean }
): Promise<MeetupPlan | null> {
  const plans = await readMeetupPlansFromDisk();
  const plan = plans.find((p) => p.id === planId && p.userId === userId);
  if (!plan || plan.dateSessionStatus !== 'active' || plan.okForRestOfDate) return null;

  const checkIns: DateSafetyCheckIn[] = [...(plan.safetyCheckIns || [])];
  const due = plan.nextSafetyCheckInAt;
  checkIns.push({
    id: Date.now().toString(),
    dueAt: due || new Date().toISOString(),
    respondedAt: new Date().toISOString(),
    isSafe: data.isSafe,
    datePartnerOk: data.datePartnerOk ?? null,
  });

  const next = new Date(Date.now() + CHECK_IN_INTERVAL_MS);
  const fields: Partial<MeetupPlan> = {
    safetyCheckIns: checkIns,
    nextSafetyCheckInAt: data.isSafe ? next.toISOString() : null,
  };

  if (!data.isSafe) {
    fields.dangerAlertAt = new Date().toISOString();
    fields.dateSessionStatus = 'missing';
  }

  await updateMeetupPlanFields(planId, fields);
  return (await readMeetupPlansFromDisk()).find((p) => p.id === planId) || null;
}

export async function triggerDateDanger(planId: string, userId: string, via: 'button' | 'safe_word'): Promise<MeetupPlan | null> {
  const plans = await readMeetupPlansFromDisk();
  const plan = plans.find((p) => p.id === planId && p.userId === userId);
  if (!plan) return null;

  await updateMeetupPlanFields(planId, {
    dangerAlertAt: new Date().toISOString(),
    dateSessionStatus: 'missing',
    dangerTriggeredVia: via,
  } as Partial<MeetupPlan>);

  return (await readMeetupPlansFromDisk()).find((p) => p.id === planId) || null;
}

export async function submitOkForRestOfDate(
  planId: string,
  userId: string,
  ok360VaultRef: string
): Promise<MeetupPlan | null> {
  const plans = await readMeetupPlansFromDisk();
  const plan = plans.find((p) => p.id === planId && p.userId === userId);
  if (!plan) return null;

  await updateMeetupPlanFields(planId, {
    okForRestOfDate: true,
    ok360VaultRef,
    nextSafetyCheckInAt: null,
  } as Partial<MeetupPlan>);

  return (await readMeetupPlansFromDisk()).find((p) => p.id === planId) || null;
}

export async function endDateSession(planId: string, userId: string): Promise<MeetupPlan | null> {
  const plans = await readMeetupPlansFromDisk();
  const plan = plans.find((p) => p.id === planId && p.userId === userId);
  if (!plan) return null;
  const { deleteSensitive, vaultRef } = await import('../utils/sensitiveVault.js');
  await deleteSensitive(plan.idFrontVaultRef);
  await deleteSensitive(plan.idBackVaultRef);
  await deleteSensitive(vaultRef(planId, 'id_front'));
  await deleteSensitive(vaultRef(planId, 'id_back'));
  await updateMeetupPlanFields(planId, {
    dateSessionStatus: 'completed',
    trackingEndedAt: new Date().toISOString(),
    nextSafetyCheckInAt: null,
    idFrontImage: null,
    idBackImage: null,
    idFrontVaultRef: null,
    idBackVaultRef: null,
    idPurgedAt: new Date().toISOString(),
  } as Partial<MeetupPlan>);
  const next = (await readMeetupPlansFromDisk()).find((p) => p.id === planId && p.userId === userId);
  return next || null;
}

/** Emergency contact views trail only if danger/missing reported */
export async function getTrailForEmergencyContact(planId: string, contactUserId: string): Promise<{
  plan: MeetupPlan;
  trail: LocationTrailPoint[];
} | null> {
  const plans = await readMeetupPlansFromDisk();
  const plan = plans.find((p) => p.id === planId);
  if (!plan) return null;
  if (plan.emergencyContactUserId !== contactUserId && plan.emergencyContactId) {
    const { getEmergencyContactById } = await import('./safety.js');
    const c = await getEmergencyContactById(plan.emergencyContactId);
    if (!c) return null;
  } else if (plan.emergencyContactUserId !== contactUserId) {
    return null;
  }

  if (!plan.dangerAlertAt && !plan.missingReportedAt && plan.dateSessionStatus !== 'missing') {
    return null;
  }

  return { plan, trail: plan.locationTrail || [] };
}

export async function getActiveDateSessionsForUser(userId: string): Promise<MeetupPlan[]> {
  const plans = await readMeetupPlansFromDisk();
  return plans.filter(
    (p) =>
      p.userId === userId &&
      p.dateSessionStatus === 'active' &&
      !p.okForRestOfDate
  );
}

export async function getDueCheckIns(userId: string): Promise<MeetupPlan[]> {
  const now = Date.now();
  const plans = await readMeetupPlansFromDisk();
  return plans.filter((p) => {
    if (p.userId !== userId || p.dateSessionStatus !== 'active' || p.okForRestOfDate) return false;
    if (!p.nextSafetyCheckInAt) return false;
    return new Date(p.nextSafetyCheckInAt).getTime() <= now;
  });
}

export async function getDangerAlertsForEmergencyContact(contactUserId: string): Promise<MeetupPlan[]> {
  const plans = await readMeetupPlansFromDisk();
  return plans.filter(
    (p) =>
      p.emergencyContactUserId === contactUserId &&
      (p.dangerAlertAt || p.dateSessionStatus === 'missing')
  );
}

export { CHECK_IN_INTERVAL_MS };
