import { query, usePostgres } from './index.js';
import type { User, Highlight, HighlightItem, DisappearingPhoto, DatingProfile, Story, StoryAudience } from '../models/user.js';
import { STORY_TTL_MS } from '../constants/socialMedia.js';
import { inferMediaTypeFromUrl } from '../utils/mediaType.js';

const USER_COLS = 'id, email, password, name, username, data';

function rowToUser(row: { id: string; email: string; password: string; name: string; username: string; data: unknown }): User {
  const data = (row.data as Record<string, unknown>) || {};
  const parseDate = (v: unknown): Date | string | null => v == null ? null : typeof v === 'string' ? new Date(v) : (v as Date);
  return {
    id: row.id,
    email: row.email,
    password: row.password,
    name: row.name,
    username: row.username,
    phoneNumber: (data.phoneNumber as string) ?? null,
    profilePicture: (data.profilePicture as string) ?? null,
    profileSetupComplete: Boolean(data.profileSetupComplete),
    improvementCategories: Array.isArray(data.improvementCategories) ? data.improvementCategories : [],
    resetToken: (data.resetToken as string) ?? null,
    resetTokenExpiry: parseDate(data.resetTokenExpiry) as Date | string | null,
    emailVerified: data.emailVerified !== undefined ? Boolean(data.emailVerified) : true,
    emailVerificationToken: (data.emailVerificationToken as string) ?? null,
    emailVerificationTokenExpiry: parseDate(data.emailVerificationTokenExpiry) as Date | string | null,
    emailVerificationCode: (data.emailVerificationCode as string) ?? null,
    emailVerificationCodeExpiry: parseDate(data.emailVerificationCodeExpiry) as Date | string | null,
    blockedUsers: Array.isArray(data.blockedUsers) ? data.blockedUsers : [],
    mutedUsers: Array.isArray(data.mutedUsers) ? data.mutedUsers : [],
    unmatchedUsers: Array.isArray(data.unmatchedUsers) ? data.unmatchedUsers : [],
    highlights: ((data.highlights as unknown[]) || []).map((h: any) => ({
      ...h,
      items: (h.items || []).map((item: HighlightItem) => ({
        ...item,
        createdAt: item.createdAt ? new Date(item.createdAt as string) : new Date(),
        mediaType: item.mediaType || inferMediaTypeFromUrl(item.imageUrl),
      })),
      createdAt: h.createdAt ? new Date(h.createdAt) : new Date(),
      coverImage: h.coverImage || (h.items?.[0]?.imageUrl) || null,
    })),
    stories: ((data.stories as unknown[]) || []).map((raw: unknown) => {
      const s = raw as Story;
      return {
        ...s,
        createdAt: s.createdAt ? new Date(s.createdAt as string) : new Date(),
        expiresAt: s.expiresAt ? new Date(s.expiresAt as string) : new Date(),
        mediaType: s.mediaType || inferMediaTypeFromUrl(s.mediaUrl),
      };
    }),
    closeFriendIds: Array.isArray(data.closeFriendIds) ? data.closeFriendIds : [],
    disappearingPhotos: ((data.disappearingPhotos as unknown[]) || []).map((p: any) => ({
      ...p,
      createdAt: p.createdAt ? new Date(p.createdAt) : new Date(),
      views: (p.views || []).map((v: any) => ({ ...v, viewedAt: v.viewedAt ? new Date(v.viewedAt) : new Date() })),
    })),
    location: data.location
      ? { ...(data.location as object), updatedAt: (data.location as any).updatedAt ? new Date((data.location as any).updatedAt) : new Date() }
      : null,
    profiles: ((data.profiles as unknown[]) || []).map((p: any) => ({ ...p, createdAt: p.createdAt ? new Date(p.createdAt) : new Date() })),
    activeProfileId: (data.activeProfileId as string) ?? undefined,
    bio: (data.bio as string) ?? undefined,
    age: (data.age as number) ?? undefined,
    gender: (data.gender as string) ?? undefined,
    height: (data.height as string) ?? undefined,
    interests: Array.isArray(data.interests) ? data.interests : undefined,
    education: (data.education as string) ?? undefined,
    occupation: (data.occupation as string) ?? undefined,
    relationshipStatus: (data.relationshipStatus as string) ?? undefined,
    country: (data.country as string) ?? undefined,
    city: (data.city as string) ?? undefined,
    passwordHint1: (data.passwordHint1 as string) ?? undefined,
    passwordHint2: (data.passwordHint2 as string) ?? undefined,
    passwordHint3: (data.passwordHint3 as string) ?? undefined,
    backupPasswordHash: (data.backupPasswordHash as string) ?? null,
    publicFigureLevel: (data.publicFigureLevel as User['publicFigureLevel']) ?? null,
    publicFigureProof: (data.publicFigureProof as string) ?? null,
    publicFigureIdImage: (data.publicFigureIdImage as string) ?? null,
    publicFigureUniqueImage: (data.publicFigureUniqueImage as string) ?? null,
    publicFigureVerified: (data.publicFigureVerified as boolean) ?? undefined,
    publicFigureVerifiedAt: parseDate(data.publicFigureVerifiedAt) as Date | string | null | undefined,
    revealToUserIds: Array.isArray(data.revealToUserIds) ? data.revealToUserIds : undefined,
    celebChatDisappearMode: (data.celebChatDisappearMode as User['celebChatDisappearMode']) ?? undefined,
    celebChatDisappearSeconds: (data.celebChatDisappearSeconds as number) ?? undefined,
    celebMessagesOnlyWhenOpened: (data.celebMessagesOnlyWhenOpened as boolean) ?? undefined,
    photoVerifiedAt: (data.photoVerifiedAt as string) ?? null,
    financialTier: (data.financialTier as User['financialTier']) ?? undefined,
    lifeQuizCompleted: (data.lifeQuizCompleted as boolean) ?? undefined,
    lifeQuizGoals: (data.lifeQuizGoals as string) ?? undefined,
    isFamousOrInfluencer: (data.isFamousOrInfluencer as boolean) ?? undefined,
    profileClickCount: (data.profileClickCount as number) ?? undefined,
    profileImpressionCount: (data.profileImpressionCount as number) ?? undefined,
    styleScore: (data.styleScore as number) ?? undefined,
    outdoorWalkEnabled: (data.outdoorWalkEnabled as boolean) ?? undefined,
    homeLocation: (data.homeLocation as User['homeLocation']) ?? undefined,
    nearbyDiscoverable: (data.nearbyDiscoverable as boolean) ?? undefined,
    connectionsVisible: data.connectionsVisible !== undefined ? Boolean(data.connectionsVisible) : undefined,
    schoolHomeHour: (data.schoolHomeHour as number) ?? undefined,
    schoolHomeMinute: (data.schoolHomeMinute as number) ?? undefined,
    schoolNotifyEnabled: (data.schoolNotifyEnabled as boolean) ?? undefined,
    googleId: (data.googleId as string) ?? null,
    facebookId: (data.facebookId as string) ?? null,
    qualifiedCoach: Boolean(data.qualifiedCoach),
    coachStarRating: typeof data.coachStarRating === 'number' ? data.coachStarRating : undefined,
    loginCode: (data.loginCode as string) ?? null,
    loginCodeExpiry: parseDate(data.loginCodeExpiry) as Date | string | null,

    // Enforcement
    suspensionUntil: (data.suspensionUntil as string) ?? null,
    suspensionReason: (data.suspensionReason as string) ?? null,
    meetupNoShowStrikes: (data.meetupNoShowStrikes as number) ?? 0,
    meetupNoShowLastAt: (data.meetupNoShowLastAt as string) ?? null,
    schoolSkipStreak: (data.schoolSkipStreak as number) ?? 0,
    schoolSkipLastDate: (data.schoolSkipLastDate as string) ?? null,
    schoolSkipTotal: (data.schoolSkipTotal as number) ?? 0,
    schoolSkipExceptionLastDate: (data.schoolSkipExceptionLastDate as string) ?? null,
    visibilityReducedUntil: (data.visibilityReducedUntil as string) ?? null,
    visibilityReducedReason: (data.visibilityReducedReason as string) ?? null,
  } as User;
}

function userToData(u: Partial<User>): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  const keys = ['phoneNumber', 'profilePicture', 'profileSetupComplete', 'improvementCategories', 'resetToken', 'resetTokenExpiry',
    'emailVerified', 'emailVerificationToken', 'emailVerificationTokenExpiry', 'emailVerificationCode', 'emailVerificationCodeExpiry',
    'blockedUsers', 'mutedUsers', 'unmatchedUsers', 'highlights', 'stories', 'closeFriendIds', 'disappearingPhotos', 'location', 'profiles', 'activeProfileId',
    'bio', 'age', 'gender', 'height', 'interests', 'education', 'occupation', 'relationshipStatus', 'country', 'city',
    'passwordHint1', 'passwordHint2', 'passwordHint3', 'backupPasswordHash', 'publicFigureLevel', 'publicFigureProof', 'publicFigureIdImage',
    'publicFigureUniqueImage', 'publicFigureVerified', 'publicFigureVerifiedAt', 'revealToUserIds', 'celebChatDisappearMode',
    'celebChatDisappearSeconds', 'celebMessagesOnlyWhenOpened', 'photoVerifiedAt',
    'financialTier', 'lifeQuizCompleted', 'lifeQuizGoals', 'isFamousOrInfluencer',
    'profileClickCount', 'profileImpressionCount', 'styleScore', 'outdoorWalkEnabled',
    'homeLocation', 'nearbyDiscoverable', 'connectionsVisible',
    'schoolHomeHour', 'schoolHomeMinute', 'schoolNotifyEnabled',
    'suspensionUntil', 'suspensionReason',
    'meetupNoShowStrikes', 'meetupNoShowLastAt',
    'schoolSkipStreak', 'schoolSkipLastDate', 'schoolSkipTotal', 'schoolSkipExceptionLastDate',
    'visibilityReducedUntil', 'visibilityReducedReason',
    'googleId', 'facebookId',
    'qualifiedCoach', 'coachStarRating', 'loginCode', 'loginCodeExpiry'] as const;
  for (const k of keys) {
    if ((u as any)[k] !== undefined) data[k] = (u as any)[k];
  }
  return data;
}

export async function createUser(
  userData: Omit<
    User,
    | 'id'
    | 'resetToken'
    | 'resetTokenExpiry'
    | 'profilePicture'
    | 'highlights'
    | 'disappearingPhotos'
    | 'profileSetupComplete'
    | 'improvementCategories'
    | 'blockedUsers'
    | 'mutedUsers'
    | 'unmatchedUsers'
    | 'profiles'
    | 'activeProfileId'
    | 'emailVerified'
    | 'emailVerificationToken'
    | 'emailVerificationTokenExpiry'
    | 'emailVerificationCode'
    | 'emailVerificationCodeExpiry'
    | 'phoneNumber'
  > & {
    improvementCategories?: string[];
    passwordHint1?: string;
    passwordHint2?: string;
    passwordHint3?: string;
    phoneNumber?: string | null;
  }
): Promise<User> {
  const id = Date.now().toString();
  const data = userToData({
    ...userData,
    profilePicture: null,
    highlights: [],
    disappearingPhotos: [],
    profileSetupComplete: false,
    improvementCategories: userData.improvementCategories || [],
    location: null,
    blockedUsers: [],
    mutedUsers: [],
    unmatchedUsers: [],
    profiles: [],
    stories: [],
    closeFriendIds: [],
    emailVerified: false,
    emailVerificationToken: null,
    emailVerificationTokenExpiry: null,
    emailVerificationCode: null,
    emailVerificationCodeExpiry: null,
    phoneNumber: userData.phoneNumber ?? null,
    passwordHint1: userData.passwordHint1,
    passwordHint2: userData.passwordHint2,
    passwordHint3: userData.passwordHint3,
  });
  await query(
    'INSERT INTO users (id, email, password, name, username, data) VALUES ($1, $2, $3, $4, $5, $6)',
    [id, userData.email, userData.password, userData.name, userData.username, JSON.stringify(data)]
  );
  const user = await getUserById(id);
  if (!user) throw new Error('User not found after insert');
  return user;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const res = await query<{ id: string; email: string; password: string; name: string; username: string; data: unknown }>(
    `SELECT ${USER_COLS} FROM users WHERE email = $1`,
    [email]
  );
  return res.rows[0] ? rowToUser(res.rows[0]) : null;
}

export async function getUserByUsername(username: string): Promise<User | null> {
  const res = await query<{ id: string; email: string; password: string; name: string; username: string; data: unknown }>(
    `SELECT ${USER_COLS} FROM users WHERE username = $1`,
    [username]
  );
  return res.rows[0] ? rowToUser(res.rows[0]) : null;
}

export async function getUserByPhone(phoneNumber: string): Promise<User | null> {
  const normalized = phoneNumber.replace(/\D/g, '');
  if (!normalized) return null;
  let res = await query<{ id: string; email: string; password: string; name: string; username: string; data: unknown }>(
    `SELECT ${USER_COLS} FROM users WHERE data->>'phoneNumber' IS NOT NULL AND regexp_replace(data->>'phoneNumber', '\\D', '', 'g') = $1`,
    [normalized]
  );
  if (res.rows[0]) return rowToUser(res.rows[0]);
  if (normalized.length >= 10) {
    const tail = normalized.slice(-10);
    res = await query<{ id: string; email: string; password: string; name: string; username: string; data: unknown }>(
      `SELECT ${USER_COLS} FROM users WHERE data->>'phoneNumber' IS NOT NULL AND right(regexp_replace(data->>'phoneNumber', '\\D', '', 'g'), 10) = $1 LIMIT 1`,
      [tail]
    );
    if (res.rows[0]) return rowToUser(res.rows[0]);
  }
  return null;
}

export async function getUserById(userId: string): Promise<User | null> {
  const res = await query<{ id: string; email: string; password: string; name: string; username: string; data: unknown }>(
    `SELECT ${USER_COLS} FROM users WHERE id = $1`,
    [userId]
  );
  return res.rows[0] ? rowToUser(res.rows[0]) : null;
}

export async function updateUserProfile(userId: string, updates: Partial<User>): Promise<User | null> {
  const u = await getUserById(userId);
  if (!u) return null;
  const { id, email, password, name, username, ...rest } = { ...u, ...updates };
  const data = userToData(rest);
  await query('UPDATE users SET name = $1, username = $2, data = $3 WHERE id = $4', [name, username, JSON.stringify(data), userId]);
  return getUserById(userId);
}

export async function updateUserLocation(userId: string, location: { lat: number; lon: number; accuracy?: number }): Promise<User | null> {
  return updateUserProfile(userId, {
    location: { lat: location.lat, lon: location.lon, accuracy: location.accuracy, updatedAt: new Date() },
  });
}

export async function addHighlight(
  userId: string,
  imageUrl: string,
  highlightId?: string,
  mediaType?: 'image' | 'video'
): Promise<Highlight | null> {
  const u = await getUserById(userId);
  if (!u) return null;
  const mt = mediaType || inferMediaTypeFromUrl(imageUrl);
  const highlights = [...(u.highlights || [])];
  if (highlightId) {
    const hi = highlights.findIndex(h => h.id === highlightId);
    if (hi !== -1) {
      const newItem: HighlightItem = { id: Date.now().toString(), imageUrl, mediaType: mt, createdAt: new Date() };
      highlights[hi].items = [...highlights[hi].items, newItem];
      if (!highlights[hi].coverImage) highlights[hi].coverImage = imageUrl;
      await updateUserProfile(userId, { highlights });
      return highlights[hi];
    }
  }
  const highlight: Highlight = {
    id: Date.now().toString(),
    title: '',
    items: [{ id: Date.now().toString() + '_item', imageUrl, mediaType: mt, createdAt: new Date() }],
    createdAt: new Date(),
    coverImage: imageUrl,
  };
  highlights.push(highlight);
  await updateUserProfile(userId, { highlights });
  return highlight;
}

export async function pruneExpiredStories(userId: string): Promise<void> {
  const u = await getUserById(userId);
  if (!u) return;
  const list = u.stories || [];
  const now = Date.now();
  const kept = list.filter(s => new Date(s.expiresAt).getTime() > now);
  if (kept.length !== list.length) {
    await updateUserProfile(userId, { stories: kept });
  }
}

export async function addStory(
  userId: string,
  mediaUrl: string,
  mediaType: 'image' | 'video',
  audience: StoryAudience
): Promise<Story | null> {
  await pruneExpiredStories(userId);
  const u = await getUserById(userId);
  if (!u) return null;
  const story: Story = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    mediaUrl,
    mediaType,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + STORY_TTL_MS),
    audience,
  };
  await updateUserProfile(userId, { stories: [...(u.stories || []), story] });
  return story;
}

export async function removeStory(userId: string, storyId: string): Promise<boolean> {
  const u = await getUserById(userId);
  if (!u) return false;
  const list = u.stories || [];
  const next = list.filter(s => s.id !== storyId);
  if (next.length === list.length) return false;
  await updateUserProfile(userId, { stories: next });
  return true;
}

export async function reorderHighlights(userId: string, orderedIds: string[]): Promise<boolean> {
  const u = await getUserById(userId);
  if (!u) return false;
  const highlights = u.highlights || [];
  const map = new Map(highlights.map(h => [h.id, h]));
  const ordered = orderedIds.map(id => map.get(id)).filter(Boolean) as Highlight[];
  const missing = highlights.filter(h => !orderedIds.includes(h.id));
  await updateUserProfile(userId, { highlights: [...ordered, ...missing] });
  return true;
}

export async function removeHighlight(userId: string, highlightId: string, itemId?: string): Promise<boolean> {
  const u = await getUserById(userId);
  if (!u) return false;
  const highlights = [...(u.highlights || [])];
  const hi = highlights.findIndex(h => h.id === highlightId);
  if (hi === -1) return false;
  if (itemId) {
    highlights[hi].items = highlights[hi].items.filter(item => item.id !== itemId);
    if (highlights[hi].items.length === 0) highlights.splice(hi, 1);
    else highlights[hi].coverImage = highlights[hi].items[0]?.imageUrl;
  } else {
    highlights.splice(hi, 1);
  }
  await updateUserProfile(userId, { highlights });
  return true;
}

export async function addDisappearingPhoto(userId: string, imageUrl: string): Promise<DisappearingPhoto | null> {
  const u = await getUserById(userId);
  if (!u) return null;
  const photo: DisappearingPhoto = { id: Date.now().toString(), imageUrl, createdAt: new Date(), views: [] };
  const disappearingPhotos = [...(u.disappearingPhotos || []), photo];
  await updateUserProfile(userId, { disappearingPhotos });
  return photo;
}

export async function viewDisappearingPhoto(photoId: string, viewerId: string, ownerId: string): Promise<{ canView: boolean; imageUrl: string | null }> {
  const owner = await getUserById(ownerId);
  if (!owner) return { canView: false, imageUrl: null };
  const photo = owner.disappearingPhotos?.find(p => p.id === photoId);
  if (!photo) return { canView: false, imageUrl: null };
  const viewCount = photo.views?.filter(v => v.userId === viewerId).length || 0;
  if (viewCount >= 2) return { canView: false, imageUrl: null };
  const disappearingPhotos = (owner.disappearingPhotos || []).map(p =>
    p.id === photoId
      ? { ...p, views: [...(p.views || []), { userId: viewerId, viewedAt: new Date() }] }
      : p
  );
  await updateUserProfile(ownerId, { disappearingPhotos });
  return { canView: true, imageUrl: photo.imageUrl };
}

export async function getAllUsers(): Promise<Omit<User, 'password' | 'resetToken' | 'resetTokenExpiry'>[]> {
  const res = await query<{ id: string; email: string; password: string; name: string; username: string; data: unknown }>(
    `SELECT ${USER_COLS} FROM users`
  );
  return res.rows.map(row => {
    const u = rowToUser(row);
    const { password, resetToken, resetTokenExpiry, ...rest } = u;
    return rest;
  });
}

export async function getUserByResetToken(token: string): Promise<User | null> {
  const res = await query<{ id: string; email: string; password: string; name: string; username: string; data: unknown }>(
    `SELECT ${USER_COLS} FROM users WHERE data->>'resetToken' = $1`,
    [token]
  );
  return res.rows[0] ? rowToUser(res.rows[0]) : null;
}

export async function updateUserPassword(userId: string, hashedPassword: string): Promise<void> {
  await query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, userId]);
}

export async function updateUserResetToken(userId: string, resetToken: string | null, resetTokenExpiry: Date | null): Promise<void> {
  const u = await getUserById(userId);
  if (!u) return;
  await updateUserProfile(userId, { resetToken, resetTokenExpiry });
}

export async function getUserByEmailVerificationToken(token: string): Promise<User | null> {
  const res = await query<{ id: string; email: string; password: string; name: string; username: string; data: unknown }>(
    `SELECT ${USER_COLS} FROM users WHERE data->>'emailVerificationToken' = $1`,
    [token]
  );
  return res.rows[0] ? rowToUser(res.rows[0]) : null;
}

export async function updateEmailVerificationToken(userId: string, token: string | null, expiry: Date | null): Promise<void> {
  await updateUserProfile(userId, { emailVerificationToken: token, emailVerificationTokenExpiry: expiry });
}

export async function verifyUserEmail(userId: string): Promise<void> {
  await updateUserProfile(userId, {
    emailVerified: true,
    emailVerificationToken: null,
    emailVerificationTokenExpiry: null,
    emailVerificationCode: null,
    emailVerificationCodeExpiry: null,
  });
}

export async function getUserByEmailVerificationCode(code: string): Promise<User | null> {
  const res = await query<{ id: string; email: string; password: string; name: string; username: string; data: unknown }>(
    `SELECT ${USER_COLS} FROM users WHERE data->>'emailVerificationCode' = $1`,
    [code]
  );
  return res.rows[0] ? rowToUser(res.rows[0]) : null;
}

export async function updateEmailVerificationCode(userId: string, code: string | null, expiry: Date | null): Promise<void> {
  await updateUserProfile(userId, { emailVerificationCode: code, emailVerificationCodeExpiry: expiry });
}

export async function getUserByLoginCode(code: string): Promise<User | null> {
  const res = await query<{ id: string; email: string; password: string; name: string; username: string; data: unknown }>(
    `SELECT ${USER_COLS} FROM users WHERE data->>'loginCode' = $1`,
    [code]
  );
  return res.rows[0] ? rowToUser(res.rows[0]) : null;
}

export async function updateLoginCode(userId: string, code: string | null, expiry: Date | null): Promise<void> {
  await updateUserProfile(userId, { loginCode: code, loginCodeExpiry: expiry });
}

export async function blockUser(userId: string, blockedUserId: string): Promise<boolean> {
  const u = await getUserById(userId);
  if (!u) return false;
  const blocked = [...(u.blockedUsers || [])];
  if (!blocked.includes(blockedUserId)) blocked.push(blockedUserId);
  await updateUserProfile(userId, { blockedUsers: blocked });
  return true;
}

export async function unblockUser(userId: string, blockedUserId: string): Promise<boolean> {
  const u = await getUserById(userId);
  if (!u) return false;
  await updateUserProfile(userId, { blockedUsers: (u.blockedUsers || []).filter(id => id !== blockedUserId) });
  return true;
}

export async function muteUser(userId: string, mutedUserId: string): Promise<boolean> {
  const u = await getUserById(userId);
  if (!u) return false;
  const muted = [...(u.mutedUsers || [])];
  if (!muted.includes(mutedUserId)) muted.push(mutedUserId);
  await updateUserProfile(userId, { mutedUsers: muted });
  return true;
}

export async function unmuteUser(userId: string, mutedUserId: string): Promise<boolean> {
  const u = await getUserById(userId);
  if (!u) return false;
  await updateUserProfile(userId, { mutedUsers: (u.mutedUsers || []).filter(id => id !== mutedUserId) });
  return true;
}

export async function unmatchUser(userId: string, unmatchedUserId: string): Promise<boolean> {
  const u = await getUserById(userId);
  if (!u) return false;
  const unmatched = [...(u.unmatchedUsers || [])];
  if (!unmatched.includes(unmatchedUserId)) unmatched.push(unmatchedUserId);
  await updateUserProfile(userId, { unmatchedUsers: unmatched });
  return true;
}
