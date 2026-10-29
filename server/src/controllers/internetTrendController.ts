import { Request, Response } from 'express';
import { getUserById } from '../models/user.js';
import { listWardrobe } from '../models/fashionWardrobe.js';
import { defaultTrendPool } from '../data/internetTrendPool.js';
import { upsertUserAgeProfile } from '../db/pg-age-segments.js';
import { ageSegmentFromAge, partitionOutfitFeed } from '../services/ageSegmentFeed.js';
import {
  ageGroupFromAge,
  internetTrendMatcher,
  type IngestedTrendOutfit,
  type UserStyleProfile,
} from '../services/internetTrendMatcher.js';

function profileFromUser(
  userId: string,
  age: number,
  style: string[]
): UserStyleProfile {
  return { userId, age, stylePreference: style };
}

export const internetTrendsHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string | undefined;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const user = await getUserById(userId);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const age = Number(req.body?.age ?? user.age ?? 28) || 28;
    const stylePreference = Array.isArray(req.body?.stylePreference)
      ? req.body.stylePreference.map(String)
      : Array.isArray(user.improvementCategories)
        ? user.improvementCategories.map(String)
        : [];
    const limit = Number(req.body?.limit) || 5;
    const pool = Array.isArray(req.body?.trendPool) && req.body.trendPool.length
      ? (req.body.trendPool as IngestedTrendOutfit[])
      : defaultTrendPool();

    await upsertUserAgeProfile(userId, age, stylePreference).catch(() => null);
    const matches = internetTrendMatcher.matchInternetTrends(
      profileFromUser(userId, age, stylePreference),
      pool,
      limit
    );
    const audit = partitionOutfitFeed(
      pool.map((look) => ({
        id: look.id || look.sourceUrl,
        title: look.celebrityOrBoardName || '',
        tags: look.extractedTags,
      })),
      ageSegmentFromAge(age),
      stylePreference
    );

    res.json({
      ageGroup: ageGroupFromAge(age),
      ageSegment: ageSegmentFromAge(age),
      stylePreference,
      matches,
      droppedForSegment: audit.dropped.map((d) => ({ id: d.item.id, reason: d.reason })),
    });
  } catch (error) {
    console.error('Internet trends error:', error);
    res.status(500).json({ error: 'Could not match internet trends' });
  }
};

export const internetTrendClosetHandler = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string | undefined;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const trend = req.body?.trend as IngestedTrendOutfit | undefined;
    if (!trend || !Array.isArray(trend.extractedTags)) {
      return res.status(400).json({ error: 'trend with extractedTags is required' });
    }

    const closet = await listWardrobe(userId);
    const result = internetTrendMatcher.crossReferenceWithCloset(
      closet.map((item) => ({
        styleTags: item.pieces,
        title: item.title,
        notes: item.notes,
        pieces: item.pieces,
      })),
      trend
    );
    res.json(result);
  } catch (error) {
    console.error('Internet trend closet error:', error);
    res.status(500).json({ error: 'Could not compare that trend to the closet' });
  }
};
