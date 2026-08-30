/** Normalize PIN input: NFKC, map unicode/fullwidth digits to ASCII, keep digits only. */
export function normalizePinDigits(raw: unknown): string {
  return String(raw ?? '')
    .normalize('NFKC')
    .replace(/[\uFF10-\uFF19]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xff10 + 0x30))
    .replace(/[\u0660-\u0669]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x0660 + 0x30))
    .replace(/[\u0966-\u096F]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x0966 + 0x30))
    .replace(/\D/g, '');
}

export function isValidPinFormat(pin: string): boolean {
  return /^\d{6}$/.test(pin);
}

export function secretCandidates(raw: unknown): string[] {
  const trimmed = String(raw ?? '').trim();
  const pin = normalizePinDigits(raw);
  const out: string[] = [];
  if (trimmed) out.push(trimmed);
  if (pin && pin !== trimmed) out.push(pin);
  if (pin.length === 6 && !out.includes(pin)) out.push(pin);
  return [...new Set(out)];
}
