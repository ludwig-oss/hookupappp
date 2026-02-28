import { Request, Response } from 'express';
import {
  getVerification,
  sendEmailVerificationCode,
  verifyEmailCode,
  sendPhoneVerificationCode,
  verifyPhoneCode,
  connectSocialAccount,
  disconnectSocialAccount,
  uploadIdVerification,
} from '../models/verification.js';
import { getUserById } from '../models/user.js';

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export const getVerificationStatus = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const verification = await getVerification(userId);
    res.json({ verification });
  } catch (error) {
    console.error('Get verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const sendEmailVerification = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const user = await getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const code = generateCode();
    await sendEmailVerificationCode(userId, code);

    // In production, send email here
    // For now, return code for testing
    res.json({ 
      message: 'Verification code sent to email',
      code: code, // Remove in production
    });
  } catch (error) {
    console.error('Send email verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const verifyEmail = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Verification code is required' });
    }

    const verified = await verifyEmailCode(userId, code);
    if (verified) {
      res.json({ message: 'Email verified successfully' });
    } else {
      res.status(400).json({ error: 'Invalid or expired verification code' });
    }
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const sendPhoneVerification = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    const code = generateCode();
    await sendPhoneVerificationCode(userId, phoneNumber, code);

    // In production, send SMS here
    // For now, return code for testing
    res.json({ 
      message: 'Verification code sent to phone',
      code: code, // Remove in production
    });
  } catch (error) {
    console.error('Send phone verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const verifyPhone = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Verification code is required' });
    }

    const verified = await verifyPhoneCode(userId, code);
    if (verified) {
      res.json({ message: 'Phone verified successfully' });
    } else {
      res.status(400).json({ error: 'Invalid or expired verification code' });
    }
  } catch (error) {
    console.error('Verify phone error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const connectSocial = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { provider, emailOrUsername } = req.body;

    if (!provider || !emailOrUsername) {
      return res.status(400).json({ error: 'Provider and email/username are required' });
    }

    if (provider !== 'google' && provider !== 'facebook' && provider !== 'instagram') {
      return res.status(400).json({ error: 'Invalid provider' });
    }

    await connectSocialAccount(userId, provider, emailOrUsername);
    res.json({ message: `${provider} account connected successfully` });
  } catch (error) {
    console.error('Connect social error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const disconnectSocial = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { provider } = req.body;

    if (!provider) {
      return res.status(400).json({ error: 'Provider is required' });
    }

    if (provider !== 'google' && provider !== 'facebook' && provider !== 'instagram') {
      return res.status(400).json({ error: 'Invalid provider' });
    }

    await disconnectSocialAccount(userId, provider);
    res.json({ message: `${provider} account disconnected successfully` });
  } catch (error) {
    console.error('Disconnect social error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const uploadId = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { documentUrl } = req.body;

    if (!documentUrl) {
      return res.status(400).json({ error: 'Document URL is required' });
    }

    await uploadIdVerification(userId, documentUrl);
    res.json({ message: 'ID verification document uploaded. Pending review.' });
  } catch (error) {
    console.error('Upload ID error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};



