/** First word of a sign-in name, at most 6 characters. The person can edit it later. */
export function displayFirstName(raw: string | null | undefined): string {
  const first = String(raw || '').trim().split(/\s+/)[0] || '';
  return first.slice(0, 6);
}
