import { query } from './index.js';
import type { Buzz, BuzzStatus } from '../models/connections.js';

type BuzzRow = {
  id: string;
  from_user_id: string;
  to_user_id: string;
  status: string;
  location: unknown;
  created_at: Date | string;
  responded_at: Date | string | null;
};

function rowToBuzz(row: BuzzRow): Buzz {
  return {
    id: row.id,
    fromUserId: row.from_user_id,
    toUserId: row.to_user_id,
    status: row.status as BuzzStatus,
    createdAt: row.created_at,
    respondedAt: row.responded_at,
    location: (row.location as Buzz['location']) ?? undefined,
  };
}

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function createBuzz(data: {
  fromUserId: string;
  toUserId: string;
  location?: Buzz['location'];
}): Promise<Buzz> {
  const existing = await query<{ id: string }>(
    `SELECT id FROM connection_buzzes
     WHERE from_user_id = $1 AND to_user_id = $2 AND status = 'pending'
     LIMIT 1`,
    [data.fromUserId, data.toUserId]
  );
  if (existing.rows[0]) {
    throw new Error('Buzz already sent to this user');
  }
  const id = newId();
  await query(
    `INSERT INTO connection_buzzes (id, from_user_id, to_user_id, status, location)
     VALUES ($1, $2, $3, 'pending', $4)`,
    [id, data.fromUserId, data.toUserId, data.location ? JSON.stringify(data.location) : null]
  );
  const res = await query<BuzzRow>(
    'SELECT * FROM connection_buzzes WHERE id = $1',
    [id]
  );
  if (!res.rows[0]) throw new Error('Buzz not saved');
  return rowToBuzz(res.rows[0]);
}

export async function getBuzzesForUser(userId: string): Promise<Buzz[]> {
  const res = await query<BuzzRow>(
    `SELECT * FROM connection_buzzes WHERE to_user_id = $1 AND status = 'pending' ORDER BY created_at DESC`,
    [userId]
  );
  return res.rows.map(rowToBuzz);
}

export async function getSentBuzzes(userId: string): Promise<Buzz[]> {
  const res = await query<BuzzRow>(
    `SELECT * FROM connection_buzzes WHERE from_user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );
  return res.rows.map(rowToBuzz);
}

export async function respondToBuzz(
  buzzId: string,
  status: Exclude<BuzzStatus, 'pending'>
): Promise<Buzz | null> {
  await query(
    `UPDATE connection_buzzes SET status = $2, responded_at = NOW() WHERE id = $1`,
    [buzzId, status]
  );
  const res = await query<BuzzRow>('SELECT * FROM connection_buzzes WHERE id = $1', [buzzId]);
  return res.rows[0] ? rowToBuzz(res.rows[0]) : null;
}

export async function tryMutualBuzzMatch(
  fromUserId: string,
  toUserId: string
): Promise<{ matched: boolean; chatUserId?: string }> {
  const reverse = await query<{ id: string }>(
    `SELECT id FROM connection_buzzes
     WHERE from_user_id = $1 AND to_user_id = $2 AND status = 'pending'
     LIMIT 1`,
    [toUserId, fromUserId]
  );
  if (!reverse.rows[0]) return { matched: false };
  await query(
    `UPDATE connection_buzzes SET status = 'accepted', responded_at = NOW()
     WHERE status = 'pending'
       AND (
         (from_user_id = $1 AND to_user_id = $2)
         OR (from_user_id = $2 AND to_user_id = $1)
       )`,
    [fromUserId, toUserId]
  );
  return { matched: true, chatUserId: toUserId };
}
