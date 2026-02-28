import { Request, Response } from 'express';
import { getUserById, updateUserProfile, addHighlight, removeHighlight, addDisappearingPhoto, viewDisappearingPhoto } from '../models/user.js';
import { getActiveRelationship } from '../models/relationship.js';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { uploadImage } from '../utils/storage.js';

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

export const uploadProfilePicture = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || req.body.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { image } = req.body; // Base64 image data
    if (!image) {
      return res.status(400).json({ error: 'Image is required' });
    }

    const imageUrl = await uploadImage(image, 'profile');
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
    // GET /me → use auth userId; GET /:userId → use param
    const userId = req.params.userId === 'me' || !req.params.userId
      ? (req as any).userId
      : req.params.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized. Send Authorization: Bearer <token> for /me' });
    }

    const user = await getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Don't send password and sensitive data
    const { password, resetToken, resetTokenExpiry, ...userProfile } = user;
    
    // Ensure all required fields exist with defaults
    const profile = {
      ...userProfile,
      highlights: userProfile.highlights || [],
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

    if (req.params.userId && req.params.userId !== 'me') {
      try {
        const rel = await getActiveRelationship(userId);
        (profile as any).inRelationship = !!rel && rel.status === 'active';
      } catch (_) {
        (profile as any).inRelationship = false;
      }
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

    const { image, highlightId } = req.body; // Base64 image data, optional highlightId to add to existing
    if (!image) {
      return res.status(400).json({ error: 'Image is required' });
    }

    const imageUrl = await uploadImage(image, 'highlights');
    const highlight = await addHighlight(userId, imageUrl, highlightId);

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
      updates.profilePicture = await uploadImage(profilePicture, 'profile');
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
    if (name) updates.name = name;
    if (username) updates.username = username;

    // Check if phone number is already taken (if changing)
    if (phoneNumber) {
      const normalizedPhone = phoneNumber.replace(/\D/g, '');
      const { getUserByPhone } = await import('../models/user.js');
      const existingUser = await getUserByPhone(normalizedPhone);
      if (existingUser && existingUser.id !== userId) {
        return res.status(400).json({ error: 'Phone number already registered to another account' });
      }
      updates.phoneNumber = normalizedPhone;
    }

    if (age !== undefined) updates.age = age;
    if (bio !== undefined) updates.bio = bio;
    if (gender !== undefined) updates.gender = gender;
    if (height !== undefined) updates.height = height;
    if (education !== undefined) updates.education = education;
    if (occupation !== undefined) updates.occupation = occupation;
    if (relationshipStatus !== undefined) updates.relationshipStatus = relationshipStatus;
    // Always persist country and city when present in body (required for profile save)
    if ('country' in body) updates.country = typeof body.country === 'string' ? body.country.trim() : '';
    if ('city' in body) updates.city = typeof body.city === 'string' ? body.city.trim() : '';

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


