import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
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
import { claimUsername, reserveUsername, checkUsernameAvailable, normalizeUsernameKey } from '../models/usernameRegistry.js';
import { getUserConversations } from '../models/chat.js';
import { sanitizeName, sanitizeUsername, sanitizeForStorage, LIMITS } from '../utils/sanitize.js';
import { validateStrongPassword } from './authController.js';
import { resolveUserByIdentifier, verifyLoginSecret, loginFailureMessage, upgradeLegacyPasswordHashes } from '../utils/loginUser.js';
import { isValidPinFormat, normalizePinDigits } from '../utils/pin.js';
import { runWithSystem } from '../db/context.js';
import { descriptionMatches } from '../utils/textMatch.js';
import { getFaceProfileByUserId, isValidDescriptor, verifyFaceForUser } from '../models/faceAuth.js';
import { createStolenReport, saveRecoverySelfie } from '../models/accountRecovery.js';
import { signAuthToken, wantsStayLoggedIn } from '../utils/authToken.js';

const BCRYPT_ROUNDS = process.env.NODE_ENV === 'production' ? 12 : 10;
const PIN_RESET_TTL_MS = 15 * 60 * 1000;

function parseExpiry(v: Date | string | null | undefined): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function clearPinRecoveryChallenge(userId: string): Promise<void> {
  await updateUserProfile(userId, {
    pinRecoveryToken: null,
    pinRecoveryAnswer: null,
    pinRecoveryExpiry: null,
  });
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
  const normalized = normalizePinDigits(pin);
  if (!isValidPinFormat(normalized)) {
    return { valid: false, error: 'PIN must be exactly 6 digits' };
  }
  if (normalized === '000000' || normalized === '123456' || normalized === '654321') {
    return { valid: false, error: 'Choose a less obvious PIN' };
  }
  return { valid: true };
}

type ChatFact = { username: string; name: string; lastMessage: string };

async function chatFactsForUser(userId: string): Promise<ChatFact[]> {
  const convos = await getUserConversations(userId);
  const sorted = convos.sort((a, b) => {
    const da = new Date(a.lastMessage.createdAt).getTime();
    const db = new Date(b.lastMessage.createdAt).getTime();
    return db - da;
  });
  const facts: ChatFact[] = [];
  const seen = new Set<string>();
  for (const c of sorted) {
    const u = await getUserById(c.userId);
    const username = (u?.username || '').toLowerCase();
    if (!username || seen.has(username)) continue;
    seen.add(username);
    facts.push({
      username,
      name: u?.name || '',
      lastMessage: String(c.lastMessage?.content || ''),
    });
  }
  return facts;
}

async function chatPartnerUsernames(userId: string): Promise<string[]> {
  return (await chatFactsForUser(userId)).map((f) => f.username);
}

async function issueIdentityToken(userId: string): Promise<string> {
  const token = uuidv4();
  await updateUserProfile(userId, {
    pinRecoveryToken: token,
    pinRecoveryAnswer: 'selfie-ok',
    pinRecoveryExpiry: new Date(Date.now() + PIN_RESET_TTL_MS),
  });
  return token;
}

async function issueResetToken(userId: string): Promise<string> {
  await clearPinRecoveryChallenge(userId);
  const resetToken = uuidv4();
  await updateUserResetToken(userId, resetToken, new Date(Date.now() + PIN_RESET_TTL_MS));
  return resetToken;
}

function identityTokenValid(user: { pinRecoveryToken?: string | null; pinRecoveryAnswer?: string | null; pinRecoveryExpiry?: Date | string | null }, token: string): boolean {
  const expiry = parseExpiry(user.pinRecoveryExpiry);
  return Boolean(
    token &&
      user.pinRecoveryToken === token &&
      user.pinRecoveryAnswer === 'selfie-ok' &&
      expiry &&
      expiry.getTime() > Date.now()
  );
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
    let { name, username, pin, pinHint1, pinHint2, pinHint3, email, phoneNumber, improvementCategories, password, passwordHint1, passwordHint2, passwordHint3 } = req.body;

    name = sanitizeName(name);
    username = sanitizeUsername(username);
    const pinStr = normalizePinDigits(pin);

    if (!name || !username) {
      return res.status(400).json({ error: 'Name and username are required' });
    }

    const pinCheck = validatePin(pinStr);
    if (!pinCheck.valid) {
      return res.status(400).json({ error: pinCheck.error });
    }

    if (!pinHint1?.trim() || !pinHint2?.trim() || !pinHint3?.trim()) {
      return res.status(400).json({ error: 'Add 3 PIN hints so you can remember it later — never write the PIN itself' });
    }

    const passwordStr = password ? String(password).trim() : '';
    if (!passwordStr) {
      return res.status(400).json({ error: 'A password is required' });
    }
    const passwordCheck = validateStrongPassword(passwordStr);
    if (!passwordCheck.valid) {
      return res.status(400).json({ error: passwordCheck.error });
    }
    if (!passwordHint1?.trim() || !passwordHint2?.trim() || !passwordHint3?.trim()) {
      return res.status(400).json({ error: 'Add 3 password hints to help you remember — never write the password itself' });
    }

    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!usernameRegex.test(username)) {
      return res.status(400).json({ error: 'Username must be 3–20 characters (letters, numbers, underscore)' });
    }

    try {
      await claimUsername(username);
    } catch (e: unknown) {
      return res.status(400).json({ error: e instanceof Error ? e.message : 'This username is already taken. Sign in instead.' });
    }

    if (!improvementCategories || !Array.isArray(improvementCategories) || improvementCategories.length === 0) {
      improvementCategories = ['dating-apps'];
    }

    const signupEmail =
      email && String(email).includes('@')
        ? String(email).trim().toLowerCase()
        : `${normalizeUsernameKey(username)}@noreply.local`;

    if (await runWithSystem(() => getUserByEmail(signupEmail))) {
      return res.status(400).json({ error: 'This username is already taken. Sign in instead.' });
    }

    const normalizedPhone = phoneNumber ? String(phoneNumber).replace(/\D/g, '') : null;
    if (normalizedPhone && (await runWithSystem(() => getUserByPhone(normalizedPhone)))) {
      return res.status(400).json({ error: 'Phone number is already registered' });
    }

    const backupPasswordHash = await bcrypt.hash(passwordStr, BCRYPT_ROUNDS);
    const hashedPin = await bcrypt.hash(pinStr, BCRYPT_ROUNDS);
    const user = await runWithSystem(async () => {
      const created = await createUser({
        email: signupEmail,
        password: hashedPin,
        name,
        username: normalizeUsernameKey(username),
        improvementCategories,
        passwordHint1: sanitizeForStorage(pinHint1, LIMITS.PASSWORD_HINT),
        passwordHint2: sanitizeForStorage(pinHint2, LIMITS.PASSWORD_HINT),
        passwordHint3: sanitizeForStorage(pinHint3, LIMITS.PASSWORD_HINT),
        backupPasswordHash,
      });
      await reserveUsername(username, created.id);
      await updateUserProfile(created.id, {
        emailVerified: false,
        pinAuth: true,
        backupPasswordHash,
        backupPasswordHint1: sanitizeForStorage(passwordHint1, LIMITS.PASSWORD_HINT),
        backupPasswordHint2: sanitizeForStorage(passwordHint2, LIMITS.PASSWORD_HINT),
        backupPasswordHint3: sanitizeForStorage(passwordHint3, LIMITS.PASSWORD_HINT),
      });
      if (normalizedPhone) {
        await updateUserProfile(created.id, { phoneNumber: normalizedPhone });
      }
      return created;
    });

    const token = signAuthToken(user, true);

    res.status(201).json({
      message: 'Account created. Your username is yours forever.',
      token,
      user: toClientUser(user),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : '';
    if (msg === 'USERNAME_TAKEN' || /unique|duplicate/i.test(msg)) {
      return res.status(400).json({ error: 'This username is already taken. Sign in instead.' });
    }
    console.error('signupWithPin:', error);
    res.status(500).json({ error: 'Could not create account' });
  }
}

export async function loginWithPin(req: Request, res: Response) {
  try {
    await runWithSystem(async () => {
      const { username, identifier, pin, password, stayLoggedIn } = req.body as {
        username?: string;
        identifier?: string;
        pin?: string;
        password?: string;
        stayLoggedIn?: boolean;
      };
      const secret = normalizePinDigits(pin ?? password ?? '');
      const rawId = String(username || identifier || '').trim();

      if (!rawId || !secret) {
        res.status(400).json({ error: 'Username and 6-digit PIN required' });
        return;
      }
      if (!isValidPinFormat(secret)) {
        res.status(400).json({ error: 'PIN must be exactly 6 digits' });
        return;
      }

      const user = await resolveUserByIdentifier(rawId);
      if (!user) {
        res.status(401).json({
          error: loginFailureMessage(null, { pinLogin: true, attemptedSecret: secret }),
          suggestRecovery: true,
        });
        return;
      }

      const ok = await verifyLoginSecret(user, secret);
      if (!ok) {
        res.status(401).json({
          error: loginFailureMessage(user, { pinLogin: true, attemptedSecret: secret }),
          suggestRecovery: true,
        });
        return;
      }

      await upgradeLegacyPasswordHashes(user, secret);

      const token = signAuthToken(user, wantsStayLoggedIn({ stayLoggedIn }));

      res.json({
        message: 'Signed in',
        token,
        user: toClientUser(user),
      });
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
        message: 'If this account exists, your hints are below. They help you remember — we never show your PIN or password.',
        pinHint1: '',
        pinHint2: '',
        pinHint3: '',
        passwordHint1: '',
        passwordHint2: '',
        passwordHint3: '',
        hint1: '',
        hint2: '',
        hint3: '',
        chatRecoveryAvailable: false,
        faceRecoveryAvailable: false,
      });
    }

    const partners = await chatPartnerUsernames(user.id);
    const face = await getFaceProfileByUserId(user.id);

    res.json({
      message: 'These are hints you wrote to help you remember. They are not your PIN or password.',
      pinHint1: user.passwordHint1 || '',
      pinHint2: user.passwordHint2 || '',
      pinHint3: user.passwordHint3 || '',
      passwordHint1: user.backupPasswordHint1 || '',
      passwordHint2: user.backupPasswordHint2 || '',
      passwordHint3: user.backupPasswordHint3 || '',
      hint1: user.passwordHint1 || '',
      hint2: user.passwordHint2 || '',
      hint3: user.passwordHint3 || '',
      chatRecoveryAvailable: partners.length > 0,
      faceRecoveryAvailable: Boolean(face),
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

    const facts = await chatFactsForUser(user.id);
    if (!facts.length) {
      return res.status(400).json({ error: 'No chat history yet — try describing who you talked to, or take a selfie if you have photos on this account.' });
    }

    const correct = facts[0];
    const allUsers = await getAllUsers();
    const decoys = allUsers
      .map((u) => u.username?.toLowerCase())
      .filter((u): u is string => !!u && u !== correct.username && !facts.some((f) => f.username === u))
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);

    const options = [correct.username, ...decoys].sort(() => Math.random() - 0.5);

    const challengeToken = uuidv4();
    await updateUserProfile(user.id, {
      pinRecoveryToken: challengeToken,
      pinRecoveryAnswer: JSON.stringify({ username: correct.username, lastMessage: correct.lastMessage, name: correct.name }),
      pinRecoveryExpiry: new Date(Date.now() + PIN_RESET_TTL_MS),
    });

    res.json({
      question: 'Who did you last talk to, and what did you last talk about?',
      options,
      challengeToken,
      askTopic: true,
    });
  } catch (error) {
    console.error('forgotPinLastChatChallenge:', error);
    res.status(500).json({ error: 'Could not start recovery' });
  }
}

export async function forgotPinVerifyLastChat(req: Request, res: Response) {
  try {
    const username = normalizeUsernameKey(String(req.body.username || ''));
    const { challengeToken, answer, topic } = req.body as { challengeToken?: string; answer?: string; topic?: string };
    const user = username ? await getUserByUsername(username) : null;
    if (!user || !challengeToken || !answer) {
      return res.status(400).json({ error: 'Missing recovery info' });
    }

    const expiry = parseExpiry(user.pinRecoveryExpiry);
    if (
      !user.pinRecoveryToken ||
      user.pinRecoveryToken !== challengeToken ||
      !expiry ||
      expiry.getTime() < Date.now()
    ) {
      return res.status(401).json({ error: 'Challenge expired — try again.' });
    }

    let expectedUser = '';
    let lastMessage = '';
    let partnerName = '';
    try {
      const parsed = JSON.parse(String(user.pinRecoveryAnswer || ''));
      expectedUser = String(parsed.username || '');
      lastMessage = String(parsed.lastMessage || '');
      partnerName = String(parsed.name || '');
    } catch {
      expectedUser = String(user.pinRecoveryAnswer || '');
    }

    if (normalizeUsernameKey(answer) !== normalizeUsernameKey(expectedUser)) {
      return res.status(401).json({ error: 'Wrong person — try naming 3 people from your chats instead.' });
    }

    const topicText = String(topic || '').trim();
    if (topicText.length < 4) {
      return res.status(400).json({ error: 'Say a little about what you last talked about.' });
    }
    const topicOk = descriptionMatches(topicText, [lastMessage, partnerName, expectedUser].filter(Boolean));
    if (lastMessage && !topicOk) {
      return res.status(401).json({ error: 'That does not match your last chat. Try describing it in your own words, or name 3 people from your chats.' });
    }

    const identityToken = await issueIdentityToken(user.id);
    res.json({ identityToken, message: 'That matches this account. Take a selfie next so we can check it against your photos.' });
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

    const identityToken = await issueIdentityToken(user.id);
    res.json({ identityToken, message: 'That matches this account. Take a selfie next so we can check it against your photos.' });
  } catch (error) {
    console.error('forgotPinVerifyChatNames:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
}

export async function forgotPinVerifyDescribe(req: Request, res: Response) {
  try {
    const username = normalizeUsernameKey(String(req.body.username || ''));
    const description = String(req.body.description || '').trim();
    const user = username ? await getUserByUsername(username) : null;
    if (!user) {
      return res.status(404).json({ error: 'Account not found' });
    }
    if (description.length < 8) {
      return res.status(400).json({ error: 'Describe who you talked to or what you last talked about (a short sentence).' });
    }

    const facts = await chatFactsForUser(user.id);
    if (!facts.length) {
      return res.status(400).json({ error: 'No chat history yet. Take a selfie if you have photos on this account, or report a stolen account.' });
    }

    const haystack = facts.flatMap((f) => [f.username, f.name, f.lastMessage].filter(Boolean));
    if (!descriptionMatches(description, haystack)) {
      return res.status(401).json({ error: 'That does not match this account’s chats closely enough. Try again with names or what you last talked about.' });
    }

    const identityToken = await issueIdentityToken(user.id);
    res.json({ identityToken, message: 'That matches this account. Take a selfie next so we can check it against your photos.' });
  } catch (error) {
    console.error('forgotPinVerifyDescribe:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
}

export async function forgotPinSubmitSelfie(req: Request, res: Response) {
  try {
    const username = normalizeUsernameKey(String(req.body.username || ''));
    const identityToken = String(req.body.identityToken || '');
    const selfie = String(req.body.selfie || '');
    const faceDescriptor = req.body.faceDescriptor;
    const user = username ? await getUserByUsername(username) : null;
    if (!user) {
      return res.status(404).json({ error: 'Account not found' });
    }
    if (!selfie || selfie.length < 8) {
      return res.status(400).json({ error: 'Take a selfie with your camera and send it.' });
    }
    if (selfie.length > 2_000_000) {
      return res.status(400).json({ error: 'Selfie is too large. Try again.' });
    }

    const identityOk = identityTokenValid(user, identityToken);
    const storedFace = await getFaceProfileByUserId(user.id);
    let faceMatched = false;

    if (isValidDescriptor(faceDescriptor) && storedFace) {
      faceMatched = await verifyFaceForUser(user.id, faceDescriptor);
    }

    if (storedFace && isValidDescriptor(faceDescriptor) && !faceMatched) {
      return res.status(401).json({ error: 'Selfie does not match the photos on this account.' });
    }

    if (!identityOk && !faceMatched) {
      return res.status(401).json({ error: 'Prove this is your account with your chats first, then take a selfie.' });
    }

    if (selfie.length > 80 && selfie !== 'face-scan') {
      await saveRecoverySelfie({
        userId: user.id,
        username: user.username,
        image: selfie.slice(0, 1_500_000),
        faceMatched,
      });
    }

    const resetToken = await issueResetToken(user.id);
    res.json({
      resetToken,
      message: faceMatched
        ? 'Selfie matches your photos. You can reset your PIN and password now.'
        : 'Selfie received and saved for review against your photos. You can reset your PIN and password now.',
    });
  } catch (error) {
    console.error('forgotPinSubmitSelfie:', error);
    res.status(500).json({ error: 'Could not check selfie' });
  }
}

export async function reportStolenAccount(req: Request, res: Response) {
  try {
    const username = normalizeUsernameKey(String(req.body.username || ''));
    const details = sanitizeForStorage(req.body.details || req.body.description || '', 2000);
    const contact = sanitizeForStorage(req.body.contact || '', 200);
    if (!username) {
      return res.status(400).json({ error: 'Enter the username of the account' });
    }
    if (!details || details.length < 10) {
      return res.status(400).json({ error: 'Tell us what happened (at least a short sentence).' });
    }

    const user = await getUserByUsername(username);
    await createStolenReport({
      username,
      userId: user?.id || null,
      details,
      contact,
    });

    res.json({
      message: user
        ? 'Report received for this username. We will review it. You can also recover with hints, chats, and a selfie.'
        : 'Report received. If this username exists, we will review it.',
    });
  } catch (error) {
    console.error('reportStolenAccount:', error);
    res.status(500).json({ error: 'Could not send report' });
  }
}

export async function resetPin(req: Request, res: Response) {
  try {
    const { resetToken, newPin, newPassword } = req.body as { resetToken?: string; newPin?: string; newPassword?: string };
    if (!resetToken) {
      return res.status(400).json({ error: 'Reset token required' });
    }
    if (!newPin && !newPassword) {
      return res.status(400).json({ error: 'Enter a new PIN and/or password' });
    }

    const user = await getUserByResetToken(resetToken);
    if (!user?.resetTokenExpiry) {
      return res.status(400).json({ error: 'Invalid or expired reset — start again.' });
    }

    const expiry = user.resetTokenExpiry instanceof Date ? user.resetTokenExpiry : new Date(user.resetTokenExpiry);
    if (expiry < new Date()) {
      return res.status(400).json({ error: 'Reset expired — start again.' });
    }

    if (newPin) {
      const pinCheck = validatePin(String(newPin));
      if (!pinCheck.valid) {
        return res.status(400).json({ error: pinCheck.error });
      }
      const hashed = await bcrypt.hash(normalizePinDigits(newPin), BCRYPT_ROUNDS);
      await updateUserPassword(user.id, hashed);
      await updateUserProfile(user.id, { pinAuth: true });
    }

    if (newPassword) {
      const passwordCheck = validateStrongPassword(String(newPassword));
      if (!passwordCheck.valid) {
        return res.status(400).json({ error: passwordCheck.error });
      }
      const hashedPassword = await bcrypt.hash(String(newPassword), BCRYPT_ROUNDS);
      await updateUserProfile(user.id, { backupPasswordHash: hashedPassword });
    }

    await updateUserResetToken(user.id, null, null);

    res.json({ message: 'Sign-in details updated for this username only. Sign in with your new PIN or password.' });
  } catch (error) {
    console.error('resetPin:', error);
    res.status(500).json({ error: 'Could not reset PIN or password' });
  }
}
