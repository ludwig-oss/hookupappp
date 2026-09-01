import { Request, Response } from 'express';
import { sanitizeForStorage, sanitizeHttpUrl, LIMITS } from '../utils/sanitize.js';
import {
  IMPROVEMENT_CATEGORIES,
  SESSION_PRICE_EUR,
  QUALIFIED_ADMIN_SEED_LIMIT,
  GUIDE_REVIEW_SLA_HOURS,
  createApplication,
  getApplicationByUserId,
  getApplicationById,
  getAllApplications,
  resubmitRejectedApplication,
  getPendingApplications,
  approveApplication,
  rejectApplication,
  getGuideByUserId,
  getGuideById,
  getGuidesByCategory,
  getGuidesByCategoryAndRegion,
  getGuidesRecommended,
  getGuidesByProblemSearch,
  getAllGuides,
  matchesRegionFilter,
  matchesGeoFilter,
  getQualifiedCoachesLocal,
  enrichGuideWithUser,
  addAvailability,
  getAvailability,
  createBooking,
  getBookingsByUserId,
  getBookingsByGuideId,
  updateBookingPayment,
  createGuideRequest,
  getRequestById,
  getRequestsByUserId,
  getRequestsByGuideId,
  acceptGuideRequest,
  rejectGuideRequest,
  submitPaymentProof,
  confirmPaymentReceived,
  updateGuidePaypalInfo,
  completeCourse,
  getUserImprovementPercentage,
  getCompletedCoursesByUser,
  countQualifiedAdmins,
  isQualifiedAdmin,
  getQualifiedAdminUserIds,
  widgetAnswersFromProof,
} from '../models/improvement.js';
import { getUserById } from '../models/user.js';
import {
  notifyGuideApplicationReceived,
  notifyGuideApplicationDecision,
  notifyGuideApplicationPendingReview,
} from '../realtime/notifications.js';
import { sendPushToUser } from '../realtime/push.js';

export const getCategories = async (req: Request, res: Response) => {
  try {
    res.json({ categories: IMPROVEMENT_CATEGORIES });
  } catch (error: any) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const applyAsGuide = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || req.body.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { categories, region, experience, qualifications, identificationUrl, proofPerCategory } = req.body;

    if (!categories || !Array.isArray(categories) || categories.length === 0) {
      return res.status(400).json({ error: 'At least one category is required' });
    }

    if (!region || !String(region).trim()) {
      return res.status(400).json({ error: 'Region is required (e.g. Munich, Europe, Global)' });
    }

    const proofEntries =
      proofPerCategory && typeof proofPerCategory === 'object'
        ? Object.entries(
            proofPerCategory as Record<
              string,
              {
                whyGood?: string;
                description?: string;
                proofType?: string;
                instagramHandle?: string;
                imageUrls?: string[] | string;
                videoUrl?: string;
              }
            >
          )
        : [];

    if (proofEntries.length === 0) {
      return res.status(400).json({ error: 'Add why you are good and proof for each category' });
    }

    const sanitizedProof: Record<string, import('../models/improvement.js').CategoryProof> = {};
    for (const [key, val] of proofEntries) {
      const catKey = sanitizeForStorage(key, LIMITS.SHORT_LABEL);
      if (!categories.includes(catKey)) continue;
      const whyGood = sanitizeForStorage(val?.whyGood || val?.description, LIMITS.PRECOMM_FIELD);
      if (!whyGood) {
        return res.status(400).json({ error: `Explain why you are good at ${catKey}` });
      }
      const proofType = (val?.proofType || 'pictures') as 'instagram' | 'pictures' | 'video';
      const entry: import('../models/improvement.js').CategoryProof = {
        whyGood,
        description: whyGood,
        proofType,
      };
      if (proofType === 'instagram') {
        const handle = sanitizeForStorage(val?.instagramHandle, LIMITS.SHORT_LABEL);
        if (!handle) return res.status(400).json({ error: `Instagram handle required for ${catKey}` });
        entry.instagramHandle = handle.replace(/^@/, '');
      } else if (proofType === 'video') {
        const videoUrl = sanitizeHttpUrl(val?.videoUrl) || sanitizeForStorage(val?.videoUrl, LIMITS.HTTP_URL);
        if (!videoUrl) return res.status(400).json({ error: `Upload a video for ${catKey}` });
        entry.videoUrl = videoUrl;
      } else {
        const rawUrls = Array.isArray(val?.imageUrls)
          ? val.imageUrls
          : typeof val?.imageUrls === 'string'
            ? val.imageUrls.split(/[\s,]+/)
            : [];
        const urls = rawUrls
          .map((u) => sanitizeHttpUrl(String(u)) || sanitizeForStorage(String(u), LIMITS.HTTP_URL))
          .filter(Boolean) as string[];
        if (!urls.length) return res.status(400).json({ error: `Upload a photo for ${catKey}` });
        entry.imageUrls = urls;
      }
      sanitizedProof[catKey] = entry;
    }

    for (const catId of categories) {
      if (!sanitizedProof[catId]) {
        return res.status(400).json({ error: `Proof required for category ${catId}` });
      }
    }

    const summaryExperience = Object.entries(sanitizedProof)
      .map(([id, p]) => `${id}: ${p.whyGood}`)
      .join('\n');

    const widgetAnswers = widgetAnswersFromProof(sanitizedProof);

    const existing = await getApplicationByUserId(userId);
    if (existing?.status === 'pending') {
      return res.status(400).json({ error: 'You have already submitted an application. You will get an answer within 48 hours.' });
    }
    if (existing?.status === 'approved') {
      return res.status(400).json({ error: 'You are already a qualified guide' });
    }

    const qualifiedCount = await countQualifiedAdmins();
    const seedSlotsLeft = Math.max(0, QUALIFIED_ADMIN_SEED_LIMIT - qualifiedCount);
    const autoApprove = seedSlotsLeft > 0;
    const now = new Date();
    const decisionDueAt = new Date(now.getTime() + GUIDE_REVIEW_SLA_HOURS * 60 * 60 * 1000);

    const payload = {
      categories,
      region: sanitizeForStorage(region || 'Global', LIMITS.CITY),
      experience: sanitizeForStorage(experience || summaryExperience, LIMITS.EXPERIENCE),
      qualifications: sanitizeForStorage(qualifications || 'See proof per category', LIMITS.QUALIFICATIONS),
      identificationUrl: identificationUrl
        ? sanitizeHttpUrl(identificationUrl) || sanitizeForStorage(identificationUrl, LIMITS.HTTP_URL)
        : '',
      proofPerCategory: sanitizedProof,
      widgetAnswers,
    };

    const application =
      existing?.status === 'rejected'
        ? await resubmitRejectedApplication(existing, payload)
        : await createApplication({
            userId,
            ...payload,
            status: 'pending',
            decisionDueAt,
          });

    if (autoApprove) {
      const guide = await approveApplication(application.id, 'system-seed', 4.5, { autoApproved: true });
      const fresh = await getApplicationByUserId(userId);
      notifyGuideApplicationDecision(userId, { approved: true, autoApproved: true });
      sendPushToUser(userId, {
        title: 'You are a qualified guide',
        body: 'You can start guiding others now. Open Compatibility to use your expert dashboard.',
        data: { url: '/home' },
      }).catch(() => {});
      return res.json({
        message:
          'You are a qualified guide admin. You can start guiding others now from Compatibility.',
        application: fresh || { ...application, status: 'approved', autoApproved: true },
        guide,
        autoApproved: true,
        qualifiedAdminCount: qualifiedCount + 1,
        seedLimit: QUALIFIED_ADMIN_SEED_LIMIT,
        reviewSlaHours: GUIDE_REVIEW_SLA_HOURS,
      });
    }

    notifyGuideApplicationReceived(userId, { hours: GUIDE_REVIEW_SLA_HOURS, applicationId: application.id });
    sendPushToUser(userId, {
      title: 'Guide application received',
      body: `You will get an answer within ${GUIDE_REVIEW_SLA_HOURS} hours. Qualified guides are reviewing your profile and proofs.`,
      data: { url: '/home' },
    }).catch(() => {});

    const applicant = await getUserById(userId);
    const applicantName = applicant?.name || applicant?.username || 'A member';
    const adminIds = (await getQualifiedAdminUserIds()).filter((id) => id !== userId);
    for (const adminId of adminIds) {
      notifyGuideApplicationPendingReview(adminId, {
        applicationId: application.id,
        applicantName,
      });
      sendPushToUser(adminId, {
        title: 'New guide application to review',
        body: `${applicantName} applied. Open Compatibility → Expert dashboard to approve or decline.`,
        data: { url: '/home' },
      }).catch(() => {});
    }

    res.json({
      message: `You will get an answer within ${GUIDE_REVIEW_SLA_HOURS} hours. Existing qualified guides will review your profile and what you submitted.`,
      application,
      autoApproved: false,
      qualifiedAdminCount: qualifiedCount,
      seedLimit: QUALIFIED_ADMIN_SEED_LIMIT,
      reviewSlaHours: GUIDE_REVIEW_SLA_HOURS,
      decisionDueAt,
    });
  } catch (error) {
    console.error('Apply as guide error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getMyApplication = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || req.query.userId as string;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const application = await getApplicationByUserId(userId);
    res.json({ application });
  } catch (error) {
    console.error('Get application error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAllApplicationsAdmin = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    if (!(await isQualifiedAdmin(userId))) {
      return res.status(403).json({ error: 'Only qualified guide admins can view applications' });
    }
    const applications = await getAllApplications();
    res.json({ applications });
  } catch (error) {
    console.error('Get all applications error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getPendingApplicationsForReview = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    if (!(await isQualifiedAdmin(userId))) {
      return res.status(403).json({ error: 'Only qualified guide admins can review applications' });
    }
    const pending = await getPendingApplications();
    const applications = await Promise.all(
      pending
        .filter((app) => app.userId !== userId)
        .map(async (app) => {
          const u = await getUserById(app.userId);
          return {
            ...app,
            applicant: u
              ? {
                  id: u.id,
                  name: u.name,
                  username: u.username,
                  profilePicture: u.profilePicture ?? null,
                  age: u.age ?? null,
                  city: u.city ?? null,
                  country: u.country ?? null,
                }
              : null,
          };
        })
    );
    res.json({
      applications,
      reviewSlaHours: GUIDE_REVIEW_SLA_HOURS,
      qualifiedAdminCount: await countQualifiedAdmins(),
    });
  } catch (error) {
    console.error('Get pending guide applications error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const approveGuideApplication = async (req: Request, res: Response) => {
  try {
    const reviewerId = (req as any).userId || req.body.reviewerId;
    const { applicationId } = req.body;

    if (!reviewerId || !applicationId) {
      return res.status(400).json({ error: 'Reviewer ID and application ID are required' });
    }
    if (!(await isQualifiedAdmin(reviewerId))) {
      return res.status(403).json({ error: 'Only qualified guide admins can approve applicants' });
    }

    const app = await getApplicationById(applicationId);
    if (!app) return res.status(404).json({ error: 'Application not found' });
    if (app.status !== 'pending') {
      return res.status(400).json({ error: 'This application is no longer pending' });
    }
    if (app.userId === reviewerId) {
      return res.status(400).json({ error: 'You cannot approve your own application' });
    }

    const guide = await approveApplication(
      applicationId,
      reviewerId,
      typeof req.body.coachStarRating === 'number' ? req.body.coachStarRating : 4.5
    );
    notifyGuideApplicationDecision(app.userId, { approved: true });
    sendPushToUser(app.userId, {
      title: 'You are a qualified guide',
      body: 'You were approved. You can start guiding others now from Compatibility.',
      data: { url: '/home' },
    }).catch(() => {});
    res.json({
      message: 'They are approved. They can start guiding others.',
      guide,
    });
  } catch (error: any) {
    console.error('Approve application error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const rejectGuideApplication = async (req: Request, res: Response) => {
  try {
    const reviewerId = (req as any).userId || req.body.reviewerId;
    const { applicationId } = req.body;

    if (!reviewerId || !applicationId) {
      return res.status(400).json({ error: 'Reviewer ID and application ID are required' });
    }
    if (!(await isQualifiedAdmin(reviewerId))) {
      return res.status(403).json({ error: 'Only qualified guide admins can reject applicants' });
    }

    const app = await getApplicationById(applicationId);
    if (!app) return res.status(404).json({ error: 'Application not found' });
    if (app.status !== 'pending') {
      return res.status(400).json({ error: 'This application is no longer pending' });
    }
    if (app.userId === reviewerId) {
      return res.status(400).json({ error: 'You cannot reject your own application' });
    }

    await rejectApplication(applicationId, reviewerId);
    notifyGuideApplicationDecision(app.userId, { approved: false });
    sendPushToUser(app.userId, {
      title: 'Guide application update',
      body: 'Your application was not approved. You can improve your proofs and try again later.',
      data: { url: '/home' },
    }).catch(() => {});
    res.json({ message: 'Application rejected.' });
  } catch (error: any) {
    console.error('Reject application error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const getMyGuideProfile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || req.query.userId as string;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const guide = await getGuideByUserId(userId);
    const user = await getUserById(userId);

    if (!guide || !guide.isActive) {
      return res.json({
        guide: null,
        user: null,
        canVote: false,
      });
    }

    if (user && !user.qualifiedCoach) {
      await (await import('../models/user.js')).updateUserProfile(userId, {
        qualifiedCoach: true,
        coachStarRating: guide.rating,
      });
    }

    res.json({
      guide: { ...guide, qualifiedCoach: true },
      user: user ? { id: user.id, name: user.name, username: user.username, profilePicture: user.profilePicture } : null,
      canVote: true,
    });
  } catch (error) {
    console.error('Get guide profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getGuidesForCategory = async (req: Request, res: Response) => {
  try {
    const { category } = req.params;
    const region = req.query.region as string | undefined;
    const country = req.query.country as string | undefined;
    const city = req.query.city as string | undefined;
    if (!category) {
      return res.status(400).json({ error: 'Category is required' });
    }

    let guides;
    if (country || city) {
      guides = await getQualifiedCoachesLocal(country, city, [category]);
    } else {
      guides = region
        ? await getGuidesByCategoryAndRegion(category, region)
        : await getGuidesByCategory(category);
    }

    const guidesWithUsers = (
      await Promise.all(guides.map((guide) => enrichGuideWithUser(guide)))
    ).filter(Boolean);

    res.json({ guides: guidesWithUsers });
  } catch (error) {
    console.error('Get guides for category error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getGuidesRecommendedForUser = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || req.query.userId as string;
    const region = req.query.region as string | undefined;
    const countryQ = req.query.country as string | undefined;
    const cityQ = req.query.city as string | undefined;
    if (!userId) return res.status(400).json({ error: 'User ID is required' });

    const user = await getUserById(userId);
    const categoryIds = user?.improvementCategories || [];
    const country = countryQ || user?.country;
    const city = cityQ || user?.city;

    const guides = await getQualifiedCoachesLocal(country, city, categoryIds.length ? categoryIds : undefined);
    const regionFiltered = region
      ? guides.filter((g) => matchesRegionFilter(g.region, region))
      : guides;

    const guidesWithUsers = (
      await Promise.all(regionFiltered.map((guide) => enrichGuideWithUser(guide)))
    ).filter(Boolean);

    res.json({ guides: guidesWithUsers, country: country || null, city: city || null });
  } catch (error) {
    console.error('Get recommended guides error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const searchGuidesByProblem = async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string)?.trim();
    const region = req.query.region as string | undefined;
    const country = req.query.country as string | undefined;
    const city = req.query.city as string | undefined;
    if (!q) return res.status(400).json({ error: 'Search query q is required' });

    const guides = await getGuidesByProblemSearch(q);
    let filtered = region ? guides.filter((g) => matchesRegionFilter(g.region, region)) : guides;
    if (country || city) {
      filtered = filtered.filter((g) => matchesGeoFilter(g.region, country, city));
    }

    const guidesWithUsers = (
      await Promise.all(filtered.map((guide) => enrichGuideWithUser(guide)))
    ).filter(Boolean);

    res.json({ guides: guidesWithUsers });
  } catch (error) {
    console.error('Search guides by problem error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/** Local qualified coaches in viewer's area (live sync from profile country/city). */
export const getLocalQualifiedCoaches = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const country = (req.query.country as string) || undefined;
    const city = (req.query.city as string) || undefined;
    const category = (req.query.category as string) || undefined;

    let c = country;
    let ct = city;
    if (userId && (!c || !ct)) {
      const user = await getUserById(userId);
      c = c || user?.country;
      ct = ct || user?.city;
    }

    const categoryIds = category ? [category] : undefined;
    const guides = await getQualifiedCoachesLocal(c, ct, categoryIds);
    const guidesWithUsers = (
      await Promise.all(guides.map((guide) => enrichGuideWithUser(guide)))
    ).filter(Boolean);

    res.json({ guides: guidesWithUsers, country: c || null, city: ct || null });
  } catch (error) {
    console.error('Get local qualified coaches error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAllGuidesList = async (req: Request, res: Response) => {
  try {
    const guides = await getAllGuides();
    const guidesWithUsers = await Promise.all(
      guides.map(async (guide) => {
        const user = await getUserById(guide.userId);
        return {
          ...guide,
          user: user ? {
            id: user.id,
            name: user.name,
            username: user.username,
            profilePicture: user.profilePicture,
          } : null,
        };
      })
    );

    res.json({ guides: guidesWithUsers });
  } catch (error) {
    console.error('Get all guides error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const setAvailability = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || req.body.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const guide = await getGuideByUserId(userId);
    if (!guide) {
      return res.status(403).json({ error: 'You are not a guide' });
    }

    const { startTime, endTime } = req.body;
    if (!startTime || !endTime) {
      return res.status(400).json({ error: 'Start time and end time are required' });
    }

    const slot = await addAvailability(guide.id, new Date(startTime), new Date(endTime));
    res.json({ message: 'Availability added successfully', slot });
  } catch (error) {
    console.error('Set availability error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getGuideAvailability = async (req: Request, res: Response) => {
  try {
    const { guideId } = req.params;
    if (!guideId) {
      return res.status(400).json({ error: 'Guide ID is required' });
    }

    const slots = await getAvailability(guideId);
    res.json({ availability: slots });
  } catch (error) {
    console.error('Get availability error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createBookingRequest = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || req.body.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { guideId, category, startTime, endTime, duration, requestId } = req.body;
    if (!guideId || !category || !startTime || !endTime || !duration) {
      return res.status(400).json({ error: 'All booking fields are required' });
    }

    const guide = await getGuideById(guideId);
    if (!guide) {
      return res.status(404).json({ error: 'Guide not found' });
    }

    let amount: number;
    let paypalOrderId: string | null = null;
    let bookingRequestId: string | null = null;

    if (requestId) {
      const guideRequest = await getRequestById(requestId);
      if (!guideRequest || guideRequest.userId !== userId || guideRequest.guideId !== guideId) {
        return res.status(400).json({ error: 'Invalid request' });
      }
      if (guideRequest.status !== 'accepted' || guideRequest.paymentStatus !== 'confirmed') {
        return res.status(400).json({ error: 'Request must be accepted and trainer must confirm payment first' });
      }
      amount = guide.sessionPriceEur ?? SESSION_PRICE_EUR;
      paypalOrderId = null;
      bookingRequestId = requestId;
    } else {
      amount = (duration / 60) * guide.hourlyRate;
    }

    const booking = await createBooking({
      userId,
      guideId,
      category,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      duration,
      amount,
      paypalOrderId: paypalOrderId || undefined,
      requestId: bookingRequestId || undefined,
    });

    res.json({ booking });
  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getMyBookings = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || req.query.userId as string;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const bookings = await getBookingsByUserId(userId);
    res.json({ bookings });
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getGuideBookings = async (req: Request, res: Response) => {
  try {
    const guideId = req.params.guideId;
    if (!guideId) {
      return res.status(400).json({ error: 'Guide ID is required' });
    }

    const bookings = await getBookingsByGuideId(guideId);
    res.json({ bookings });
  } catch (error) {
    console.error('Get guide bookings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const confirmPayment = async (req: Request, res: Response) => {
  try {
    const { bookingId, paymentIntentId } = req.body;
    if (!bookingId || !paymentIntentId) {
      return res.status(400).json({ error: 'Booking ID and payment intent ID are required' });
    }

    await updateBookingPayment(bookingId, paymentIntentId);
    res.json({ message: 'Payment confirmed' });
  } catch (error) {
    console.error('Confirm payment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Guide Request endpoints
export const sendGuideRequest = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || req.body.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { guideId, category, message } = req.body;
    if (!guideId || !category) {
      return res.status(400).json({ error: 'Guide ID and category are required' });
    }

    const guide = await getGuideById(guideId);
    if (!guide) {
      return res.status(404).json({ error: 'Guide not found' });
    }

    const request = await createGuideRequest({
      userId,
      guideId,
      category,
      message: message || '',
    });

    res.json({ message: 'Request sent successfully', request });
  } catch (error) {
    console.error('Send guide request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getMyGuideRequests = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || req.query.userId as string;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const requests = await getRequestsByUserId(userId);
    res.json({ requests });
  } catch (error) {
    console.error('Get guide requests error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getGuideRequestsForMe = async (req: Request, res: Response) => {
  try {
    const guideId = req.params.guideId;
    if (!guideId) {
      return res.status(400).json({ error: 'Guide ID is required' });
    }

    const requests = await getRequestsByGuideId(guideId);
    res.json({ requests });
  } catch (error) {
    console.error('Get guide requests for me error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const acceptRequest = async (req: Request, res: Response) => {
  try {
    const { requestId } = req.body;
    if (!requestId) {
      return res.status(400).json({ error: 'Request ID is required' });
    }

    await acceptGuideRequest(requestId);
    res.json({ message: 'Request accepted' });
  } catch (error) {
    console.error('Accept request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const submitPaymentProofHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { requestId } = req.params;
    const { proofText, proofImageUrl } = req.body;
    if (!requestId || !proofText || typeof proofText !== 'string' || !proofText.trim()) {
      return res.status(400).json({ error: 'Request ID and proof text are required' });
    }

    const guideRequest = await getRequestById(requestId);
    if (!guideRequest || guideRequest.userId !== userId) {
      return res.status(404).json({ error: 'Request not found' });
    }

    await submitPaymentProof(requestId, proofText.trim(), proofImageUrl || null);
    res.json({ message: 'Proof submitted. Trainer has up to 48 hours to confirm receipt.' });
  } catch (error: any) {
    console.error('Submit payment proof error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const confirmPaymentReceivedHandler = async (req: Request, res: Response) => {
  try {
    const guideUserId = (req as any).userId;
    if (!guideUserId) return res.status(401).json({ error: 'Unauthorized' });

    const { requestId } = req.body;
    if (!requestId) return res.status(400).json({ error: 'Request ID is required' });

    await confirmPaymentReceived(requestId, guideUserId);
    res.json({ message: 'Payment confirmed. User can now book an appointment.' });
  } catch (error: any) {
    console.error('Confirm payment error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const setMyPaypalInfo = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { paypalInfo } = req.body;
    if (typeof paypalInfo !== 'string') {
      return res.status(400).json({ error: 'paypalInfo (PayPal email or PayPal.me link) is required' });
    }

    await updateGuidePaypalInfo(userId, paypalInfo.trim());
    res.json({ message: 'PayPal info updated' });
  } catch (error: any) {
    console.error('Set PayPal info error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const rejectRequest = async (req: Request, res: Response) => {
  try {
    const { requestId } = req.body;
    if (!requestId) {
      return res.status(400).json({ error: 'Request ID is required' });
    }

    await rejectGuideRequest(requestId);
    res.json({ message: 'Request rejected' });
  } catch (error) {
    console.error('Reject request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Course completion endpoints
export const rateCourseCompletion = async (req: Request, res: Response) => {
  try {
    const guideId = (req as any).userId || req.body.guideId;
    if (!guideId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { bookingId, rating } = req.body;
    if (!bookingId || !rating) {
      return res.status(400).json({ error: 'Booking ID and rating are required' });
    }

    if (rating !== 'success' && rating !== 'partial') {
      return res.status(400).json({ error: 'Rating must be "success" or "partial"' });
    }

    const booking = await completeCourse(bookingId, rating);
    res.json({ 
      message: 'Course rated successfully',
      booking,
      improvementGained: booking.improvementPercentage 
    });
  } catch (error: any) {
    console.error('Rate course completion error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const getUserImprovement = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || req.query.userId as string;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const percentage = await getUserImprovementPercentage(userId);
    const completedCourses = await getCompletedCoursesByUser(userId);
    
    res.json({ 
      improvementPercentage: percentage,
      completedCourses: completedCourses.length,
      courses: completedCourses 
    });
  } catch (error) {
    console.error('Get user improvement error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};





