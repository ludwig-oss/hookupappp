import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import {
  createUser,
  getUserByEmail,
  getUserById,
  getUserByUsername,
  getAllUsers,
  updateUserProfile,
  type User,
} from '../models/user.js';
import { isUsernameReserved, reserveUsername } from '../models/usernameRegistry.js';

const JWT_EXPIRES_IN = '7d';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set in production');
  }
  return secret || 'dev-only-secret-do-not-use-in-production';
}

function frontendBase(): string {
  return (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');
}

function isRenderHost(url: string): boolean {
  try {
    const host = new URL(url.startsWith('http') ? url : `https://${url}`).hostname.toLowerCase();
    return host.includes('onrender.com');
  } catch {
    return false;
  }
}

function parseHttpOrigin(raw: string): string {
  try {
    const u = new URL(raw.includes('://') ? raw : `https://${raw}`);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    return `${u.protocol}//${u.host}`.replace(/\/+$/, '');
  } catch {
    return '';
  }
}

function isAllowedOAuthOrigin(origin: string): boolean {
  try {
    const u = new URL(origin);
    const host = u.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1') return true;
    if (host === 'hookupapp.dev' || host.endsWith('.hookupapp.dev')) return true;
    if (host.endsWith('.vercel.app')) return true;
    const frontend = parseHttpOrigin(process.env.FRONTEND_URL || '');
    if (frontend && origin === frontend) return true;
    const extra = parseHttpOrigin(process.env.OAUTH_CALLBACK_BASE || '');
    if (extra && origin === extra) return true;
    return false;
  } catch {
    return false;
  }
}

function safeAppOrigin(origin: string | undefined, fallback: string): string {
  const parsed = parseHttpOrigin(origin || '');
  if (parsed && isAllowedOAuthOrigin(parsed) && !isRenderHost(parsed)) return parsed;
  return fallback.replace(/\/+$/, '');
}

/** Public app URL — never send users to Render's cold-start splash for OAuth. */
function oauthCallbackBase(req: Request): string {
  const frontend = (process.env.FRONTEND_URL || '').replace(/\/+$/, '');
  if (frontend && !isRenderHost(frontend)) return frontend;

  const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
  const host = (req.headers['x-forwarded-host'] as string) || req.headers.host || '';
  const inferred = host ? `${proto}://${host}`.replace(/\/+$/, '') : '';
  if (inferred && !isRenderHost(inferred)) return inferred;

  const configured = (process.env.OAUTH_CALLBACK_BASE || '').replace(/\/+$/, '');
  if (configured && !isRenderHost(configured)) return configured;
  if (configured) return configured;

  return inferred || frontend || frontendBase();
}

function originFromRequest(req: Request): string {
  const candidates = [
    String(req.query.return_origin || ''),
    String(req.headers.origin || ''),
    String(req.headers.referer || ''),
  ];
  for (const c of candidates) {
    if (!c) continue;
    const origin = parseHttpOrigin(c);
    if (origin && isAllowedOAuthOrigin(origin) && !isRenderHost(origin)) return origin;
  }
  return oauthCallbackBase(req);
}

/** Public Web client ID — not a secret. Used when Render env is missing so phones can still sign in. */
const PUBLIC_GOOGLE_WEB_CLIENT_ID =
  '20879117427-ksgnef8b8dlnmv8h2d9a2403ihcrb18f.apps.googleusercontent.com';

function googleWebClientId(): string {
  return process.env.GOOGLE_CLIENT_ID?.trim() || PUBLIC_GOOGLE_WEB_CLIENT_ID;
}

function parseOAuthState(state: string): { o?: string; nonce?: string } {
  try {
    return JSON.parse(Buffer.from(String(state || ''), 'base64url').toString('utf8')) as {
      o?: string;
      nonce?: string;
    };
  } catch {
    return {};
  }
}

function encodeOAuthState(origin: string, nonce?: string): string {
  return Buffer.from(JSON.stringify({ n: uuidv4(), o: origin, nonce: nonce || uuidv4() }), 'utf8').toString(
    'base64url'
  );
}

function originFromOAuthState(state: string, req: Request): string {
  return safeAppOrigin(parseOAuthState(state).o, originFromRequest(req));
}

/** OAuth providers redirect here (Vercel / localhost app) — bridge page wakes API then hits /api/auth/.../callback */
function oauthReturnRedirectUri(provider: 'google' | 'facebook' | 'apple', origin: string): string {
  return `${origin.replace(/\/+$/, '')}/auth/oauth-return/${provider}`;
}

function missingOAuthVarsMessage(label: string, vars: string[]): string {
  const onRender = Boolean(process.env.RENDER);
  const where = onRender
    ? `Set ${vars.join(' and ')} on Render, then redeploy.`
    : `Add ${vars.join(' and ')} to server/.env and restart the API.`;
  return `${label} is not configured yet. ${where}`;
}

function toClientUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    username: user.username,
    profilePicture: user.profilePicture ?? null,
    profileSetupComplete: Boolean(user.profileSetupComplete),
    emailVerified: Boolean(user.emailVerified),
    improvementCategories: Array.isArray(user.improvementCategories) ? user.improvementCategories : [],
    phoneNumber: user.phoneNumber ?? null,
    age: user.age,
    country: user.country,
    city: user.city,
    hasBackupPassword: Boolean(user.backupPasswordHash),
    hasGoogleAuth: Boolean(user.googleId),
  };
}

function issueTokenAndRedirect(res: Response, user: User, origin?: string) {
  const token = jwt.sign({ userId: user.id, email: user.email }, getJwtSecret(), {
    expiresIn: JWT_EXPIRES_IN,
  });
  const base = safeAppOrigin(origin, frontendBase());
  const dest = `${base}/auth/callback?token=${encodeURIComponent(token)}&setup=${user.profileSetupComplete ? '1' : '0'}`;
  res.redirect(302, dest);
}

function redirectError(res: Response, message: string, origin?: string) {
  const base = safeAppOrigin(origin, frontendBase());
  res.redirect(302, `${base}/login?oauth_error=${encodeURIComponent(message)}`);
}

async function findByGoogleId(googleId: string): Promise<User | null> {
  const users = await getAllUsers();
  const hit = users.find((u) => (u as any).googleId === googleId);
  return hit ? ((await getUserById(hit.id)) as User) : null;
}

async function findByFacebookId(facebookId: string): Promise<User | null> {
  const users = await getAllUsers();
  const hit = users.find((u) => (u as any).facebookId === facebookId);
  return hit ? ((await getUserById(hit.id)) as User) : null;
}

async function findByAppleId(appleId: string): Promise<User | null> {
  const users = await getAllUsers();
  const hit = users.find((u) => (u as any).appleId === appleId);
  return hit ? ((await getUserById(hit.id)) as User) : null;
}

async function uniqueUsername(base: string): Promise<string> {
  let clean = base.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 16) || 'user';
  if (clean.length < 3) clean = `user${clean}`;
  let candidate = clean;
  let i = 0;
  while ((await getUserByUsername(candidate)) || (await isUsernameReserved(candidate))) {
    i += 1;
    candidate = `${clean.slice(0, 12)}${i}`;
  }
  return candidate;
}

async function upsertOAuthUser(opts: {
  provider: 'google' | 'facebook' | 'apple';
  providerId: string;
  email: string;
  name: string;
  picture?: string | null;
}): Promise<User> {
  const { provider, providerId, email, name, picture } = opts;
  const existingByProvider =
    provider === 'google'
      ? await findByGoogleId(providerId)
      : provider === 'facebook'
        ? await findByFacebookId(providerId)
        : await findByAppleId(providerId);
  if (existingByProvider) {
    if (picture && !existingByProvider.profilePicture) {
      await updateUserProfile(existingByProvider.id, { profilePicture: picture });
    }
    return (await getUserById(existingByProvider.id)) || existingByProvider;
  }

  if (email) {
    const byEmail = await getUserByEmail(email.toLowerCase());
    if (byEmail) {
      const patch: Partial<User> = {
        emailVerified: true,
        ...(picture && !byEmail.profilePicture ? { profilePicture: picture } : {}),
      };
      const idKey = provider === 'google' ? 'googleId' : provider === 'facebook' ? 'facebookId' : 'appleId';
      (patch as any)[idKey] = providerId;
      await updateUserProfile(byEmail.id, patch);
      return (await getUserById(byEmail.id)) || byEmail;
    }
  }

  const username = await uniqueUsername((email || name || 'user').split('@')[0]);
  const randomPass = await bcrypt.hash(uuidv4() + providerId, 10);
  const user = await createUser({
    email: email || `${provider}_${providerId}@oauth.local`,
    password: randomPass,
    name: name || username,
    username,
    improvementCategories: ['dating-apps'],
    passwordHint1: 'oauth',
    passwordHint2: 'oauth',
    passwordHint3: 'oauth',
  });
  await reserveUsername(username, user.id);
  const idPatch =
    provider === 'google'
      ? ({ googleId: providerId } as any)
      : provider === 'facebook'
        ? ({ facebookId: providerId } as any)
        : ({ appleId: providerId } as any);
  await updateUserProfile(user.id, {
    emailVerified: true,
    pinAuth: false,
    profileSetupComplete: false,
    profilePicture: picture || null,
    ...idPatch,
  });
  return (await getUserById(user.id)) || user;
}

export function oauthStatus(_req: Request, res: Response) {
  res.json({
    google: Boolean(googleWebClientId()),
    facebook: Boolean(process.env.FACEBOOK_APP_ID?.trim() && process.env.FACEBOOK_APP_SECRET?.trim()),
    apple: Boolean(process.env.APPLE_CLIENT_ID?.trim() && process.env.APPLE_TEAM_ID?.trim()),
  });
}

export function startGoogle(req: Request, res: Response) {
  const origin = originFromRequest(req);
  const clientId = googleWebClientId();
  const secret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId) {
    return redirectError(res, 'Google sign-in is unavailable. Try username + PIN.', origin);
  }
  const redirectUri = oauthReturnRedirectUri('google', origin);
  const nonce = uuidv4();
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('prompt', 'select_account');
  url.searchParams.set('state', encodeOAuthState(origin, nonce));
  if (secret) {
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('access_type', 'online');
    url.searchParams.set('include_granted_scopes', 'true');
  } else {
    // No client secret on the host (typical Render miss). ID token in the URL hash still works on phones.
    url.searchParams.set('response_type', 'id_token');
    url.searchParams.set('nonce', nonce);
    url.searchParams.set('response_mode', 'fragment');
  }
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Referrer-Policy', 'no-referrer-when-downgrade');
  res.redirect(302, url.toString());
}

async function googleProfileFromIdToken(idToken: string, expectedNonce?: string) {
  const clientId = googleWebClientId();
  const tokenRes = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
  );
  const payload = (await tokenRes.json()) as {
    error?: string;
    aud?: string;
    iss?: string;
    sub?: string;
    email?: string;
    email_verified?: string | boolean;
    name?: string;
    picture?: string;
    nonce?: string;
  };
  if (!tokenRes.ok || payload.error || !payload.sub) {
    throw new Error('Google sign-in expired. Tap Sign in with Google again.');
  }
  if (payload.aud !== clientId) {
    throw new Error('Google sign-in did not match this app.');
  }
  const iss = String(payload.iss || '');
  if (iss !== 'https://accounts.google.com' && iss !== 'accounts.google.com') {
    throw new Error('Google sign-in did not match this app.');
  }
  if (expectedNonce && payload.nonce && payload.nonce !== expectedNonce) {
    throw new Error('Google sign-in expired. Tap Sign in with Google again.');
  }
  const verified = payload.email_verified === true || payload.email_verified === 'true';
  if (!payload.email || !verified) {
    throw new Error('Google did not share a verified Gmail. Allow email access and try again.');
  }
  return {
    id: payload.sub,
    email: payload.email.toLowerCase(),
    name: payload.name || 'Google User',
    picture: payload.picture || null,
  };
}

export async function googleIdToken(req: Request, res: Response) {
  try {
    const idToken = String(req.body?.idToken || req.body?.credential || req.query.id_token || '').trim();
    if (!idToken) {
      return res.status(400).json({ error: 'Google did not return a sign-in token.' });
    }
    const nonce = parseOAuthState(String(req.body?.state || req.query.state || '')).nonce;
    const profile = await googleProfileFromIdToken(idToken, nonce);
    const user = await upsertOAuthUser({
      provider: 'google',
      providerId: profile.id,
      email: profile.email,
      name: profile.name,
      picture: profile.picture,
    });
    const token = jwt.sign({ userId: user.id, email: user.email }, getJwtSecret(), {
      expiresIn: JWT_EXPIRES_IN,
    });
    return res.json({
      token,
      setup: user.profileSetupComplete ? '1' : '0',
      user: toClientUser(user),
    });
  } catch (e: any) {
    console.error('Google ID token error:', e);
    return res.status(400).json({ error: e.message || 'Google sign-in failed' });
  }
}

export async function googleCallback(req: Request, res: Response) {
  const origin = originFromOAuthState(String(req.query.state || ''), req);
  try {
    const idToken = String(req.query.id_token || '').trim();
    if (idToken) {
      const nonce = parseOAuthState(String(req.query.state || '')).nonce;
      const profile = await googleProfileFromIdToken(idToken, nonce);
      const user = await upsertOAuthUser({
        provider: 'google',
        providerId: profile.id,
        email: profile.email,
        name: profile.name,
        picture: profile.picture,
      });
      return issueTokenAndRedirect(res, user, origin);
    }

    const clientId = googleWebClientId();
    const secret = process.env.GOOGLE_CLIENT_SECRET?.trim();
    if (!clientId) {
      return redirectError(res, 'Google sign-in is unavailable. Try username + PIN.', origin);
    }
    if (!secret) {
      return redirectError(res, 'Google sign-in needs another tap. Use Sign in with Google again.', origin);
    }
    const code = String(req.query.code || '');
    const err = String(req.query.error || '');
    if (err) return redirectError(res, err, origin);
    if (!code) return redirectError(res, 'Google did not return a code.', origin);

    const redirectUri = oauthReturnRedirectUri('google', origin);
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: secret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    const tokenJson = (await tokenRes.json()) as { access_token?: string; error?: string };
    if (!tokenRes.ok || !tokenJson.access_token) {
      return redirectError(res, tokenJson.error || 'Google token exchange failed', origin);
    }

    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    });
    const profile = (await profileRes.json()) as {
      id?: string;
      email?: string;
      name?: string;
      picture?: string;
      verified_email?: boolean;
    };
    if (!profile.id) return redirectError(res, 'Could not read Google profile', origin);

    if (!profile.email) {
      return redirectError(res, 'Google did not share your Gmail. Allow email access and try again.', origin);
    }

    const user = await upsertOAuthUser({
      provider: 'google',
      providerId: profile.id,
      email: profile.email.toLowerCase(),
      name: profile.name || 'Google User',
      picture: profile.picture || null,
    });
    issueTokenAndRedirect(res, user, origin);
  } catch (e: any) {
    console.error('Google OAuth error:', e);
    redirectError(res, e.message || 'Google sign-in failed', origin);
  }
}

export function startFacebook(req: Request, res: Response) {
  const origin = originFromRequest(req);
  const appId = process.env.FACEBOOK_APP_ID?.trim();
  const secret = process.env.FACEBOOK_APP_SECRET?.trim();
  if (!appId || !secret) {
    return redirectError(res, missingOAuthVarsMessage('Facebook sign-in', ['FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET']), origin);
  }
  const redirectUri = oauthReturnRedirectUri('facebook', origin);
  const url = new URL('https://www.facebook.com/v19.0/dialog/oauth');
  url.searchParams.set('client_id', appId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', encodeOAuthState(origin));
  url.searchParams.set('scope', 'email,public_profile');
  res.redirect(302, url.toString());
}

export async function facebookCallback(req: Request, res: Response) {
  const origin = originFromOAuthState(String(req.query.state || ''), req);
  try {
    const appId = process.env.FACEBOOK_APP_ID?.trim();
    const secret = process.env.FACEBOOK_APP_SECRET?.trim();
    if (!appId || !secret) {
      return redirectError(res, 'Facebook sign-in is not configured.', origin);
    }
    const code = String(req.query.code || '');
    const err = String(req.query.error_description || req.query.error || '');
    if (err) return redirectError(res, err, origin);
    if (!code) return redirectError(res, 'Facebook did not return a code.', origin);

    const redirectUri = oauthReturnRedirectUri('facebook', origin);
    const tokenUrl = new URL('https://graph.facebook.com/v19.0/oauth/access_token');
    tokenUrl.searchParams.set('client_id', appId);
    tokenUrl.searchParams.set('client_secret', secret);
    tokenUrl.searchParams.set('redirect_uri', redirectUri);
    tokenUrl.searchParams.set('code', code);
    const tokenRes = await fetch(tokenUrl.toString());
    const tokenJson = (await tokenRes.json()) as { access_token?: string; error?: { message?: string } };
    if (!tokenRes.ok || !tokenJson.access_token) {
      return redirectError(res, tokenJson.error?.message || 'Facebook token exchange failed', origin);
    }

    const profileUrl = new URL('https://graph.facebook.com/me');
    profileUrl.searchParams.set('fields', 'id,name,email,picture.type(large)');
    profileUrl.searchParams.set('access_token', tokenJson.access_token);
    const profileRes = await fetch(profileUrl.toString());
    const profile = (await profileRes.json()) as {
      id?: string;
      name?: string;
      email?: string;
      picture?: { data?: { url?: string } };
    };
    if (!profile.id) return redirectError(res, 'Could not read Facebook profile', origin);

    const user = await upsertOAuthUser({
      provider: 'facebook',
      providerId: profile.id,
      email: (profile.email || '').toLowerCase(),
      name: profile.name || 'Facebook User',
      picture: profile.picture?.data?.url || null,
    });
    issueTokenAndRedirect(res, user, origin);
  } catch (e: any) {
    console.error('Facebook OAuth error:', e);
    redirectError(res, e.message || 'Facebook sign-in failed', origin);
  }
}

export function startApple(req: Request, res: Response) {
  const origin = originFromRequest(req);
  const clientId = process.env.APPLE_CLIENT_ID?.trim();
  const teamId = process.env.APPLE_TEAM_ID?.trim();
  if (!clientId || !teamId) {
    return redirectError(res, missingOAuthVarsMessage('Apple Sign-In', ['APPLE_CLIENT_ID', 'APPLE_TEAM_ID']), origin);
  }
  const redirectUri = oauthReturnRedirectUri('apple', origin);
  const url = new URL('https://appleid.apple.com/auth/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('response_mode', 'query');
  url.searchParams.set('scope', 'name email');
  url.searchParams.set('state', encodeOAuthState(origin));
  res.redirect(302, url.toString());
}

export async function appleCallback(req: Request, res: Response) {
  const origin = originFromOAuthState(String(req.query.state || ''), req);
  try {
    const clientId = process.env.APPLE_CLIENT_ID?.trim();
    if (!clientId) {
      return redirectError(res, 'Apple Sign-In is not configured.', origin);
    }
    const code = String(req.query.code || '');
    const err = String(req.query.error || '');
    if (err) return redirectError(res, err, origin);
    if (!code) return redirectError(res, 'Apple did not return a code.', origin);

    // Production Apple token exchange requires a signed client_secret JWT (ES256).
    // When APPLE_KEY_ID + APPLE_PRIVATE_KEY are set, exchange the code; otherwise guide setup.
    const keyId = process.env.APPLE_KEY_ID?.trim();
    const privateKey = process.env.APPLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    if (!keyId || !privateKey) {
      return redirectError(res, 'Apple Sign-In needs APPLE_KEY_ID and APPLE_PRIVATE_KEY on the server. See OAUTH-SETUP.md.', origin);
    }

    const redirectUri = oauthReturnRedirectUri('apple', origin);
    const clientSecret = jwt.sign({}, privateKey, {
      algorithm: 'ES256',
      expiresIn: '5m',
      audience: 'https://appleid.apple.com',
      issuer: process.env.APPLE_TEAM_ID!.trim(),
      subject: clientId,
      keyid: keyId,
    });

    const tokenRes = await fetch('https://appleid.apple.com/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });
    const tokenJson = (await tokenRes.json()) as { id_token?: string; error?: string };
    if (!tokenRes.ok || !tokenJson.id_token) {
      return redirectError(res, tokenJson.error || 'Apple token exchange failed', origin);
    }

    const payload = jwt.decode(tokenJson.id_token) as { sub?: string; email?: string } | null;
    if (!payload?.sub) return redirectError(res, 'Could not read Apple profile', origin);

    const user = await upsertOAuthUser({
      provider: 'apple',
      providerId: payload.sub,
      email: (payload.email || '').toLowerCase(),
      name: 'Apple User',
      picture: null,
    });
    issueTokenAndRedirect(res, user, origin);
  } catch (e: any) {
    console.error('Apple OAuth error:', e);
    redirectError(res, e.message || 'Apple sign-in failed', origin);
  }
}
