import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { getUserById, getUserByUsername } from '../models/user.js';
import {
  getPasskeysByUserId,
  getPasskeyByCredentialId,
  savePasskey,
  updatePasskeyCounter,
} from '../models/passkeys.js';
import { getWebAuthnOrigin, getWebAuthnRpId, WEBAUTHN_RP_NAME } from '../lib/webauthnConfig.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/** In-memory challenges (short-lived). */
const regChallenges = new Map<string, string>();
const authChallenges = new Map<string, string>();

function sanitizeUserForClient(user: Awaited<ReturnType<typeof getUserById>>) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    username: user.username,
    profilePicture: user.profilePicture,
    profileSetupComplete: user.profileSetupComplete,
    emailVerified: user.emailVerified,
    qualifiedCoach: Boolean(user.qualifiedCoach),
  };
}

function issueToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}

/** GET options to register a passkey (requires auth). */
export async function passkeyRegisterOptions(req: Request, res: Response) {
  try {
    const userId = (req as any).userId as string;
    const user = await getUserById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const existing = await getPasskeysByUserId(userId);
    const options = await generateRegistrationOptions({
      rpName: WEBAUTHN_RP_NAME,
      rpID: getWebAuthnRpId(),
      userName: user.username || user.email || user.id,
      userDisplayName: user.name || user.username,
      attestationType: 'none',
      excludeCredentials: existing.map((pk) => ({
        id: pk.credentialId,
        transports: pk.transports as ('usb' | 'nfc' | 'ble' | 'internal' | 'hybrid')[] | undefined,
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'required',
        authenticatorAttachment: 'platform',
      },
    });

    regChallenges.set(userId, options.challenge);
    res.json(options);
  } catch (e: any) {
    console.error('passkeyRegisterOptions:', e);
    res.status(500).json({ error: e.message || 'Failed to generate registration options' });
  }
}

/** POST verify registration (requires auth). */
export async function passkeyRegisterVerify(req: Request, res: Response) {
  try {
    const userId = (req as any).userId as string;
    const expectedChallenge = regChallenges.get(userId);
    if (!expectedChallenge) {
      return res.status(400).json({ error: 'Registration session expired. Try again.' });
    }

    const verification = await verifyRegistrationResponse({
      response: req.body,
      expectedChallenge,
      expectedOrigin: getWebAuthnOrigin(),
      expectedRPID: getWebAuthnRpId(),
      requireUserVerification: true,
    });

    regChallenges.delete(userId);

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({ error: 'Passkey registration failed' });
    }

    const info = verification.registrationInfo;
    await savePasskey({
      userId,
      credentialId: info.credentialID,
      publicKey: Buffer.from(info.credentialPublicKey).toString('base64url'),
      counter: info.counter,
      transports: req.body?.response?.transports,
    });

    res.json({
      message: 'Face ID / Touch ID registered successfully',
      deviceType: info.credentialDeviceType,
      backedUp: info.credentialBackedUp,
    });
  } catch (e: any) {
    console.error('passkeyRegisterVerify:', e);
    res.status(500).json({ error: e.message || 'Registration verification failed' });
  }
}

/** POST options for login — body: { username?: string } */
export async function passkeyLoginOptions(req: Request, res: Response) {
  try {
    const { username } = req.body as { username?: string };
    let user = username ? await getUserByUsername(username.trim()) : null;
    if (!user && username?.includes('@')) {
      const { getUserByEmail } = await import('../models/user.js');
      user = await getUserByEmail(username.trim());
    }
    if (!user) {
      return res.status(404).json({ error: 'No account found for that username' });
    }

    const passkeys = await getPasskeysByUserId(user.id);
    if (!passkeys.length) {
      return res.status(400).json({
        error: 'No Face ID / passkey registered yet. Sign in with password once, then register in Settings.',
      });
    }

    const options = await generateAuthenticationOptions({
      rpID: getWebAuthnRpId(),
      allowCredentials: passkeys.map((pk) => ({
        id: pk.credentialId,
        transports: pk.transports as ('usb' | 'nfc' | 'ble' | 'internal' | 'hybrid')[] | undefined,
      })),
      userVerification: 'required',
    });

    authChallenges.set(user.id, options.challenge);
    res.json({ options, userId: user.id });
  } catch (e: any) {
    console.error('passkeyLoginOptions:', e);
    res.status(500).json({ error: e.message || 'Failed to generate login options' });
  }
}

/** POST verify login — body: WebAuthn assertion + userId from options step */
export async function passkeyLoginVerify(req: Request, res: Response) {
  try {
    const { userId } = req.body as { userId?: string };
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const expectedChallenge = authChallenges.get(userId);
    if (!expectedChallenge) {
      return res.status(400).json({ error: 'Login session expired. Try again.' });
    }

    const credentialId = req.body?.id as string;
    const passkey = credentialId ? await getPasskeyByCredentialId(credentialId) : null;
    if (!passkey || passkey.userId !== userId) {
      return res.status(400).json({ error: 'Unknown passkey' });
    }

    const verification = await verifyAuthenticationResponse({
      response: req.body,
      expectedChallenge,
      expectedOrigin: getWebAuthnOrigin(),
      expectedRPID: getWebAuthnRpId(),
      requireUserVerification: true,
      authenticator: {
        credentialID: passkey.credentialId,
        credentialPublicKey: Buffer.from(passkey.publicKey, 'base64url'),
        counter: passkey.counter,
        transports: passkey.transports as ('usb' | 'nfc' | 'ble' | 'internal' | 'hybrid')[] | undefined,
      },
    });

    authChallenges.delete(userId);

    if (!verification.verified) {
      return res.status(401).json({ error: 'Passkey verification failed' });
    }

    await updatePasskeyCounter(passkey.credentialId, verification.authenticationInfo.newCounter);

    const user = await getUserById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const token = issueToken(userId);
    res.json({
      message: 'Signed in with passkey',
      token,
      user: sanitizeUserForClient(user),
    });
  } catch (e: any) {
    console.error('passkeyLoginVerify:', e);
    res.status(500).json({ error: e.message || 'Passkey login failed' });
  }
}

/** GET whether user has passkeys registered */
export async function passkeyStatus(req: Request, res: Response) {
  try {
    const userId = (req as any).userId as string;
    const passkeys = await getPasskeysByUserId(userId);
    res.json({ registered: passkeys.length > 0, count: passkeys.length });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed' });
  }
}

export async function passkeySupported(_req: Request, res: Response) {
  res.json({ supported: true, rpId: getWebAuthnRpId() });
}
