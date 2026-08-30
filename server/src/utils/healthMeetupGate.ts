import { getMeetupPlansForUser } from '../models/safety.js';

/** Health results can only be requested when a meetup with this person is planned. */
export async function hasPlannedMeetupWith(userId: string, otherUserId: string): Promise<boolean> {
  const [plansA, plansB] = await Promise.all([
    getMeetupPlansForUser(userId),
    getMeetupPlansForUser(otherUserId),
  ]);
  const combined = [...plansA, ...plansB];
  return combined.some(
    (p) =>
      (p.userId === userId && p.chatPartnerUserId === otherUserId) ||
      (p.userId === otherUserId && p.chatPartnerUserId === userId)
  );
}
