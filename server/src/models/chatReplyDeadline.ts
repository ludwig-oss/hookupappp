import { getConversation, type Message } from './chat.js';
import { unmatchUser } from './user.js';

export const REPLY_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface ReplyDeadlineStatus {
  active: boolean;
  owesReplyUserId: string | null;
  deadlineAt: string | null;
  expired: boolean;
  hoursRemaining: number | null;
  minutesRemaining: number | null;
  ruleText: string;
}

const EMPTY_STATUS: ReplyDeadlineStatus = {
  active: false,
  owesReplyUserId: null,
  deadlineAt: null,
  expired: false,
  hoursRemaining: null,
  minutesRemaining: null,
  ruleText:
    'After you match or accept each other\'s interest, reply within 24 hours to every message you receive — or the match ends. This applies to all ongoing chats.',
};

export function statusFromMessages(viewerUserId: string, messages: Message[]): ReplyDeadlineStatus {
  if (!messages.length) {
    return {
      ...EMPTY_STATUS,
      ruleText:
        'Say hi — they have 24 hours to reply after your message, and you\'ll have 24 hours after each message they send.',
    };
  }

  const last = messages[messages.length - 1];
  const owesReplyUserId = last.toUserId;
  const deadlineMs = new Date(last.createdAt).getTime() + REPLY_WINDOW_MS;
  const remainingMs = deadlineMs - Date.now();
  const expired = remainingMs <= 0;
  const hoursRemaining = expired ? 0 : Math.floor(remainingMs / (60 * 60 * 1000));
  const minutesRemaining = expired ? 0 : Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));

  let ruleText: string;
  if (owesReplyUserId === viewerUserId) {
    ruleText = expired
      ? 'You did not reply within 24 hours. This match is ending.'
      : `You must reply within ${hoursRemaining}h ${minutesRemaining}m or you'll be unmatched.`;
  } else {
    ruleText = expired
      ? 'They did not reply within 24 hours. This match is ending.'
      : `They must reply within ${hoursRemaining}h ${minutesRemaining}m after your message.`;
  }

  return {
    active: true,
    owesReplyUserId,
    deadlineAt: new Date(deadlineMs).toISOString(),
    expired,
    hoursRemaining,
    minutesRemaining,
    ruleText,
  };
}

export async function mutualUnmatch(userA: string, userB: string): Promise<void> {
  await unmatchUser(userA, userB);
  await unmatchUser(userB, userA);
}

export async function enforceReplyDeadline(
  viewerUserId: string,
  otherUserId: string
): Promise<{ unmatched: boolean; reason?: string; status: ReplyDeadlineStatus }> {
  const messages = await getConversation(viewerUserId, otherUserId);
  const status = statusFromMessages(viewerUserId, messages);

  if (!status.active || !status.expired || !status.owesReplyUserId) {
    return { unmatched: false, status };
  }

  await mutualUnmatch(viewerUserId, otherUserId);

  const reason =
    status.owesReplyUserId === viewerUserId
      ? 'You did not reply within 24 hours. This match has ended to keep chats active and real.'
      : 'They did not reply within 24 hours. This match has ended.';

  return { unmatched: true, reason, status };
}

export async function getReplyStatusForConversation(
  viewerUserId: string,
  otherUserId: string
): Promise<ReplyDeadlineStatus> {
  const messages = await getConversation(viewerUserId, otherUserId);
  return statusFromMessages(viewerUserId, messages);
}
