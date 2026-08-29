/** WebAuthn RP / origin — set WEBAUTHN_RP_ID and FRONTEND_URL on production. */
export function getWebAuthnRpId(): string {
  const explicit = process.env.WEBAUTHN_RP_ID?.trim();
  if (explicit) return explicit;
  const frontend = process.env.FRONTEND_URL?.trim();
  if (frontend) {
    try {
      return new URL(frontend).hostname;
    } catch {
      //
    }
  }
  return 'localhost';
}

export function getWebAuthnOrigin(): string {
  const explicit = process.env.WEBAUTHN_ORIGIN?.trim();
  if (explicit) return explicit;
  const frontend = process.env.FRONTEND_URL?.trim();
  if (frontend) return frontend.replace(/\/$/, '');
  return 'http://localhost:5173';
}

export const WEBAUTHN_RP_NAME = process.env.WEBAUTHN_RP_NAME?.trim() || 'ASWP';
