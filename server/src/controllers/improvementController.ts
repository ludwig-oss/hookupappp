import { Request, Response } from 'express';
import { sanitizeForStorage, sanitizeHttpUrl, LIMITS } from '../utils/sanitize.js';
import {
  IMPROVEMENT_CATEGORIES,
  SESSION_PRICE_EUR,
  createApplication,
  getApplicationByUserId,
  getAllApplications,
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
} from '../models/improvement.js';
import { getUserById } from '../models/user.js';

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

    if (!experience || !qualifications) {
      return res.status(400).json({ error: 'Experience and qualifications are required' });
    }

    // At least one of identificationUrl or proofPerCategory (with descriptions) required
    const hasIdentification = identificationUrl && String(identificationUrl).trim();
    const hasProofPerCategory = proofPerCategory && typeof proofPerCategory === 'object' &&
      Object.values(proofPerCategory).some((p: any) => p && typeof p.description === 'string' && String(p.description).trim());
    if (!hasIdentification && !hasProofPerCategory) {
      return res.status(400).json({ error: 'Provide identification or proof for each category (description + optional image URLs)' });
    }

    // Check if user already applied
    const existing = await getApplicationByUserId(userId);
    if (existing) {
      return res.status(400).json({ error: 'You have already submitted an application' });
    }

    const sanitizedProof =
      proofPerCategory && typeof proofPerCategory === 'object'
        ? Object.fromEntries(
            Object.entries(
              proofPerCategory as Record<string, { description?: string; imageUrls?: string[]; imageUrl?: string }>
            ).map(([key, val]) => {
              const urls = Array.isArray(val?.imageUrls)
                ? val.imageUrls
                    .map((u) => sanitizeHttpUrl(u) || sanitizeForStorage(u, LIMITS.HTTP_URL))
                    .filter(Boolean)
                : val?.imageUrl
                  ? [sanitizeHttpUrl(val.imageUrl) || sanitizeForStorage(val.imageUrl, LIMITS.HTTP_URL)].filter(Boolean)
                  : undefined;
              return [
                sanitizeForStorage(key, LIMITS.SHORT_LABEL),
                {
                  description: sanitizeForStorage(val?.description, LIMITS.PRECOMM_FIELD),
                  ...(urls?.length ? { imageUrls: urls } : {}),
                },
              ];
            })
          )
        : undefined;

    const application = await createApplication({
      userId,
      categories,
      region: sanitizeForStorage(region || 'Global', LIMITS.CITY),
      experience: sanitizeForStorage(experience, LIMITS.EXPERIENCE),
      qualifications: sanitizeForStorage(qualifications, LIMITS.QUALIFICATIONS),
      identificationUrl: hasIdentification
        ? sanitizeHttpUrl(identificationUrl) || sanitizeForStorage(identificationUrl, LIMITS.HTTP_URL)
        : '',
      proofPerCategory: sanitizedProof,
    });

    res.json({
      message: 'Application submitted. Your application will be reviewed within 48 hours. You will get a response here.',
      application,
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
    // In production, check if user is admin
    const applications = await getAllApplications();
    res.json({ applications });
  } catch (error) {
    console.error('Get all applications error:', error);
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

    const guide = await approveApplication(applicationId, reviewerId);
    res.json({
      message: 'Application approved. Guide badge has been assigned.',
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

    await rejectApplication(applicationId, reviewerId);
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
    if (!guide) {
      return res.status(404).json({ error: 'You are not a guide' });
    }

    const user = await getUserById(userId);
    res.json({
      guide,
      user: user ? { id: user.id, name: user.name, username: user.username, profilePicture: user.profilePicture } : null,
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
    if (!category) {
      return res.status(400).json({ error: 'Category is required' });
    }

    const guides = region ? await getGuidesByCategoryAndRegion(category, region) : await getGuidesByCategory(category);
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
    console.error('Get guides for category error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getGuidesRecommendedForUser = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || req.query.userId as string;
    const region = req.query.region as string | undefined;
    if (!userId) return res.status(400).json({ error: 'User ID is required' });

    const user = await getUserById(userId);
    const categoryIds = user?.improvementCategories || [];
    const guides = await getGuidesRecommended(categoryIds, region);
    const guidesWithUsers = await Promise.all(
      guides.map(async (guide) => {
        const u = await getUserById(guide.userId);
        return {
          ...guide,
          user: u ? { id: u.id, name: u.name, username: u.username, profilePicture: u.profilePicture } : null,
        };
      })
    );
    res.json({ guides: guidesWithUsers });
  } catch (error) {
    console.error('Get recommended guides error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const searchGuidesByProblem = async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string)?.trim();
    const region = req.query.region as string | undefined;
    if (!q) return res.status(400).json({ error: 'Search query q is required' });

    const guides = await getGuidesByProblemSearch(q);
    const filtered = region ? guides.filter(g => matchesRegionFilter(g.region, region)) : guides;
    const guidesWithUsers = await Promise.all(
      filtered.map(async (guide) => {
        const u = await getUserById(guide.userId);
        return {
          ...guide,
          user: u ? { id: u.id, name: u.name, username: u.username, profilePicture: u.profilePicture } : null,
        };
      })
    );
    res.json({ guides: guidesWithUsers });
  } catch (error) {
    console.error('Search guides by problem error:', error);
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





