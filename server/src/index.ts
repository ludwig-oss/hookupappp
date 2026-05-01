import path from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';

// Load .env – try multiple locations so we always find server/.env
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPaths = [
  path.join(process.cwd(), '.env'),                    // same folder as "current directory" when you run npm
  path.join(__dirname, '..', '.env'),                   // server folder (when entry is server/src/index.ts)
  path.join(process.cwd(), 'server', '.env'),          // project root → server/.env
];
let loaded: { error?: Error } = { error: new Error('not tried') };
for (const envPath of envPaths) {
  loaded = dotenv.config({ path: envPath });
  if (!loaded.error) {
    console.log('✓ Loaded .env from', envPath);
    break;
  }
}
if (loaded.error) {
  console.warn('⚠ .env not found. Tried:', envPaths.join(' | '));
}
import profileRoutes from './routes/profile.js';
import chatRoutes from './routes/chat.js';
import improvementRoutes from './routes/improvement.js';
import nearbyRoutes from './routes/nearby.js';
import discoverRoutes from './routes/discover.js';
import safetyRoutes from './routes/safety.js';
import postsRoutes from './routes/posts.js';
import settingsRoutes from './routes/settings.js';
import gamificationRoutes from './routes/gamification.js';
import reportsRoutes from './routes/reports.js';
import verificationRoutes from './routes/verification.js';
import premiumRoutes from './routes/premium.js';
import compatibilityRoutes from './routes/compatibility.js';
import connectionsRoutes from './routes/connections.js';
import activityRoutes from './routes/activity.js';
import ratingsRoutes from './routes/ratings.js';
import reviewsRoutes from './routes/reviews.js';
import speedDateRoutes from './routes/speedDate.js';
import chatEngagementRoutes from './routes/chatEngagement.js';
import healthResultsRoutes from './routes/health.js';
import eventsRoutes from './routes/events.js';
import relationshipRoutes from './routes/relationship.js';
import connectionJourneyRoutes from './routes/connectionJourney.js';
import notificationsRoutes from './routes/notifications.js';
import { runSchema } from './db/index.js';
import { apiLimiter } from './middleware/rateLimit.js';

const app = express();
const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === 'production';
const frontendUrl = process.env.FRONTEND_URL?.trim() || '';

if (isProduction && !process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET must be set in production. Set it in server/.env');
  process.exit(1);
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (!isProduction) {
        callback(null, true);
        return;
      }
      if (!origin) {
        callback(null, true);
        return;
      }
      try {
        const host = new URL(origin).hostname;
        if (frontendUrl && origin === frontendUrl) {
          callback(null, true);
          return;
        }
        if (host === 'localhost' || host.endsWith('.vercel.app')) {
          callback(null, true);
          return;
        }
        callback(new Error('Not allowed by CORS'));
      } catch {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use('/api', apiLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/improvement', improvementRoutes);
app.use('/api/nearby', nearbyRoutes);
app.use('/api/discover', discoverRoutes);
app.use('/api/safety', safetyRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/gamification', gamificationRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/verification', verificationRoutes);
app.use('/api/premium', premiumRoutes);
app.use('/api/compatibility', compatibilityRoutes);
app.use('/api/connections', connectionsRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/ratings', ratingsRoutes);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/speed-date', speedDateRoutes);
app.use('/api/chat-engagement', chatEngagementRoutes);
app.use('/api/health-results', healthResultsRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/relationship', relationshipRoutes);
app.use('/api/connection-journey', connectionJourneyRoutes);
app.use('/api/notifications', notificationsRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

if (isProduction) {
  const clientDistCandidates = [
    path.join(process.cwd(), 'client', 'dist'),
    path.join(process.cwd(), '..', 'client', 'dist'),
    path.join(__dirname, '..', '..', 'client', 'dist'),
  ];
  const clientDist = clientDistCandidates.find(p => existsSync(p));
  if (clientDist) {
    app.use(express.static(clientDist));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  } else {
    console.warn('client/dist not found – run "npm run build" from project root to serve the app from this server');
  }
}

// So you can confirm SMTP/Twilio are loaded (no secrets returned)
app.get('/api/email-status', (req, res) => {
  const smtpUser = process.env.SMTP_USER?.trim();
  const smtpPass = process.env.SMTP_PASS?.trim();
  const twilioSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const twilioToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const twilioPhone = process.env.TWILIO_PHONE_NUMBER?.trim();
  const smtpKeys = Object.keys(process.env).filter(k => k.startsWith('SMTP_'));
  res.json({
    smtp: !!(smtpUser && smtpPass),
    smtpUser: smtpUser ? smtpUser.replace(/(.).*(@.*)/, '$1***$2') : null,
    smtpKeysFound: smtpKeys,
    hint: !smtpUser && !smtpPass && smtpKeys.length === 0
      ? 'No SMTP_* env vars. Add SMTP_USER and SMTP_PASS to server/.env (exact names, no spaces around =) and restart.'
      : !smtpUser || !smtpPass
        ? 'SMTP_USER and SMTP_PASS must both be set. Check for typos or spaces in server/.env'
        : null,
    twilio: !!(twilioSid && twilioToken && twilioPhone),
  });
});

async function start() {
  if (process.env.DATABASE_URL) {
    await runSchema();
    console.log('✓ PostgreSQL schema ensured');
  }
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    const smtpUser = process.env.SMTP_USER?.trim();
    const smtpPass = process.env.SMTP_PASS?.trim();
    console.log('  SMTP_USER:', smtpUser ? smtpUser.replace(/(.).*(@.*)/, '$1***$2') + ' (len ' + smtpUser.length + ')' : 'NOT SET');
    console.log('  SMTP_PASS:', smtpPass ? '*** (len ' + smtpPass.length + ')' : 'NOT SET');
    if (smtpUser && smtpPass) {
      console.log('✓ SMTP configured – emails will be sent to users');
    } else {
      console.log('⚠ SMTP NOT configured – put SMTP_USER and SMTP_PASS in server/.env (no spaces around =) and restart');
    }
    const twilioSid = process.env.TWILIO_ACCOUNT_SID?.trim();
    if (twilioSid && process.env.TWILIO_AUTH_TOKEN?.trim() && process.env.TWILIO_PHONE_NUMBER?.trim()) {
      console.log('✓ Twilio configured – SMS will be sent to phones');
    } else {
      console.log('⚠ Twilio not configured – verification codes by phone only in server console');
    }
    if (process.env.DATABASE_URL) console.log('✓ PostgreSQL (DATABASE_URL) – users, posts, chat use DB');
    console.log('  Check config: http://localhost:' + PORT + '/api/email-status');
  });
}
start().catch((err) => {
  console.error('Startup failed:', err);
  process.exit(1);
});

