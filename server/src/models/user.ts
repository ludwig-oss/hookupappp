import { readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { usePostgres } from '../db/index.js';
import * as pgUsers from '../db/pg-users.js';
import { inferMediaTypeFromUrl } from '../utils/mediaType.js';
import { STORY_TTL_MS } from '../constants/socialMedia.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export type StoryAudience = 'all' | 'closeFriends';

export interface Story {
  id: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  createdAt: Date | string;
  expiresAt: Date | string;
  audience: StoryAudience;
}

export interface HighlightItem {
  id: string;
  imageUrl: string;
  mediaType?: 'image' | 'video';
  createdAt: Date | string;
}

export interface Highlight {
  id: string;
  title?: string;
  items: HighlightItem[];
  createdAt: Date | string;
  coverImage?: string; // First item's image for display
}

export interface DisappearingPhoto {
  id: string;
  imageUrl: string;
  createdAt: Date | string;
  views: Array<{
    userId: string;
    viewedAt: Date | string;
  }>;
}

export interface Location {
  lat: number;
  lon: number;
  accuracy?: number;
  updatedAt: Date | string;
}

export interface DatingProfile {
  id: string;
  type: 'casual' | 'serious' | 'friends';
  name: string;
  bio?: string;
  photos: string[];
  preferences: {
    orientation: string;
    lookingFor: string;
    ageRange: { min: number; max: number };
    maxDistance: number;
  };
  isActive: boolean;
  createdAt: Date | string;
}

export interface User {
  id: string;
  email: string;
  password: string;
  name: string;
  username: string;
  phoneNumber?: string | null;
  profilePicture: string | null;
  highlights: Highlight[];
  /** Ephemeral stories (24h); visibility controlled by `audience`. */
  stories?: Story[];
  /** User IDs who can see `closeFriends` stories (owner manages). */
  closeFriendIds?: string[];
  disappearingPhotos: DisappearingPhoto[];
  profileSetupComplete: boolean;
  improvementCategories: string[]; // Categories user wants to improve
  location?: Location | null;
  resetToken: string | null;
  resetTokenExpiry: Date | string | null;
  /** Short-lived PIN recovery quiz (survives server restarts). */
  pinRecoveryToken?: string | null;
  pinRecoveryAnswer?: string | null;
  pinRecoveryExpiry?: Date | string | null;
  emailVerified: boolean;
  emailVerificationToken: string | null;
  emailVerificationTokenExpiry: Date | string | null;
  emailVerificationCode: string | null;
  emailVerificationCodeExpiry: Date | string | null;
  blockedUsers: string[]; // User IDs that this user has blocked
  mutedUsers: string[]; // User IDs that this user has muted
  unmatchedUsers: string[]; // User IDs that this user has unmatched
  profiles?: DatingProfile[]; // Multiple dating profiles
  activeProfileId?: string; // Currently active profile
  bio?: string;
  age?: number;
  gender?: string;
  height?: string;
  interests?: string[];
  education?: string;
  occupation?: string;
  relationshipStatus?: string;
  country?: string;
  city?: string;
  passwordHint1?: string;
  passwordHint2?: string;
  passwordHint3?: string;
  /** Optional backup password hash (PIN accounts sign in with username + password via this). */
  backupPasswordHash?: string | null;
  /** Public figure / celebrity verification */
  publicFigureLevel?: 'world' | 'community' | 'country' | null;
  publicFigureProof?: string | null; // Instagram, Facebook, TikTok links (social proof)
  publicFigureIdImage?: string | null; // ID photo with sensitive info (address etc.) hidden
  publicFigureUniqueImage?: string | null; // Optional: unique verification pic (e.g. holding spoon, dog)
  publicFigureVerified?: boolean;
  publicFigureVerifiedAt?: Date | string | null;
  /** For verified celebs: user IDs who are allowed to see real name/photo (after NDA) */
  revealToUserIds?: string[];
  /** Celebrity chat: 'none' | 'after_read' | 'after_read_seconds' */
  celebChatDisappearMode?: 'none' | 'after_read' | 'after_read_seconds';
  celebChatDisappearSeconds?: number;
  /** If true, messages show only when opened (no preview) */
  celebMessagesOnlyWhenOpened?: boolean;
  /** Anti-catfish: user verified their profile photo with a selfie (look left/center/right scan). Shown as green badge. */
  photoVerifiedAt?: string | null;
  /** OAuth provider ids (Google / Facebook). */
  googleId?: string | null;
  facebookId?: string | null;

  /** Style/Problem Coach — set when admin approves guide application. */
  qualifiedCoach?: boolean;
  coachStarRating?: number;

  /** One-time login verification code (email/SMS). */
  loginCode?: string | null;
  loginCodeExpiry?: Date | string | null;

  /** Date safety: secret word triggers emergency alert during active date */
  dateSafeWord?: string | null;

  /** Outdoor walk matching: financial / life stage */
  financialTier?: 'building' | 'stable' | 'wealthy';
  lifeQuizCompleted?: boolean;
  lifeQuizGoals?: string;
  isFamousOrInfluencer?: boolean;
  profileClickCount?: number;
  profileImpressionCount?: number;
  styleScore?: number;
  outdoorWalkEnabled?: boolean;
  /** Saved home coords — nearby visibility only works within ~150m of here. */
  homeLocation?: { lat: number; lon: number } | null;
  /** Manual switch: show as nearby/online only when at home. Auto-off when user leaves home. */
  nearbyDiscoverable?: boolean;
  /** Connections buzz — visible to nearby users when location is on (default on). */
  connectionsVisible?: boolean;
  schoolHomeHour?: number;
  schoolHomeMinute?: number;
  schoolNotifyEnabled?: boolean;

  /** Enforcement: user cannot use app while suspended (ISO date). */
  suspensionUntil?: string | null;
  suspensionReason?: string | null;

  /** Enforcement: repeated "didn't meet in 7 days" strikes. */
  meetupNoShowStrikes?: number;
  meetupNoShowLastAt?: string | null;

  /** Enforcement: men's daily improvement compliance (School). */
  schoolSkipStreak?: number;
  schoolSkipLastDate?: string | null; // YYYY-MM-DD
  schoolSkipTotal?: number;
  schoolSkipExceptionLastDate?: string | null; // YYYY-MM-DD

  /** Discovery penalty if user ignores required improvement (ISO date). */
  visibilityReducedUntil?: string | null;
  visibilityReducedReason?: string | null;
}

const DB_PATH = join(__dirname, '..', 'data', 'users.json');

async function readUsers(): Promise<User[]> {
  try {
    const data = await readFile(DB_PATH, 'utf-8');
    const users = JSON.parse(data);
    // Convert dates back to Date objects
    return users.map((user: User) => ({
      ...user,
      resetTokenExpiry: user.resetTokenExpiry ? new Date(user.resetTokenExpiry) : null,
      emailVerified: user.emailVerified !== undefined ? user.emailVerified : true, // Default to true for existing users
      emailVerificationToken: user.emailVerificationToken || null,
      emailVerificationTokenExpiry: user.emailVerificationTokenExpiry ? new Date(user.emailVerificationTokenExpiry) : null,
      emailVerificationCode: user.emailVerificationCode || null,
      emailVerificationCodeExpiry: user.emailVerificationCodeExpiry ? new Date(user.emailVerificationCodeExpiry) : null,
      highlights: (user.highlights || []).map((h: any) => {
        // Backward compatibility: convert old single-image highlights to new format
        if (h.imageUrl && !h.items) {
          return {
            id: h.id,
            title: h.title || '',
            items: [{
              id: h.id + '_item',
              imageUrl: h.imageUrl,
              createdAt: h.createdAt || new Date(),
            }],
            createdAt: h.createdAt ? new Date(h.createdAt) : new Date(),
            coverImage: h.imageUrl,
          };
        }
        return {
          ...h,
          items: (h.items || []).map((item: HighlightItem) => ({
            ...item,
            createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
            mediaType: item.mediaType || inferMediaTypeFromUrl(item.imageUrl),
          })),
          createdAt: h.createdAt ? new Date(h.createdAt) : new Date(),
          coverImage: h.coverImage || (h.items && h.items[0]?.imageUrl) || null,
        };
      }),
      stories: (user.stories || []).map((s: Story) => ({
        ...s,
        createdAt: s.createdAt ? new Date(s.createdAt) : new Date(),
        expiresAt: s.expiresAt ? new Date(s.expiresAt) : new Date(),
        mediaType: s.mediaType || inferMediaTypeFromUrl(s.mediaUrl),
      })),
      closeFriendIds: user.closeFriendIds || [],
      disappearingPhotos: (user.disappearingPhotos || []).map((photo: DisappearingPhoto) => ({
        ...photo,
        createdAt: photo.createdAt ? new Date(photo.createdAt) : new Date(),
        views: (photo.views || []).map((v: any) => ({
          ...v,
          viewedAt: v.viewedAt ? new Date(v.viewedAt) : new Date(),
        })),
      })),
      location: user.location
        ? {
            ...user.location,
            updatedAt: user.location.updatedAt ? new Date(user.location.updatedAt) : new Date(),
          }
        : null,
      blockedUsers: user.blockedUsers || [],
      mutedUsers: user.mutedUsers || [],
      unmatchedUsers: user.unmatchedUsers || [],
      profiles: (user.profiles || []).map((p: DatingProfile) => ({
        ...p,
        createdAt: p.createdAt ? new Date(p.createdAt) : new Date(),
      })),

      // Enforcement defaults
      suspensionUntil: (user as any).suspensionUntil ?? null,
      suspensionReason: (user as any).suspensionReason ?? null,
      meetupNoShowStrikes: typeof (user as any).meetupNoShowStrikes === 'number' ? (user as any).meetupNoShowStrikes : 0,
      meetupNoShowLastAt: (user as any).meetupNoShowLastAt ?? null,
      schoolSkipStreak: typeof (user as any).schoolSkipStreak === 'number' ? (user as any).schoolSkipStreak : 0,
      schoolSkipLastDate: (user as any).schoolSkipLastDate ?? null,
      schoolSkipTotal: typeof (user as any).schoolSkipTotal === 'number' ? (user as any).schoolSkipTotal : 0,
      schoolSkipExceptionLastDate: (user as any).schoolSkipExceptionLastDate ?? null,
      visibilityReducedUntil: (user as any).visibilityReducedUntil ?? null,
      visibilityReducedReason: (user as any).visibilityReducedReason ?? null,
    }));
  } catch (error) {
    return [];
  }
}

async function writeUsers(users: User[]): Promise<void> {
  const dir = join(__dirname, '..', 'data');
  const { mkdir } = await import('fs/promises');
  await mkdir(dir, { recursive: true });
  await writeFile(DB_PATH, JSON.stringify(users, null, 2), 'utf-8');
}

export async function createUser(userData: Omit<User, 'id' | 'resetToken' | 'resetTokenExpiry' | 'profilePicture' | 'highlights' | 'disappearingPhotos' | 'profileSetupComplete' | 'improvementCategories' | 'blockedUsers' | 'mutedUsers' | 'unmatchedUsers' | 'profiles' | 'activeProfileId' | 'emailVerified' | 'emailVerificationToken' | 'emailVerificationTokenExpiry' | 'emailVerificationCode' | 'emailVerificationCodeExpiry' | 'phoneNumber'> & { improvementCategories?: string[]; passwordHint1?: string; passwordHint2?: string; passwordHint3?: string }): Promise<User> {
  if (usePostgres()) return pgUsers.createUser(userData);
  const users = await readUsers();
  const user: User = {
    ...userData,
    id: Date.now().toString(),
    resetToken: null,
    resetTokenExpiry: null,
    profilePicture: null,
    highlights: [],
    disappearingPhotos: [],
    profileSetupComplete: false,
    improvementCategories: (userData as { improvementCategories?: string[] }).improvementCategories || [],
    location: null,
    blockedUsers: [],
    mutedUsers: [],
    unmatchedUsers: [],
    profiles: [],
    stories: [],
    closeFriendIds: [],
    emailVerified: true,
    emailVerificationToken: null,
    emailVerificationTokenExpiry: null,
    emailVerificationCode: null,
    emailVerificationCodeExpiry: null,
    phoneNumber: null,
    passwordHint1: userData.passwordHint1 || '',
    passwordHint2: userData.passwordHint2 || '',
    passwordHint3: userData.passwordHint3 || '',

    // Enforcement defaults
    suspensionUntil: null,
    suspensionReason: null,
    meetupNoShowStrikes: 0,
    meetupNoShowLastAt: null,
    schoolSkipStreak: 0,
    schoolSkipLastDate: null,
    schoolSkipTotal: 0,
    schoolSkipExceptionLastDate: null,
    visibilityReducedUntil: null,
    visibilityReducedReason: null,
  };
  users.push(user);
  await writeUsers(users);
  return user;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  if (usePostgres()) return pgUsers.getUserByEmail(email);
  const users = await readUsers();
  return users.find(u => u.email === email) || null;
}

export async function getUserByUsername(username: string): Promise<User | null> {
  if (usePostgres()) return pgUsers.getUserByUsername(username);
  const users = await readUsers();
  return users.find(u => u.username === username) || null;
}

export async function getUserByPhone(phoneNumber: string): Promise<User | null> {
  if (usePostgres()) return pgUsers.getUserByPhone(phoneNumber);
  const users = await readUsers();
  const normalizedSearch = phoneNumber.replace(/\D/g, '');
  if (!normalizedSearch) return null;
  const exact = users.find((u) => {
    if (!u.phoneNumber) return false;
    return u.phoneNumber.replace(/\D/g, '') === normalizedSearch;
  });
  if (exact) return exact;
  // Allow match on last 10 digits (country-code differences)
  if (normalizedSearch.length >= 10) {
    const tail = normalizedSearch.slice(-10);
    return (
      users.find((u) => {
        if (!u.phoneNumber) return false;
        const n = u.phoneNumber.replace(/\D/g, '');
        return n.slice(-10) === tail;
      }) || null
    );
  }
  return null;
}

export async function getUserById(userId: string): Promise<User | null> {
  if (usePostgres()) return pgUsers.getUserById(userId);
  const users = await readUsers();
  return users.find(u => u.id === userId) || null;
}

export async function updateUserProfile(userId: string, updates: Partial<User>): Promise<User | null> {
  if (usePostgres()) return pgUsers.updateUserProfile(userId, updates);
  const users = await readUsers();
  const userIndex = users.findIndex(u => u.id === userId);
  if (userIndex !== -1) {
    const next = { ...users[userIndex], ...updates };
    if (updates.country !== undefined) next.country = updates.country;
    if (updates.city !== undefined) next.city = updates.city;
    users[userIndex] = next;
    await writeUsers(users);
    return users[userIndex];
  }
  return null;
}

export async function updateUserLocation(
  userId: string,
  location: { lat: number; lon: number; accuracy?: number }
): Promise<User | null> {
  return updateUserProfile(userId, {
    location: {
      lat: location.lat,
      lon: location.lon,
      accuracy: location.accuracy,
      updatedAt: new Date(),
    },
  });
}

export async function addHighlight(
  userId: string,
  imageUrl: string,
  highlightId?: string,
  mediaType?: 'image' | 'video'
): Promise<Highlight | null> {
  if (usePostgres()) return pgUsers.addHighlight(userId, imageUrl, highlightId, mediaType);
  const mt = mediaType || inferMediaTypeFromUrl(imageUrl);
  const users = await readUsers();
  const userIndex = users.findIndex(u => u.id === userId);
  if (userIndex !== -1) {
    users[userIndex].highlights = users[userIndex].highlights || [];
    
    // If highlightId provided, add item to existing highlight
    if (highlightId) {
      const highlightIndex = users[userIndex].highlights.findIndex(h => h.id === highlightId);
      if (highlightIndex !== -1) {
        const newItem: HighlightItem = {
          id: Date.now().toString(),
          imageUrl,
          mediaType: mt,
          createdAt: new Date(),
        };
        users[userIndex].highlights[highlightIndex].items.push(newItem);
        // Update cover image if this is the first item
        if (!users[userIndex].highlights[highlightIndex].coverImage) {
          users[userIndex].highlights[highlightIndex].coverImage = imageUrl;
        }
        await writeUsers(users);
        return users[userIndex].highlights[highlightIndex];
      }
    }
    
    // Create new highlight with first item
    const highlight: Highlight = {
      id: Date.now().toString(),
      title: '',
      items: [{
        id: Date.now().toString() + '_item',
        imageUrl,
        mediaType: mt,
        createdAt: new Date(),
      }],
      createdAt: new Date(),
      coverImage: imageUrl,
    };
    users[userIndex].highlights.push(highlight);
    await writeUsers(users);
    return highlight;
  }
  return null;
}

export async function pruneExpiredStories(userId: string): Promise<void> {
  if (usePostgres()) return pgUsers.pruneExpiredStories(userId);
  const users = await readUsers();
  const userIndex = users.findIndex(u => u.id === userId);
  if (userIndex === -1) return;
  const list = users[userIndex].stories || [];
  const now = Date.now();
  const kept = list.filter(s => new Date(s.expiresAt).getTime() > now);
  if (kept.length !== list.length) {
    users[userIndex].stories = kept;
    await writeUsers(users);
  }
}

export async function addStory(
  userId: string,
  mediaUrl: string,
  mediaType: 'image' | 'video',
  audience: StoryAudience
): Promise<Story | null> {
  if (usePostgres()) return pgUsers.addStory(userId, mediaUrl, mediaType, audience);
  await pruneExpiredStories(userId);
  const users = await readUsers();
  const idx = users.findIndex(u => u.id === userId);
  if (idx === -1) return null;
  const story: Story = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    mediaUrl,
    mediaType,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + STORY_TTL_MS),
    audience,
  };
  users[idx].stories = [...(users[idx].stories || []), story];
  await writeUsers(users);
  return story;
}

export async function removeStory(userId: string, storyId: string): Promise<boolean> {
  if (usePostgres()) return pgUsers.removeStory(userId, storyId);
  const users = await readUsers();
  const userIndex = users.findIndex(u => u.id === userId);
  if (userIndex === -1) return false;
  const list = users[userIndex].stories || [];
  const next = list.filter(s => s.id !== storyId);
  if (next.length === list.length) return false;
  users[userIndex].stories = next;
  await writeUsers(users);
  return true;
}

export async function reorderHighlights(userId: string, orderedIds: string[]): Promise<boolean> {
  if (usePostgres()) return pgUsers.reorderHighlights(userId, orderedIds);
  const users = await readUsers();
  const userIndex = users.findIndex(u => u.id === userId);
  if (userIndex === -1) return false;
  const highlights = users[userIndex].highlights || [];
  const map = new Map(highlights.map(h => [h.id, h]));
  const ordered = orderedIds.map(id => map.get(id)).filter(Boolean) as Highlight[];
  const missing = highlights.filter(h => !orderedIds.includes(h.id));
  users[userIndex].highlights = [...ordered, ...missing];
  await writeUsers(users);
  return true;
}

export async function removeHighlight(userId: string, highlightId: string, itemId?: string): Promise<boolean> {
  if (usePostgres()) return pgUsers.removeHighlight(userId, highlightId, itemId);
  const users = await readUsers();
  const userIndex = users.findIndex(u => u.id === userId);
  if (userIndex !== -1) {
    const highlightIndex = users[userIndex].highlights.findIndex(h => h.id === highlightId);
    if (highlightIndex !== -1) {
      // If itemId provided, remove specific item from highlight
      if (itemId) {
        users[userIndex].highlights[highlightIndex].items = users[userIndex].highlights[highlightIndex].items.filter(
          (item: HighlightItem) => item.id !== itemId
        );
        // Update cover image if items remain
        if (users[userIndex].highlights[highlightIndex].items.length > 0) {
          users[userIndex].highlights[highlightIndex].coverImage = users[userIndex].highlights[highlightIndex].items[0].imageUrl;
        } else {
          // Remove highlight if no items left
          users[userIndex].highlights.splice(highlightIndex, 1);
        }
      } else {
        // Remove entire highlight
        users[userIndex].highlights.splice(highlightIndex, 1);
      }
      await writeUsers(users);
      return true;
    }
  }
  return false;
}

export async function addDisappearingPhoto(userId: string, imageUrl: string): Promise<DisappearingPhoto | null> {
  if (usePostgres()) return pgUsers.addDisappearingPhoto(userId, imageUrl);
  const users = await readUsers();
  const userIndex = users.findIndex(u => u.id === userId);
  if (userIndex !== -1) {
    const photo: DisappearingPhoto = {
      id: Date.now().toString(),
      imageUrl,
      createdAt: new Date(),
      views: [],
    };
    users[userIndex].disappearingPhotos = users[userIndex].disappearingPhotos || [];
    users[userIndex].disappearingPhotos.push(photo);
    await writeUsers(users);
    return photo;
  }
  return null;
}

export async function viewDisappearingPhoto(photoId: string, viewerId: string, ownerId: string): Promise<{ canView: boolean; imageUrl: string | null }> {
  if (usePostgres()) return pgUsers.viewDisappearingPhoto(photoId, viewerId, ownerId);
  const users = await readUsers();
  const owner = users.find(u => u.id === ownerId);
  if (!owner) {
    return { canView: false, imageUrl: null };
  }

  const photo = owner.disappearingPhotos?.find(p => p.id === photoId);
  if (!photo) {
    return { canView: false, imageUrl: null };
  }

  // Check if viewer has already viewed this photo twice
  const viewCount = photo.views?.filter(v => v.userId === viewerId).length || 0;
  if (viewCount >= 2) {
    return { canView: false, imageUrl: null };
  }

  // Add view
  const userIndex = users.findIndex(u => u.id === ownerId);
  if (userIndex !== -1) {
    if (!users[userIndex].disappearingPhotos) {
      users[userIndex].disappearingPhotos = [];
    }
    const photoIndex = users[userIndex].disappearingPhotos.findIndex(p => p.id === photoId);
    if (photoIndex !== -1) {
      if (!users[userIndex].disappearingPhotos[photoIndex].views) {
        users[userIndex].disappearingPhotos[photoIndex].views = [];
      }
      users[userIndex].disappearingPhotos[photoIndex].views.push({
        userId: viewerId,
        viewedAt: new Date(),
      });
      await writeUsers(users);
    }
  }

  return { canView: true, imageUrl: photo.imageUrl };
}

export async function getAllUsers(): Promise<Omit<User, 'password' | 'resetToken' | 'resetTokenExpiry'>[]> {
  if (usePostgres()) return pgUsers.getAllUsers();
  const users = await readUsers();
  return users.map(({ password, resetToken, resetTokenExpiry, ...user }) => user);
}

export async function getUserByResetToken(token: string): Promise<User | null> {
  if (usePostgres()) return pgUsers.getUserByResetToken(token);
  const users = await readUsers();
  return users.find(u => u.resetToken === token) || null;
}

export async function updateUserPassword(userId: string, hashedPassword: string): Promise<void> {
  if (usePostgres()) return pgUsers.updateUserPassword(userId, hashedPassword);
  const users = await readUsers();
  const userIndex = users.findIndex(u => u.id === userId);
  if (userIndex !== -1) {
    users[userIndex].password = hashedPassword;
    await writeUsers(users);
  }
}

export async function updateUserResetToken(
  userId: string,
  resetToken: string | null,
  resetTokenExpiry: Date | null
): Promise<void> {
  if (usePostgres()) return pgUsers.updateUserResetToken(userId, resetToken, resetTokenExpiry);
  const users = await readUsers();
  const userIndex = users.findIndex(u => u.id === userId);
  if (userIndex !== -1) {
    users[userIndex].resetToken = resetToken;
    users[userIndex].resetTokenExpiry = resetTokenExpiry;
    await writeUsers(users);
  }
}

export async function getUserByEmailVerificationToken(token: string): Promise<User | null> {
  if (usePostgres()) return pgUsers.getUserByEmailVerificationToken(token);
  const users = await readUsers();
  return users.find(u => u.emailVerificationToken === token) || null;
}

export async function updateEmailVerificationToken(userId: string, token: string | null, expiry: Date | null): Promise<void> {
  if (usePostgres()) return pgUsers.updateEmailVerificationToken(userId, token, expiry);
  const users = await readUsers();
  const userIndex = users.findIndex(u => u.id === userId);
  if (userIndex !== -1) {
    users[userIndex].emailVerificationToken = token;
    users[userIndex].emailVerificationTokenExpiry = expiry;
    await writeUsers(users);
  }
}

export async function verifyUserEmail(userId: string): Promise<void> {
  if (usePostgres()) return pgUsers.verifyUserEmail(userId);
  const users = await readUsers();
  const userIndex = users.findIndex(u => u.id === userId);
  if (userIndex !== -1) {
    users[userIndex].emailVerified = true;
    users[userIndex].emailVerificationToken = null;
    users[userIndex].emailVerificationTokenExpiry = null;
    users[userIndex].emailVerificationCode = null;
    users[userIndex].emailVerificationCodeExpiry = null;
    await writeUsers(users);
  }
}

export async function getUserByEmailVerificationCode(code: string): Promise<User | null> {
  if (usePostgres()) return pgUsers.getUserByEmailVerificationCode(code);
  const users = await readUsers();
  return users.find(u => u.emailVerificationCode === code) || null;
}

export async function updateEmailVerificationCode(userId: string, code: string | null, expiry: Date | null): Promise<void> {
  if (usePostgres()) return pgUsers.updateEmailVerificationCode(userId, code, expiry);
  const users = await readUsers();
  const userIndex = users.findIndex(u => u.id === userId);
  if (userIndex !== -1) {
    users[userIndex].emailVerificationCode = code;
    users[userIndex].emailVerificationCodeExpiry = expiry;
    await writeUsers(users);
  }
}

export async function getUserByLoginCode(code: string): Promise<User | null> {
  if (usePostgres()) return pgUsers.getUserByLoginCode(code);
  const users = await readUsers();
  return users.find(u => u.loginCode === code) || null;
}

export async function updateLoginCode(userId: string, code: string | null, expiry: Date | null): Promise<void> {
  if (usePostgres()) return pgUsers.updateLoginCode(userId, code, expiry);
  const users = await readUsers();
  const userIndex = users.findIndex(u => u.id === userId);
  if (userIndex !== -1) {
    users[userIndex].loginCode = code;
    users[userIndex].loginCodeExpiry = expiry;
    await writeUsers(users);
  }
}

export async function blockUser(userId: string, blockedUserId: string): Promise<boolean> {
  if (usePostgres()) return pgUsers.blockUser(userId, blockedUserId);
  const users = await readUsers();
  const userIndex = users.findIndex(u => u.id === userId);
  if (userIndex !== -1) {
    if (!users[userIndex].blockedUsers) {
      users[userIndex].blockedUsers = [];
    }
    if (!users[userIndex].blockedUsers.includes(blockedUserId)) {
      users[userIndex].blockedUsers.push(blockedUserId);
    }
    await writeUsers(users);
    return true;
  }
  return false;
}

export async function unblockUser(userId: string, blockedUserId: string): Promise<boolean> {
  if (usePostgres()) return pgUsers.unblockUser(userId, blockedUserId);
  const users = await readUsers();
  const userIndex = users.findIndex(u => u.id === userId);
  if (userIndex !== -1) {
    users[userIndex].blockedUsers = (users[userIndex].blockedUsers || []).filter(id => id !== blockedUserId);
    await writeUsers(users);
    return true;
  }
  return false;
}

export async function muteUser(userId: string, mutedUserId: string): Promise<boolean> {
  if (usePostgres()) return pgUsers.muteUser(userId, mutedUserId);
  const users = await readUsers();
  const userIndex = users.findIndex(u => u.id === userId);
  if (userIndex !== -1) {
    if (!users[userIndex].mutedUsers) {
      users[userIndex].mutedUsers = [];
    }
    if (!users[userIndex].mutedUsers.includes(mutedUserId)) {
      users[userIndex].mutedUsers.push(mutedUserId);
    }
    await writeUsers(users);
    return true;
  }
  return false;
}

export async function unmuteUser(userId: string, mutedUserId: string): Promise<boolean> {
  if (usePostgres()) return pgUsers.unmuteUser(userId, mutedUserId);
  const users = await readUsers();
  const userIndex = users.findIndex(u => u.id === userId);
  if (userIndex !== -1) {
    users[userIndex].mutedUsers = (users[userIndex].mutedUsers || []).filter(id => id !== mutedUserId);
    await writeUsers(users);
    return true;
  }
  return false;
}

export async function unmatchUser(userId: string, unmatchedUserId: string): Promise<boolean> {
  if (usePostgres()) return pgUsers.unmatchUser(userId, unmatchedUserId);
  const users = await readUsers();
  const userIndex = users.findIndex(u => u.id === userId);
  if (userIndex !== -1) {
    if (!users[userIndex].unmatchedUsers) {
      users[userIndex].unmatchedUsers = [];
    }
    if (!users[userIndex].unmatchedUsers.includes(unmatchedUserId)) {
      users[userIndex].unmatchedUsers.push(unmatchedUserId);
    }
    await writeUsers(users);
    return true;
  }
  return false;
}

