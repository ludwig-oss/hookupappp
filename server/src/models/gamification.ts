import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'profile' | 'social' | 'premium' | 'achievement' | 'safety' | 'explorer';
  pointsRequired: number;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  target: number;
  pointsReward: number;
}

export interface UserGamification {
  userId: string;
  points: number;
  badges: string[]; // Badge IDs
  achievements: Array<{
    id: string;
    progress: number;
    completed: boolean;
    completedAt: Date | string | null;
  }>;
  level: number;
  totalMatches: number;
  totalMessages: number;
  totalLikes: number;
  profileCompleteness: number;
}

const GAMIFICATION_PATH = join(process.cwd(), 'server', 'data', 'gamification.json');
const BADGES_PATH = join(process.cwd(), 'server', 'data', 'badges.json');

const defaultBadges: Badge[] = [
  { id: 'first_steps', name: 'First Steps', description: 'Complete your profile', icon: '👋', category: 'profile', pointsRequired: 10 },
  { id: 'social_butterfly', name: 'Social Butterfly', description: 'Send 100 messages', icon: '💬', category: 'social', pointsRequired: 100 },
  { id: 'match_maker', name: 'Match Maker', description: 'Get 10 matches', icon: '💕', category: 'social', pointsRequired: 50 },
  { id: 'popular', name: 'Popular', description: 'Get 50 likes', icon: '⭐', category: 'social', pointsRequired: 200 },
  { id: 'verified', name: 'Verified', description: 'Complete verification', icon: '✅', category: 'achievement', pointsRequired: 30 },
  { id: 'safety_first', name: 'Safety First', description: 'Add emergency contact', icon: '🛡️', category: 'safety', pointsRequired: 20 },
  { id: 'explorer', name: 'Explorer', description: 'Use Nearby Buzz 10 times', icon: '🗺️', category: 'explorer', pointsRequired: 40 },
  { id: 'coach', name: 'Coach', description: 'Become a guide', icon: '🎓', category: 'achievement', pointsRequired: 100 },
  { id: 'storyteller', name: 'Storyteller', description: 'Post 5 dating stories', icon: '📖', category: 'social', pointsRequired: 60 },
  { id: 'premium_member', name: 'Premium Member', description: 'Subscribe to premium', icon: '👑', category: 'premium', pointsRequired: 0 },
];

const defaultAchievements: Achievement[] = [
  { id: 'complete_profile', name: 'Profile Master', description: 'Complete 100% of your profile', icon: '📝', category: 'profile', target: 100, pointsReward: 50 },
  { id: 'send_100_messages', name: 'Chatterbox', description: 'Send 100 messages', icon: '💬', category: 'social', target: 100, pointsReward: 100 },
  { id: 'get_10_matches', name: 'Match Master', description: 'Get 10 matches', icon: '💕', category: 'social', target: 10, pointsReward: 150 },
  { id: 'get_50_likes', name: 'Heartbreaker', description: 'Get 50 likes', icon: '❤️', category: 'social', target: 50, pointsReward: 200 },
  { id: 'verify_account', name: 'Verified User', description: 'Verify your account', icon: '✅', category: 'achievement', target: 1, pointsReward: 75 },
  { id: 'use_nearby_10', name: 'Local Explorer', description: 'Use Nearby Buzz 10 times', icon: '🗺️', category: 'explorer', target: 10, pointsReward: 80 },
  { id: 'post_5_stories', name: 'Storyteller', description: 'Post 5 dating stories', icon: '📖', category: 'social', target: 5, pointsReward: 90 },
  { id: 'add_emergency', name: 'Safety Conscious', description: 'Add emergency contact', icon: '🛡️', category: 'safety', target: 1, pointsReward: 40 },
];

async function readGamification(): Promise<UserGamification[]> {
  try {
    const data = await readFile(GAMIFICATION_PATH, 'utf-8');
    const gamification = JSON.parse(data);
    return gamification.map((g: UserGamification) => ({
      ...g,
      achievements: (g.achievements || []).map((a: any) => ({
        ...a,
        completedAt: a.completedAt ? new Date(a.completedAt) : null,
      })),
    }));
  } catch {
    return [];
  }
}

async function writeGamification(gamification: UserGamification[]): Promise<void> {
  const dir = join(process.cwd(), 'server', 'data');
  await import('fs/promises').then(fs => fs.mkdir(dir, { recursive: true }));
  await writeFile(GAMIFICATION_PATH, JSON.stringify(gamification, null, 2));
}

async function ensureBadgesFile(): Promise<void> {
  try {
    await readFile(BADGES_PATH, 'utf-8');
  } catch {
    const dir = join(process.cwd(), 'server', 'data');
    await import('fs/promises').then(fs => fs.mkdir(dir, { recursive: true }));
    await writeFile(BADGES_PATH, JSON.stringify(defaultBadges, null, 2));
  }
}

export async function getAllBadges(): Promise<Badge[]> {
  await ensureBadgesFile();
  try {
    const data = await readFile(BADGES_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return defaultBadges;
  }
}

export async function getAllAchievements(): Promise<Achievement[]> {
  return defaultAchievements;
}

export async function getUserGamification(userId: string): Promise<UserGamification> {
  const gamification = await readGamification();
  const userGam = gamification.find(g => g.userId === userId);
  
  if (userGam) {
    return userGam;
  }
  
  const newGam: UserGamification = {
    userId,
    points: 0,
    badges: [],
    achievements: defaultAchievements.map(a => ({
      id: a.id,
      progress: 0,
      completed: false,
      completedAt: null,
    })),
    level: 1,
    totalMatches: 0,
    totalMessages: 0,
    totalLikes: 0,
    profileCompleteness: 0,
  };
  
  gamification.push(newGam);
  await writeGamification(gamification);
  return newGam;
}

export async function awardPoints(userId: string, points: number, reason?: string): Promise<UserGamification> {
  const gamification = await readGamification();
  let userGam = gamification.find(g => g.userId === userId);
  
  if (!userGam) {
    userGam = await getUserGamification(userId);
    gamification.push(userGam);
  }
  
  userGam.points += points;
  userGam.level = Math.floor(userGam.points / 100) + 1;
  
  // Check for badge eligibility
  const badges = await getAllBadges();
  badges.forEach(badge => {
    if (userGam.points >= badge.pointsRequired && !userGam.badges.includes(badge.id)) {
      userGam.badges.push(badge.id);
    }
  });
  
  await writeGamification(gamification);
  return userGam;
}

export async function updateAchievementProgress(userId: string, achievementId: string, progress: number): Promise<UserGamification> {
  const gamification = await readGamification();
  let userGam = gamification.find(g => g.userId === userId);
  
  if (!userGam) {
    userGam = await getUserGamification(userId);
    gamification.push(userGam);
  }
  
  const achievement = userGam.achievements.find(a => a.id === achievementId);
  if (achievement) {
    achievement.progress = progress;
    const achievementDef = defaultAchievements.find(a => a.id === achievementId);
    if (achievementDef && progress >= achievementDef.target && !achievement.completed) {
      achievement.completed = true;
      achievement.completedAt = new Date();
      await awardPoints(userId, achievementDef.pointsReward, `Achievement: ${achievementDef.name}`);
    }
  }
  
  await writeGamification(gamification);
  return userGam;
}

export async function updateStats(userId: string, stats: Partial<Pick<UserGamification, 'totalMatches' | 'totalMessages' | 'totalLikes' | 'profileCompleteness'>>): Promise<UserGamification> {
  const gamification = await readGamification();
  let userGam = gamification.find(g => g.userId === userId);
  
  if (!userGam) {
    userGam = await getUserGamification(userId);
    gamification.push(userGam);
  }
  
  Object.assign(userGam, stats);
  await writeGamification(gamification);
  return userGam;
}



