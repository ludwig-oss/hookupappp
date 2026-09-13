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
import { createPost, getAllPosts, addComment, likePost, patchPostEngagement } from '../models/posts.js';
import { getUserPreference } from '../models/discover.js';
import { notifyNewAdviceAnswer } from '../realtime/notifications.js';
import { createReview, getReviewsForUser } from '../models/reviews.js';
import { createEvent, createEventRequest, getEventsByCity } from '../models/events.js';

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
  if (!isSimulatorEnabled()) return;
  if (!seeded) {
    seeded = true;
    try {
      await seedAdviceFeed();
      await answerUnansweredAdvice();
  await seedLoveFeed();
      await seedLoveFeedVideos();
      console.log('🧪 Simulator social seed: Dating Advice answers + Love Life Feed posts ready.');
    } catch (e: any) {
      console.warn('🧪 Simulator social seed skipped:', e?.message || e);
      seeded = false;
    }
  }
  // Always top-up profile reviews + city events (safe if already present)
  await seedMockReviews().catch(() => {});
  await seedMockCityEvents().catch(() => {});
  await seedLoveFeedVideos().catch(() => {});
}

const REVIEW_TEXTS = [
  'Showed up on time, funny, and respectful. Would hang out again.',
  'Great conversation — no phone glued to the table. Felt safe the whole time.',
  'Cute vibe but a bit flaky on texting. Still a solid first meet.',
  'Kind energy. Paid attention when I talked. Recommend.',
  'Chemistry was real. Public place first date — did everything right.',
];

async function seedMockReviews(): Promise<void> {
  const mocks = getSimulatorUsers();
  if (mocks.length < 4) return;
  let wrote = 0;
  for (let i = 0; i < Math.min(12, mocks.length); i++) {
    const to = mocks[i];
    const existing = await getReviewsForUser(to.id);
    if (existing.length >= 2) continue;
    const fromA = mocks[(i + 1) % mocks.length];
    const fromB = mocks[(i + 2) % mocks.length];
    for (const from of [fromA, fromB]) {
      if (from.id === to.id) continue;
      await createReview({
        fromUserId: from.id,
        toUserId: to.id,
        attributes: {},
        overallStars: 3 + ((i + from.id.length) % 3),
        reviewText: REVIEW_TEXTS[(i + wrote) % REVIEW_TEXTS.length],
        source: 'manual',
        disclaimerAccepted: true,
      }).catch(() => {});
      wrote++;
    }
  }
}

async function seedMockCityEvents(): Promise<void> {
  const mocks = getSimulatorUsers();
  if (mocks.length < 3) return;
  const cities = [...new Set(mocks.map((m) => (m.city || '').trim()).filter(Boolean))];
  for (const city of cities.slice(0, 8)) {
    const existing = await getEventsByCity(city);
    if (existing.length >= 2) continue;
    const host = mocks.find((m) => (m.city || '').trim().toLowerCase() === city.toLowerCase()) || mocks[0];
    const day = new Date();
    day.setDate(day.getDate() + 2 + (city.length % 5));
    const startDate = day.toISOString().slice(0, 10);
    await createEvent(host.id, {
      type: city.length % 2 === 0 ? 'drinks' : 'house_party',
      title: city.length % 2 === 0 ? `${city} rooftop hang` : `Chill house night in ${city}`,
      description: `Simulator meetup in ${city}. Public-friendly first, then decide.`,
      city,
      country: host.country,
      startDate,
      startTime: '19:00',
      endTime: '06:00',
    }).catch(() => {});
  }
}

/** After a real user creates an event, mocks in that city send join requests. */
export function scheduleMockEventJoinRequests(eventId: string, city: string, creatorUserId: string): void {
  if (!isSimulatorEnabled()) return;
  void (async () => {
    try {
      await delay(700 + Math.random() * 900);
      const mocks = getSimulatorUsers().filter((m) => m.id !== creatorUserId);
      const cityLower = (city || '').toLowerCase().trim();
      const local = mocks.filter((m) => (m.city || '').toLowerCase().includes(cityLower) || cityLower.includes((m.city || '').toLowerCase()));
      const pool = (local.length ? local : mocks).slice(0, 5);
      const questions = [
        'Can I bring a friend?',
        'Is it still on if it rains?',
        'What should I bring?',
        'Public meetup spot first?',
      ];
      for (let i = 0; i < Math.min(3, pool.length); i++) {
        await delay(350 + i * 500);
        await createEventRequest(eventId, pool[i].id, questions[i % questions.length]).catch(() => {});
      }
    } catch {
      /* optional */
    }
  })();
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
  if (simPosts.length >= 8) return;

  for (let i = 0; i < FEED_POSTS.length; i++) {
    const author = mocks[i % mocks.length];
    const spec = FEED_POSTS[i];
    // Stagger ids — createPost uses Date.now()
    await delay(2);
    const post = await createPost({
      userId: author.id,
      type: spec.type,
      contentType: 'text',
      content: spec.content,
      title: spec.title,
      tags: spec.tags,
    });
    const likeTimes = i % 3 === 0 ? 28 : 8 + (i % 10);
    const shareTimes = i % 2 === 0 ? 5 + (i % 4) : 1 + (i % 3);
    const commenters = mocks.filter((m) => m.id !== author.id).slice(0, 2 + (i % 2));
    await patchPostEngagement(post.id, {
      likes: likeTimes,
      shares: shareTimes,
      comments: commenters.map((c, cIdx) => ({
        userId: c.id,
        userName: c.name,
        content: FEED_COMMENTS[(i + cIdx) % FEED_COMMENTS.length],
      })),
    });
  }
}

/** Short public sample clips so Videos tab / feed can be tested (never inline base64). */
const FEED_VIDEO_SAMPLES: { title: string; url: string; tags: string[] }[] = [
  {
    title: 'First-date walk energy',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    tags: ['first-date', 'video', 'dating'],
  },
  {
    title: 'Date-night vibes (mock clip)',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
    tags: ['date-night', 'video', 'relationship'],
  },
  {
    title: 'Soft-launch moment',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
    tags: ['soft-launch', 'video', 'love-life'],
  },
];

async function seedLoveFeedVideos(): Promise<void> {
  const mocks = getSimulatorUsers();
  if (mocks.length < 2) return;
  const posts = await getAllPosts();
  const videoCount = posts.filter((p) => p.contentType === 'video' && isSimulatorUserId(p.userId)).length;
  if (videoCount >= 3) return;

  for (let i = 0; i < FEED_VIDEO_SAMPLES.length; i++) {
    if (videoCount + i >= 3) break;
    const spec = FEED_VIDEO_SAMPLES[i];
    const author = mocks[(i + 3) % mocks.length];
    await delay(2);
    const post = await createPost({
      userId: author.id,
      type: 'positive',
      contentType: 'video',
      content: spec.url,
      title: spec.title,
      tags: spec.tags,
    });
    await patchPostEngagement(post.id, {
      likes: 12 + i * 5,
      shares: 2 + i,
      comments: [
        {
          userId: mocks[(i + 1) % mocks.length].id,
          userName: mocks[(i + 1) % mocks.length].name,
          content: 'This video tip hits different.',
        },
      ],
    });
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
          notifyNewAdviceAnswer(askerUserId, {
            questionId,
            fromUserId: r.id,
            preview: String(result.answer.content || '').slice(0, 100),
          });
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
    if (Math.random() < 0.45) {
      const { sharePost } = await import('../models/posts.js');
      await sharePost(post.id).catch(() => {});
    }
    if (Math.random() < 0.4) {
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

const COMMENT_REPLIES = [
  'This. Hard agree.',
  'Needed this reminder today.',
  'Facts — say it louder.',
  'Been there. Glad someone posted it.',
  'Bookmarking this for later.',
  'Real talk. Appreciate you sharing.',
];

/**
 * When a real user likes / comments / shares, mocks react so engagement is visible in simulator.
 */
export function scheduleMockFeedReaction(
  postId: string,
  kind: 'like' | 'comment' | 'share',
  fromUserId: string,
  opts?: { commentId?: string; commenterName?: string }
): void {
  if (!isSimulatorEnabled()) return;
  if (isSimulatorUserId(fromUserId)) return;

  void (async () => {
    try {
      await delay(500 + Math.random() * 1200);
      const mocks = getSimulatorUsers().filter((m) => m.id !== fromUserId);
      if (!mocks.length) return;
      const { sharePost } = await import('../models/posts.js');

      if (kind === 'like') {
        const likeCount = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < likeCount; i++) {
          await likePost(postId).catch(() => {});
          await delay(120);
        }
        if (Math.random() < 0.5) {
          const c = pick(mocks);
          await addComment(postId, {
            userId: c.id,
            userName: c.name,
            content: pick(FEED_COMMENTS),
          }).catch(() => {});
        }
        return;
      }

      if (kind === 'share') {
        for (const m of mocks.slice(0, 3)) {
          await sharePost(postId).catch(() => {});
          await likePost(postId).catch(() => {});
          await delay(80);
        }
        const c = pick(mocks);
        await addComment(postId, {
          userId: c.id,
          userName: c.name,
          content: 'Sharing this — more people need to see it.',
        }).catch(() => {});
        return;
      }

      // comment: mocks like the post + reply under the user's comment
      await likePost(postId).catch(() => {});
      const repliers = mocks.slice(0, 2 + Math.floor(Math.random() * 2));
      for (let i = 0; i < repliers.length; i++) {
        await delay(400 + i * 500);
        const m = repliers[i];
        await addComment(postId, {
          userId: m.id,
          userName: m.name,
          content: pick(COMMENT_REPLIES),
          replyToId: opts?.commentId || null,
          replyToUserName: opts?.commenterName || null,
        }).catch(() => {});
        if (Math.random() < 0.6) await likePost(postId).catch(() => {});
        if (Math.random() < 0.35) await sharePost(postId).catch(() => {});
      }
    } catch {
      /* ignore */
    }
  })();
}
