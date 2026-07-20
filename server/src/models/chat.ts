import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { usePostgres } from '../db/index.js';
import * as pgChat from '../db/pg-chat.js';

export interface Message {
  id: string;
  fromUserId: string;
  toUserId: string;
  content: string;
  createdAt: Date | string;
  read: boolean;
}

const DB_PATH = join(process.cwd(), 'server', 'data', 'messages.json');

async function readMessages(): Promise<Message[]> {
  try {
    const data = await readFile(DB_PATH, 'utf-8');
    const messages = JSON.parse(data);
    return messages.map((msg: Message) => ({
      ...msg,
      createdAt: msg.createdAt ? new Date(msg.createdAt) : new Date(),
    }));
  } catch (error) {
    return [];
  }
}

async function writeMessages(messages: Message[]): Promise<void> {
  const dir = join(process.cwd(), 'server', 'data');
  await import('fs/promises').then(fs => fs.mkdir(dir, { recursive: true }));
  await writeFile(DB_PATH, JSON.stringify(messages, null, 2));
}

export async function createMessage(messageData: Omit<Message, 'id' | 'createdAt' | 'read'>): Promise<Message> {
  if (usePostgres()) return pgChat.createMessage(messageData);
  const messages = await readMessages();
  const message: Message = {
    ...messageData,
    id: Date.now().toString() + Math.random().toString(36).slice(2, 7),
    createdAt: new Date(),
    read: false,
  };
  messages.push(message);
  await writeMessages(messages);
  return message;
}

/**
 * After "I'm interested" / buzz / walk match — seed a thread so both users
 * appear in Communications until they unmatch or miss reply/meetup deadlines.
 */
export async function ensureMatchConversation(
  fromUserId: string,
  toUserId: string,
  opener = "You're matched! Say hi and start chatting 💬"
): Promise<Message | null> {
  if (!fromUserId || !toUserId || fromUserId === toUserId) return null;
  const existing = await getConversation(fromUserId, toUserId);
  if (existing.length > 0) return null;
  return createMessage({ fromUserId, toUserId, content: opener });
}

export async function getConversation(userId1: string, userId2: string): Promise<Message[]> {
  if (usePostgres()) return pgChat.getConversation(userId1, userId2);
  const messages = await readMessages();
  return messages.filter(
    (msg) =>
      (msg.fromUserId === userId1 && msg.toUserId === userId2) ||
      (msg.fromUserId === userId2 && msg.toUserId === userId1)
  ).sort((a, b) => {
    const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
    const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
    return dateA.getTime() - dateB.getTime();
  });
}

export async function getUserConversations(userId: string): Promise<{ userId: string; lastMessage: Message; unreadCount: number }[]> {
  if (usePostgres()) return pgChat.getUserConversations(userId);
  const messages = await readMessages();
  const conversations = new Map<string, { lastMessage: Message; unreadCount: number }>();

  messages.forEach((msg) => {
    if (msg.fromUserId === userId || msg.toUserId === userId) {
      const otherUserId = msg.fromUserId === userId ? msg.toUserId : msg.fromUserId;
      const existing = conversations.get(otherUserId);

      if (!existing) {
        conversations.set(otherUserId, {
          lastMessage: msg,
          unreadCount: msg.toUserId === userId && !msg.read ? 1 : 0,
        });
      } else {
        const msgDate = msg.createdAt instanceof Date ? msg.createdAt : new Date(msg.createdAt);
        const existingDate = existing.lastMessage.createdAt instanceof Date
          ? existing.lastMessage.createdAt
          : new Date(existing.lastMessage.createdAt);

        if (msgDate > existingDate) {
          existing.lastMessage = msg;
        }
        if (msg.toUserId === userId && !msg.read) {
          existing.unreadCount++;
        }
      }
    }
  });

  return Array.from(conversations.entries()).map(([userId, data]) => ({
    userId,
    ...data,
  }));
}

export async function markMessagesAsRead(fromUserId: string, toUserId: string): Promise<void> {
  if (usePostgres()) return pgChat.markMessagesAsRead(fromUserId, toUserId);
  const messages = await readMessages();
  messages.forEach((msg) => {
    if (msg.fromUserId === fromUserId && msg.toUserId === toUserId && !msg.read) {
      msg.read = true;
    }
  });
  await writeMessages(messages);
}







