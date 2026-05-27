/** Days between tips: 90–120 (≈3–4 months), stable per user id + audience. */
export function intervalDaysForUser(userId: string, audience: string): number {
  let h = 0;
  const seed = `${audience}:${userId}`;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return 90 + (Math.abs(h) % 31);
}
