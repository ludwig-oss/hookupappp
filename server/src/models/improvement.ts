import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

export interface ImprovementCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
}

/** Dating and relationship improvement topics only. No general skills (e.g. technology, career, fitness). */
export const IMPROVEMENT_CATEGORIES: ImprovementCategory[] = [
  { id: 'style-fashion', name: 'Style & Fashion', description: 'Build your personal style, grooming, and wardrobe confidence', icon: '👔' },
  { id: 'communication', name: 'Communication in Relationships', description: 'Express yourself clearly and listen better with your partner', icon: '💬' },
  { id: 'texting', name: 'Texting & DMs', description: 'Master texting, when to reply, and keeping the spark over messages', icon: '📱' },
  { id: 'bedroom', name: 'Bedroom & Intimacy', description: 'Improve intimacy, connection, and address bedroom concerns', icon: '💕' },
  { id: 'keeping-partner', name: 'Keeping a Girlfriend or Boyfriend', description: 'Build a lasting relationship and avoid common breakup pitfalls', icon: '💑' },
  { id: 'relationship-problems', name: 'Relationship Problems', description: 'Work through trust, jealousy, distance, or recurring arguments', icon: '🔄' },
  { id: 'conflict-couples', name: 'Fighting & Conflict in Relationships', description: 'Handle disagreements without damaging the relationship', icon: '🤝' },
  { id: 'trust', name: 'Trust & Honesty', description: 'Build trust, be transparent, and repair it when it\'s broken', icon: '🔐' },
  { id: 'jealousy', name: 'Managing Jealousy', description: 'Deal with jealousy and insecurity in a healthy way', icon: '😤' },
  { id: 'first-date', name: 'First Dates', description: 'Plan first dates, make a great impression, and reduce nerves', icon: '🎯' },
  { id: 'asking-out', name: 'Asking Someone Out', description: 'Get the confidence and approach to ask someone out', icon: '🌹' },
  { id: 'flirting', name: 'Flirting & Attraction', description: 'Show interest, read signals, and flirt without being awkward', icon: '😉' },
  { id: 'conversation-dating', name: 'Conversation on Dates', description: 'Keep dates fun with good conversation and no awkward silences', icon: '🗣️' },
  { id: 'body-language-dating', name: 'Body Language & Signals', description: 'Read and send the right non-verbal cues when dating', icon: '👀' },
  { id: 'rejection', name: 'Handling Rejection', description: 'Bounce back from rejection and keep your confidence', icon: '💪' },
  { id: 'confidence-dating', name: 'Dating Confidence', description: 'Feel confident approaching people and going on dates', icon: '✨' },
  { id: 'emotional-intimacy', name: 'Emotional Intimacy', description: 'Open up, be vulnerable, and connect on a deeper level', icon: '🧠' },
  { id: 'long-distance', name: 'Long-Distance Relationships', description: 'Keep the connection strong when you\'re apart', icon: '✈️' },
  { id: 'boundaries', name: 'Setting Boundaries', description: 'Know your limits and communicate them in relationships', icon: '🚧' },
  { id: 'expectations', name: 'Expectations & Compatibility', description: 'Align expectations and know when you\'re compatible', icon: '⚖️' },
  { id: 'getting-back', name: 'Getting Back Together', description: 'Navigate getting back with an ex or fixing a broken relationship', icon: '🔄' },
  { id: 'moving-on', name: 'Moving On & Letting Go', description: 'Heal after a breakup and get ready to date again', icon: '🌅' },
  { id: 'exclusivity', name: 'Exclusivity & Defining the Relationship', description: 'Have the "what are we?" talk and define the relationship', icon: '💍' },
  { id: 'meeting-family', name: 'Meeting Family & Friends', description: 'Make a good impression when meeting their circle', icon: '👨‍👩‍👧‍👦' },
  { id: 'quality-time', name: 'Quality Time & Dates', description: 'Plan meaningful dates and spend quality time together', icon: '📅' },
  { id: 'apologies', name: 'Apologizing & Making Up', description: 'Say sorry the right way and repair after a fight', icon: '🙏' },
  { id: 'support-partner', name: 'Supporting Your Partner', description: 'Be there for your partner through tough times', icon: '🤗' },
  { id: 'keeping-spark', name: 'Keeping the Spark Alive', description: 'Avoid the relationship going stale and keep romance alive', icon: '🔥' },
  { id: 'dating-apps', name: 'Dating Apps & Profiles', description: 'Create a great profile and chat effectively on apps', icon: '📲' },
  { id: 'red-flags', name: 'Spotting Red Flags', description: 'Recognize unhealthy patterns and when to walk away', icon: '🚩' },
  { id: 'self-worth', name: 'Self-Worth in Dating', description: 'Value yourself and avoid settling or people-pleasing', icon: '💎' },
];

export const SESSION_PRICE_EUR = 50;

/** Per-category: why you're good + proof (Instagram, photos, or video). */
export type CategoryProofType = 'instagram' | 'pictures' | 'video';

export interface CategoryProof {
  /** Why you're good in this area */
  whyGood: string;
  /** @deprecated use whyGood */
  description?: string;
  proofType?: CategoryProofType;
  instagramHandle?: string;
  imageUrls?: string[];
  videoUrl?: string;
}

export interface GuideApplication {
  id: string;
  userId: string;
  categories: string[];
  region: string;
  experience: string;
  qualifications: string;
  identificationUrl: string; // URL to uploaded ID or main proof document
  /** Proof per category: e.g. appearance = photos, communications = credentials + proof it's you */
  proofPerCategory?: Record<string, CategoryProof>;
  status: 'pending' | 'approved' | 'rejected';
  appliedAt: Date | string;
  reviewedAt: Date | string | null;
  reviewedBy: string | null;
}

export interface Guide {
  id: string;
  userId: string;
  categories: string[];
  region: string;
  experience: string;
  qualifications: string;
  hourlyRate: number;
  sessionPriceEur: number;
  paypalInfo?: string | null; // Trainer's PayPal email or PayPal.me link for users to send €50
  rating: number;
  totalSessions: number;
  isActive: boolean;
  badge: boolean;
}

export interface AvailabilitySlot {
  id: string;
  guideId: string;
  startTime: Date | string;
  endTime: Date | string;
  isBooked: boolean;
}

export interface Booking {
  id: string;
  userId: string;
  guideId: string;
  category: string;
  startTime: Date | string;
  endTime: Date | string;
  duration: number; // in minutes
  amount: number;
  paymentStatus: 'pending' | 'completed' | 'failed' | 'refunded';
  paymentIntentId: string | null;
  paypalOrderId?: string | null;
  requestId?: string | null;
  status: 'scheduled' | 'completed' | 'cancelled';
  createdAt: Date | string;
  // Course completion tracking
  completedAt?: Date | string | null;
  guideRating?: 'success' | 'partial' | null; // Guide rates user: success = 2%, partial = 1%
  improvementPercentage?: number; // Percentage gained from this course
}

export interface GuideRequest {
  id: string;
  userId: string;
  guideId: string;
  category: string;
  status: 'pending' | 'accepted' | 'rejected';
  message?: string;
  createdAt: Date | string;
  respondedAt?: Date | string | null;
  /** After accept: user sends €50 via PayPal (trainer's info) and submits proof. Trainer confirms within 48h. */
  paymentStatus?: 'pending' | 'sent_pending_confirmation' | 'confirmed';
  paymentProofText?: string | null;
  paymentProofImageUrl?: string | null;
  paymentSentAt?: Date | string | null;
}

const APPLICATIONS_PATH = join(process.cwd(), 'server', 'data', 'guide-applications.json');
const GUIDES_PATH = join(process.cwd(), 'server', 'data', 'guides.json');
const AVAILABILITY_PATH = join(process.cwd(), 'server', 'data', 'availability.json');
const BOOKINGS_PATH = join(process.cwd(), 'server', 'data', 'bookings.json');
const REQUESTS_PATH = join(process.cwd(), 'server', 'data', 'guide-requests.json');

async function readApplications(): Promise<GuideApplication[]> {
  try {
    const data = await readFile(APPLICATIONS_PATH, 'utf-8');
    const apps = JSON.parse(data);
    return apps.map((app: GuideApplication) => ({
      ...app,
      appliedAt: app.appliedAt ? new Date(app.appliedAt) : new Date(),
      reviewedAt: app.reviewedAt ? new Date(app.reviewedAt) : null,
    }));
  } catch {
    return [];
  }
}

async function writeApplications(apps: GuideApplication[]): Promise<void> {
  const dir = join(process.cwd(), 'server', 'data');
  await import('fs/promises').then(fs => fs.mkdir(dir, { recursive: true }));
  await writeFile(APPLICATIONS_PATH, JSON.stringify(apps, null, 2));
}

function normalizeGuide(g: any): Guide {
  return {
    ...g,
    region: g.region || 'Global',
    sessionPriceEur: g.sessionPriceEur ?? SESSION_PRICE_EUR,
    paypalInfo: g.paypalInfo ?? null,
  };
}

async function readGuides(): Promise<Guide[]> {
  try {
    const data = await readFile(GUIDES_PATH, 'utf-8');
    const list = JSON.parse(data);
    return Array.isArray(list) ? list.map(normalizeGuide) : [];
  } catch {
    return [];
  }
}

async function writeGuides(guides: Guide[]): Promise<void> {
  const dir = join(process.cwd(), 'server', 'data');
  await import('fs/promises').then(fs => fs.mkdir(dir, { recursive: true }));
  await writeFile(GUIDES_PATH, JSON.stringify(guides, null, 2));
}

async function readAvailability(): Promise<AvailabilitySlot[]> {
  try {
    const data = await readFile(AVAILABILITY_PATH, 'utf-8');
    return JSON.parse(data).map((slot: AvailabilitySlot) => ({
      ...slot,
      startTime: new Date(slot.startTime),
      endTime: new Date(slot.endTime),
    }));
  } catch {
    return [];
  }
}

async function writeAvailability(slots: AvailabilitySlot[]): Promise<void> {
  const dir = join(process.cwd(), 'server', 'data');
  await import('fs/promises').then(fs => fs.mkdir(dir, { recursive: true }));
  await writeFile(AVAILABILITY_PATH, JSON.stringify(slots, null, 2));
}

async function readBookings(): Promise<Booking[]> {
  try {
    const data = await readFile(BOOKINGS_PATH, 'utf-8');
    return JSON.parse(data).map((booking: Booking) => ({
      ...booking,
      startTime: new Date(booking.startTime),
      endTime: new Date(booking.endTime),
      createdAt: new Date(booking.createdAt),
    }));
  } catch {
    return [];
  }
}

async function writeBookings(bookings: Booking[]): Promise<void> {
  const dir = join(process.cwd(), 'server', 'data');
  await import('fs/promises').then(fs => fs.mkdir(dir, { recursive: true }));
  await writeFile(BOOKINGS_PATH, JSON.stringify(bookings, null, 2));
}

export async function createApplication(appData: Omit<GuideApplication, 'id' | 'status' | 'appliedAt' | 'reviewedAt' | 'reviewedBy'>): Promise<GuideApplication> {
  const apps = await readApplications();
  const application: GuideApplication = {
    ...appData,
    region: (appData as any).region || 'Global',
    id: Date.now().toString(),
    status: 'pending',
    appliedAt: new Date(),
    reviewedAt: null,
    reviewedBy: null,
  };
  apps.push(application);
  await writeApplications(apps);
  return application;
}

export async function getApplicationByUserId(userId: string): Promise<GuideApplication | null> {
  const apps = await readApplications();
  return apps.find(a => a.userId === userId) || null;
}

export async function getApplicationById(id: string): Promise<GuideApplication | null> {
  const apps = await readApplications();
  return apps.find(a => a.id === id) || null;
}

export async function getAllApplications(): Promise<GuideApplication[]> {
  return readApplications();
}

export async function approveApplication(
  applicationId: string,
  reviewerId: string,
  coachStarRating = 4.5
): Promise<Guide> {
  const apps = await readApplications();
  const app = apps.find(a => a.id === applicationId);
  if (!app) throw new Error('Application not found');

  app.status = 'approved';
  app.reviewedAt = new Date();
  app.reviewedBy = reviewerId;
  await writeApplications(apps);

  const guides = await readGuides();
  const guide: Guide = {
    id: Date.now().toString(),
    userId: app.userId,
    categories: app.categories,
    region: app.region || 'Global',
    experience: app.experience,
    qualifications: app.qualifications,
    hourlyRate: 50,
    sessionPriceEur: SESSION_PRICE_EUR,
    rating: coachStarRating,
    totalSessions: 0,
    isActive: true,
    badge: true,
  };
  guides.push(guide);
  await writeGuides(guides);

  const { updateUserProfile } = await import('./user.js');
  await updateUserProfile(app.userId, {
    qualifiedCoach: true,
    coachStarRating,
  });

  return guide;
}

export async function rejectApplication(applicationId: string, reviewerId: string): Promise<void> {
  const apps = await readApplications();
  const app = apps.find(a => a.id === applicationId);
  if (!app) throw new Error('Application not found');

  app.status = 'rejected';
  app.reviewedAt = new Date();
  app.reviewedBy = reviewerId;
  await writeApplications(apps);
}

export async function getGuideByUserId(userId: string): Promise<Guide | null> {
  const guides = await readGuides();
  const found = guides.find(g => g.userId === userId);
  return found ? normalizeGuide(found) : null;
}

export async function getGuideById(guideId: string): Promise<Guide | null> {
  const guides = await readGuides();
  const found = guides.find(g => g.id === guideId);
  return found ? normalizeGuide(found) : null;
}

export async function getGuidesByCategory(category: string): Promise<Guide[]> {
  const guides = await readGuides();
  return guides.filter(g => g.categories.includes(category) && g.isActive);
}

/** Case-insensitive region match; empty guide region or Global counts as worldwide. */
export function matchesRegionFilter(guideRegion: string | undefined | null, filter: string | undefined | null): boolean {
  const f = (filter || '').trim().toLowerCase();
  if (!f) return true;
  const g = (guideRegion || '').trim().toLowerCase();
  if (!g || g === 'global') return true;
  return g === f || g.includes(f) || f.includes(g);
}

/** Match guide region to viewer country/city (free-text regions). */
export function matchesGeoFilter(
  guideRegion: string | undefined | null,
  country?: string | null,
  city?: string | null
): boolean {
  const g = (guideRegion || '').trim().toLowerCase();
  if (!g || g === 'global') return true;
  const c = (country || '').trim().toLowerCase();
  const ct = (city || '').trim().toLowerCase();
  if (ct && (g.includes(ct) || ct.includes(g))) return true;
  if (c && (g.includes(c) || c.includes(g))) return true;
  return matchesRegionFilter(guideRegion, country || city || undefined);
}

/** Approved coaches only, filtered by geography, sorted by star rating. */
export async function getQualifiedCoachesLocal(
  country?: string,
  city?: string,
  categoryIds?: string[]
): Promise<Guide[]> {
  const { getUserById } = await import('./user.js');
  const guides = await readGuides();
  const filtered: Guide[] = [];

  for (const g of guides) {
    if (!g.isActive) continue;
    const u = await getUserById(g.userId);
    if (!u?.qualifiedCoach) continue;
    if (categoryIds?.length && !g.categories.some((c) => categoryIds.includes(c))) continue;
    if (!matchesGeoFilter(g.region, country, city)) continue;
    const star = typeof u.coachStarRating === 'number' ? u.coachStarRating : g.rating;
    filtered.push(normalizeGuide({ ...g, rating: star }));
  }

  return filtered.sort((a, b) => b.rating - a.rating);
}

export async function enrichGuideWithUser(guide: Guide) {
  const { getUserById } = await import('./user.js');
  const u = await getUserById(guide.userId);
  if (!u?.qualifiedCoach) return null;
  const star = typeof u.coachStarRating === 'number' ? u.coachStarRating : guide.rating;
  return {
    ...normalizeGuide({ ...guide, rating: star }),
    qualifiedCoach: true,
    coachStarRating: star,
    user: u
      ? {
          id: u.id,
          name: u.name,
          username: u.username,
          profilePicture: u.profilePicture ?? null,
          country: u.country,
          city: u.city,
        }
      : null,
  };
}

export async function getGuidesByCategoryAndRegion(category: string, region?: string): Promise<Guide[]> {
  const guides = await readGuides();
  return guides
    .filter(g => g.categories.includes(category) && g.isActive && matchesRegionFilter(g.region, region))
    .sort((a, b) => b.rating - a.rating);
}

export async function getGuidesRecommended(categoryIds: string[], region?: string): Promise<Guide[]> {
  if (!categoryIds || categoryIds.length === 0) return getAllGuides();
  const guides = await readGuides();
  const set = new Set(categoryIds);
  return guides
    .filter(g => g.isActive && g.categories.some(c => set.has(c)) && matchesRegionFilter(g.region, region))
    .sort((a, b) => b.rating - a.rating);
}

export async function getGuidesByProblemSearch(query: string): Promise<Guide[]> {
  const q = (query || '').toLowerCase().trim();
  if (!q) return [];
  const categories = IMPROVEMENT_CATEGORIES.filter(
    c => c.id.toLowerCase().includes(q) || c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)
  );
  const categoryIds = categories.map(c => c.id);
  if (categoryIds.length === 0) return [];
  return getGuidesRecommended(categoryIds);
}

export async function getAllGuides(): Promise<Guide[]> {
  const guides = await readGuides();
  return guides.filter(g => g.isActive).sort((a, b) => b.rating - a.rating);
}

export async function addAvailability(guideId: string, startTime: Date, endTime: Date): Promise<AvailabilitySlot> {
  const slots = await readAvailability();
  const slot: AvailabilitySlot = {
    id: Date.now().toString(),
    guideId,
    startTime,
    endTime,
    isBooked: false,
  };
  slots.push(slot);
  await writeAvailability(slots);
  return slot;
}

export async function getAvailability(guideId: string): Promise<AvailabilitySlot[]> {
  const slots = await readAvailability();
  return slots.filter(s => s.guideId === guideId && !s.isBooked);
}

export async function createBooking(bookingData: Omit<Booking, 'id' | 'createdAt' | 'paymentStatus' | 'paymentIntentId' | 'status'> & { paypalOrderId?: string | null; requestId?: string | null }): Promise<Booking> {
  const bookings = await readBookings();
  const isPrePaid = !!(bookingData as any).paypalOrderId || !!(bookingData as any).requestId; // requestId = trainer confirmed payment
  const booking: Booking = {
    ...bookingData,
    id: Date.now().toString(),
    createdAt: new Date(),
    paymentStatus: isPrePaid ? 'completed' : 'pending',
    paymentIntentId: null,
    paypalOrderId: (bookingData as any).paypalOrderId || null,
    requestId: (bookingData as any).requestId || null,
    status: 'scheduled',
  };
  bookings.push(booking);
  await writeBookings(bookings);

  // Mark availability slot as booked
  const slots = await readAvailability();
  const slot = slots.find(s => 
    s.guideId === booking.guideId &&
    new Date(s.startTime).getTime() === new Date(booking.startTime).getTime()
  );
  if (slot) {
    slot.isBooked = true;
    await writeAvailability(slots);
  }

  return booking;
}

export async function getBookingsByUserId(userId: string): Promise<Booking[]> {
  const bookings = await readBookings();
  return bookings.filter(b => b.userId === userId);
}

export async function getBookingsByGuideId(guideId: string): Promise<Booking[]> {
  const bookings = await readBookings();
  return bookings.filter(b => b.guideId === guideId);
}

export async function updateBookingPayment(bookingId: string, paymentIntentId: string): Promise<void> {
  const bookings = await readBookings();
  const booking = bookings.find(b => b.id === bookingId);
  if (booking) {
    booking.paymentStatus = 'completed';
    booking.paymentIntentId = paymentIntentId;
    await writeBookings(bookings);
  }
}

// Guide Request functions
async function readRequests(): Promise<GuideRequest[]> {
  try {
    const data = await readFile(REQUESTS_PATH, 'utf-8');
    return JSON.parse(data).map((req: GuideRequest) => ({
      ...req,
      createdAt: new Date(req.createdAt),
      respondedAt: req.respondedAt ? new Date(req.respondedAt) : null,
    }));
  } catch {
    return [];
  }
}

async function writeRequests(requests: GuideRequest[]): Promise<void> {
  const dir = join(process.cwd(), 'server', 'data');
  await import('fs/promises').then(fs => fs.mkdir(dir, { recursive: true }));
  await writeFile(REQUESTS_PATH, JSON.stringify(requests, null, 2));
}

export async function createGuideRequest(requestData: Omit<GuideRequest, 'id' | 'status' | 'createdAt' | 'respondedAt' | 'paymentStatus' | 'paymentProofText' | 'paymentProofImageUrl' | 'paymentSentAt'>): Promise<GuideRequest> {
  const requests = await readRequests();
  const request: GuideRequest = {
    ...requestData,
    id: Date.now().toString(),
    status: 'pending',
    createdAt: new Date(),
    respondedAt: null,
    paymentStatus: 'pending',
    paymentProofText: null,
    paymentProofImageUrl: null,
    paymentSentAt: null,
  };
  requests.push(request);
  await writeRequests(requests);
  return request;
}

export async function getRequestById(requestId: string): Promise<GuideRequest | null> {
  const requests = await readRequests();
  const r = requests.find(r => r.id === requestId);
  if (!r) return null;
  return {
    ...r,
    paymentSentAt: r.paymentSentAt ? new Date(r.paymentSentAt as any) : null,
  };
}

export async function submitPaymentProof(requestId: string, proofText: string, proofImageUrl?: string | null): Promise<void> {
  const requests = await readRequests();
  const request = requests.find(r => r.id === requestId);
  if (!request) throw new Error('Request not found');
  if (request.status !== 'accepted') throw new Error('Request must be accepted first');
  if (request.paymentStatus === 'confirmed') throw new Error('Payment already confirmed');
  request.paymentStatus = 'sent_pending_confirmation';
  request.paymentProofText = proofText;
  request.paymentProofImageUrl = proofImageUrl || null;
  request.paymentSentAt = new Date();
  await writeRequests(requests);
}

export async function confirmPaymentReceived(requestId: string, guideUserId: string): Promise<void> {
  const requests = await readRequests();
  const request = requests.find(r => r.id === requestId);
  if (!request) throw new Error('Request not found');
  const guide = await getGuideById(request.guideId);
  if (!guide || guide.userId !== guideUserId) throw new Error('Not authorized to confirm');
  if (request.paymentStatus !== 'sent_pending_confirmation') throw new Error('No payment proof to confirm');
  request.paymentStatus = 'confirmed';
  await writeRequests(requests);
}

/** Mark a guide request as paid (e.g. after PayPal order capture). */
export async function updateRequestPayment(requestId: string, _orderId: string): Promise<void> {
  const requests = await readRequests();
  const request = requests.find(r => r.id === requestId);
  if (!request) throw new Error('Request not found');
  if (request.paymentStatus === 'confirmed') return; // Already paid
  request.paymentStatus = 'confirmed';
  await writeRequests(requests);
}

export async function updateGuidePaypalInfo(guideUserId: string, paypalInfo: string): Promise<void> {
  const guides = await readGuides();
  const guide = guides.find(g => g.userId === guideUserId);
  if (!guide) throw new Error('Guide not found');
  guide.paypalInfo = paypalInfo || null;
  await writeGuides(guides);
}

export async function getRequestsByUserId(userId: string): Promise<GuideRequest[]> {
  const requests = await readRequests();
  return requests.filter(r => r.userId === userId);
}

export async function getRequestsByGuideId(guideId: string): Promise<GuideRequest[]> {
  const requests = await readRequests();
  return requests.filter(r => r.guideId === guideId);
}

export async function acceptGuideRequest(requestId: string): Promise<void> {
  const requests = await readRequests();
  const request = requests.find(r => r.id === requestId);
  if (request) {
    request.status = 'accepted';
    request.respondedAt = new Date();
    await writeRequests(requests);
  }
}

export async function rejectGuideRequest(requestId: string): Promise<void> {
  const requests = await readRequests();
  const request = requests.find(r => r.id === requestId);
  if (request) {
    request.status = 'rejected';
    request.respondedAt = new Date();
    await writeRequests(requests);
  }
}

// Course completion and rating
export async function completeCourse(bookingId: string, guideRating: 'success' | 'partial'): Promise<Booking> {
  const bookings = await readBookings();
  const booking = bookings.find(b => b.id === bookingId);
  if (!booking) {
    throw new Error('Booking not found');
  }

  booking.status = 'completed';
  booking.completedAt = new Date();
  booking.guideRating = guideRating;
  booking.improvementPercentage = guideRating === 'success' ? 2 : 1;

  await writeBookings(bookings);
  return booking;
}

export async function getUserImprovementPercentage(userId: string): Promise<number> {
  const bookings = await readBookings();
  const completedBookings = bookings.filter(
    b => b.userId === userId && 
    b.status === 'completed' && 
    b.improvementPercentage !== undefined
  );
  
  const totalPercentage = completedBookings.reduce((sum, b) => sum + (b.improvementPercentage || 0), 0);
  return Math.min(100, totalPercentage); // Cap at 100%
}

export async function getCompletedCoursesByUser(userId: string): Promise<Booking[]> {
  const bookings = await readBookings();
  return bookings.filter(
    b => b.userId === userId && 
    b.status === 'completed' && 
    b.guideRating !== null
  );
}





