/**
 * Seeds Dating Advice Q&A + Love Life Feed posts when SIMULATOR is on,
 * and auto-answers new advice questions with mock cohort peers.
 */
import { isSimulatorEnabled, isSimulatorUserId, getSimulatorUsers } from './runtime.js';
import {
  createAdviceQuestion,
  addAdviceAnswer,
  addAdviceReply,
  likeAdviceAnswer,
  getQuestionById,
  type AdviceAnswerCohort,
} from '../models/datingAdvice.js';
import { createPost, getAllPosts, addComment, likePost } from '../models/posts.js';
import { getUserPreference } from '../models/discover.js';
import { notifyNewAdviceAnswer } from '../realtime/notifications.js';

const ADVICE_ANSWERS: string[] = [
  'Been there. Next time confirm the morning of — flakes often go quiet the night before.',
  'Straight talk: if they cancel twice with no reschedule, move on. Your time matters.',
  'Text something light + specific: “Coffee at X Saturday?” Vague plans die.',
  'Red flag if they only message late night. Daytime effort = real interest.',
  'Stand-ups suck. Tell a friend, then put yourself back out there the same week.',
  'Ask one curious question about their week — people open up when they feel heard.',
  'If gold-digging vibes show up (money talk early), exit politely. Not worth it.',
  'First date tip: public place, 60–90 min max, have an exit. Safety first.',
];

const ADVICE_SEED_QUERIES: { query: string; cohort: AdviceAnswerCohort; gender: string; orientation: string }[] = [
  { query: 'Got stood up — how do I bounce back without sounding bitter?', cohort: 'straight_male', gender: 'male', orientation: 'straight' },
  { query: 'How do I tell if he’s actually interested or just bored?', cohort: 'straight_female', gender: 'female', orientation: 'straight' },
  { query: 'First date ideas that aren’t just drinks?', cohort: 'straight_male', gender: 'male', orientation: 'straight' },
  { query: 'Red flags on dating apps that people ignore?', cohort: 'pan_all', gender: 'female', orientation: 'pansexual' },
  { query: 'How soon is too soon to bring up exclusivity?', cohort: 'bi_female', gender: 'female', orientation: 'bisexual' },
];

const FEED_POSTS: { title: string; content: string; type: 'positive' | 'warning'; tags: string[] }[] = [
  {
    title: 'Coffee walk > dinner pressure',
    content: 'Took a 40-minute walk for a first meet. Way less awkward than a 2-hour dinner. Highly recommend.',
    type: 'positive',
    tags: ['first-date', 'tips'],
  },
  {
    title: 'Love-bombing warning',
    content: 'If someone calls you “the one” in week one and pushes for isolation from friends — slow down. That’s not romance, that’s control.',
    type: 'warning',
    tags: ['red-flags', 'safety'],
  },
  {
    title: 'Texting tip that works',
    content: 'Match their energy, then add one concrete plan. “Free Thu? Gelato at 7?” beats essay texts.',
    type: 'positive',
    tags: ['texting', 'dating'],
  },
  {
    title: 'Meetup safety checklist',
    content: 'Share live location with a friend. Meet in public. Have your own ride. Tell someone the name + place.',
    type: 'warning',
    tags: ['safety', 'meetup'],
  },
  {
    title: 'When they go quiet',
    content: 'One follow-up is fine. Three is chasing. Protect your peace and keep dating others.',
    type: 'positive',
    tags: ['boundaries'],
  },
  {
    title: 'Green flag: consistent effort',
    content: 'Consistency > chemistry fireworks. The person who shows up mid-week is usually the real one.',
    type: 'positive',
    tags: ['green-flags'],
  },
  {
    title: 'Don’t ignore money tests',
    content: 'Sudden “emergency” cash asks before you’ve met IRL = scam pattern. Report + block.',
    type: 'warning',
    tags: ['scams', 'safety'],
  },
  {
    title: 'Second date upgrade',
    content: 'If date one felt easy, date two can be a short activity (market, gallery). Shared focus beats staring contests.',
    type: 'positive',
    tags: ['second-date'],
  },
];

const FEED_COMMENTS = [
  'This is exactly what I needed to hear.',
  'Saving this. Thank you!',
  'Had the same experience last month.',
  'Solid advice — sharing with a friend.',
  'Wish I’d read this sooner.',
];

let seeded = false;
const answering = new Set<string>();

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Fill Dating Advice + Love Feed so the simulator feels alive immediately. */
export async function seedSimulatorSocialContent(): Promise<void> {
  if (!isSimulatorEnabled() || seeded) return;
  seeded = true;
  try {
    await seedAdviceFeed();
    await answerUnansweredAdvice();
    await seedLoveFeed();
    console.log('🧪 Simulator social seed: Dating Advice answers + Love Life Feed posts ready.');
  } catch (e: any) {
    console.warn('🧪 Simulator social seed skipped:', e?.message || e);
    seeded = false;
  }
}

/** Backfill answers on any advice question still at 0 replies (incl. the user's). */
async function answerUnansweredAdvice(): Promise<void> {
  try {
    const { readFile } = await import('fs/promises');
    const { join } = await import('path');
    const paths = [
      join(process.cwd(), 'server', 'data', 'advice-questions.json'),
      join(process.cwd(), 'data', 'advice-questions.json'),
    ];
    let list: any[] = [];
    for (const p of paths) {
      try {
        const raw = JSON.parse(await readFile(p, 'utf-8'));
        if (Array.isArray(raw) && raw.length) {
          list = raw;
          break;
        }
      } catch {
        /* next */
      }
    }
    for (const q of list) {
      if (q?.id && (!Array.isArray(q.answers) || q.answers.length === 0)) {
        scheduleMockAdviceAnswers(q.id, q.userId || 'unknown');
      }
    }
  } catch {
    /* optional */
  }
}

async function seedAdviceFeed(): Promise<void> {
  const mocks = getSimulatorUsers();
  if (mocks.length < 4) return;

  const { readFile } = await import('fs/promises');
  const { join } = await import('path');
  const paths = [
    join(process.cwd(), 'server', 'data', 'advice-questions.json'),
    join(process.cwd(), 'data', 'advice-questions.json'),
  ];
  let existing = 0;
  for (const p of paths) {
    try {
      const raw = JSON.parse(await readFile(p, 'utf-8'));
      if (Array.isArray(raw)) existing = Math.max(existing, raw.length);
    } catch {
      /* missing ok */
    }
  }
  if (existing >= 4) return;

  for (let i = 0; i < ADVICE_SEED_QUERIES.length; i++) {
    const seed = ADVICE_SEED_QUERIES[i];
    const asker = mocks[i % mocks.length];
    const q = await createAdviceQuestion({
      userId: asker.id,
      query: seed.query,
      orientation: seed.orientation,
      gender: seed.gender,
      lookingFor: ['dating'],
      city: asker.city || 'Berlin',
      country: asker.country || 'Germany',
      lat: asker.location?.lat,
      lon: asker.location?.lon,
    });

    const responders = mocks.filter((m) => m.id !== asker.id).slice(0, 3);
    for (let j = 0; j < responders.length; j++) {
      const r = responders[j];
      const added = await addAdviceAnswer(q.id, {
        userId: r.id,
        userName: r.name,
        content: ADVICE_ANSWERS[(i + j) % ADVICE_ANSWERS.length],
      });
      if (added && j === 0) {
        for (const lid of mocks.slice(0, 3).map((m) => m.id)) {
          await likeAdviceAnswer(q.id, added.answer.id, lid).catch(() => {});
        }
        await addAdviceReply(q.id, added.answer.id, {
          userId: asker.id,
          userName: 'Anonymous asker',
          content: 'Thank you — this actually helps.',
        }).catch(() => {});
      }
    }
  }
}

async function seedLoveFeed(): Promise<void> {
  const mocks = getSimulatorUsers();
  if (mocks.length < 3) return;

  const posts = await getAllPosts();
  const simPosts = posts.filter((p) => isSimulatorUserId(p.userId));
  if (simPosts.length >= 6) return;

  for (let i = 0; i < FEED_POSTS.length; i++) {
    const author = mocks[i % mocks.length];
    const spec = FEED_POSTS[i];
    const post = await createPost({
      userId: author.id,
      type: spec.type,
      contentType: 'text',
      content: spec.content,
      title: spec.title,
      tags: spec.tags,
    });
    // Boost likes past blowing-up threshold for a couple posts
    const likeTimes = i % 3 === 0 ? 28 : 8 + (i % 10);
    for (let L = 0; L < likeTimes; L++) {
      await likePost(post.id).catch(() => {});
    }
    const commenters = mocks.filter((m) => m.id !== author.id).slice(0, 2 + (i % 2));
    for (let c = 0; c < commenters.length; c++) {
      await addComment(post.id, {
        userId: commenters[c].id,
        userName: commenters[c].name,
        content: FEED_COMMENTS[(i + c) % FEED_COMMENTS.length],
      }).catch(() => {});
    }
  }
}

/**
 * After a real (or any) user posts a Dating Advice question, mocks in that cohort reply.
 */
export function scheduleMockAdviceAnswers(questionId: string, askerUserId: string): void {
  if (!isSimulatorEnabled()) return;
  if (answering.has(questionId)) return;
  answering.add(questionId);

  void (async () => {
    try {
      await delay(800 + Math.random() * 1200);
      const q = await getQuestionById(questionId);
      if (!q) return;

      const mocks = getSimulatorUsers();
      const responders: typeof mocks = [];
      for (const m of mocks) {
        if (m.id === askerUserId) continue;
        const pref = await getUserPreference(m.id);
        const { computeAnswerCohort } = await import('../models/datingAdvice.js');
        const c = computeAnswerCohort(pref?.orientation || 'straight', m.gender);
        if (c === q.answerCohort || q.answerCohort === 'pan_all' || c === 'pan_all') {
          responders.push(m);
        }
        if (responders.length >= 4) break;
      }
      if (!responders.length) {
        responders.push(...mocks.filter((m) => m.id !== askerUserId).slice(0, 3));
      }

      for (let i = 0; i < Math.min(3, responders.length); i++) {
        await delay(400 + i * 600);
        const r = responders[i];
        const result = await addAdviceAnswer(questionId, {
          userId: r.id,
          userName: r.name,
          content: pick(ADVICE_ANSWERS),
        });
        if (result) {
          void notifyNewAdviceAnswer(askerUserId, questionId, result.answer.content).catch(() => {});
          // A couple likes from other mocks
          for (const liker of responders.slice(i + 1, i + 3)) {
            await likeAdviceAnswer(questionId, result.answer.id, liker.id).catch(() => {});
          }
        }
      }
    } finally {
      answering.delete(questionId);
    }
  })();
}

/** Periodic light engagement on Love Feed (likes/comments). */
export async function mockEngageLoveFeedOnce(): Promise<void> {
  if (!isSimulatorEnabled()) return;
  try {
    const posts = await getAllPosts();
    if (!posts.length) return;
    const mocks = getSimulatorUsers();
    if (mocks.length < 2) return;
    const post = pick(posts.slice(0, 12));
    const actor = pick(mocks);
    if (Math.random() < 0.6) await likePost(post.id).catch(() => {});
    if (Math.random() < 0.35) {
      await addComment(post.id, {
        userId: actor.id,
        userName: actor.name,
        content: pick(FEED_COMMENTS),
      }).catch(() => {});
    }
  } catch {
    /* ignore */
  }
}
