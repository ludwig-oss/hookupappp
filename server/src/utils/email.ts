import nodemailer from 'nodemailer';

// Email transporter configuration
// Priority: 1) Custom SMTP (if SMTP_USER and SMTP_PASS are set)
//          2) Ethereal Email (free testing service - creates real test emails)
//          3) Console logging (fallback)

let transporter: nodemailer.Transporter | null = null;
let etherealAccount: nodemailer.TestAccount | null = null;

// Helper: read env and trim (avoids issues with spaces in .env)
function smtpUser() {
  return process.env.SMTP_USER?.trim() || '';
}
function smtpPass() {
  return process.env.SMTP_PASS?.trim() || '';
}

// Initialize transporter
async function initializeTransporter() {
  const user = smtpUser();
  const pass = smtpPass();

  // If we have SMTP credentials, always use them (clear any cached Ethereal)
  if (user && pass) {
    transporter = null;
    etherealAccount = null;
  }

  if (transporter) return transporter;

  // If custom SMTP credentials are provided, use them (real emails to user inbox)
  if (user && pass) {
    const port = parseInt(process.env.SMTP_PORT?.trim() || '587', 10);
    const secure = port === 465;
    const host = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
    transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      ...(port === 587 && { requireTLS: true }),
    });
    console.log('✓ Using real SMTP –', host + ':' + port);
    try {
      await transporter.verify();
      console.log('✓ SMTP connection verified – emails will be sent to users\' inboxes');
    } catch (verifyErr: any) {
      console.error('✗ SMTP connection failed:', verifyErr.message || verifyErr);
      if (verifyErr.code === 'EAUTH') {
        console.error('  → For Gmail use an App Password, not your normal password: https://myaccount.google.com/apppasswords');
      }
      // Keep using this transporter so we still try to send (e.g. network glitch); errors will show in send
    }
    return transporter;
  }

  // Otherwise, use Ethereal Email for testing – emails do NOT go to real inboxes
  try {
    etherealAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: etherealAccount.user,
        pass: etherealAccount.pass,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
    console.log('\n📧 Ethereal Email (testing only – emails do NOT reach the user\'s real inbox)');
    console.log('   To send real verification codes, set SMTP_USER and SMTP_PASS in server/.env\n');
    return transporter;
  } catch (error) {
    console.error('Failed to create Ethereal account:', error);
    transporter = nodemailer.createTransport({
      host: 'localhost',
      port: 587,
      secure: false,
    });
    return transporter;
  }
}

export async function sendPasswordResetEmail(email: string, resetToken: string): Promise<void> {
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;

  const fromAddress = (process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@example.com').trim();
  const mailOptions = {
    from: fromAddress,
    to: email,
    subject: 'Password Reset Request',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Reset Request</h2>
        <p>You requested to reset your password. Click the link below to reset it:</p>
        <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">
          Reset Password
        </a>
        <p>Or copy and paste this URL into your browser:</p>
        <p style="color: #666; word-break: break-all;">${resetUrl}</p>
        <p style="color: #999; font-size: 12px; margin-top: 30px;">
          This link will expire in 1 hour. If you didn't request this, please ignore this email.
        </p>
      </div>
    `,
  };

  try {
    const emailTransporter = await initializeTransporter();
    const info = await emailTransporter.sendMail(mailOptions);
    
    if (etherealAccount && !smtpUser()) {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (process.env.NODE_ENV !== 'production') {
        console.log('\n⚠️  Ethereal mode: password reset email was NOT delivered to ' + email);
        console.log('   Use this link to reset (copy and open in browser): ' + resetUrl);
        console.log('   Preview (dev only): ' + previewUrl);
        console.log('   To send real emails, add SMTP_USER and SMTP_PASS to server/.env\n');
      }
    } else {
      console.log('✓ Password reset email sent to ' + email);
    }
  } catch (error) {
    console.error('Error sending email:', error);
    if (process.env.NODE_ENV !== 'production') {
      console.log('\n=== PASSWORD RESET LINK (use this if email failed) ===');
      console.log('To: ' + email);
      console.log('Reset link (copy and open in browser): ' + resetUrl);
      console.log('To send real emails, add SMTP_USER and SMTP_PASS to server/.env');
      console.log('========================================================\n');
    }
  }
}

export async function sendVerificationEmail(email: string, verificationToken: string, verificationCode: string, name: string): Promise<void> {
  const verifyUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?token=${verificationToken}`;
  // For Gmail, "from" must match the authenticated user or be left to default
  const fromAddress = (process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@example.com').trim();

  const mailOptions = {
    from: fromAddress,
    to: email,
    subject: 'Verify Your Email Address - Your Verification Code',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
        <div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <h2 style="color: #4F46E5; margin-top: 0;">Welcome, ${name}!</h2>
          <p style="font-size: 16px; color: #374151;">Thank you for signing up. Please verify your email address to complete your registration and protect your account.</p>
          
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 8px; text-align: center; margin: 30px 0;">
            <p style="color: white; font-size: 14px; margin: 0 0 10px 0; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Your Verification Code</p>
            <div style="background: white; padding: 20px; border-radius: 6px; display: inline-block; margin: 10px 0;">
              <p style="font-size: 36px; font-weight: bold; color: #4F46E5; margin: 0; letter-spacing: 8px; font-family: 'Courier New', monospace;">${verificationCode}</p>
            </div>
            <p style="color: rgba(255,255,255,0.9); font-size: 12px; margin: 15px 0 0 0;">This code expires in 1 hour</p>
          </div>

          <p style="font-size: 14px; color: #6b7280; margin: 20px 0;">Or click the button below to verify via link:</p>
          <a href="${verifyUrl}" style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px; margin: 10px 0;">
            Verify Email Address
          </a>
          
          <p style="color: #999; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <strong>Security Notice:</strong> This verification code will expire in 1 hour. If you didn't create an account, please ignore this email.
          </p>
          <p style="color: #999; font-size: 12px; margin-top: 10px;">
            For security reasons, you won't be able to log in until your email is verified.
          </p>
        </div>
      </div>
    `,
    text: `
Welcome, ${name}!

Thank you for signing up. Please verify your email address to complete your registration.

Your Verification Code: ${verificationCode}
This code expires in 1 hour.

Or visit this link to verify: ${verifyUrl}

This link will expire in 24 hours.

If you didn't create an account, please ignore this email.
    `,
  };

  try {
    const emailTransporter = await initializeTransporter();
    
    // Send the email
    const info = await emailTransporter.sendMail(mailOptions);
    
    // If using Ethereal, the email did NOT go to the user's real inbox – show code for manual entry
    if (etherealAccount && !smtpUser()) {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (process.env.NODE_ENV !== 'production') {
        console.log('\n⚠️  Ethereal mode: email was NOT delivered to ' + email);
        console.log('   Enter this code on the verify page: ' + verificationCode);
        console.log('   Preview (dev only): ' + previewUrl);
        console.log('   To send real emails, add SMTP_USER and SMTP_PASS to server/.env\n');
      }
    } else {
      console.log('✓ Verification email sent to ' + email);
    }
  } catch (error: any) {
    console.error('Error sending verification email:', error);
    if (process.env.NODE_ENV !== 'production') {
      console.log('\n=== EMAIL VERIFICATION CODE (Fallback) ===');
      console.log(`To: ${email}`);
      console.log(`Name: ${name}`);
      console.log(`Verification Code: ${verificationCode} (expires in 1 hour)`);
      console.log(`Verify Link: ${verifyUrl}`);
      console.log('\n⚠️  Email sending failed. Use the code above to verify your account.');
      console.log('   To enable real email sending, create a .env file in the server folder with:');
      console.log('   SMTP_USER=your-email@gmail.com');
      console.log('   SMTP_PASS=your-app-password');
      console.log('=============================================\n');
    }
    
    // If it's an authentication error, provide helpful message
    if (error.code === 'EAUTH') {
      console.error('\n⚠️  Email authentication failed. Please check your SMTP credentials.');
      console.error('   For Gmail, you need to use an App Password, not your regular password.');
    }
  }
}

export async function sendAppNotificationEmail(
  to: string,
  name: string,
  subject: string,
  body: string
): Promise<void> {
  try {
    const emailTransporter = await initializeTransporter();
    await emailTransporter.sendMail({
      from: process.env.SMTP_FROM?.trim() || smtpUser() || 'noreply@localhost',
      to,
      subject,
      text: `Hi ${name},\n\n${body}\n`,
      html: `<p>Hi ${name},</p><p>${body.replace(/</g, '&lt;')}</p>`,
    });
  } catch (error) {
    console.warn('Notification email failed:', (error as Error).message);
  }
}








