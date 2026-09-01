import jwt from 'jsonwebtoken';

const JWT_STAY_LOGGED_IN = '30d';
const JWT_SESSION = '12h';

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set in production (min 32 characters). Set it in server/.env');
  }
  return secret || 'dev-only-secret-do-not-use-in-production';
}

export function wantsStayLoggedIn(body: { stayLoggedIn?: unknown }): boolean {
  return body.stayLoggedIn !== false;
}

export function signAuthToken(user: { id: string; email: string }, stayLoggedIn: boolean): string {
  return jwt.sign(
    { userId: user.id, email: user.email, stayLoggedIn: Boolean(stayLoggedIn) },
    getJwtSecret(),
    { expiresIn: stayLoggedIn ? JWT_STAY_LOGGED_IN : JWT_SESSION }
  );
}
