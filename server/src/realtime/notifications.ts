/**
 * Server-Sent Events (SSE) for real-time notifications (new message, new match).
 * Clients subscribe with EventSource to GET /api/notifications/stream?token=<JWT>.
 */

import type { Response } from 'express';

const connections = new Map<string, Response[]>();

function sendEvent(res: Response, event: string, data: object): void {
  try {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  } catch {
    // Client may have disconnected
  }
}

function sendComment(res: Response, text: string): void {
  try {
    res.write(`: ${text}\n\n`);
  } catch {
    //
  }
}

/** Register an SSE connection for a user (so we can push events to them). */
export function subscribe(userId: string, res: Response): void {
  const list = connections.get(userId) ?? [];
  list.push(res);
  connections.set(userId, list);

  res.on('close', () => {
    const arr = connections.get(userId);
    if (arr) {
      const idx = arr.indexOf(res);
      if (idx !== -1) arr.splice(idx, 1);
      if (arr.length === 0) connections.delete(userId);
    }
  });

  // Send initial connected event
  sendEvent(res, 'connected', { userId });
}

/** Notify a user that they have a new chat message (real-time). */
export function notifyNewMessage(recipientUserId: string, payload: { fromUserId: string; conversationId: string; messageId?: string }): void {
  const list = connections.get(recipientUserId);
  if (!list?.length) return;
  const data = { type: 'new_message', ...payload };
  list.forEach((res) => sendEvent(res, 'new_message', data));
}

/** Notify a user that they have a new match / interest (real-time). */
export function notifyNewMatch(recipientUserId: string, payload: { fromUserId: string; interestId?: string }): void {
  const list = connections.get(recipientUserId);
  if (!list?.length) return;
  const data = { type: 'new_match', ...payload };
  list.forEach((res) => sendEvent(res, 'new_match', data));
}

/** Coach peer-vote result (passed or failed after 48h). */
export function notifyCoachVoteResult(
  recipientUserId: string,
  payload: { passed: boolean; percent: number; totalVotes: number; hints: string[] }
): void {
  const list = connections.get(recipientUserId);
  if (!list?.length) return;
  const data = { type: 'coach_vote_result', ...payload };
  list.forEach((res) => sendEvent(res, 'coach_vote_result', data));
}

/** Pending coach vote for opposite-gender voters. */
export function notifyCoachVoteAvailable(recipientUserId: string, payload: { campaignId: string; applicantName: string }): void {
  const list = connections.get(recipientUserId);
  if (!list?.length) return;
  const data = { type: 'coach_vote_available', ...payload };
  list.forEach((res) => sendEvent(res, 'coach_vote_available', data));
}

/** Someone sent an interest request (Discover). Recipient has 24h to respond. */
export function notifyNewInterest(recipientUserId: string, payload: { fromUserId: string; interestId: string }): void {
  const list = connections.get(recipientUserId);
  if (!list?.length) return;
  const data = { type: 'new_interest', ...payload };
  list.forEach((res) => sendEvent(res, 'new_interest', data));
}

/** Send a keep-alive comment so the connection is not dropped by proxies. */
export function keepAlive(): void {
  connections.forEach((list) => {
    list.forEach((res) => sendComment(res, 'ping'));
  });
}
