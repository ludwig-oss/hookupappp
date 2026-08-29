import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { createUser, getUserByEmail, getUserByUsername, getUserByResetToken, updateUserPassword, updateUserResetToken, getUserByPhone, getUserById, updateUserProfile, getUserByEmailVerificationToken, updateEmailVerificationToken, verifyUserEmail, getUserByEmailVerificationCode, updateEmailVerificationCode, getUserByLoginCode, updateLoginCode, type User } from '../models/user.js';
import { sendPasswordResetEmail, sendVerificationEmail } from '../utils/email.js';
import { sendPasswordResetSMS, sendVerificationSMS } from '../utils/sms.js';
import { sanitizeName, sanitizeUsername, sanitizeForStorage, LIMITS } from '../utils/sanitize.js';
import { assertUsernameAvailable, reserveUsername, normalizeUsernameKey } from '../models/usernameRegistry.js';

const JWT_EXPIRES_IN = '7d';

const BCRYPT_ROUNDS = process.env.NODE_ENV === 'production' ? 12 : 10;

/** Safe user payload for the client — no password, hints, or large JSON blobs. */
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
    qualifiedCoach: Boolean(user.qualifiedCoach),
    coachStarRating: typeof user.coachStarRating === 'number' ? user.coachStarRating : undefined,
  };
}

/** Read env at call time — not at module load — so tokens match `dotenv.config()` in `index.ts` (imports run before that). */
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set in production (min 32 characters). Set it in server/.env');
  }
  return secret || 'dev-only-secret-do-not-use-in-production';
}

// Strong password validation
export function validateStrongPassword(password: string): { valid: boolean; error?: string } {
  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters long' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one lowercase letter' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one uppercase letter' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one number' };
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)' };
  }
  return { valid: true };
}

export const signup = async (req: Request, res: Response) => {
  try {
    let { password, name, username, email, improvementCategories, phoneNumber, passwordHint1, passwordHint2, passwordHint3 } = req.body;
    name = sanitizeName(name);
    username = sanitizeUsername(username);
    if (!password || !name || !username) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (!passwordHint1 || !passwordHint2 || !passwordHint3) {
      return res.status(400).json({ error: 'All three password hints are required to help you recover your account' });
    }

    /** Default when client skips picker (e.g. Vercel + flaky /improvement route). Valid id from models/improvement.ts */
    if (!improvementCategories || !Array.isArray(improvementCategories) || improvementCategories.length === 0) {
      improvementCategories = ['dating-apps'];
    }

    const passwordValidation = validateStrongPassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.error });
    }

    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!usernameRegex.test(username)) {
      return res.status(400).json({ error: 'Username must be 3-20 characters and contain only letters, numbers, and underscores' });
    }

    const existingUserByUsername = await getUserByUsername(username);
    if (existingUserByUsername) {
      return res.status(400).json({ error: 'This username is taken forever — pick another one.' });
    }

    try {
      await assertUsernameAvailable(username);
    } catch (e: unknown) {
      return res.status(400).json({ error: e instanceof Error ? e.message : 'Username not available' });
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const normalizedPhone = phoneNumber ? phoneNumber.replace(/\D/g, '') : null;
    const signupEmail =
      email && String(email).includes('@')
        ? String(email).trim().toLowerCase()
        : `${username}@noreply.local`;

    if (signupEmail.includes('@') && !signupEmail.endsWith('@noreply.local')) {
      const existingEmail = await getUserByEmail(signupEmail);
      if (existingEmail) {
        return res.status(400).json({ error: 'Email is already registered' });
      }
    }

    if (normalizedPhone) {
      const existingUserByPhone = await getUserByPhone(normalizedPhone);
      if (existingUserByPhone && existingUserByPhone.id) {
        return res.status(400).json({ error: 'Phone number is already registered' });
      }
    }

    const user = await createUser({
      email: signupEmail,
      password: hashedPassword,
      name,
      username,
      improvementCategories,
      passwordHint1: sanitizeForStorage(passwordHint1, LIMITS.PASSWORD_HINT),
      passwordHint2: sanitizeForStorage(passwordHint2, LIMITS.PASSWORD_HINT),
      passwordHint3: sanitizeForStorage(passwordHint3, LIMITS.PASSWORD_HINT),
    });
    await reserveUsername(username, user.id);
    await updateUserProfile(user.id, { emailVerified: false });

    if (normalizedPhone) {
      await updateUserProfile(user.id, { phoneNumber: normalizedPhone });
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, getJwtSecret(), { expiresIn: JWT_EXPIRES_IN });

    const userForClient = toClientUser(user);

    res.status(201).json({
      message: 'Account created successfully. Verify your email or phone to unlock all features.',
      token,
      user: userForClient,
    });
  } catch (error: unknown) {
    console.error('Signup error:', error);
    const pgCode = (error as { code?: string })?.code;
    if (pgCode === '23505') {
      return res.status(400).json({ error: 'This username is taken forever — pick another one.' });
    }
    if (pgCode === '23502') {
      return res.status(400).json({ error: 'Missing required account information. Check all fields and try again.' });
    }
    const msg = error instanceof Error ? error.message : '';
    if (msg.includes('JWT_SECRET')) {
      return res.status(503).json({ error: 'Server configuration error. Try again later or contact support.' });
    }
    res.status(500).json({ error: 'Could not create account. Please try again.' });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { username, password, email, phoneNumber, identifier } = req.body;
    const rawId = String(identifier || username || email || phoneNumber || '').trim();
    if (!rawId || !password) {
      return res.status(400).json({ error: 'Username/email/phone and password are required' });
    }

    let user = await getUserByUsername(normalizeUsernameKey(rawId));
    if (!user && rawId.includes('@')) {
      user = await getUserByEmail(rawId.toLowerCase());
    }
    if (!user) {
      const digits = rawId.replace(/\D/g, '');
      if (digits.length >= 10) {
        user = await getUserByPhone(digits);
      }
    }
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    let isValidPassword = false;
    if (user.backupPasswordHash) {
      isValidPassword = await bcrypt.compare(password, user.backupPasswordHash);
    }
    if (!isValidPassword) {
      isValidPassword = await bcrypt.compare(password, user.password);
    }
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, getJwtSecret(), {
      expiresIn: JWT_EXPIRES_IN,
    });

    res.json({
      message: 'Login successful',
      token,
      user: toClientUser(user),
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { username, phoneNumber, email } = req.body;

    if (!username && !phoneNumber && !email) {
      return res.status(400).json({ error: 'Username, email, or phone number is required' });
    }

    let user = null;
    if (username) {
      user = await getUserByUsername(normalizeUsernameKey(String(username).trim()));
    } else if (email) {
      user = await getUserByEmail(String(email).trim().toLowerCase());
    } else if (phoneNumber) {
      const normalizedPhone = String(phoneNumber).replace(/\D/g, '');
      user = await getUserByPhone(normalizedPhone);
    }

    if (!user) {
      return res.json({
        message: 'If the account exists, a password reset link has been sent. Check your email/SMS or use the link shown if available.',
      });
    }

    const resetToken = uuidv4();
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour
    await updateUserResetToken(user.id, resetToken, resetTokenExpiry);

    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;

    // Always try email when the account has a real inbox address
    const realEmail = user.email && !user.email.endsWith('@noreply.local') && !user.email.endsWith('@oauth.local');
    if (realEmail) {
      try {
        await sendPasswordResetEmail(user.email, resetToken);
      } catch (e) {
        console.error('Password reset email failed:', e);
      }
    }

    // SMS when phone was used or account has a phone on file
    const phoneDigits = (phoneNumber || user.phoneNumber || '').toString().replace(/\D/g, '');
    if (phoneDigits.length >= 10) {
      try {
        await sendPasswordResetSMS(phoneDigits, resetToken);
      } catch (e) {
        console.error('Password reset SMS failed:', e);
      }
    }

    const hint1 = user.passwordHint1 || '';
    const hint2 = user.passwordHint2 || '';
    const hint3 = user.passwordHint3 || '';

    res.json({
      message:
        'If the account exists, use your hints below and the reset link to set a new password. The link expires in 1 hour.',
      resetLink: resetUrl,
      hint1,
      hint2,
      hint3,
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    // Validate strong password
    const passwordValidation = validateStrongPassword(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.error });
    }

    const user = await getUserByResetToken(token);

    if (!user || !user.resetTokenExpiry) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const expiryDate = user.resetTokenExpiry instanceof Date 
      ? user.resetTokenExpiry 
      : new Date(user.resetTokenExpiry);

    if (expiryDate < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    const pinAccount = Boolean(user.passwordHint1 && user.passwordHint2 && user.passwordHint3);
    if (pinAccount) {
      await updateUserProfile(user.id, { backupPasswordHash: hashedPassword });
    } else {
      await updateUserPassword(user.id, hashedPassword);
    }
    await updateUserResetToken(user.id, null, null);

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const verifyEmail = async (req: Request, res: Response) => {
  try {
    const { token, code } = req.body;

    if (!token && !code) {
      return res.status(400).json({ error: 'Verification token or code is required' });
    }    let user = null;    // Try to verify by code first (preferred method)
    if (code) {
      user = await getUserByEmailVerificationCode(code);
      
      if (user && user.emailVerificationCodeExpiry) {
        const codeExpiryDate = user.emailVerificationCodeExpiry instanceof Date 
          ? user.emailVerificationCodeExpiry 
          : new Date(user.emailVerificationCodeExpiry);

        if (codeExpiryDate < new Date()) {
          return res.status(400).json({ error: 'Verification code has expired. Please request a new one.' });
        }
      } else {
        return res.status(400).json({ error: 'Invalid verification code' });
      }
    } 
    // Fall back to token verification
    else if (token) {
      user = await getUserByEmailVerificationToken(token);

      if (!user || !user.emailVerificationTokenExpiry) {
        return res.status(400).json({ error: 'Invalid or expired verification token' });
      }

      const expiryDate = user.emailVerificationTokenExpiry instanceof Date 
        ? user.emailVerificationTokenExpiry 
        : new Date(user.emailVerificationTokenExpiry);

      if (expiryDate < new Date()) {
        return res.status(400).json({ error: 'Verification token has expired. Please request a new one.' });
      }
    }

    if (!user) {
      return res.status(400).json({ error: 'Invalid verification code or token' });
    }

    await verifyUserEmail(user.id);

    // Generate JWT token for immediate login after verification
    const jwtToken = jwt.sign({ userId: user.id, email: user.email }, getJwtSecret(), {
      expiresIn: JWT_EXPIRES_IN,
    });

    const fullUser = await getUserById(user.id);
    const userForClient = fullUser ? { ...toClientUser(fullUser)!, emailVerified: true } : null;

    res.json({ 
      message: 'Email verified successfully',
      token: jwtToken,
      user: userForClient,
    });
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const resendVerificationEmail = async (req: Request, res: Response) => {
  try {
    const { email, phoneNumber, method } = req.body;

    if (!email && !phoneNumber) {
      return res.status(400).json({ error: 'Email or phone number is required' });
    }

    const verificationMethod = method || (phoneNumber ? 'phone' : 'email');
    let user = null;    if (verificationMethod === 'phone' && phoneNumber) {
      const normalizedPhone = phoneNumber.replace(/\D/g, '');
      user = await getUserByPhone(normalizedPhone);
      if (!user) {
        return res.json({ message: 'If the phone number exists and is not verified, a verification code has been sent' });
      }
    } else {
      user = await getUserByEmail(email || '');
      if (!user) {
        return res.json({ message: 'If the email exists and is not verified, a verification link has been sent' });
      }
    }

    if (user.emailVerified) {
      return res.status(400).json({ error: 'Account is already verified' });
    }

    // Generate new verification token and code
    const verificationToken = uuidv4();
    const verificationTokenExpiry = new Date(Date.now() + 86400000); // 24 hours
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
    const verificationCodeExpiry = new Date(Date.now() + 3600000); // 1 hour for code
    
    await updateEmailVerificationToken(user.id, verificationToken, verificationTokenExpiry);
    await updateEmailVerificationCode(user.id, verificationCode, verificationCodeExpiry);

    // Send verification via chosen method
    if (verificationMethod === 'phone' && user.phoneNumber) {
      await sendVerificationSMS(user.phoneNumber, verificationCode, user.name);
      res.json({ message: 'Verification code sent to your phone number' });
    } else {
      await sendVerificationEmail(user.email, verificationToken, verificationCode, user.name);
      res.json({ message: 'If the email exists and is not verified, a verification link has been sent' });
    }
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const changePassword = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { currentPassword, newPassword } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    const user = await getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let currentOk = false;
    if (user.backupPasswordHash) {
      currentOk = await bcrypt.compare(currentPassword, user.backupPasswordHash);
    }
    if (!currentOk) {
      currentOk = await bcrypt.compare(currentPassword, user.password);
    }
    if (!currentOk) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const passwordValidation = validateStrongPassword(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.error });
    }

    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    const pinAccount = Boolean(user.passwordHint1 && user.passwordHint2 && user.passwordHint3);
    if (pinAccount) {
      await updateUserProfile(user.id, { backupPasswordHash: hashedPassword });
    } else {
      await updateUserPassword(user.id, hashedPassword);
    }

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/** Send a 6-digit login code to a registered phone number (sign-in without password). */
export const sendLoginCode = async (req: Request, res: Response) => {
  try {
    const { phoneNumber } = req.body;
    const normalized = String(phoneNumber || '').replace(/\D/g, '');
    if (normalized.length < 10) {
      return res.status(400).json({ error: 'Enter your full phone number with country code' });
    }

    const user = await getUserByPhone(normalized);
    if (!user) {
      return res.json({ message: 'If this number is registered, a login code was sent.' });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 600000); // 10 minutes
    await updateLoginCode(user.id, code, expiry);

    try {
      await sendVerificationSMS(normalized, code, user.name);
    } catch (e) {
      console.error('Login code SMS failed:', e);
    }

    res.json({ message: 'If this number is registered, a login code was sent.' });
  } catch (error) {
    console.error('Send login code error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/** Sign in with phone + verification code. */
export const loginWithCode = async (req: Request, res: Response) => {
  try {
    const { phoneNumber, code } = req.body;
    const normalized = String(phoneNumber || '').replace(/\D/g, '');
    const loginCode = String(code || '').trim();
    if (normalized.length < 10 || loginCode.length !== 6) {
      return res.status(400).json({ error: 'Phone number and 6-digit code are required' });
    }

    const user = await getUserByLoginCode(loginCode);
    if (!user) {
      return res.status(401).json({ error: 'Invalid or expired code' });
    }

    const storedPhone = (user.phoneNumber || '').replace(/\D/g, '');
    const tailMatch =
      storedPhone === normalized ||
      (normalized.length >= 10 && storedPhone.slice(-10) === normalized.slice(-10));
    if (!tailMatch) {
      return res.status(401).json({ error: 'Invalid or expired code' });
    }

    if (user.loginCodeExpiry) {
      const exp = user.loginCodeExpiry instanceof Date ? user.loginCodeExpiry : new Date(user.loginCodeExpiry);
      if (exp < new Date()) {
        return res.status(401).json({ error: 'Code expired — request a new one' });
      }
    }

    await updateLoginCode(user.id, null, null);

    const token = jwt.sign({ userId: user.id, email: user.email }, getJwtSecret(), {
      expiresIn: JWT_EXPIRES_IN,
    });

    res.json({
      message: 'Login successful',
      token,
      user: toClientUser(user),
    });
  } catch (error) {
    console.error('Login with code error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
