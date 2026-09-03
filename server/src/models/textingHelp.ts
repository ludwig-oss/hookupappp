import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { getAllUsers, getUserById } from './user.js';
import { getAllGuides, matchesGeoFilter, type Guide } from './improvement.js';
import { isSseConnected } from '../realtime/notifications.js';

export const TEXTING_HELP_PRICE_EUR = 5;
const ONLINE_MS = 8 * 60 * 1000;
const PAGE_SIZE = 4;
const STORE_PATH = join(process.cwd(), 'server', 'data', 'texting-help.json');

export type TextingHelpStatus = 'pending_payment' | 'paid' | 'live' | 'ended';

export interface TextingHelpReview {
  sessionId: string;
  fromUserId: string;
  guideUserId: string;
  stars: number;
  text: string;
  createdAt: string;
}

export interface TextingHelpSession {
  id: string;
  userId: string;
  otherUserId: string;
  status: TextingHelpStatus;
  paidAt: string | null;
  paymentMethod: 'paypal' | 'stripe' | 'demo' | null;
  paypalOrderId: string | null;
  stripePaymentIntentId: string | null;
  offeredGuideUserIds: string[];
  firstAnsweredGuideUserId: string | null;
  chosenGuideUserId: string | null;
  liveRoomUrl: string | null;
  createdAt: string;
  endedAt: string | null;
}

interface Store {
  sessions: TextingHelpSession[];
  reviews: TextingHelpReview[];
}

export interface TextingHelpGuideCard {
  guideId: string;
  userId: string;
  name: string;
  profilePicture: string | null;
  region: string;
  rating: number;
  reviewCount: number;
  helpedCount: number;
  online: boolean;
  answeredSos: boolean;
}

async function readStore(): Promise<Store> {
  try {
    const raw = JSON.parse(await readFile(STORE_PATH, 'utf-8')) as Store;
    return {
      sessions: raw.sessions || [],
      reviews: raw.reviews || [],
    };
  } catch {
    return { sessions: [], reviews: [] };
  }
}

async function writeStore(store: Store): Promise<void> {
  const dir = join(process.cwd(), 'server', 'data');
  await mkdir(dir, { recursive: true });
  await writeFile(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
}

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isOnline(user: { id: string; location?: { updatedAt?: Date | string } | null }): boolean {
  if (isSseConnected(user.id)) return true;
  const t = user.location?.updatedAt;
  if (!t) return false;
  return Date.now() - new Date(t).getTime() < ONLINE_MS;
}

export async function createTextingHelpSession(userId: string, otherUserId: string): Promise<TextingHelpSession> {
  const store = await readStore();
  const existing = store.sessions.find(
    (s) => s.userId === userId && s.otherUserId === otherUserId && (s.status === 'pending_payment' || s.status === 'paid' || s.status === 'live')
  );
  if (existing) return existing;
  const session: TextingHelpSession = {
    id: newId(),
    userId,
    otherUserId,
    status: 'pending_payment',
    paidAt: null,
    paymentMethod: null,
    paypalOrderId: null,
    stripePaymentIntentId: null,
    offeredGuideUserIds: [],
    firstAnsweredGuideUserId: null,
    chosenGuideUserId: null,
    liveRoomUrl: null,
    createdAt: new Date().toISOString(),
    endedAt: null,
  };
  store.sessions.push(session);
  await writeStore(store);
  return session;
}

export async function getTextingHelpSession(sessionId: string): Promise<TextingHelpSession | null> {
  const store = await readStore();
  return store.sessions.find((s) => s.id === sessionId) || null;
}

export async function saveTextingHelpSession(session: TextingHelpSession): Promise<TextingHelpSession> {
  const store = await readStore();
  const idx = store.sessions.findIndex((s) => s.id === session.id);
  if (idx >= 0) store.sessions[idx] = session;
  else store.sessions.push(session);
  await writeStore(store);
  return session;
}

export async function markTextingHelpPaid(
  sessionId: string,
  method: TextingHelpSession['paymentMethod'],
  extras?: { paypalOrderId?: string; stripePaymentIntentId?: string }
): Promise<TextingHelpSession | null> {
  const session = await getTextingHelpSession(sessionId);
  if (!session) return null;
  if (session.status === 'pending_payment') session.status = 'paid';
  session.paidAt = session.paidAt || new Date().toISOString();
  session.paymentMethod = method;
  if (extras?.paypalOrderId) session.paypalOrderId = extras.paypalOrderId;
  if (extras?.stripePaymentIntentId) session.stripePaymentIntentId = extras.stripePaymentIntentId;
  return saveTextingHelpSession(session);
}

function avgStars(reviews: TextingHelpReview[], guideUserId: string, fallback: number): { rating: number; count: number } {
  const mine = reviews.filter((r) => r.guideUserId === guideUserId);
  if (!mine.length) return { rating: fallback, count: 0 };
  const rating = Math.round((mine.reduce((s, r) => s + r.stars, 0) / mine.length) * 10) / 10;
  return { rating, count: mine.length };
}

export async function listIncomingTextingHelpSos(guideUserId: string): Promise<Array<{
  sessionId: string;
  fromUserId: string;
  fromName: string;
  otherUserId: string;
  createdAt: string;
  firstAnswered: boolean;
}>> {
  const store = await readStore();
  const open = store.sessions.filter(
    (s) =>
      (s.status === 'paid' || s.status === 'live') &&
      !s.chosenGuideUserId &&
      s.offeredGuideUserIds.includes(guideUserId)
  );
  const out = [];
  for (const s of open) {
    const from = await getUserById(s.userId);
    out.push({
      sessionId: s.id,
      fromUserId: s.userId,
      fromName: from?.name || 'Someone',
      otherUserId: s.otherUserId,
      createdAt: s.createdAt,
      firstAnswered: Boolean(s.firstAnsweredGuideUserId),
    });
  }
  return out;
}

export async function pickTextingHelpGuides(
  session: TextingHelpSession,
  offset = 0
): Promise<{ guides: TextingHelpGuideCard[]; nextOffset: number; total: number }> {
  const user = await getUserById(session.userId);
  const country = user?.country;
  const city = user?.city;
  const [allGuides, allUsers, store] = await Promise.all([getAllGuides(), getAllUsers(), readStore()]);

  const byUser = new Map<string, Guide>();
  const textingFirst = [
    ...allGuides.filter((g) => g.isActive && g.categories.includes('texting')),
    ...allGuides.filter((g) => g.isActive && !g.categories.includes('texting')),
  ];
  for (const g of textingFirst) {
    if (!byUser.has(g.userId)) byUser.set(g.userId, g);
  }

  const userById = new Map(allUsers.map((u) => [u.id, u]));
  const ranked: Array<{ guide: Guide; online: boolean; rating: number; reviewCount: number; helped: number; geo: boolean }> = [];

  for (const guide of byUser.values()) {
    if (guide.userId === session.userId) continue;
    const u = userById.get(guide.userId);
    if (!u) continue;
    const { rating, count } = avgStars(store.reviews, guide.userId, guide.rating || 0);
    const helped = store.sessions.filter((s) => s.chosenGuideUserId === guide.userId && s.status !== 'pending_payment').length;
    ranked.push({
      guide,
      online: isOnline(u),
      rating,
      reviewCount: count,
      helped,
      geo: matchesGeoFilter(guide.region, country, city),
    });
  }

  if (ranked.length === 0) {
    for (const u of allUsers) {
      if (!u.qualifiedCoach || u.id === session.userId) continue;
      const { rating, count } = avgStars(store.reviews, u.id, u.coachStarRating || 0);
      ranked.push({
        guide: {
          id: `coach-${u.id}`,
          userId: u.id,
          categories: ['texting'],
          region: [u.city, u.country].filter(Boolean).join(', '),
          experience: '',
          qualifications: '',
          hourlyRate: 0,
          sessionPriceEur: TEXTING_HELP_PRICE_EUR,
          rating,
          totalSessions: 0,
          isActive: true,
          badge: false,
        },
        online: isOnline(u),
        rating,
        reviewCount: count,
        helped: store.sessions.filter((s) => s.chosenGuideUserId === u.id).length,
        geo: matchesGeoFilter([u.city, u.country].filter(Boolean).join(', '), country, city),
      });
    }
  }

  ranked.sort((a, b) => {
      if (a.online !== b.online) return a.online ? -1 : 1;
      if (a.geo !== b.geo) return a.geo ? -1 : 1;
      if (b.rating !== a.rating) return b.rating - a.rating;
      return b.helped - a.helped;
    });

  const page = ranked.slice(offset, offset + PAGE_SIZE);
  const cards: TextingHelpGuideCard[] = [];
  for (const row of page) {
    const u = userById.get(row.guide.userId)!;
    cards.push({
      guideId: row.guide.id,
      userId: row.guide.userId,
      name: u.name,
      profilePicture: u.profilePicture || null,
      region: row.guide.region || [u.city, u.country].filter(Boolean).join(', '),
      rating: row.rating,
      reviewCount: row.reviewCount,
      helpedCount: row.helped,
      online: row.online,
      answeredSos: session.firstAnsweredGuideUserId === row.guide.userId,
    });
  }

  session.offeredGuideUserIds = Array.from(new Set([...session.offeredGuideUserIds, ...cards.map((c) => c.userId)]));
  await saveTextingHelpSession(session);

  return {
    guides: cards,
    nextOffset: offset + PAGE_SIZE,
    total: ranked.length,
  };
}

export async function answerTextingHelpSos(sessionId: string, guideUserId: string): Promise<TextingHelpSession | null> {
  const session = await getTextingHelpSession(sessionId);
  if (!session || (session.status !== 'paid' && session.status !== 'live')) return null;
  if (!session.offeredGuideUserIds.includes(guideUserId)) return null;
  if (!session.firstAnsweredGuideUserId) session.firstAnsweredGuideUserId = guideUserId;
  return saveTextingHelpSession(session);
}

export async function chooseTextingHelpGuide(sessionId: string, userId: string, guideUserId: string): Promise<TextingHelpSession | null> {
  const session = await getTextingHelpSession(sessionId);
  if (!session || session.userId !== userId) return null;
  if (session.status !== 'paid' && session.status !== 'live') return null;
  session.chosenGuideUserId = guideUserId;
  session.status = 'live';
  session.liveRoomUrl = `https://meet.jit.si/aswp-texting-${session.id}#config.startWithVideoMuted=true`;
  return saveTextingHelpSession(session);
}

export async function addTextingHelpReview(
  sessionId: string,
  fromUserId: string,
  stars: number,
  text: string
): Promise<TextingHelpReview | null> {
  const store = await readStore();
  const session = store.sessions.find((s) => s.id === sessionId);
  if (!session || session.userId !== fromUserId || !session.chosenGuideUserId) return null;
  const existing = store.reviews.find((r) => r.sessionId === sessionId && r.fromUserId === fromUserId);
  if (existing) {
    existing.stars = Math.max(1, Math.min(5, Math.round(stars)));
    existing.text = (text || '').slice(0, 600);
    existing.createdAt = new Date().toISOString();
    await writeStore(store);
    return existing;
  }
  const review: TextingHelpReview = {
    sessionId,
    fromUserId,
    guideUserId: session.chosenGuideUserId,
    stars: Math.max(1, Math.min(5, Math.round(stars))),
    text: (text || '').slice(0, 600),
    createdAt: new Date().toISOString(),
  };
  store.reviews.push(review);
  session.status = 'ended';
  session.endedAt = new Date().toISOString();
  await writeStore(store);
  return review;
}

export async function getGuideTextingReviews(guideUserId: string): Promise<TextingHelpReview[]> {
  const store = await readStore();
  return store.reviews.filter((r) => r.guideUserId === guideUserId).slice(-20).reverse();
}
