import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { createUser, getUserByEmail, getUserByUsername, getUserByResetToken, updateUserPassword, updateUserResetToken, getUserByPhone, getUserById, updateUserProfile, getUserByEmailVerificationToken, updateEmailVerificationToken, verifyUserEmail, getUserByEmailVerificationCode, updateEmailVerificationCode } from '../models/user.js';
import { sendPasswordResetEmail, sendVerificationEmail } from '../utils/email.js';
import { sendPasswordResetSMS, sendVerificationSMS } from '../utils/sms.js';
import { sanitizeName, sanitizeUsername } from '../utils/sanitize.js';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '7d';

const BCRYPT_ROUNDS = process.env.NODE_ENV === 'production' ? 12 : 10;

function getJwtSecret(): string {
  if (JWT_SECRET && JWT_SECRET.length >= 32) return JWT_SECRET;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set in production (min 32 characters). Set it in server/.env');
  }
  return JWT_SECRET || 'dev-only-secret-do-not-use-in-production';
}

// Strong password validation
function validateStrongPassword(password: string): { valid: boolean; error?: string } {
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
    let { password, name, username, improvementCategories, phoneNumber, passwordHint1, passwordHint2, passwordHint3 } = req.body;
    name = sanitizeName(name);
    username = sanitizeUsername(username) || (typeof req.body.username === 'string' ? req.body.username.trim().slice(0, 20) : '');
    if (!password || !name || !username) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (!passwordHint1 || !passwordHint2 || !passwordHint3) {
      return res.status(400).json({ error: 'All three password hints are required to help you recover your account' });
    }

    if (!improvementCategories || !Array.isArray(improvementCategories) || improvementCategories.length === 0) {
      return res.status(400).json({ error: 'You must select at least one improvement category' });
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
      return res.status(400).json({ error: 'Username is already taken' });
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const normalizedPhone = phoneNumber ? phoneNumber.replace(/\D/g, '') : null;

    if (normalizedPhone) {
      const existingUserByPhone = await getUserByPhone(normalizedPhone);
      if (existingUserByPhone && existingUserByPhone.id) {
        return res.status(400).json({ error: 'Phone number is already registered' });
      }
    }

    const user = await createUser({
      email: `${username}@noreply.local`,
      password: hashedPassword,
      name,
      username,
      improvementCategories,
      passwordHint1: String(passwordHint1).trim().slice(0, 200),
      passwordHint2: String(passwordHint2).trim().slice(0, 200),
      passwordHint3: String(passwordHint3).trim().slice(0, 200),
    });
    await updateUserProfile(user.id, { emailVerified: false });

    if (normalizedPhone) {
      await updateUserProfile(user.id, { phoneNumber: normalizedPhone });
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, getJwtSecret(), { expiresIn: JWT_EXPIRES_IN });

    // Return full profile (no password); do not override emailVerified so client can gate features
    const { password: _p, resetToken: _rt, resetTokenExpiry: _rte, ...safeUser } = user;
    const userForClient = { ...safeUser, emailVerified: user.emailVerified };

    res.status(201).json({
      message: 'Account created successfully. Verify your email or phone to unlock all features.',
      token,
      user: userForClient,
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    const loginUsername = (username || '').trim();
    if (!loginUsername || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = await getUserByUsername(loginUsername);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, getJwtSecret(), {
      expiresIn: JWT_EXPIRES_IN,
    });

    // Return full profile (no password); expose real emailVerified so client can require verification
    const { password: _p, resetToken: _rt, resetTokenExpiry: _rte, ...safeUser } = user;
    const userForClient = { ...safeUser, emailVerified: user.emailVerified };

    res.json({
      message: 'Login successful',
      token,
      user: userForClient,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { username, phoneNumber } = req.body;

    if (!username && !phoneNumber) {
      return res.status(400).json({ error: 'Username or phone number is required' });
    }

    let user = null;
    if (username) {
      user = await getUserByUsername((username || '').trim());
    } else if (phoneNumber) {
      const normalizedPhone = phoneNumber.replace(/\D/g, '');
      user = await getUserByPhone(normalizedPhone);
    }

    if (!user) {
      return res.json({ message: 'If the account exists, a password reset link has been sent' });
    }

    const resetToken = uuidv4();
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour
    await updateUserResetToken(user.id, resetToken, resetTokenExpiry);

    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;

    if (phoneNumber && user.phoneNumber) {
      const normalizedPhone = phoneNumber.replace(/\D/g, '');
      await sendPasswordResetSMS(normalizedPhone, resetToken);
    }

    const hint1 = user.passwordHint1 || '';
    const hint2 = user.passwordHint2 || '';
    const hint3 = user.passwordHint3 || '';

    res.json({
      message: 'If the account exists, use your hints below to help remember your password. Use the reset link to set a new password.',
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
    await updateUserPassword(user.id, hashedPassword);
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

    // Return full profile (no password) so client has everything
    const fullUser = await getUserById(user.id);
    const { password: _p, resetToken: _rt, resetTokenExpiry: _rte, ...safeUser } = fullUser!;
    const userForClient = { ...safeUser, emailVerified: true };

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

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Validate strong password
    const passwordValidation = validateStrongPassword(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.error });
    }

    // Update password
    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await updateUserPassword(user.id, hashedPassword);

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
