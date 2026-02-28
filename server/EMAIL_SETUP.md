# Sending Real Emails (Verification & Password Reset)

**Verification codes** and **password reset links** are sent to the user's real email only when the server is configured with SMTP. Otherwise the app uses a test mailbox (Ethereal) and **no email is delivered** to the address they typed in.

## One-time setup (about 2 minutes)

1. **Create a `.env` file** in the `server` folder (same folder as `package.json`).
   - Copy from `env.example`:  
     `cp env.example .env`  
     (or duplicate `env.example` and rename the copy to `.env`.)

2. **Set your email credentials** in `server/.env`:

   ```env
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-16-char-app-password
   ```

   **Gmail:**
   - Do **not** use your normal Gmail password.
   - Use an [App Password](https://myaccount.google.com/apppasswords):
     - Go to https://myaccount.google.com/apppasswords
     - Create an app password for “Mail” and use that 16-character value as `SMTP_PASS`.

   **Other providers (Outlook, Yahoo, etc.):**
   - Use that provider’s SMTP settings and, if they offer it, an app-specific password.
   - You can set `SMTP_HOST` and `SMTP_PORT` in `.env` if needed (see `env.example`).

3. **Restart the server** so it picks up `.env`:
   - Stop the current process (Ctrl+C), then run `npm run dev` again from the project root (or `npm run dev:server` from the `server` folder).

After this:
- **Signup verification** emails (with the 6-digit code) will be sent to the real address the user entered.
- **Forgot password** reset links will be sent to the user's real inbox.

The same SMTP setup is used for both.

## Troubleshooting

- **"SMTP not configured" in server console**  
  The server didn’t find `SMTP_USER` and `SMTP_PASS`. Check that `server/.env` exists, has no spaces around `=`, and you restarted the server after editing.

- **Check if the server sees your config**  
  Open: `http://localhost:5000/api/email-status`  
  You should see `"smtp": true` and a masked email. If `smtp` is `false`, fix `.env` and restart.

- **"SMTP connection failed" / "EAUTH"**  
  For Gmail you must use an **App Password**, not your normal password. Create one at https://myaccount.google.com/apppasswords and set `SMTP_PASS` to that 16-character value.

- **SMS (phone verification)**  
  To send real SMS, add Twilio credentials to `server/.env`: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`. Without them, the verification code is only printed in the server console.
