import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { getAllUsers } from './user.js';

export interface Interest {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Date | string;
  respondedAt?: Date | string | null;
}

export interface PreCommunicationProfile {
  id: string;
  interestId: string;
  userId: string;
  whatLookingFor: string;
  howWillMeet: string;
  canAffordTravelProof: string;
  willingToMoveWhere: string;
  whereWork: string;
  whereLive: string;
  whereChill: string;
  name: string;
  familyFriends: string;
  createdAt: Date | string;
}

const INTERESTS_PATH = join(process.cwd(), 'server', 'data', 'activity-interests.json');
const PRECOMM_PATH = join(process.cwd(), 'server', 'data', 'activity-precomm.json');

async function readInterests(): Promise<Interest[]> {
  try {
    const data = await readFile(INTERESTS_PATH, 'utf-8');
    const list = JSON.parse(data);
    return list.map((i: Interest) => ({
      ...i,
      createdAt: new Date(i.createdAt),
      respondedAt: i.respondedAt ? new Date(i.respondedAt as string) : null,
    }));
  } catch {
    return [];
  }
}

async function writeInterests(interests: Interest[]): Promise<void> {
  const dir = join(process.cwd(), 'server', 'data');
  await import('fs/promises').then(fs => fs.mkdir(dir, { recursive: true }));
  await writeFile(INTERESTS_PATH, JSON.stringify(interests, null, 2));
}

async function readPreComm(): Promise<PreCommunicationProfile[]> {
  try {
    const data = await readFile(PRECOMM_PATH, 'utf-8');
    const list = JSON.parse(data);
    return list.map((p: PreCommunicationProfile) => ({
      ...p,
      createdAt: new Date(p.createdAt),
    }));
  } catch {
    return [];
  }
}

async function writePreComm(profiles: PreCommunicationProfile[]): Promise<void> {
  const dir = join(process.cwd(), 'server', 'data');
  await import('fs/promises').then(fs => fs.mkdir(dir, { recursive: true }));
  await writeFile(PRECOMM_PATH, JSON.stringify(profiles, null, 2));
}

export async function getActiveUsersByRegion(country: string, city?: string) {
  const users = await getAllUsers();
  const norm = (s: string) => (s || '').toLowerCase().trim();
  const c = norm(country);
  return users.filter(u => {
    if (!u.country) return false;
    if (norm(u.country) !== c) return false;
    if (city !== undefined && city !== null && city !== '') {
      if (!u.city) return false;
      return norm(u.city) === norm(city);
    }
    return true;
  });
}

export async function sendInterest(fromUserId: string, toUserId: string): Promise<Interest> {
  const interests = await readInterests();
  const existing = interests.find(
    i => (i.fromUserId === fromUserId && i.toUserId === toUserId) || (i.fromUserId === toUserId && i.toUserId === fromUserId)
  );
  if (existing) throw new Error('Interest already exists');
  const interest: Interest = {
    id: Date.now().toString(),
    fromUserId,
    toUserId,
    status: 'pending',
    createdAt: new Date(),
    respondedAt: null,
  };
  interests.push(interest);
  await writeInterests(interests);
  return interest;
}

export async function acceptInterest(interestId: string, toUserId: string): Promise<void> {
  const interests = await readInterests();
  const interest = interests.find(i => i.id === interestId && i.toUserId === toUserId);
  if (!interest) throw new Error('Interest not found');
  if (interest.status !== 'pending') throw new Error('Already responded');
  interest.status = 'accepted';
  interest.respondedAt = new Date();
  await writeInterests(interests);
}

export async function rejectInterest(interestId: string, toUserId: string): Promise<void> {
  const interests = await readInterests();
  const interest = interests.find(i => i.id === interestId && i.toUserId === toUserId);
  if (!interest) throw new Error('Interest not found');
  if (interest.status !== 'pending') throw new Error('Already responded');
  interest.status = 'rejected';
  interest.respondedAt = new Date();
  await writeInterests(interests);
}

export async function getInterestsForUser(userId: string): Promise<{ sent: Interest[]; received: Interest[] }> {
  const interests = await readInterests();
  const sent = interests.filter(i => i.fromUserId === userId);
  const received = interests.filter(i => i.toUserId === userId);
  return { sent, received };
}

export async function getInterestById(interestId: string): Promise<Interest | null> {
  const interests = await readInterests();
  return interests.find(i => i.id === interestId) || null;
}

export async function savePreCommProfile(
  userId: string,
  interestId: string,
  data: Omit<PreCommunicationProfile, 'id' | 'interestId' | 'userId' | 'createdAt'>
): Promise<PreCommunicationProfile> {
  const interest = await getInterestById(interestId);
  if (!interest) throw new Error('Interest not found');
  if (interest.status !== 'accepted') throw new Error('Interest must be accepted first');
  if (interest.fromUserId !== userId && interest.toUserId !== userId) throw new Error('Not your interest');
  const profiles = await readPreComm();
  const existing = profiles.find(p => p.interestId === interestId && p.userId === userId);
  const profile: PreCommunicationProfile = {
    id: existing?.id || Date.now().toString(),
    interestId,
    userId,
    whatLookingFor: data.whatLookingFor || '',
    howWillMeet: data.howWillMeet || '',
    canAffordTravelProof: data.canAffordTravelProof || '',
    willingToMoveWhere: data.willingToMoveWhere || '',
    whereWork: data.whereWork || '',
    whereLive: data.whereLive || '',
    whereChill: data.whereChill || '',
    name: data.name || '',
    familyFriends: data.familyFriends || '',
    createdAt: existing?.createdAt || new Date(),
  };
  if (existing) {
    const idx = profiles.findIndex(p => p.id === existing.id);
    if (idx !== -1) profiles[idx] = profile;
  } else {
    profiles.push(profile);
  }
  await writePreComm(profiles);
  return profile;
}

export async function getPreCommProfilesForInterest(interestId: string): Promise<PreCommunicationProfile[]> {
  const profiles = await readPreComm();
  return profiles.filter(p => p.interestId === interestId);
}

export async function canChatAfterPreComm(interestId: string): Promise<boolean> {
  const interest = await getInterestById(interestId);
  if (!interest || interest.status !== 'accepted') return false;
  const profiles = await readPreComm();
  const forInterest = profiles.filter(p => p.interestId === interestId);
  return forInterest.length >= 2;
}
