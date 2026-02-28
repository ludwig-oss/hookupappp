import { query } from './index.js';
import type { Message } from '../models/chat.js';

function rowToMessage(row: { id: string; from_user_id: string; to_user_id: string; content: string; created_at: Date; read: boolean }): Message {
  return {
    id: row.id,
    fromUserId: row.from_user_id,
    toUserId: row.to_user_id,
    content: row.content,
    createdAt: row.created_at,
    read: row.read,
  };
}

export async function createMessage(messageData: Omit<Message, 'id' | 'createdAt' | 'read'>): Promise<Message> {
  const id = Date.now().toString();
  await query(
    'INSERT INTO messages (id, from_user_id, to_user_id, content, read) VALUES ($1, $2, $3, $4, false)',
    [id, messageData.fromUserId, messageData.toUserId, messageData.content]
  );
  const res = await query<{ id: string; from_user_id: string; to_user_id: string; content: string; created_at: Date; read: boolean }>(
    'SELECT * FROM messages WHERE id = $1',
    [id]
  );
  const row = res.rows[0];
  if (!row) throw new Error('Message not found after insert');
  return rowToMessage(row);
}

export async function getConversation(userId1: string, userId2: string): Promise<Message[]> {
  const res = await query<{ id: string; from_user_id: string; to_user_id: string; content: string; created_at: Date; read: boolean }>(
    `SELECT * FROM messages
     WHERE (from_user_id = $1 AND to_user_id = $2) OR (from_user_id = $2 AND to_user_id = $1)
     ORDER BY created_at ASC`,
    [userId1, userId2]
  );
  return res.rows.map(rowToMessage);
}

export async function getUserConversations(userId: string): Promise<{ userId: string; lastMessage: Message; unreadCount: number }[]> {
  const res = await query<{ id: string; from_user_id: string; to_user_id: string; content: string; created_at: Date; read: boolean }>(
    `SELECT * FROM messages
     WHERE from_user_id = $1 OR to_user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );
  const conversations = new Map<string, { lastMessage: Message; unreadCount: number }>();
  for (const row of res.rows) {
    const msg = rowToMessage(row);
    const otherUserId = row.from_user_id === userId ? row.to_user_id : row.from_user_id;
    const existing = conversations.get(otherUserId);
    if (!existing) {
      conversations.set(otherUserId, {
        lastMessage: msg,
        unreadCount: row.to_user_id === userId && !row.read ? 1 : 0,
      });
    } else {
      if (new Date(row.created_at) > new Date(existing.lastMessage.createdAt)) {
        existing.lastMessage = msg;
      }
      if (row.to_user_id === userId && !row.read) existing.unreadCount++;
    }
  }
  return Array.from(conversations.entries()).map(([userId, data]) => ({ userId, ...data }));
}

export async function markMessagesAsRead(fromUserId: string, toUserId: string): Promise<void> {
  await query(
    'UPDATE messages SET read = true WHERE from_user_id = $1 AND to_user_id = $2 AND read = false',
    [fromUserId, toUserId]
  );
}
