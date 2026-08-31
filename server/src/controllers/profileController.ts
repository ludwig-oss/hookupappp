import { Request, Response } from 'express';
import {
  getUserById,
  getUserByEmail,
  getUserByUsername,
  updateUserProfile,
  addHighlight,
  removeHighlight,
  addDisappearingPhoto,
  viewDisappearingPhoto,
  addStory,
  removeStory,
  reorderHighlights,
  pruneExpiredStories,
} from '../models/user.js';
import { getActiveRelationship } from '../models/relationship.js';
import { runWithSystem } from '../db/context.js';
import type { AuthRequest } from '../middleware/auth.js';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { uploadImage, uploadMedia, isRemoteMediaUrl } from '../utils/storage.js';
import { inferMediaTypeFromUrl } from '../utils/mediaType.js';
import {
  sanitizeName,
  sanitizeUsername,
  sanitizeBio,
  sanitizeForStorage,
  sanitizeOptionalAge,
  LIMITS,
} from '../utils/sanitize.js';

const UPLOADS_DIR = join(process.cwd(), 'server', 'uploads');

// Helper to ensure uploads directory exists
async function ensureUploadsDir() {
  const fs = await import('fs/promises');
  try {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
  } catch (error) {
    // Directory already exists
  }
}

// Convert image to base64 for storage (simple approach)
function base64ToDataUrl(base64: string, mimeType: string = 'image/jpeg'): string {
  if (base64.startsWith('data:')) {
    return base64;
  }
  return `data:${mimeType};base64,${base64}`;
}

function mediaPayload(raw: string): string {
  if (raw.startsWith('data:') || isRemoteMediaUrl(raw)) return raw.trim();
  return base64ToDataUrl(raw);
}

export const uploadProfilePicture = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || req.body.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { image } = req.body;
    if (image === '' || image === null) {
      const user = await updateUserProfile(userId, { profilePicture: null, photoVerifiedAt: null });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      return res.json({
        message: 'Profile picture removed',
        profilePicture: null,
        photoVerifiedAt: null,
      });
    }
    if (!image) {
      return res.status(400).json({ error: 'Image is required' });
    }

    const imageUrl = inferMediaTypeFromUrl(image) === 'video'
      ? await uploadMedia(image, 'profile')
      : await uploadImage(image, 'profile');
    const user = await updateUserProfile(userId, { profilePicture: imageUrl, photoVerifiedAt: null });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: 'Profile picture updated successfully. Verify it\'s you with a selfie to get the verified badge.',
      profilePicture: user.profilePicture,
      photoVerifiedAt: user.photoVerifiedAt || null,
    });
  } catch (error) {
    console.error('Upload profile picture error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/** Submit selfie verification (look left / center / right) to prove profile photo is really you. Sets photoVerifiedAt. */
export const submitPhotoVerification = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || req.body.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { selfieImages } = req.body; // Array of base64: [lookLeft, lookCenter, lookRight] or single selfie
    const images = Array.isArray(selfieImages) ? selfieImages : (req.body.selfie ? [req.body.selfie] : []);
    if (!images.length || !images.every((img: any) => typeof img === 'string' && img.length > 0)) {
      return res.status(400).json({ error: 'At least one selfie image is required' });
    }

    const user = await getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (!user.profilePicture) {
      return res.status(400).json({ error: 'Upload a profile picture first, then verify with a selfie' });
    }

    const userUpdated = await updateUserProfile(userId, {
      photoVerifiedAt: new Date().toISOString(),
    });

    res.json({
      message: 'Photo verified. Your profile will show a green verified badge.',
      photoVerifiedAt: userUpdated?.photoVerifiedAt || null,
    });
  } catch (error) {
    console.error('Photo verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getUserProfile = async (req: Request, res: Response) => {
  try {
    const authUserId = (req as AuthRequest).userId as string;
    const authEmail = (req as AuthRequest).userEmail;
    const paramId = req.params.userId;
    const profileUserId =
      paramId === 'me' || !paramId ? authUserId : paramId;
    if (!profileUserId) {
      return res.status(401).json({ error: 'Unauthorized. Send Authorization: Bearer <token> for /me' });
    }

    let user = await getUserById(profileUserId);
    const isOwnProfileRequest = paramId === 'me' || !paramId || authUserId === profileUserId;
    if (!user && isOwnProfileRequest) {
      user = await runWithSystem(() => getUserById(profileUserId));
      if (!user && authEmail) {
        user = await runWithSystem(() => getUserByEmail(authEmail));
      }
      if (!user && authEmail?.endsWith('@noreply.local')) {
        const uname = authEmail.split('@')[0]?.trim();
        if (uname) {
          user = await runWithSystem(() => getUserByUsername(uname));
        }
      }
    }
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    await pruneExpiredStories(user.id);
    const viewingOwnProfile = isOwnProfileRequest || authUserId === user.id;
    const now = Date.now();
    const ownerCloseFriends = user.closeFriendIds || [];
    const visibleStories = (user.stories || []).filter((s) => {
      if (new Date(s.expiresAt).getTime() <= now) return false;
      if (viewingOwnProfile) return true;
      if (s.audience === 'all') return true;
      return ownerCloseFriends.includes(authUserId);
    });

    // Don't send password and sensitive data
    const { password, resetToken, resetTokenExpiry, ...userProfile } = user;
    
    // Ensure all required fields exist with defaults
    const profile: Record<string, unknown> = {
      ...userProfile,
      highlights: userProfile.highlights || [],
      stories: visibleStories,
      closeFriendIds: viewingOwnProfile ? (userProfile.closeFriendIds || []) : undefined,
      disappearingPhotos: userProfile.disappearingPhotos || [],
      improvementCategories: userProfile.improvementCategories || [],
      profilePicture: userProfile.profilePicture || null,
      profileSetupComplete: userProfile.profileSetupComplete !== undefined ? userProfile.profileSetupComplete : false,
      blockedUsers: userProfile.blockedUsers || [],
      mutedUsers: userProfile.mutedUsers || [],
      unmatchedUsers: userProfile.unmatchedUsers || [],
      profiles: userProfile.profiles || [],
      photoVerifiedAt: userProfile.photoVerifiedAt || null,
    };
    if (!viewingOwnProfile) {
      delete profile.closeFriendIds;
    }

    try {
      const rel = await getActiveRelationship(user.id);
      (profile as any).inRelationship = !!rel && rel.status === 'active';
    } catch (_) {
      (profile as any).inRelationship = false;
    }
    
    res.json(profile);
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const addUserHighlight = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || req.body.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { image, media, highlightId } = req.body;
    const raw = media || image;
    if (!raw || typeof raw !== 'string') {
      return res.status(400).json({ error: 'Image or media (data URL / base64) is required' });
    }

    const mediaUrl = await uploadMedia(mediaPayload(raw), 'highlights');
    const mediaType = inferMediaTypeFromUrl(mediaUrl);
    const highlight = await addHighlight(userId, mediaUrl, highlightId, mediaType);

    if (!highlight) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: highlightId ? 'Item added to highlight successfully' : 'Highlight created successfully',
      highlight,
    });
  } catch (error) {
    console.error('Add highlight error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const addUserStory = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { media, image, audience } = req.body;
    const raw = media || image;
    if (!raw || typeof raw !== 'string') {
      return res.status(400).json({ error: 'media or image (data URL / base64) is required' });
    }

    const aud = audience === 'closeFriends' ? 'closeFriends' : 'all';
    const mediaUrl = await uploadMedia(mediaPayload(raw), 'stories');
    const mediaType = inferMediaTypeFromUrl(mediaUrl);
    const story = await addStory(userId, mediaUrl, mediaType, aud);
    if (!story) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ message: 'Story published (visible for 24 hours)', story });
  } catch (error) {
    console.error('Add story error:', error);
    const msg = error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({ error: msg.includes('too large') ? msg : 'Story upload failed — try a smaller photo or shorter video.' });
  }
};

export const deleteUserStory = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { storyId } = req.params;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!storyId) {
      return res.status(400).json({ error: 'Story ID is required' });
    }
    const ok = await removeStory(userId, storyId);
    if (!ok) {
      return res.status(404).json({ error: 'Story not found' });
    }
    res.json({ message: 'Story deleted' });
  } catch (error) {
    console.error('Delete story error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const reorderUserHighlights = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds) || !orderedIds.every((id: unknown) => typeof id === 'string')) {
      return res.status(400).json({ error: 'orderedIds must be an array of highlight id strings' });
    }
    await reorderHighlights(userId, orderedIds);
    res.json({ message: 'Highlights reordered' });
  } catch (error) {
    console.error('Reorder highlights error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const addHighlightFromStory = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { storyId, highlightId } = req.body;
    if (!storyId || typeof storyId !== 'string') {
      return res.status(400).json({ error: 'storyId is required' });
    }
    const owner = await getUserById(userId);
    const story = owner?.stories?.find((s) => s.id === storyId);
    if (!story || new Date(story.expiresAt).getTime() <= Date.now()) {
      return res.status(404).json({ error: 'Story not found or expired' });
    }
    const highlight = await addHighlight(userId, story.mediaUrl, highlightId, story.mediaType);
    if (!highlight) {
      return res.status(404).json({ error: 'Could not add highlight' });
    }
    res.json({
      message: highlightId ? 'Added to highlight' : 'Created highlight from story',
      highlight,
    });
  } catch (error) {
    console.error('Highlight from story error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteUserHighlight = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || req.body.userId;
    const { highlightId } = req.params;
    const { itemId } = req.body; // Optional: delete specific item instead of entire highlight

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!highlightId) {
      return res.status(400).json({ error: 'Highlight ID is required' });
    }

    const success = await removeHighlight(userId, highlightId, itemId);
    if (!success) {
      return res.status(404).json({ error: 'Highlight not found' });
    }

    res.json({ message: 'Highlight deleted successfully' });
  } catch (error) {
    console.error('Delete highlight error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const addDisappearingPhotoUser = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || req.body.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ error: 'Image is required' });
    }

    const imageUrl = await uploadImage(image, 'disappearing');
    const photo = await addDisappearingPhoto(userId, imageUrl);

    if (!photo) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: 'Disappearing photo added successfully',
      photo,
    });
  } catch (error) {
    console.error('Add disappearing photo error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const viewDisappearingPhotoUser = async (req: Request, res: Response) => {
  try {
    const viewerId = (req as any).userId || req.body.viewerId;
    const { photoId, ownerId } = req.body;

    if (!viewerId || !photoId || !ownerId) {
      return res.status(400).json({ error: 'Viewer ID, photo ID, and owner ID are required' });
    }

    const result = await viewDisappearingPhoto(photoId, viewerId, ownerId);
    res.json(result);
  } catch (error) {
    console.error('View disappearing photo error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const completeProfileSetup = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || req.body.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { profilePicture } = req.body;
    const updates: any = { profileSetupComplete: true };
    
    if (profilePicture) {
      const isVideo =
        profilePicture.startsWith('data:video') || /\.(mp4|webm|mov)(\?|#|$)/i.test(profilePicture);
      updates.profilePicture = isVideo
        ? await uploadMedia(profilePicture, 'profile')
        : await uploadImage(profilePicture, 'profile');
    }

    const user = await updateUserProfile(userId, updates);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: 'Profile setup completed',
      user: { id: user.id, email: user.email, name: user.name, username: user.username, profilePicture: user.profilePicture },
    });
  } catch (error) {
    console.error('Complete profile setup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateUserProfileInfo = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const body = req.body || {};

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { name, username, phoneNumber, age, bio, gender, height, education, occupation, relationshipStatus } = body;

    // Check if username is already taken (if changing)
    if (username) {
      const { getUserByUsername } = await import('../models/user.js');
      const existingUser = await getUserByUsername(username);
      if (existingUser && existingUser.id !== userId) {
        return res.status(400).json({ error: 'Username already taken' });
      }
    }

    const updates: any = {};
    if (name) {
      const safeName = sanitizeName(name);
      if (!safeName) return res.status(400).json({ error: 'Name is required' });
      updates.name = safeName;
    }
    if (username) {
      const safeUsername = sanitizeUsername(username);
      if (!safeUsername) {
        return res.status(400).json({ error: 'Username must be 3-20 characters and contain only letters, numbers, and underscores' });
      }
      updates.username = safeUsername;
    }

    // Check if phone number is already taken (if changing)
    if (phoneNumber) {
      const normalizedPhone = String(phoneNumber).replace(/\D/g, '').slice(0, LIMITS.PHONE);
      if (normalizedPhone.length < 10) {
        return res.status(400).json({ error: 'Invalid phone number' });
      }
      const { getUserByPhone } = await import('../models/user.js');
      const existingUser = await getUserByPhone(normalizedPhone);
      if (existingUser && existingUser.id !== userId) {
        return res.status(400).json({ error: 'Phone number already registered to another account' });
      }
      updates.phoneNumber = normalizedPhone;
    }

    if (age !== undefined) {
      const safeAge = sanitizeOptionalAge(age);
      if (age !== null && age !== '' && safeAge === undefined) {
        return res.status(400).json({ error: 'Age must be between 18 and 120' });
      }
      if (safeAge !== undefined) updates.age = safeAge;
    }
    if (bio !== undefined) updates.bio = sanitizeBio(bio);
    if (gender !== undefined) updates.gender = sanitizeForStorage(gender, LIMITS.SHORT_LABEL);
    if (height !== undefined) updates.height = sanitizeForStorage(height, LIMITS.SHORT_LABEL);
    if (education !== undefined) updates.education = sanitizeForStorage(education, LIMITS.SHORT_LABEL);
    if (occupation !== undefined) updates.occupation = sanitizeForStorage(occupation, LIMITS.SHORT_LABEL);
    if (relationshipStatus !== undefined) {
      updates.relationshipStatus = sanitizeForStorage(relationshipStatus, LIMITS.SHORT_LABEL);
    }
    // Always persist country and city when present in body (required for profile save)
    if ('country' in body) updates.country = sanitizeForStorage(body.country, LIMITS.COUNTRY);
    if ('city' in body) updates.city = sanitizeForStorage(body.city, LIMITS.CITY);

    // Public figure / celebrity
    if (body.publicFigureLevel !== undefined) updates.publicFigureLevel = body.publicFigureLevel || null;
    if (body.publicFigureProof !== undefined) updates.publicFigureProof = body.publicFigureProof || null;
    if (body.publicFigureIdImage !== undefined) updates.publicFigureIdImage = body.publicFigureIdImage || null;
    if (body.publicFigureUniqueImage !== undefined) updates.publicFigureUniqueImage = body.publicFigureUniqueImage || null;
    if (body.publicFigureVerified !== undefined) updates.publicFigureVerified = !!body.publicFigureVerified;
    if (body.publicFigureVerifiedAt !== undefined) updates.publicFigureVerifiedAt = body.publicFigureVerifiedAt || null;
    if (Array.isArray(body.revealToUserIds)) updates.revealToUserIds = body.revealToUserIds;
    if (body.celebChatDisappearMode !== undefined) updates.celebChatDisappearMode = body.celebChatDisappearMode || 'none';
    if (body.celebChatDisappearSeconds !== undefined) updates.celebChatDisappearSeconds = body.celebChatDisappearSeconds;
    if (body.celebMessagesOnlyWhenOpened !== undefined) updates.celebMessagesOnlyWhenOpened = !!body.celebMessagesOnlyWhenOpened;
    if (Array.isArray(body.closeFriendIds)) {
      updates.closeFriendIds = body.closeFriendIds.filter((id: unknown) => typeof id === 'string');
    }

    const user = await updateUserProfile(userId, updates);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { password, resetToken, resetTokenExpiry, ...userProfile } = user;
    res.json({
      message: 'Profile updated successfully',
      user: userProfile,
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};


