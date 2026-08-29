import { query } from './index.js';
import type { Interest } from '../models/activity.js';

function rowToInterest(row: {
  id: string;
  from_user_id: string;
  to_user_id: string;
  status: string;
  created_at: Date;
  responded_at: Date | null;
}): Interest {
  return {
    id: row.id,
    fromUserId: row.from_user_id,
    toUserId: row.to_user_id,
    status: row.status as Interest['status'],
    createdAt: row.created_at,
    respondedAt: row.responded_at,
  };
}

export async function sendInterest(
  fromUserId: string,
  toUserId: string
): Promise<Interest & { mutual?: boolean }> {
  const reverse = await query<{
    id: string;
    from_user_id: string;
    to_user_id: string;
    status: string;
    created_at: Date;
    responded_at: Date | null;
  }>(
    `SELECT id, from_user_id, to_user_id, status, created_at, responded_at
     FROM activity_interests
     WHERE from_user_id = $1 AND to_user_id = $2 AND status = 'pending'
     LIMIT 1`,
    [toUserId, fromUserId]
  );

  if (reverse.rows[0]) {
    const rev = reverse.rows[0];
    await query(
      `UPDATE activity_interests SET status = 'accepted', responded_at = NOW() WHERE id = $1`,
      [rev.id]
    );
    const id = `${Date.now()}-r`;
    await query(
      `INSERT INTO activity_interests (id, from_user_id, to_user_id, status, responded_at)
       VALUES ($1, $2, $3, 'accepted', NOW())`,
      [id, fromUserId, toUserId]
    );
    const res = await query<{
      id: string;
      from_user_id: string;
      to_user_id: string;
      status: string;
      created_at: Date;
      responded_at: Date | null;
    }>(`SELECT * FROM activity_interests WHERE id = $1`, [id]);
    const row = res.rows[0];
    if (!row) throw new Error('Could not save mutual interest');
    return { ...rowToInterest(row), mutual: true };
  }

  const existing = await query<{ id: string; status: string }>(
    `SELECT id, status FROM activity_interests
     WHERE from_user_id = $1 AND to_user_id = $2
     ORDER BY created_at DESC LIMIT 1`,
    [fromUserId, toUserId]
  );
  if (existing.rows[0]) {
    const row = existing.rows[0];
    if (row.status === 'pending') {
      const full = await query<{
        id: string;
        from_user_id: string;
        to_user_id: string;
        status: string;
        created_at: Date;
        responded_at: Date | null;
      }>(`SELECT * FROM activity_interests WHERE id = $1`, [row.id]);
      if (full.rows[0]) return rowToInterest(full.rows[0]);
    }
    if (row.status === 'accepted') throw new Error('You are already connected with this user');
  }

  const id = Date.now().toString();
  await query(
    `INSERT INTO activity_interests (id, from_user_id, to_user_id, status) VALUES ($1, $2, $3, 'pending')`,
    [id, fromUserId, toUserId]
  );
  const res = await query<{
    id: string;
    from_user_id: string;
    to_user_id: string;
    status: string;
    created_at: Date;
    responded_at: Date | null;
  }>(`SELECT * FROM activity_interests WHERE id = $1`, [id]);
  const row = res.rows[0];
  if (!row) throw new Error('Could not save interest');
  return rowToInterest(row);
}

export async function acceptInterest(interestId: string, toUserId: string): Promise<{ fromUserId: string }> {
  const res = await query<{ from_user_id: string; status: string }>(
    `SELECT from_user_id, status FROM activity_interests WHERE id = $1 AND to_user_id = $2`,
    [interestId, toUserId]
  );
  const row = res.rows[0];
  if (!row) throw new Error('Interest not found');
  if (row.status !== 'pending') throw new Error('Already responded');
  await query(
    `UPDATE activity_interests SET status = 'accepted', responded_at = NOW() WHERE id = $1`,
    [interestId]
  );
  return { fromUserId: row.from_user_id };
}

export async function rejectInterest(interestId: string, toUserId: string): Promise<void> {
  const res = await query<{ status: string }>(
    `SELECT status FROM activity_interests WHERE id = $1 AND to_user_id = $2`,
    [interestId, toUserId]
  );
  if (!res.rows[0]) throw new Error('Interest not found');
  if (res.rows[0].status !== 'pending') throw new Error('Already responded');
  await query(
    `UPDATE activity_interests SET status = 'rejected', responded_at = NOW() WHERE id = $1`,
    [interestId]
  );
}

export async function getInterestsForUser(userId: string): Promise<{ sent: Interest[]; received: Interest[] }> {
  const sentRes = await query<{
    id: string;
    from_user_id: string;
    to_user_id: string;
    status: string;
    created_at: Date;
    responded_at: Date | null;
  }>(`SELECT * FROM activity_interests WHERE from_user_id = $1 ORDER BY created_at DESC`, [userId]);
  const recvRes = await query<{
    id: string;
    from_user_id: string;
    to_user_id: string;
    status: string;
    created_at: Date;
    responded_at: Date | null;
  }>(`SELECT * FROM activity_interests WHERE to_user_id = $1 ORDER BY created_at DESC`, [userId]);
  return {
    sent: sentRes.rows.map(rowToInterest),
    received: recvRes.rows.map(rowToInterest),
  };
}

export async function getInterestById(interestId: string): Promise<Interest | null> {
  const res = await query<{
    id: string;
    from_user_id: string;
    to_user_id: string;
    status: string;
    created_at: Date;
    responded_at: Date | null;
  }>(`SELECT * FROM activity_interests WHERE id = $1`, [interestId]);
  return res.rows[0] ? rowToInterest(res.rows[0]) : null;
}