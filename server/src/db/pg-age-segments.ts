import { query, usePostgres } from './index.js';
import { ageSegmentFromAge, type AgeSegmentSlug } from '../services/ageSegmentFeed.js';

const SEGMENT_IDS: Record<AgeSegmentSlug, string> = {
  teen: 'seg-teen',
  young_adult: 'seg-young-adult',
  mature: 'seg-mature',
};

export async function upsertUserAgeProfile(
  userId: string,
  age: number,
  styleOverrideTags: string[] = []
): Promise<{ segment: AgeSegmentSlug } | null> {
  if (!usePostgres()) return { segment: ageSegmentFromAge(age) };
  const segment = ageSegmentFromAge(age);
  await query(
    `INSERT INTO user_age_profiles (user_id, segment_id, age, style_override_tags, computed_at, updated_at)
     VALUES ($1, $2, $3, $4, NOW(), NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       segment_id = EXCLUDED.segment_id,
       age = EXCLUDED.age,
       style_override_tags = EXCLUDED.style_override_tags,
       updated_at = NOW()`,
    [userId, SEGMENT_IDS[segment], age, styleOverrideTags]
  );
  return { segment };
}
