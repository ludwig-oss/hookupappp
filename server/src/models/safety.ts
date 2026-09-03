import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

export interface EmergencyContact {
  id: string;
  userId: string;
  name: string;
  phone: string;
  email?: string;
  relationship?: string;
  /** PIN hash for emergency contact to unlock date voice recordings */
  recordingPinHash?: string | null;
  createdAt: Date | string;
}

export interface DateShare {
  id: string;
  userId: string;
  dateUserId: string; // The person they're going on a date with
  location: string;
  date: string; // Date/time of the date
  notes?: string;
  sharedAt: Date | string;
  sharedWith: string[]; // Emergency contact IDs
}

export interface MeetupPlan {
  id: string;
  userId: string;
  meetAt: string; // ISO date/time
  location: string;
  expectedBackAt: string; // ISO date/time - when to remind user to check in
  emergencyContactUserId?: string | null; // App user as emergency contact
  emergencyContactId?: string | null; // From safety EmergencyContact (name+phone)
  chatPartnerUserId?: string | null;
  notifiedAt?: string | null; // When we showed the check-in reminder
  emergencyContactVideoNotifiedAt?: string | null;
  idVerificationConsent?: boolean;
  /** @deprecated legacy inline storage — use vault refs */
  idFrontImage?: string | null;
  /** @deprecated legacy inline storage */
  idBackImage?: string | null;
  /** @deprecated legacy inline storage */
  safetyCheckVideo?: string | null;
  idFrontVaultRef?: string | null;
  idBackVaultRef?: string | null;
  safetyVideoVaultRef?: string | null;
  safetyCheckStatus?: 'none' | 'pending_review' | 'approved' | 'rejected';
  safetyCheckSubmittedAt?: string | null;
  safetyReviewedAt?: string | null;
  safetyReviewedBy?: string | null;
  agreedVenueName?: string | null;
  /** ID scan for legal/real verification before meetup */
  idVerificationStatus?: 'none' | 'pending_review' | 'verified' | 'rejected';
  idVerifiedAt?: string | null;
  idVerificationCountry?: string | null;
  /** When ID images were deleted after they confirmed they arrived home safe. */
  idPurgedAt?: string | null;
  /** Live date safety session */
  dateSessionStatus?: 'scheduled' | 'active' | 'completed' | 'missing';
  trackingStartedAt?: string | null;
  trackingEndedAt?: string | null;
  trackingConsent?: boolean;
  locationTrail?: Array<{
    id: string;
    lat: number;
    lon: number;
    recordedAt: string;
    dwellMinutes?: number;
    isIndoor?: boolean;
    accuracy?: number;
    label?: string;
  }>;
  safetyCheckIns?: Array<{
    id: string;
    dueAt: string;
    respondedAt?: string | null;
    isSafe?: boolean | null;
    datePartnerOk?: boolean | null;
  }>;
  nextSafetyCheckInAt?: string | null;
  checkInIntervalHours?: number;
  okForRestOfDate?: boolean;
  ok360VaultRef?: string | null;
  dangerAlertAt?: string | null;
  dangerTriggeredVia?: 'button' | 'safe_word' | null;
  missingReportedAt?: string | null;
  emergencyContactNotifiedAt?: string | null;
  /** Live date voice recording (Twitch-style VOD) */
  voiceRecordingSessionId?: string | null;
  voiceRecordingEnabled?: boolean;
  emergencyRecordingPinHash?: string | null;
  createdAt: Date | string;
}

export interface TextingCoach {
  id: string;
  userId: string;
  name: string;
  username: string;
  profilePicture: string | null;
  rating: number;
  totalHelps: number;
  specialties: string[];
  isActive: boolean;
  hourlyRate: number;
  bio?: string;
  reviews: Array<{
    userId: string;
    userName: string;
    rating: number;
    comment: string;
    createdAt: Date | string;
  }>;
}

export interface CoachingSession {
  id: string;
  userId: string; // Person getting help
  coachId: string;
  conversationId: string; // The chat conversation they need help with
  status: 'active' | 'completed' | 'cancelled';
  startedAt: Date | string;
  endedAt?: Date | string;
  amount?: number;
  paymentStatus?: 'pending' | 'paid' | 'refunded';
}

const EMERGENCY_CONTACTS_PATH = join(process.cwd(), 'server', 'data', 'emergency-contacts.json');
const MEETUP_PLANS_PATH = join(process.cwd(), 'server', 'data', 'meetup-plans.json');
const DATE_SHARES_PATH = join(process.cwd(), 'server', 'data', 'date-shares.json');
const TEXTING_COACHES_PATH = join(process.cwd(), 'server', 'data', 'texting-coaches.json');
const COACHING_SESSIONS_PATH = join(process.cwd(), 'server', 'data', 'coaching-sessions.json');

// Emergency Contacts
export async function getEmergencyContacts(userId: string): Promise<EmergencyContact[]> {
  try {
    const data = await readFile(EMERGENCY_CONTACTS_PATH, 'utf-8');
    const contacts = JSON.parse(data);
    return contacts.filter((c: EmergencyContact) => c.userId === userId);
  } catch {
    return [];
  }
}

export async function addEmergencyContact(contact: Omit<EmergencyContact, 'id' | 'createdAt'>): Promise<EmergencyContact> {
  try {
    const data = await readFile(EMERGENCY_CONTACTS_PATH, 'utf-8');
    const contacts = JSON.parse(data);
    const newContact: EmergencyContact = {
      ...contact,
      id: Date.now().toString(),
      createdAt: new Date(),
    };
    contacts.push(newContact);
    await writeFile(EMERGENCY_CONTACTS_PATH, JSON.stringify(contacts, null, 2));
    return newContact;
  } catch {
    const newContact: EmergencyContact = {
      ...contact,
      id: Date.now().toString(),
      createdAt: new Date(),
    };
    const dir = join(process.cwd(), 'server', 'data');
    await import('fs/promises').then(fs => fs.mkdir(dir, { recursive: true }));
    await writeFile(EMERGENCY_CONTACTS_PATH, JSON.stringify([newContact], null, 2));
    return newContact;
  }
}

export async function deleteEmergencyContact(userId: string, contactId: string): Promise<boolean> {
  try {
    const data = await readFile(EMERGENCY_CONTACTS_PATH, 'utf-8');
    const contacts: EmergencyContact[] = JSON.parse(data);
    const filtered = contacts.filter(c => !(c.userId === userId && c.id === contactId));
    await writeFile(EMERGENCY_CONTACTS_PATH, JSON.stringify(filtered, null, 2));
    return true;
  } catch {
    return false;
  }
}

export async function getEmergencyContactById(contactId: string): Promise<EmergencyContact | null> {
  try {
    const data = await readFile(EMERGENCY_CONTACTS_PATH, 'utf-8');
    const contacts: EmergencyContact[] = JSON.parse(data);
    return contacts.find(c => c.id === contactId) || null;
  } catch {
    return null;
  }
}

// Meetup Plans (safety check-in)
async function readMeetupPlans(): Promise<MeetupPlan[]> {
  try {
    const data = await readFile(MEETUP_PLANS_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export async function readMeetupPlansFromDisk(): Promise<MeetupPlan[]> {
  return readMeetupPlans();
}

export function sanitizeMeetupPlanForClient(plan: MeetupPlan): Omit<
  MeetupPlan,
  'idFrontImage' | 'idBackImage' | 'safetyCheckVideo' | 'idFrontVaultRef' | 'idBackVaultRef' | 'safetyVideoVaultRef'
> & {
  hasIdOnFile: boolean;
  hasSafetyVideo: boolean;
} {
  const {
    idFrontImage,
    idBackImage,
    safetyCheckVideo,
    idFrontVaultRef,
    idBackVaultRef,
    safetyVideoVaultRef,
    ...rest
  } = plan;
  return {
    ...rest,
    hasIdOnFile: Boolean(idFrontVaultRef || idBackVaultRef || idFrontImage),
    hasSafetyVideo: Boolean(safetyVideoVaultRef || safetyCheckVideo),
  };
}

export async function updateMeetupPlanFields(
  planId: string,
  fields: Partial<MeetupPlan>
): Promise<boolean> {
  const plans = await readMeetupPlans();
  const i = plans.findIndex((p) => p.id === planId);
  if (i === -1) return false;
  plans[i] = { ...plans[i], ...fields };
  await writeMeetupPlans(plans);
  return true;
}

async function writeMeetupPlans(plans: MeetupPlan[]): Promise<void> {
  const dir = join(process.cwd(), 'server', 'data');
  await import('fs/promises').then(fs => fs.mkdir(dir, { recursive: true }));
  await writeFile(MEETUP_PLANS_PATH, JSON.stringify(plans, null, 2));
}

export async function createMeetupPlan(
  plan: Omit<MeetupPlan, 'id' | 'createdAt'> & { id?: string }
): Promise<MeetupPlan> {
  const plans = await readMeetupPlans();
  const newPlan: MeetupPlan = {
    ...plan,
    id: plan.id || Date.now().toString(),
    createdAt: new Date(),
  };
  plans.push(newPlan);
  await writeMeetupPlans(plans);
  return sanitizeMeetupPlanForClient(newPlan) as MeetupPlan;
}

export async function getMeetupPlansForUser(userId: string): Promise<MeetupPlan[]> {
  const plans = await readMeetupPlans();
  return plans.filter(p => p.userId === userId);
}

export async function setMeetupPlanNotified(planId: string, userId: string): Promise<boolean> {
  const plans = await readMeetupPlans();
  const i = plans.findIndex(p => p.id === planId && p.userId === userId);
  if (i === -1) return false;
  plans[i].notifiedAt = new Date().toISOString();
  await writeMeetupPlans(plans);
  return true;
}

export async function setMeetupPlanEmergencyVideoNotified(planId: string, userId: string): Promise<boolean> {
  const plans = await readMeetupPlans();
  const i = plans.findIndex((p) => p.id === planId && p.userId === userId);
  if (i === -1) return false;
  plans[i].emergencyContactVideoNotifiedAt = new Date().toISOString();
  await writeMeetupPlans(plans);
  return true;
}

export async function getMeetupPlanById(planId: string, userId: string): Promise<MeetupPlan | null> {
  const plans = await readMeetupPlans();
  return plans.find((p) => p.id === planId && p.userId === userId) ?? null;
}

export async function submitMeetupSafetyCheck(
  planId: string,
  userId: string,
  safetyVideoVaultRef: string
): Promise<MeetupPlan | null> {
  const plans = await readMeetupPlans();
  const i = plans.findIndex((p) => p.id === planId && p.userId === userId);
  if (i === -1) return null;
  plans[i].safetyVideoVaultRef = safetyVideoVaultRef;
  plans[i].safetyCheckVideo = null;
  plans[i].safetyCheckStatus = 'pending_review';
  plans[i].safetyCheckSubmittedAt = new Date().toISOString();
  await writeMeetupPlans(plans);
  return sanitizeMeetupPlanForClient(plans[i]) as MeetupPlan;
}

export async function getDueMeetupPlansForEmergencyVideo(): Promise<MeetupPlan[]> {
  const plans = await readMeetupPlans();
  const now = Date.now();
  return plans.filter((p) => {
    if (!p.expectedBackAt || p.emergencyContactVideoNotifiedAt) return false;
    const due = new Date(p.expectedBackAt).getTime();
    return due <= now && (!p.safetyCheckStatus || p.safetyCheckStatus === 'none');
  });
}

// Date Shares
export async function shareDateInfo(share: Omit<DateShare, 'id' | 'sharedAt'>): Promise<DateShare> {
  try {
    const data = await readFile(DATE_SHARES_PATH, 'utf-8');
    const shares = JSON.parse(data);
    const newShare: DateShare = {
      ...share,
      id: Date.now().toString(),
      sharedAt: new Date(),
    };
    shares.push(newShare);
    await writeFile(DATE_SHARES_PATH, JSON.stringify(shares, null, 2));
    return newShare;
  } catch {
    const newShare: DateShare = {
      ...share,
      id: Date.now().toString(),
      sharedAt: new Date(),
    };
    await writeFile(DATE_SHARES_PATH, JSON.stringify([newShare], null, 2));
    return newShare;
  }
}

// Texting Coaches
export async function getTextingCoaches(): Promise<TextingCoach[]> {
  try {
    const data = await readFile(TEXTING_COACHES_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    const dir = join(process.cwd(), 'server', 'data');
    await import('fs/promises').then(fs => fs.mkdir(dir, { recursive: true }));
    await writeFile(TEXTING_COACHES_PATH, JSON.stringify([], null, 2));
    return [];
  }
}

export async function getTextingCoachById(coachId: string): Promise<TextingCoach | null> {
  const coaches = await getTextingCoaches();
  return coaches.find(c => c.id === coachId) || null;
}

export async function createTextingCoach(coach: Omit<TextingCoach, 'id' | 'reviews'>): Promise<TextingCoach> {
  const coaches = await getTextingCoaches();
  // Check if coach already exists
  const existing = coaches.find(c => c.userId === coach.userId);
  if (existing) {
    return existing;
  }
  const newCoach: TextingCoach = {
    ...coach,
    id: Date.now().toString(),
    reviews: [],
  };
  coaches.push(newCoach);
  const dir = join(process.cwd(), 'server', 'data');
  await import('fs/promises').then(fs => fs.mkdir(dir, { recursive: true }));
  await writeFile(TEXTING_COACHES_PATH, JSON.stringify(coaches, null, 2));
  return newCoach;
}

export async function addCoachReview(coachId: string, review: Omit<TextingCoach['reviews'][0], 'createdAt'>): Promise<boolean> {
  const coaches = await getTextingCoaches();
  const coachIndex = coaches.findIndex(c => c.id === coachId);
  if (coachIndex === -1) return false;
  
  coaches[coachIndex].reviews.push({
    ...review,
    createdAt: new Date(),
  });
  
  // Update rating
  const reviews = coaches[coachIndex].reviews;
  coaches[coachIndex].rating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  coaches[coachIndex].totalHelps = reviews.length;
  
  await writeFile(TEXTING_COACHES_PATH, JSON.stringify(coaches, null, 2));
  return true;
}

// Coaching Sessions
export async function createCoachingSession(session: Omit<CoachingSession, 'id' | 'startedAt' | 'status'>): Promise<CoachingSession> {
  try {
    const data = await readFile(COACHING_SESSIONS_PATH, 'utf-8');
    const sessions = JSON.parse(data);
    const newSession: CoachingSession = {
      ...session,
      id: Date.now().toString(),
      startedAt: new Date(),
      status: 'active',
    };
    sessions.push(newSession);
    await writeFile(COACHING_SESSIONS_PATH, JSON.stringify(sessions, null, 2));
    return newSession;
  } catch {
    const newSession: CoachingSession = {
      ...session,
      id: Date.now().toString(),
      startedAt: new Date(),
      status: 'active',
    };
    await writeFile(COACHING_SESSIONS_PATH, JSON.stringify([newSession], null, 2));
    return newSession;
  }
}

export async function getActiveCoachingSession(userId: string): Promise<CoachingSession | null> {
  try {
    const data = await readFile(COACHING_SESSIONS_PATH, 'utf-8');
    const sessions: CoachingSession[] = JSON.parse(data);
    return sessions.find(s => s.userId === userId && s.status === 'active') || null;
  } catch {
    return null;
  }
}

export async function completeCoachingSession(sessionId: string, amount: number): Promise<boolean> {
  try {
    const data = await readFile(COACHING_SESSIONS_PATH, 'utf-8');
    const sessions: CoachingSession[] = JSON.parse(data);
    const sessionIndex = sessions.findIndex(s => s.id === sessionId);
    if (sessionIndex === -1) return false;
    
    sessions[sessionIndex].status = 'completed';
    sessions[sessionIndex].endedAt = new Date();
    sessions[sessionIndex].amount = amount;
    sessions[sessionIndex].paymentStatus = 'pending';
    
    await writeFile(COACHING_SESSIONS_PATH, JSON.stringify(sessions, null, 2));
    return true;
  } catch {
    return false;
  }
}

