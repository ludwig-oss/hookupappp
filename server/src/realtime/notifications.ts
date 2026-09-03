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

/** Notify pending coach vote for opposite-gender voters. */
export function notifyCoachVoteAvailable(recipientUserId: string, payload: { campaignId: string; applicantName: string }): void {
  const list = connections.get(recipientUserId);
  if (!list?.length) return;
  const data = { type: 'coach_vote_available', ...payload };
  list.forEach((res) => sendEvent(res, 'coach_vote_available', data));
}

/** Someone answered your dating advice question. */
export function notifyNewAdviceAnswer(
  recipientUserId: string,
  payload: { questionId: string; fromUserId: string; preview: string }
): void {
  const list = connections.get(recipientUserId);
  if (!list?.length) return;
  const data = { type: 'advice_answer', ...payload };
  list.forEach((res) => sendEvent(res, 'advice_answer', data));
}

/** Wallet balance updated (guide earnings, advice prize, etc.). */
export function notifyWalletUpdate(recipientUserId: string, payload: { amountEur: number; reason: string }): void {
  const list = connections.get(recipientUserId);
  if (!list?.length) return;
  const data = { type: 'wallet_update', ...payload };
  list.forEach((res) => sendEvent(res, 'wallet_update', data));
}

/** Anonymous confession assigned to guide. */
export function notifyConfessionRequest(recipientUserId: string, payload: { sessionId: string }): void {
  const list = connections.get(recipientUserId);
  if (!list?.length) return;
  const data = { type: 'confession_request', ...payload };
  list.forEach((res) => sendEvent(res, 'confession_request', data));
}

/** New message in anonymous confession session. */
export function notifyConfessionMessage(recipientUserId: string, payload: { sessionId: string; preview: string }): void {
  const list = connections.get(recipientUserId);
  if (!list?.length) return;
  const data = { type: 'confession_message', ...payload };
  list.forEach((res) => sendEvent(res, 'confession_message', data));
}

/** Notify applicant they will hear back within 48 hours. */
export function notifyGuideApplicationReceived(
  recipientUserId: string,
  payload: { hours: number; applicationId: string }
): void {
  const list = connections.get(recipientUserId);
  if (!list?.length) return;
  const data = { type: 'guide_application_received', ...payload };
  list.forEach((res) => sendEvent(res, 'guide_application_received', data));
}

/** Notify applicant of the review decision. */
export function notifyGuideApplicationDecision(
  recipientUserId: string,
  payload: { approved: boolean; autoApproved?: boolean }
): void {
  const list = connections.get(recipientUserId);
  if (!list?.length) return;
  const data = { type: 'guide_application_decision', ...payload };
  list.forEach((res) => sendEvent(res, 'guide_application_decision', data));
}

/** Notify a qualified guide-admin that someone applied and needs review. */
export function notifyGuideApplicationPendingReview(
  recipientUserId: string,
  payload: { applicationId: string; applicantName: string }
): void {
  const list = connections.get(recipientUserId);
  if (!list?.length) return;
  const data = { type: 'guide_application_pending_review', ...payload };
  list.forEach((res) => sendEvent(res, 'guide_application_pending_review', data));
}

/** Someone sent an interest request (Discover). Recipient has 24h to respond. */
export function notifyNewInterest(recipientUserId: string, payload: { fromUserId: string; interestId: string }): void {
  const list = connections.get(recipientUserId);
  if (!list?.length) return;
  const data = { type: 'new_interest', ...payload };
  list.forEach((res) => sendEvent(res, 'new_interest', data));
}

/** True when the user currently has an SSE notification stream open (treated as online). */
export function isSseConnected(userId: string): boolean {
  return (connections.get(userId)?.length ?? 0) > 0;
}

/** Notify a user that chat patterns look detached — not a red flag, a watch-out. */
export function notifyChatDisinterest(
  recipientUserId: string,
  payload: { otherUserId: string; score: number; statusLabel: string; report: unknown }
): void {
  const list = connections.get(recipientUserId);
  if (!list?.length) return;
  const data = { type: 'chat_disinterest', ...payload };
  list.forEach((res) => sendEvent(res, 'chat_disinterest', data));
}

/** SOS to a guide: someone paid for live texting help. */
export function notifyTextingHelpSos(
  recipientUserId: string,
  payload: { sessionId: string; fromUserId: string; fromName: string }
): void {
  const list = connections.get(recipientUserId);
  if (!list?.length) return;
  const data = { type: 'texting_help_sos', ...payload };
  list.forEach((res) => sendEvent(res, 'texting_help_sos', data));
}

/** The user who paid: a guide answered the SOS first (highlight on the wheel). */
export function notifyTextingHelpAnswered(
  recipientUserId: string,
  payload: { sessionId: string; guideUserId: string; guideName: string }
): void {
  const list = connections.get(recipientUserId);
  if (!list?.length) return;
  const data = { type: 'texting_help_answered', ...payload };
  list.forEach((res) => sendEvent(res, 'texting_help_answered', data));
}

/** Chosen guide: user picked them for live screen-share help. */
export function notifyTextingHelpChosen(
  recipientUserId: string,
  payload: { sessionId: string; liveRoomUrl: string }
): void {
  const list = connections.get(recipientUserId);
  if (!list?.length) return;
  const data = { type: 'texting_help_chosen', ...payload };
  list.forEach((res) => sendEvent(res, 'texting_help_chosen', data));
}

/** Date Arena match found / accepted / idea spun. */
export function notifyDateMatch(
  recipientUserId: string,
  payload: { matchId: string; fromUserId: string; status: string; ideaTitle?: string | null }
): void {
  const list = connections.get(recipientUserId);
  if (!list?.length) return;
  const data = { type: 'date_match', ...payload };
  list.forEach((res) => sendEvent(res, 'date_match', data));
}

/** Pitch-yourself offer (Plus after reject, or Platinum direct). */
export function notifyPitch(
  recipientUserId: string,
  payload: { pitchId: string; fromUserId: string; incoming: boolean; accepted?: boolean }
): void {
  const list = connections.get(recipientUserId);
  if (!list?.length) return;
  const data = { type: 'date_pitch', ...payload };
  list.forEach((res) => sendEvent(res, 'date_pitch', data));
}

/** Guide lawyer 3-person room. */
export function notifyLawyerRoom(
  recipientUserId: string,
  payload: { sessionId: string; role: string; accepted?: boolean }
): void {
  const list = connections.get(recipientUserId);
  if (!list?.length) return;
  const data = { type: 'date_lawyer', ...payload };
  list.forEach((res) => sendEvent(res, 'date_lawyer', data));
}

/** Send a keep-alive comment so the connection is not dropped by proxies. */
export function keepAlive(): void {
  connections.forEach((list) => {
    list.forEach((res) => sendComment(res, 'ping'));
  });
}
