import { query } from './index.js';
import { STORY_TTL_MS } from '../constants/socialMedia.js';
import { inferMediaTypeFromUrl } from '../utils/mediaType.js';
import type { Highlight, HighlightItem, Story, StoryAudience } from '../models/user.js';

function newId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function toIso(d: Date | string | undefined | null): string {
  if (d instanceof Date && Number.isFinite(d.getTime())) return d.toISOString();
  if (typeof d === 'string' && d.trim()) {
    const t = new Date(d);
    if (Number.isFinite(t.getTime())) return t.toISOString();
  }
  return new Date().toISOString();
}

function rowToStory(row: {
  id: string;
  media_url: string;
  media_type: string;
  audience: string;
  created_at: Date | string;
  expires_at: Date | string;
}): Story {
  return {
    id: row.id,
    mediaUrl: row.media_url,
    mediaType: row.media_type === 'video' ? 'video' : 'image',
    audience: row.audience === 'closeFriends' ? 'closeFriends' : 'all',
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

function rowToHighlight(row: {
  id: string;
  title: string | null;
  cover_image: string | null;
  items: unknown;
  created_at: Date | string;
}): Highlight {
  const items = (Array.isArray(row.items) ? row.items : []).map((raw: any) => ({
    id: String(raw?.id || newId()),
    imageUrl: String(raw?.imageUrl || ''),
    mediaType: raw?.mediaType === 'video' ? 'video' as const : 'image' as const,
    createdAt: raw?.createdAt || new Date(),
  })).filter((item: HighlightItem) => item.imageUrl);
  return {
    id: row.id,
    title: row.title || '',
    coverImage: row.cover_image || items[0]?.imageUrl,
    items,
    createdAt: row.created_at,
  };
}

export async function listStories(userId: string): Promise<Story[]> {
  await query(
    `DELETE FROM profile_stories WHERE user_id = $1 AND expires_at <= NOW()`,
    [userId]
  );
  const res = await query<{
    id: string;
    media_url: string;
    media_type: string;
    audience: string;
    created_at: Date | string;
    expires_at: Date | string;
  }>(
    `SELECT id, media_url, media_type, audience, created_at, expires_at
     FROM profile_stories
     WHERE user_id = $1 AND expires_at > NOW()
     ORDER BY created_at DESC`,
    [userId]
  );
  return res.rows.map(rowToStory);
}

export async function insertStory(
  userId: string,
  mediaUrl: string,
  mediaType: 'image' | 'video',
  audience: StoryAudience
): Promise<Story> {
  const id = newId();
  const expiresAt = new Date(Date.now() + STORY_TTL_MS);
  await query(
    `INSERT INTO profile_stories (id, user_id, media_url, media_type, audience, created_at, expires_at)
     VALUES ($1, $2, $3, $4, $5, NOW(), $6)`,
    [id, userId, mediaUrl, mediaType, audience === 'closeFriends' ? 'closeFriends' : 'all', expiresAt.toISOString()]
  );
  const res = await query<{
    id: string;
    media_url: string;
    media_type: string;
    audience: string;
    created_at: Date | string;
    expires_at: Date | string;
  }>(
    `SELECT id, media_url, media_type, audience, created_at, expires_at FROM profile_stories WHERE id = $1`,
    [id]
  );
  if (!res.rows[0]) throw new Error('Story not saved');
  return rowToStory(res.rows[0]);
}

export async function deleteStory(userId: string, storyId: string): Promise<boolean> {
  const res = await query(
    `DELETE FROM profile_stories WHERE id = $1 AND user_id = $2`,
    [storyId, userId]
  );
  return (res.rowCount ?? 0) > 0;
}

export async function getStory(userId: string, storyId: string): Promise<Story | null> {
  const res = await query<{
    id: string;
    media_url: string;
    media_type: string;
    audience: string;
    created_at: Date | string;
    expires_at: Date | string;
  }>(
    `SELECT id, media_url, media_type, audience, created_at, expires_at
     FROM profile_stories WHERE id = $1 AND user_id = $2 AND expires_at > NOW()`,
    [storyId, userId]
  );
  return res.rows[0] ? rowToStory(res.rows[0]) : null;
}

export async function listHighlights(userId: string): Promise<Highlight[]> {
  const res = await query<{
    id: string;
    title: string | null;
    cover_image: string | null;
    items: unknown;
    created_at: Date | string;
  }>(
    `SELECT id, title, cover_image, items, created_at
     FROM profile_highlights
     WHERE user_id = $1
     ORDER BY sort_order ASC, created_at ASC`,
    [userId]
  );
  return res.rows.map(rowToHighlight);
}

export async function insertHighlight(
  userId: string,
  imageUrl: string,
  mediaType: 'image' | 'video'
): Promise<Highlight> {
  const id = newId();
  const item: HighlightItem = {
    id: `${id}_item`,
    imageUrl,
    mediaType,
    createdAt: new Date().toISOString(),
  };
  await query(
    `INSERT INTO profile_highlights (id, user_id, title, cover_image, items, created_at, sort_order)
     VALUES (
       $1, $2, '', $3, $4::jsonb, NOW(),
       COALESCE((SELECT MAX(sort_order) + 1 FROM profile_highlights WHERE user_id = $2), 0)
     )`,
    [id, userId, imageUrl, JSON.stringify([item])]
  );
  const res = await query<{
    id: string;
    title: string | null;
    cover_image: string | null;
    items: unknown;
    created_at: Date | string;
  }>(
    `SELECT id, title, cover_image, items, created_at FROM profile_highlights WHERE id = $1`,
    [id]
  );
  if (!res.rows[0]) throw new Error('Highlight not saved');
  return rowToHighlight(res.rows[0]);
}

export async function appendHighlightItem(
  userId: string,
  highlightId: string,
  imageUrl: string,
  mediaType: 'image' | 'video'
): Promise<Highlight | null> {
  const existing = await query<{
    id: string;
    title: string | null;
    cover_image: string | null;
    items: unknown;
    created_at: Date | string;
  }>(
    `SELECT id, title, cover_image, items, created_at FROM profile_highlights WHERE id = $1 AND user_id = $2`,
    [highlightId, userId]
  );
  if (!existing.rows[0]) return null;
  const highlight = rowToHighlight(existing.rows[0]);
  const item: HighlightItem = {
    id: newId(),
    imageUrl,
    mediaType,
    createdAt: new Date().toISOString(),
  };
  highlight.items = [...highlight.items, item];
  if (!highlight.coverImage) highlight.coverImage = imageUrl;
  await query(
    `UPDATE profile_highlights SET items = $3::jsonb, cover_image = $4 WHERE id = $1 AND user_id = $2`,
    [highlightId, userId, JSON.stringify(highlight.items), highlight.coverImage]
  );
  return highlight;
}

export async function deleteHighlight(
  userId: string,
  highlightId: string,
  itemId?: string
): Promise<boolean> {
  if (!itemId) {
    const res = await query(
      `DELETE FROM profile_highlights WHERE id = $1 AND user_id = $2`,
      [highlightId, userId]
    );
    return (res.rowCount ?? 0) > 0;
  }
  const existing = await query<{
    id: string;
    title: string | null;
    cover_image: string | null;
    items: unknown;
    created_at: Date | string;
  }>(
    `SELECT id, title, cover_image, items, created_at FROM profile_highlights WHERE id = $1 AND user_id = $2`,
    [highlightId, userId]
  );
  if (!existing.rows[0]) return false;
  const highlight = rowToHighlight(existing.rows[0]);
  const next = highlight.items.filter((item) => item.id !== itemId);
  if (next.length === highlight.items.length) return false;
  if (next.length === 0) {
    await query(`DELETE FROM profile_highlights WHERE id = $1 AND user_id = $2`, [highlightId, userId]);
    return true;
  }
  await query(
    `UPDATE profile_highlights SET items = $3::jsonb, cover_image = $4 WHERE id = $1 AND user_id = $2`,
    [highlightId, userId, JSON.stringify(next), next[0].imageUrl]
  );
  return true;
}

export async function reorderHighlights(userId: string, orderedIds: string[]): Promise<boolean> {
  for (let i = 0; i < orderedIds.length; i++) {
    await query(
      `UPDATE profile_highlights SET sort_order = $3 WHERE id = $1 AND user_id = $2`,
      [orderedIds[i], userId, i]
    );
  }
  return true;
}

/** Copy leftover JSON blob media into tables once, so older uploads survive. */
export async function migrateJsonMediaIfNeeded(
  userId: string,
  jsonStories: Story[] | undefined,
  jsonHighlights: Highlight[] | undefined
): Promise<void> {
  const [storyCount, highlightCount] = await Promise.all([
    query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM profile_stories WHERE user_id = $1`, [userId]),
    query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM profile_highlights WHERE user_id = $1`, [userId]),
  ]);
  if (Number(storyCount.rows[0]?.n || 0) === 0 && jsonStories?.length) {
    const now = Date.now();
    for (const s of jsonStories) {
      if (!s?.mediaUrl) continue;
      const exp = new Date(s.expiresAt).getTime();
      if (Number.isFinite(exp) && exp <= now) continue;
      const created = toIso(s.createdAt);
      const expires = Number.isFinite(exp) ? new Date(exp).toISOString() : new Date(now + STORY_TTL_MS).toISOString();
      await query(
        `INSERT INTO profile_stories (id, user_id, media_url, media_type, audience, created_at, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO NOTHING`,
        [
          s.id || newId(),
          userId,
          s.mediaUrl,
          s.mediaType === 'video' ? 'video' : inferMediaTypeFromUrl(s.mediaUrl),
          s.audience === 'closeFriends' ? 'closeFriends' : 'all',
          created,
          expires,
        ]
      );
    }
  }
  if (Number(highlightCount.rows[0]?.n || 0) === 0 && jsonHighlights?.length) {
    for (let i = 0; i < jsonHighlights.length; i++) {
      const h = jsonHighlights[i];
      const items = (h.items || []).map((item) => ({
        id: item.id || newId(),
        imageUrl: item.imageUrl,
        mediaType: item.mediaType === 'video' ? 'video' : inferMediaTypeFromUrl(item.imageUrl),
        createdAt: toIso(item.createdAt),
      })).filter((item) => item.imageUrl);
      if (!items.length && h.coverImage) {
        items.push({
          id: `${h.id || newId()}_item`,
          imageUrl: h.coverImage,
          mediaType: inferMediaTypeFromUrl(h.coverImage),
          createdAt: toIso(h.createdAt),
        });
      }
      if (!items.length) continue;
      await query(
        `INSERT INTO profile_highlights (id, user_id, title, cover_image, items, created_at, sort_order)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
         ON CONFLICT (id) DO NOTHING`,
        [
          h.id || newId(),
          userId,
          h.title || '',
          h.coverImage || items[0].imageUrl,
          JSON.stringify(items),
          toIso(h.createdAt),
          i,
        ]
      );
    }
  }
}
