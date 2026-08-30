/** Match server pin normalization — mobile keyboards may use fullwidth digits. */
export function normalizePinDigits(raw: string): string {
  return String(raw ?? '')
    .normalize('NFKC')
    .replace(/[\uFF10-\uFF19]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xff10 + 0x30))
    .replace(/[\u0660-\u0669]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x0660 + 0x30))
    .replace(/[\u0966-\u096F]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x0966 + 0x30))
    .replace(/\D/g, '')
    .slice(0, 6);
}
