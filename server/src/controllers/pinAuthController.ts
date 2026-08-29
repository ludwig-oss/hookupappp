import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import {
  createUser,
  getUserByEmail,
  getUserById,
  getUserByPhone,
  getUserByUsername,
  updateUserProfile,
  updateUserPassword,
  updateUserResetToken,
  getUserByResetToken,
  getAllUsers,
} from '../models/user.js';
import { assertUsernameAvailable, reserveUsername, checkUsernameAvailable, normalizeUsernameKey } from '../models/usernameRegistry.js';
import { getUserConversations } from '../models/chat.js';
import { sanitizeName, sanitizeUsername, sanitizeForStorage, LIMITS } from '../utils/sanitize.js';

const BCRYPT_ROUNDS = process.env.NODE_ENV === 'production' ? 12 : 10;
const JWT_EXPIRES_IN = '7d';
const PIN_RESET_TTL_MS = 15 * 60 * 1000;

const pinChallenges = new Map<string, { userId: string; correct: string; expires: number }>();

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
    improvementCategories: Array.isArray(user.improvementCategories) ? user.improvementCategories : [],
  };
}

function validatePin(pin: string): { valid: boolean; error?: string } {
  if (!/^\d{6}$/.test(pin)) {
    return { valid: false, error: 'PIN must be exactly 6 digits' };
  }
  if (pin === '000000' || pin === '123456' || pin === '654321') {
    return { valid: false, error: 'Choose a less obvious PIN' };
  }
  return { valid: true };
}

async function chatPartnerUsernames(userId: string): Promise<string[]> {
  const convos = await getUserConversations(userId);
  const sorted = convos.sort((a, b) => {
    const da = new Date(a.lastMessage.createdAt).getTime();
    const db = new Date(b.lastMessage.createdAt).getTime();
    return db - da;
  });
  const names: string[] = [];
  for (const c of sorted) {
    const u = await getUserById(c.userId);
    if (u?.username && !names.includes(u.username.toLowerCase())) {
      names.push(u.username.toLowerCase());
    }
  }
  return names;
}

export async function usernameAvailability(req: Request, res: Response) {
  try {
    const u = String(req.query.u || req.query.username || '');
    const result = await checkUsernameAvailable(u);
    res.json(result);
  } catch {
    res.status(500).json({ available: false, reason: 'Could not check username' });
  }
}

export async function signupWithPin(req: Request, res: Response) {
  try {
    let { name, username, pin, pinHint1, pinHint2, pinHint3, email, phoneNumber, improvementCategories } = req.body;

    name = sanitizeName(name);
    username = sanitizeUsername(username);
    const pinStr = String(pin || '');

    if (!name || !username) {
      return res.status(400).json({ error: 'Name and username are required' });
    }

    const pinCheck = validatePin(pinStr);
    if (!pinCheck.valid) {
      return res.status(400).json({ error: pinCheck.error });
    }

    if (!pinHint1?.trim() || !pinHint2?.trim() || !pinHint3?.trim()) {
      return res.status(400).json({ error: 'Add 3 PIN hints so you can recover if you forget' });
    }

    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!usernameRegex.test(username)) {
      return res.status(400).json({ error: 'Username must be 3–20 characters (letters, numbers, underscore)' });
    }

    try {
      await assertUsernameAvailable(username);
    } catch (e: unknown) {
      return res.status(400).json({ error: e instanceof Error ? e.message : 'Username not available' });
    }

    if (!improvementCategories || !Array.isArray(improvementCategories) || improvementCategories.length === 0) {
      improvementCategories = ['dating-apps'];
    }

    const signupEmail =
      email && String(email).includes('@')
        ? String(email).trim().toLowerCase()
        : `${normalizeUsernameKey(username)}@noreply.local`;

    if (signupEmail.includes('@') && !signupEmail.endsWith('@noreply.local')) {
      if (await getUserByEmail(signupEmail)) {
        return res.status(400).json({ error: 'Email is already registered' });
      }
    }

    const normalizedPhone = phoneNumber ? String(phoneNumber).replace(/\D/g, '') : null;
    if (normalizedPhone && (await getUserByPhone(normalizedPhone))) {
      return res.status(400).json({ error: 'Phone number is already registered' });
    }

    const hashedPin = await bcrypt.hash(pinStr, BCRYPT_ROUNDS);
    const user = await createUser({
      email: signupEmail,
      password: hashedPin,
      name,
      username: normalizeUsernameKey(username),
      improvementCategories,
      passwordHint1: sanitizeForStorage(pinHint1, LIMITS.PASSWORD_HINT),
      passwordHint2: sanitizeForStorage(pinHint2, LIMITS.PASSWORD_HINT),
      passwordHint3: sanitizeForStorage(pinHint3, LIMITS.PASSWORD_HINT),
    });

    await reserveUsername(username, user.id);
    await updateUserProfile(user.id, { emailVerified: false });
    if (normalizedPhone) {
      await updateUserProfile(user.id, { phoneNumber: normalizedPhone });
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, getJwtSecret(), { expiresIn: JWT_EXPIRES_IN });

    res.status(201).json({
      message: 'Account created. Your username is yours forever.',
      token,
      user: toClientUser(user),
    });
  } catch (error: unknown) {
    console.error('signupWithPin:', error);
    res.status(500).json({ error: 'Could not create account' });
  }
}

export async function loginWithPin(req: Request, res: Response) {
  try {
    const { username, pin } = req.body as { username?: string; pin?: string };
    const key = normalizeUsernameKey(String(username || ''));
    const pinStr = String(pin || '');

    if (!key || !pinStr) {
      return res.status(400).json({ error: 'Username and 6-digit PIN required' });
    }

    const user = await getUserByUsername(key);
    if (!user) {
      return res.status(401).json({ error: 'Wrong username or PIN' });
    }

    const ok = await bcrypt.compare(pinStr, user.password);
    if (!ok) {
      return res.status(401).json({ error: 'Wrong username or PIN' });
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, getJwtSecret(), { expiresIn: JWT_EXPIRES_IN });

    res.json({
      message: 'Signed in',
      token,
      user: toClientUser(user),
    });
  } catch (error) {
    console.error('loginWithPin:', error);
    res.status(500).json({ error: 'Sign-in failed' });
  }
}

/** Step 1 — show PIN hints (helps user remember; no PIN stored in response). */
export async function forgotPinHints(req: Request, res: Response) {
  try {
    const username = normalizeUsernameKey(String(req.body.username || ''));
    if (!username) {
      return res.status(400).json({ error: 'Enter your username' });
    }

    const user = await getUserByUsername(username);
    if (!user) {
      return res.json({
        message: 'If this account exists, your hints are below.',
        hint1: '',
        hint2: '',
        hint3: '',
        chatRecoveryAvailable: false,
      });
    }

    const partners = await chatPartnerUsernames(user.id);

    res.json({
      message: 'Use these hints to remember your PIN. They are exactly what you wrote at sign-up.',
      hint1: user.passwordHint1 || '',
      hint2: user.passwordHint2 || '',
      hint3: user.passwordHint3 || '',
      chatRecoveryAvailable: partners.length > 0,
    });
  } catch (error) {
    console.error('forgotPinHints:', error);
    res.status(500).json({ error: 'Could not load hints' });
  }
}

/** Step 2a — who did you last talk to? (multiple choice usernames). */
export async function forgotPinLastChatChallenge(req: Request, res: Response) {
  try {
    const username = normalizeUsernameKey(String(req.body.username || ''));
    const user = username ? await getUserByUsername(username) : null;
    if (!user) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const partners = await chatPartnerUsernames(user.id);
    if (!partners.length) {
      return res.status(400).json({ error: 'No chat history yet — use the three-usernames step or contact support.' });
    }

    const correct = partners[0];
    const allUsers = await getAllUsers();
    const decoys = allUsers
      .map((u) => u.username?.toLowerCase())
      .filter((u): u is string => !!u && u !== correct && !partners.includes(u))
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);

    const options = [correct, ...decoys].sort(() => Math.random() - 0.5);

    const challengeToken = uuidv4();
    pinChallenges.set(challengeToken, {
      userId: user.id,
      correct,
      expires: Date.now() + PIN_RESET_TTL_MS,
    });

    res.json({
      question: 'Who did you last talk to?',
      options,
      challengeToken,
    });
  } catch (error) {
    console.error('forgotPinLastChatChallenge:', error);
    res.status(500).json({ error: 'Could not start recovery' });
  }
}

export async function forgotPinVerifyLastChat(req: Request, res: Response) {
  try {
    const username = normalizeUsernameKey(String(req.body.username || ''));
    const { challengeToken, answer } = req.body as { challengeToken?: string; answer?: string };
    const user = username ? await getUserByUsername(username) : null;
    if (!user || !challengeToken || !answer) {
      return res.status(400).json({ error: 'Missing recovery info' });
    }

    const challenge = pinChallenges.get(challengeToken);
    if (!challenge || challenge.userId !== user.id || challenge.expires < Date.now()) {
      return res.status(401).json({ error: 'Challenge expired — try again.' });
    }

    if (normalizeUsernameKey(answer) !== challenge.correct) {
      return res.status(401).json({ error: 'Wrong answer — try the three-usernames method instead.' });
    }

    pinChallenges.delete(challengeToken);

    const resetToken = uuidv4();
    await updateUserResetToken(user.id, resetToken, new Date(Date.now() + PIN_RESET_TTL_MS));

    res.json({ resetToken, message: 'Verified — set a new PIN.' });
  } catch (error) {
    console.error('forgotPinVerifyLastChat:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
}

/** Step 2b — name 3 people from your chats (usernames). */
export async function forgotPinVerifyChatNames(req: Request, res: Response) {
  try {
    const username = normalizeUsernameKey(String(req.body.username || ''));
    const rawNames = req.body.usernames as unknown;
    const user = username ? await getUserByUsername(username) : null;
    if (!user) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const submitted = Array.isArray(rawNames)
      ? rawNames.map((n) => normalizeUsernameKey(String(n))).filter(Boolean)
      : [];

    const unique = [...new Set(submitted)];
    if (unique.length < 3) {
      return res.status(400).json({ error: 'Enter 3 different chat partner usernames' });
    }

    const partners = await chatPartnerUsernames(user.id);
    if (partners.length < 3) {
      return res.status(400).json({
        error: `You need at least 3 people in your chats. You have ${partners.length}. Try the last-person question instead.`,
      });
    }

    const matched = unique.filter((n) => partners.includes(n));
    if (matched.length < 3) {
      return res.status(401).json({ error: 'Those usernames do not match your chats. Try again.' });
    }

    const resetToken = uuidv4();
    await updateUserResetToken(user.id, resetToken, new Date(Date.now() + PIN_RESET_TTL_MS));

    res.json({ resetToken, message: 'Verified — set a new PIN.' });
  } catch (error) {
    console.error('forgotPinVerifyChatNames:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
}

export async function resetPin(req: Request, res: Response) {
  try {
    const { resetToken, newPin } = req.body as { resetToken?: string; newPin?: string };
    if (!resetToken || !newPin) {
      return res.status(400).json({ error: 'Reset token and new PIN required' });
    }

    const pinCheck = validatePin(String(newPin));
    if (!pinCheck.valid) {
      return res.status(400).json({ error: pinCheck.error });
    }

    const user = await getUserByResetToken(resetToken);
    if (!user?.resetTokenExpiry) {
      return res.status(400).json({ error: 'Invalid or expired reset link — start again.' });
    }

    const expiry = user.resetTokenExpiry instanceof Date ? user.resetTokenExpiry : new Date(user.resetTokenExpiry);
    if (expiry < new Date()) {
      return res.status(400).json({ error: 'Reset expired — start again.' });
    }

    const hashed = await bcrypt.hash(String(newPin), BCRYPT_ROUNDS);
    await updateUserPassword(user.id, hashed);
    await updateUserResetToken(user.id, null, null);

    res.json({ message: 'PIN updated. Sign in with your new PIN.' });
  } catch (error) {
    console.error('resetPin:', error);
    res.status(500).json({ error: 'Could not reset PIN' });
  }
}
