// SMS utility – Twilio when configured, else log to console
import twilio from 'twilio';

function getTwilioClient(): twilio.Twilio | null {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from = process.env.TWILIO_PHONE_NUMBER?.trim();
  if (sid && token && from) return twilio(sid, token);
  return null;
}

export async function sendVerificationSMS(phoneNumber: string, verificationCode: string, name: string): Promise<void> {
  const formattedPhone = phoneNumber.replace(/\D/g, '');
  const toNumber = formattedPhone.startsWith('1') && formattedPhone.length === 11 ? `+${formattedPhone}` : formattedPhone.length === 10 ? `+1${formattedPhone}` : `+${formattedPhone}`;
  const message = `Welcome ${name}! Your verification code is: ${verificationCode}. Expires in 1 hour.`;

  const client = getTwilioClient();
  if (client) {
    try {
      await client.messages.create({
        body: message,
        to: toNumber,
        from: process.env.TWILIO_PHONE_NUMBER!.trim(),
      });
      console.log('✓ Verification SMS sent to', toNumber);
    } catch (err: any) {
      console.error('Error sending verification SMS:', err.message || err);
      if (process.env.NODE_ENV !== 'production') {
        console.log('\n=== VERIFICATION CODE (SMS failed – use this) ===');
        console.log('To:', toNumber, '| Code:', verificationCode);
        console.log('==================================================\n');
      }
    }
    return;
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log('\n=== VERIFICATION SMS (no Twilio) ===');
    console.log('To:', toNumber, '| Code:', verificationCode);
    console.log('Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER in server/.env to send real SMS.');
    console.log('===================================\n');
  }
}

export async function sendPasswordResetSMS(phoneNumber: string, resetToken: string): Promise<void> {
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;
  const formattedPhone = phoneNumber.replace(/\D/g, '');
  const toNumber = formattedPhone.startsWith('1') && formattedPhone.length === 11 ? `+${formattedPhone}` : formattedPhone.length === 10 ? `+1${formattedPhone}` : `+${formattedPhone}`;
  const message = `Password reset: ${resetUrl} (expires in 1 hour).`;

  const client = getTwilioClient();
  if (client) {
    try {
      await client.messages.create({
        body: message,
        to: toNumber,
        from: process.env.TWILIO_PHONE_NUMBER!.trim(),
      });
      console.log('✓ Password reset SMS sent to', toNumber);
    } catch (err: any) {
      console.error('Error sending password reset SMS:', err.message || err);
      if (process.env.NODE_ENV !== 'production') {
        console.log('\n=== PASSWORD RESET LINK (SMS failed) ===');
        console.log('To:', toNumber, '| Link:', resetUrl);
        console.log('=========================================\n');
      }
    }
    return;
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log('\n=== PASSWORD RESET SMS (no Twilio) ===');
    console.log('To:', toNumber, '| Link:', resetUrl);
    console.log('======================================\n');
  }
}
