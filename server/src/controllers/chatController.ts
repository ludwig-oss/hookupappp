import { Request, Response } from 'express';
import { createMessage, getConversation, getUserConversations, markMessagesAsRead } from '../models/chat.js';
import { getAllUsers, getUserById, blockUser, muteUser, unmatchUser } from '../models/user.js';
import { getActiveFocus, setFocus as setFocusRecord, clearFocus } from '../models/chatFocus.js';
import { checkContent } from '../utils/moderation.js';
import { notifyNewMessage } from '../realtime/notifications.js';
import { sendPushToUser } from '../realtime/push.js';
import { sanitizeMessageContent } from '../utils/sanitize.js';

function isBlocked(blocker: string[], blocked: string): boolean {
  return (blocker || []).includes(blocked);
}

export const sendMessage = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || req.body.fromUserId;
    const { toUserId } = req.body;
    const content = sanitizeMessageContent(req.body.content);

    if (!toUserId || !content) {
      return res.status(400).json({ error: 'Recipient and message content are required' });
    }

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const fromUser = await getUserById(userId);
    const toUser = await getUserById(toUserId);
    if (!fromUser || !toUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (isBlocked(fromUser.blockedUsers || [], toUserId) || isBlocked(toUser.blockedUsers || [], userId)) {
      return res.status(403).json({ error: 'You cannot message this user.' });
    }

    const moderation = checkContent(content);
    if (!moderation.allowed) {
      return res.status(400).json({ error: moderation.reason || 'Message not allowed.' });
    }

    const message = await createMessage({
      fromUserId: userId,
      toUserId,
      content,
    });

    notifyNewMessage(toUserId, { fromUserId: userId, conversationId: userId, messageId: message.id });
    sendPushToUser(toUserId, {
      title: `New message from ${fromUser.name}`,
      body: typeof content === 'string' ? content.slice(0, 100) : '',
      data: { fromUserId: userId, conversationId: userId, messageId: message.id },
    }).catch(() => {});

    res.json({ message });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getConversationMessages = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || req.query.userId as string;
    const { otherUserId } = req.params;

    if (!userId || !otherUserId) {
      return res.status(400).json({ error: 'User IDs are required' });
    }

    const me = await getUserById(userId);
    const other = await getUserById(otherUserId);
    if (me && other && (isBlocked(me.blockedUsers || [], otherUserId) || isBlocked(other.blockedUsers || [], userId))) {
      return res.json({ messages: [] });
    }

    const messages = await getConversation(userId, otherUserId);
    res.json({ messages });
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getConversationsList = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || req.query.userId as string;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const currentUser = await getUserById(userId);
    const blockedSet = new Set(currentUser?.blockedUsers || []);

    const raw = await getUserConversations(userId);
    const filtered = raw.filter((c) => !blockedSet.has(c.userId));
    const conversations = await Promise.all(
      filtered.map(async (c) => {
        const other = await getUserById(c.userId);
        return {
          ...c,
          name: other?.name ?? 'Unknown',
          profilePicture: other?.profilePicture ?? null,
        };
      })
    );
    res.json({ conversations });
  } catch (error) {
    console.error('Get conversations list error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAvailableUsers = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || req.query.userId as string;
    const currentUser = await getUserById(userId);
    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const users = await getAllUsers();
    // Filter out blocked, muted, unmatched users, and self
    const filteredUsers = users.filter(u => 
      u.id !== userId && 
      !currentUser.blockedUsers?.includes(u.id) &&
      !currentUser.unmatchedUsers?.includes(u.id)
    );
    res.json({ users: filteredUsers });
  } catch (error) {
    console.error('Get available users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const searchUsersByUsername = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || req.query.userId as string;
    const q = ((req.query.q as string) || '').trim().toLowerCase();
    if (!q) {
      return res.json({ users: [] });
    }
    const currentUser = await getUserById(userId);
    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    const users = await getAllUsers();
    const filtered = users.filter(u =>
      u.id !== userId &&
      !currentUser.blockedUsers?.includes(u.id) &&
      !currentUser.unmatchedUsers?.includes(u.id) &&
      (u.username || '').toLowerCase().includes(q)
    );
    res.json({
      users: filtered.map(u => ({
        id: u.id,
        name: u.name,
        username: u.username,
        profilePicture: u.profilePicture,
      })),
    });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const markAsRead = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId || req.body.userId;
    const { otherUserId } = req.body;

    if (!userId || !otherUserId) {
      return res.status(400).json({ error: 'User IDs are required' });
    }

    await markMessagesAsRead(otherUserId, userId);
    res.json({ message: 'Messages marked as read' });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const blockChatUser = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { blockedUserId } = req.body;

    if (!blockedUserId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    await blockUser(userId, blockedUserId);
    res.json({ message: 'User blocked' });
  } catch (error) {
    console.error('Block user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const muteChatUser = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { mutedUserId } = req.body;

    if (!mutedUserId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    await muteUser(userId, mutedUserId);
    res.json({ message: 'User muted' });
  } catch (error) {
    console.error('Mute user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const unmatchChatUser = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { unmatchedUserId } = req.body;

    if (!unmatchedUserId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    await unmatchUser(userId, unmatchedUserId);
    res.json({ message: 'User unmatched' });
  } catch (error) {
    console.error('Unmatch user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// --- Focus (5-day commitment) ---
export const getFocus = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const focus = await getActiveFocus(userId);
    if (!focus) return res.json({ focus: null });
    const partner = await getUserById(focus.focusedUserId);
    const endsAt = new Date(focus.endsAt);
    const now = new Date();
    const daysLeft = Math.max(0, Math.ceil((endsAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
    res.json({
      focus: {
        partnerUserId: focus.focusedUserId,
        partnerName: partner?.name ?? null,
        startedAt: focus.startedAt,
        endsAt: focus.endsAt,
        daysLeft,
      },
    });
  } catch (error) {
    console.error('Get focus error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const startFocus = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { partnerUserId } = req.body;
    if (!userId || !partnerUserId) {
      return res.status(400).json({ error: 'partnerUserId is required' });
    }
    const focus = await setFocusRecord(userId, partnerUserId);
    const partner = await getUserById(focus.focusedUserId);
    const endsAt = new Date(focus.endsAt);
    const daysLeft = 5;
    res.json({
      focus: {
        partnerUserId: focus.focusedUserId,
        partnerName: partner?.name ?? null,
        startedAt: focus.startedAt,
        endsAt: focus.endsAt,
        daysLeft,
      },
    });
  } catch (error) {
    console.error('Start focus error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const endFocus = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    await clearFocus(userId);
    res.json({ focus: null, message: 'Focus ended. You can chat with anyone now.' });
  } catch (error) {
    console.error('End focus error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};




