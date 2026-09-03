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
  isValidDescriptor,
  saveFaceProfile,
  verifyFaceForUser,
  getFaceProfileByUserId,
  euclideanDistance,
  FACE_MATCH_THRESHOLD,
} from '../models/faceAuth.js';
import { photoLockStatusForUser, getPhotoLockStatus } from '../models/photoVerification.js';
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

/** JWT user id can miss under RLS; recover the same way /me does. */
async function resolveOwnUser(authUserId: string, authEmail?: string) {
  let user = await getUserById(authUserId);
  if (!user) user = await runWithSystem(() => getUserById(authUserId));
  if (!user && authEmail) user = await runWithSystem(() => getUserByEmail(authEmail));
  if (!user && authEmail?.endsWith('@noreply.local')) {
    const uname = authEmail.split('@')[0]?.trim();
    if (uname) user = await runWithSystem(() => getUserByUsername(uname));
  }
  return user;
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

/** Submit a live face scan that must match the visible profile photo. */
export const submitPhotoVerification = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || req.body.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { selfieImages, faceDescriptor, profileFaceDescriptor } = req.body;
    const images = Array.isArray(selfieImages) ? selfieImages : (req.body.selfie ? [req.body.selfie] : []);
    if (!images.length || !images.every((img: any) => typeof img === 'string' && img.length > 0)) {
      return res.status(400).json({ error: 'At least one selfie image is required' });
    }

    const user = await getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (!user.profilePicture) {
      return res.status(400).json({ error: 'Upload a visible profile picture first, then take a live selfie so we can confirm it is you.' });
    }

    if (!isValidDescriptor(faceDescriptor)) {
      return res.status(400).json({
        error: 'Live face scan is required. Allow camera access and keep your face in frame with both eyes open.',
      });
    }
    if (!isValidDescriptor(profileFaceDescriptor)) {
      return res.status(400).json({
        error: 'Could not read a face from your visible profile photo. Upload a clear photo of your face, then try again.',
      });
    }
    if (euclideanDistance(faceDescriptor, profileFaceDescriptor) > FACE_MATCH_THRESHOLD) {
      return res.status(400).json({
        error: 'Your live selfie does not match your visible profile photo. Use your own photo — this is required to prevent catfishing.',
      });
    }

    const existingFace = await getFaceProfileByUserId(userId);
    if (existingFace) {
      const samePerson = await verifyFaceForUser(userId, faceDescriptor);
      if (!samePerson) {
        return res.status(400).json({
          error: 'That live selfie does not match the face on file. Use your own face in good lighting.',
        });
      }
    }

    await saveFaceProfile(userId, faceDescriptor);
    const userUpdated = await updateUserProfile(userId, {
      photoVerifiedAt: new Date().toISOString(),
    });

    res.json({
      message: 'Photo verified. Your profile will show a green verified badge.',
      photoVerifiedAt: userUpdated?.photoVerifiedAt || null,
      photoLock: photoLockStatusForUser({ ...user, photoVerifiedAt: userUpdated?.photoVerifiedAt || new Date().toISOString() }),
    });
  } catch (error) {
    console.error('Photo verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getPhotoLock = async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).userId as string;
    const authEmail = (req as AuthRequest).userEmail;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const user = await resolveOwnUser(userId, authEmail);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const status = await getPhotoLockStatus(user.id);
    res.json(status || photoLockStatusForUser(user));
  } catch (error) {
    console.error('Photo lock status error:', error);
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

    const isOwnProfileRequest = paramId === 'me' || !paramId || authUserId === profileUserId;
    let user = isOwnProfileRequest
      ? await resolveOwnUser(profileUserId, authEmail)
      : await getUserById(profileUserId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const ownerId = user.id;
    await runWithSystem(() => pruneExpiredStories(ownerId));
    const fresh = await runWithSystem(() => getUserById(ownerId));
    if (fresh) user = fresh;
    const viewingOwnProfile = isOwnProfileRequest || String(authUserId) === String(user.id);
    const now = Date.now();
    const viewerId = String(authUserId);
    const ownerCloseFriends = (user.closeFriendIds || []).map(String);
    const ownerBlocked = (user.blockedUsers || []).map(String);
    const visibleStories = (user.stories || []).filter((s) => {
      const exp = new Date(s.expiresAt).getTime();
      if (Number.isFinite(exp) && exp <= now) return false;
      if (viewingOwnProfile) return true;
      if (ownerBlocked.includes(viewerId)) return false;
      if (s.audience !== 'closeFriends') return true;
      return ownerCloseFriends.includes(viewerId);
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
      photoVerifiedAt: userProfile.photoVerifiedAt ?? null,
      createdAt: viewingOwnProfile ? photoLockStatusForUser(user).createdAt : undefined,
      photoLock: viewingOwnProfile ? photoLockStatusForUser(user) : undefined,
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
    const authUserId = (req as AuthRequest).userId as string;
    const authEmail = (req as AuthRequest).userEmail;
    const existing = await resolveOwnUser(authUserId, authEmail);
    if (!existing) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { image, media, highlightId } = req.body;
    const raw = media || image;
    if (!raw || typeof raw !== 'string') {
      return res.status(400).json({ error: 'Image or media (data URL / base64) is required' });
    }

    const mediaUrl = await uploadMedia(mediaPayload(raw), 'highlights');
    const mediaType = inferMediaTypeFromUrl(mediaUrl);
    const highlight = await runWithSystem(() => addHighlight(existing.id, mediaUrl, highlightId, mediaType));

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
    const authUserId = (req as AuthRequest).userId as string;
    const authEmail = (req as AuthRequest).userEmail;
    const existing = await resolveOwnUser(authUserId, authEmail);
    if (!existing) {
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
    const story = await runWithSystem(() => addStory(existing.id, mediaUrl, mediaType, aud));
    if (!story) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ message: 'Story published (visible for 24 hours)', story });
  } catch (error) {
    console.error('Add story error:', error);
    const msg = error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({ error: msg.includes('too large') ? msg : 'Story upload failed. Please try again.' });
  }
};

export const deleteUserStory = async (req: Request, res: Response) => {
  try {
    const authUserId = (req as AuthRequest).userId as string;
    const authEmail = (req as AuthRequest).userEmail;
    const existing = await resolveOwnUser(authUserId, authEmail);
    const { storyId } = req.params;
    if (!existing) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!storyId) {
      return res.status(400).json({ error: 'Story ID is required' });
    }
    const ok = await runWithSystem(() => removeStory(existing.id, storyId));
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
    const authUserId = (req as AuthRequest).userId as string;
    const authEmail = (req as AuthRequest).userEmail;
    const existing = await resolveOwnUser(authUserId, authEmail);
    if (!existing) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds) || !orderedIds.every((id: unknown) => typeof id === 'string')) {
      return res.status(400).json({ error: 'orderedIds must be an array of highlight id strings' });
    }
    await runWithSystem(() => reorderHighlights(existing.id, orderedIds));
    res.json({ message: 'Highlights reordered' });
  } catch (error) {
    console.error('Reorder highlights error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const addHighlightFromStory = async (req: Request, res: Response) => {
  try {
    const authUserId = (req as AuthRequest).userId as string;
    const authEmail = (req as AuthRequest).userEmail;
    const existing = await resolveOwnUser(authUserId, authEmail);
    if (!existing) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { storyId, highlightId } = req.body;
    if (!storyId || typeof storyId !== 'string') {
      return res.status(400).json({ error: 'storyId is required' });
    }
    const owner = await runWithSystem(() => getUserById(existing.id));
    const story = owner?.stories?.find((s) => s.id === storyId);
    if (!story || new Date(story.expiresAt).getTime() <= Date.now()) {
      return res.status(404).json({ error: 'Story not found or expired' });
    }
    const highlight = await runWithSystem(() => addHighlight(existing.id, story.mediaUrl, highlightId, story.mediaType));
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
    const authUserId = (req as AuthRequest).userId as string;
    const authEmail = (req as AuthRequest).userEmail;
    const existing = await resolveOwnUser(authUserId, authEmail);
    const { highlightId } = req.params;
    const { itemId } = req.body;

    if (!existing) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!highlightId) {
      return res.status(400).json({ error: 'Highlight ID is required' });
    }

    const success = await runWithSystem(() => removeHighlight(existing.id, highlightId, itemId));
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
    const userId = (req as AuthRequest).userId || req.body.userId;
    const authEmail = (req as AuthRequest).userEmail;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const existing = await resolveOwnUser(String(userId), authEmail);
    if (!existing) {
      return res.status(401).json({
        error: 'This session is no longer valid. Sign in again.',
        code: 'SESSION_GONE',
      });
    }

    const { profilePicture } = req.body;
    const updates: Record<string, unknown> = { profileSetupComplete: true };

    if (profilePicture && typeof profilePicture === 'string') {
      const isVideo =
        profilePicture.startsWith('data:video') || /\.(mp4|webm|mov)(\?|#|$)/i.test(profilePicture);
      updates.profilePicture = isVideo
        ? await uploadMedia(profilePicture, 'profile')
        : await uploadImage(profilePicture, 'profile');
    }

    const user = await runWithSystem(() => updateUserProfile(existing.id, updates));
    if (!user) {
      return res.status(401).json({
        error: 'This session is no longer valid. Sign in again.',
        code: 'SESSION_GONE',
      });
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
    const authUserId = (req as AuthRequest).userId as string;
    const authEmail = (req as AuthRequest).userEmail;
    const body = req.body || {};

    const existing = await resolveOwnUser(authUserId, authEmail);
    if (!existing) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const userId = existing.id;

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
      updates.closeFriendIds = [...new Set(
        body.closeFriendIds.map((id: unknown) => String(id).trim()).filter(Boolean)
      )];
    }

    const user = await runWithSystem(() => updateUserProfile(existing.id, updates));
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


