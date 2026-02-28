import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

export interface Verification {
  userId: string;
  email: {
    verified: boolean;
    verifiedAt: Date | string | null;
    verificationCode: string | null;
    codeExpiry: Date | string | null;
  };
  phone: {
    verified: boolean;
    phoneNumber: string | null;
    verifiedAt: Date | string | null;
    verificationCode: string | null;
    codeExpiry: Date | string | null;
  };
  social: {
    google: { connected: boolean; email: string | null; connectedAt: Date | string | null };
    facebook: { connected: boolean; email: string | null; connectedAt: Date | string | null };
    instagram: { connected: boolean; username: string | null; connectedAt: Date | string | null };
  };
  id: {
    verified: boolean;
    verifiedAt: Date | string | null;
    documentUrl: string | null;
    status: 'pending' | 'approved' | 'rejected' | null;
  };
}

const VERIFICATION_PATH = join(process.cwd(), 'server', 'data', 'verification.json');

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function readVerifications(): Promise<Verification[]> {
  try {
    const data = await readFile(VERIFICATION_PATH, 'utf-8');
    const verifications = JSON.parse(data);
    return verifications.map((v: Verification) => ({
      ...v,
      email: {
        ...v.email,
        verifiedAt: v.email.verifiedAt ? new Date(v.email.verifiedAt) : null,
        codeExpiry: v.email.codeExpiry ? new Date(v.email.codeExpiry) : null,
      },
      phone: {
        ...v.phone,
        verifiedAt: v.phone.verifiedAt ? new Date(v.phone.verifiedAt) : null,
        codeExpiry: v.phone.codeExpiry ? new Date(v.phone.codeExpiry) : null,
      },
      social: {
        google: {
          ...v.social.google,
          connectedAt: v.social.google.connectedAt ? new Date(v.social.google.connectedAt) : null,
        },
        facebook: {
          ...v.social.facebook,
          connectedAt: v.social.facebook.connectedAt ? new Date(v.social.facebook.connectedAt) : null,
        },
        instagram: {
          ...v.social.instagram,
          connectedAt: v.social.instagram.connectedAt ? new Date(v.social.instagram.connectedAt) : null,
        },
      },
      id: {
        ...v.id,
        verifiedAt: v.id.verifiedAt ? new Date(v.id.verifiedAt) : null,
      },
    }));
  } catch {
    return [];
  }
}

async function writeVerifications(verifications: Verification[]): Promise<void> {
  const dir = join(process.cwd(), 'server', 'data');
  await import('fs/promises').then(fs => fs.mkdir(dir, { recursive: true }));
  await writeFile(VERIFICATION_PATH, JSON.stringify(verifications, null, 2));
}

export async function getVerification(userId: string): Promise<Verification> {
  const verifications = await readVerifications();
  let verification = verifications.find(v => v.userId === userId);
  
  if (!verification) {
    verification = {
      userId,
      email: { verified: false, verifiedAt: null, verificationCode: null, codeExpiry: null },
      phone: { verified: false, phoneNumber: null, verifiedAt: null, verificationCode: null, codeExpiry: null },
      social: {
        google: { connected: false, email: null, connectedAt: null },
        facebook: { connected: false, email: null, connectedAt: null },
        instagram: { connected: false, username: null, connectedAt: null },
      },
      id: { verified: false, verifiedAt: null, documentUrl: null, status: null },
    };
    verifications.push(verification);
    await writeVerifications(verifications);
  }
  
  return verification;
}

export async function sendEmailVerificationCode(userId: string, code: string): Promise<void> {
  const verifications = await readVerifications();
  let verification = verifications.find(v => v.userId === userId);
  
  if (!verification) {
    verification = await getVerification(userId);
    verifications.push(verification);
  }
  
  verification.email.verificationCode = code;
  verification.email.codeExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
  
  await writeVerifications(verifications);
}

export async function verifyEmailCode(userId: string, code: string): Promise<boolean> {
  const verifications = await readVerifications();
  const verification = verifications.find(v => v.userId === userId);
  
  if (!verification || !verification.email.verificationCode) {
    return false;
  }
  
  const expiry = verification.email.codeExpiry ? new Date(verification.email.codeExpiry) : null;
  if (expiry && expiry < new Date()) {
    return false; // Code expired
  }
  
  if (verification.email.verificationCode === code) {
    verification.email.verified = true;
    verification.email.verifiedAt = new Date();
    verification.email.verificationCode = null;
    verification.email.codeExpiry = null;
    await writeVerifications(verifications);
    return true;
  }
  
  return false;
}

export async function sendPhoneVerificationCode(userId: string, phoneNumber: string, code: string): Promise<void> {
  const verifications = await readVerifications();
  let verification = verifications.find(v => v.userId === userId);
  
  if (!verification) {
    verification = await getVerification(userId);
    verifications.push(verification);
  }
  
  verification.phone.phoneNumber = phoneNumber;
  verification.phone.verificationCode = code;
  verification.phone.codeExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
  
  await writeVerifications(verifications);
}

export async function verifyPhoneCode(userId: string, code: string): Promise<boolean> {
  const verifications = await readVerifications();
  const verification = verifications.find(v => v.userId === userId);
  
  if (!verification || !verification.phone.verificationCode) {
    return false;
  }
  
  const expiry = verification.phone.codeExpiry ? new Date(verification.phone.codeExpiry) : null;
  if (expiry && expiry < new Date()) {
    return false; // Code expired
  }
  
  if (verification.phone.verificationCode === code) {
    verification.phone.verified = true;
    verification.phone.verifiedAt = new Date();
    verification.phone.verificationCode = null;
    verification.phone.codeExpiry = null;
    await writeVerifications(verifications);
    return true;
  }
  
  return false;
}

export async function connectSocialAccount(userId: string, provider: 'google' | 'facebook' | 'instagram', emailOrUsername: string): Promise<void> {
  const verifications = await readVerifications();
  let verification = verifications.find(v => v.userId === userId);
  
  if (!verification) {
    verification = await getVerification(userId);
    verifications.push(verification);
  }
  
  if (provider === 'google' || provider === 'facebook') {
    verification.social[provider].connected = true;
    verification.social[provider].email = emailOrUsername;
    verification.social[provider].connectedAt = new Date();
  } else if (provider === 'instagram') {
    verification.social.instagram.connected = true;
    verification.social.instagram.username = emailOrUsername;
    verification.social.instagram.connectedAt = new Date();
  }
  
  await writeVerifications(verifications);
}

export async function disconnectSocialAccount(userId: string, provider: 'google' | 'facebook' | 'instagram'): Promise<void> {
  const verifications = await readVerifications();
  const verification = verifications.find(v => v.userId === userId);
  
  if (verification) {
    if (provider === 'google' || provider === 'facebook') {
      verification.social[provider].connected = false;
      verification.social[provider].email = null;
      verification.social[provider].connectedAt = null;
    } else if (provider === 'instagram') {
      verification.social.instagram.connected = false;
      verification.social.instagram.username = null;
      verification.social.instagram.connectedAt = null;
    }
    await writeVerifications(verifications);
  }
}

export async function uploadIdVerification(userId: string, documentUrl: string): Promise<void> {
  const verifications = await readVerifications();
  let verification = verifications.find(v => v.userId === userId);
  
  if (!verification) {
    verification = await getVerification(userId);
    verifications.push(verification);
  }
  
  verification.id.documentUrl = documentUrl;
  verification.id.status = 'pending';
  
  await writeVerifications(verifications);
}

export async function approveIdVerification(userId: string): Promise<void> {
  const verifications = await readVerifications();
  const verification = verifications.find(v => v.userId === userId);
  
  if (verification) {
    verification.id.verified = true;
    verification.id.verifiedAt = new Date();
    verification.id.status = 'approved';
    await writeVerifications(verifications);
  }
}



