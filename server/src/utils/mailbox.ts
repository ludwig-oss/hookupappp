/** Same inbox, including Gmail dots, plus-tags, and googlemail.com. */

export function canonicalMailbox(email: string): string {
  const raw = String(email || '').trim().toLowerCase();
  const at = raw.lastIndexOf('@');
  if (at <= 0) return raw;
  let local = raw.slice(0, at);
  let host = raw.slice(at + 1);
  if (host === 'googlemail.com') host = 'gmail.com';
  if (host === 'gmail.com') local = local.split('+')[0].replace(/\./g, '');
  return `${local}@${host}`;
}

export function sameMailbox(a: string, b: string): boolean {
  const left = canonicalMailbox(a);
  const right = canonicalMailbox(b);
  return Boolean(left) && left === right;
}

/** Gmail local part after dot and plus stripping. Empty when this is not Gmail. */
export function gmailLocal(email: string): string {
  const box = canonicalMailbox(email);
  return box.endsWith('@gmail.com') ? box.slice(0, -'@gmail.com'.length) : '';
}
