import { Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {
  createUser,
  getUserByEmail,
  getUserById,
  getUserByPhone,
  getUserByUsername,
  updateUserProfile,
} from '../models/user.js';
import { assertUsernameAvailable, reserveUsername, normalizeUsernameKey } from '../models/usernameRegistry.js';
import {
  findLookalikeConflict,
  identifyByFace,
  isValidDescriptor,
  saveFaceProfile,
  verifyFaceForUser,
} from '../models/faceAuth.js';
import { sanitizeName, sanitizeUsername, sanitizeForStorage, LIMITS } from '../utils/sanitize.js';

const BCRYPT_ROUNDS = process.env.NODE_ENV === 'production' ? 12 : 10;

function validateStrongPassword(password: string): { valid: boolean; error?: string } {
  if (password.length < 8) return { valid: false, error: 'Password must be at least 8 characters' };
  if (!/[A-Z]/.test(password)) return { valid: false, error: 'Password must include an uppercase letter' };
  if (!/[a-z]/.test(password)) return { valid: false, error: 'Password must include a lowercase letter' };
  if (!/[0-9]/.test(password)) return { valid: false, error: 'Password must include a number' };
  return { valid: true };
}
const JWT_EXPIRES_IN = '7d';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set in production');
  }
  return secret || 'dev-only-secret-do-not-use-in-production';
}

function toClientUser(user: Awaited<ReturnType<typeof getUserById>>) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    username: user.username,
    profilePicture: user.profilePicture ?? null,
    profileSetupComplete: Boolean(user.profileSetupComplete),
    emailVerified: Boolean(user.emailVerified),
  };
}

/** Sign up with face scan + optional typed profile fields. */
export async function signupWithFace(req: Request, res: Response) {
  try {
    let { name, username, email, phoneNumber, password, passwordHint1, passwordHint2, passwordHint3, improvementCategories, faceDescriptor } =
      req.body;

    if (!isValidDescriptor(faceDescriptor)) {
      return res.status(400).json({ error: 'Valid face scan required. Keep both eyes open and try again.' });
    }

    const conflict = await findLookalikeConflict(faceDescriptor);
    if (conflict) {
      return res.status(409).json({
        error: 'This face is too similar to an existing account. If that is you, sign in with Face ID instead.',
      });
    }

    name = sanitizeName(name);
    username = sanitizeUsername(username);
    if (!name || !username) {
      return res.status(400).json({ error: 'Name and username are required (or fill them in before scanning).' });
    }

    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!usernameRegex.test(username)) {
      return res.status(400).json({ error: 'Username must be 3–20 characters (letters, numbers, underscore).' });
    }

    try {
      await assertUsernameAvailable(username);
    } catch (e: unknown) {
      return res.status(400).json({ error: e instanceof Error ? e.message : 'Username not available' });
    }

    if (!password) {
      password = crypto.randomBytes(24).toString('base64url');
    } else {
      const passwordValidation = validateStrongPassword(password);
      if (!passwordValidation.valid) {
        return res.status(400).json({ error: passwordValidation.error });
      }
    }

    if (!improvementCategories || !Array.isArray(improvementCategories) || improvementCategories.length === 0) {
      improvementCategories = ['dating-apps'];
    }

    const signupEmail =
      email && String(email).includes('@')
        ? String(email).trim().toLowerCase()
        : `${username}@noreply.local`;

    if (signupEmail.includes('@') && !signupEmail.endsWith('@noreply.local')) {
      if (await getUserByEmail(signupEmail)) {
        return res.status(400).json({ error: 'Email is already registered' });
      }
    }

    const normalizedPhone = phoneNumber ? String(phoneNumber).replace(/\D/g, '') : null;
    if (normalizedPhone && (await getUserByPhone(normalizedPhone))) {
      return res.status(400).json({ error: 'Phone number is already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await createUser({
      email: signupEmail,
      password: hashedPassword,
      name,
      username,
      improvementCategories,
      passwordHint1: sanitizeForStorage(passwordHint1 || 'face-signup', LIMITS.PASSWORD_HINT),
      passwordHint2: sanitizeForStorage(passwordHint2 || 'face-signup', LIMITS.PASSWORD_HINT),
      passwordHint3: sanitizeForStorage(passwordHint3 || 'face-signup', LIMITS.PASSWORD_HINT),
    });

    await reserveUsername(username, user.id);
    await updateUserProfile(user.id, { emailVerified: false });
    if (normalizedPhone) {
      await updateUserProfile(user.id, { phoneNumber: normalizedPhone });
    }

    await saveFaceProfile(user.id, faceDescriptor);

    const token = jwt.sign({ userId: user.id, email: user.email }, getJwtSecret(), { expiresIn: JWT_EXPIRES_IN });

    res.status(201).json({
      message: 'Account created. Finish by registering Face ID on this device.',
      token,
      user: toClientUser(user),
      faceRegistered: true,
    });
  } catch (error: unknown) {
    console.error('signupWithFace:', error);
    res.status(500).json({ error: 'Could not create account with face sign-up.' });
  }
}

/** Match face for login — optional username narrows the match. */
export async function identifyFaceForLogin(req: Request, res: Response) {
  try {
    const { faceDescriptor, username } = req.body as { faceDescriptor?: unknown; username?: string };

    if (!isValidDescriptor(faceDescriptor)) {
      return res.status(400).json({ error: 'Face scan failed. Keep both eyes open and look at the camera.' });
    }

    let userId: string | null = null;

    if (username?.trim()) {
      let user = await getUserByUsername(username.trim());
      if (!user && username.includes('@')) {
        user = await getUserByEmail(username.trim().toLowerCase());
      }
      if (!user) {
        return res.status(404).json({ error: 'No account found for that username.' });
      }
      const ok = await verifyFaceForUser(user.id, faceDescriptor);
      if (!ok) {
        return res.status(401).json({
          error: 'Face does not match this account. Use your own face or check your username.',
        });
      }
      userId = user.id;
    } else {
      const match = await identifyByFace(faceDescriptor);
      if (!match) {
        return res.status(401).json({
          error: 'Face not recognized. Sign up first or enter your username, then scan again.',
        });
      }
      userId = match.userId;
    }

    const user = await getUserById(userId);
    if (!user) return res.status(404).json({ error: 'Account not found' });

    res.json({
      userId: user.id,
      username: user.username,
      message: 'Face verified. Confirm with Face ID on your device.',
    });
  } catch (error: unknown) {
    console.error('identifyFaceForLogin:', error);
    res.status(500).json({ error: 'Face sign-in failed.' });
  }
}
