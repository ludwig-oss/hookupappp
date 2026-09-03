import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import type { Message } from './chat.js';

export const DISINTEREST_WARN_THRESHOLD = 70;
const COOLDOWN_MS = 12 * 60 * 60 * 1000;
const MIN_MESSAGES = 6;
const STORE_PATH = join(process.cwd(), 'server', 'data', 'disinterest.json');

export interface DisinterestSign {
  id: string;
  label: string;
  detail: string;
  score: number;
}

export interface DisinterestReport {
  otherUserId: string;
  score: number;
  statusLabel: 'Attentive' | 'Mild' | 'Detached' | 'Severe';
  channelMode: 'Text Logs';
  riskIndex: number;
  threshold: number;
  warningSent: boolean;
  signs: DisinterestSign[];
  sampleSize: number;
  analyzedAt: string;
}

interface StoredWarning {
  viewerUserId: string;
  otherUserId: string;
  lastWarnedAt: string;
  lastScore: number;
}

async function readWarnings(): Promise<StoredWarning[]> {
  try {
    return JSON.parse(await readFile(STORE_PATH, 'utf-8'));
  } catch {
    return [];
  }
}

async function writeWarnings(rows: StoredWarning[]): Promise<void> {
  const dir = join(process.cwd(), 'server', 'data');
  await mkdir(dir, { recursive: true });
  await writeFile(STORE_PATH, JSON.stringify(rows, null, 2), 'utf-8');
}

function isAnalyzableText(content: string): boolean {
  if (!content || typeof content !== 'string') return false;
  if (content.startsWith('data:')) return false;
  if (content.startsWith('HOOKUPGIF:')) return false;
  if (content.startsWith('[Safety]')) return false;
  if (content.length > 2000) return false;
  return true;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function statusFromScore(score: number): DisinterestReport['statusLabel'] {
  if (score >= 71) return 'Severe';
  if (score >= 51) return 'Detached';
  if (score >= 26) return 'Mild';
  return 'Attentive';
}

function replyDelaysMs(theirs: Message[], mine: Message[]): number[] {
  const delays: number[] = [];
  const mineSorted = [...mine].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  for (const theirsMsg of theirs) {
    const t = new Date(theirsMsg.createdAt).getTime();
    const prevMine = [...mineSorted].reverse().find((m) => new Date(m.createdAt).getTime() < t);
    if (prevMine) delays.push(t - new Date(prevMine.createdAt).getTime());
  }
  return delays;
}

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function stdev(nums: number[]): number {
  if (nums.length < 2) return 0;
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
  const v = nums.reduce((a, b) => a + (b - mean) ** 2, 0) / nums.length;
  return Math.sqrt(v);
}

export function analyzeDisinterest(viewerUserId: string, otherUserId: string, messages: Message[]): DisinterestReport {
  const textMsgs = messages.filter((m) => isAnalyzableText(m.content));
  const mine = textMsgs.filter((m) => m.fromUserId === viewerUserId);
  const theirs = textMsgs.filter((m) => m.fromUserId === otherUserId);
  const theirText = theirs.map((m) => m.content.toLowerCase());
  const joinedTheirs = theirText.join(' \n ');

  const signs: DisinterestSign[] = [];

  const myCount = mine.length;
  const theirCount = theirs.length;
  const ratio = theirCount === 0 ? (myCount >= 3 ? 4 : 1) : myCount / theirCount;
  signs.push({
    id: 'one_sided',
    label: 'One-sided effort',
    detail: 'You are the one initiating and carrying the conversation.',
    score: clamp01((ratio - 1.2) / 2.2),
  });

  const avgLen = theirCount ? theirs.reduce((s, m) => s + m.content.trim().length, 0) / theirCount : 0;
  signs.push({
    id: 'dry_replies',
    label: 'Dry or delayed replies',
    detail: 'Short replies, polite emojis, or long waits without follow-up.',
    score: theirCount ? clamp01((28 - avgLen) / 22) : 0,
  });

  const delays = replyDelaysMs(theirs, mine);
  const medDelay = median(delays);
  const delayScore = medDelay <= 0 ? 0 : clamp01((medDelay - 90 * 60 * 1000) / (8 * 60 * 60 * 1000));
  signs[signs.length - 1].score = Math.max(signs[signs.length - 1].score, delayScore);

  const surfaceRe = /\b(weather|lol|lmao|ok|k+|yeah|yep|nice|cool|busy|haha|hehe|idk|hmm+|sure|np|tbh|wyd)\b/i;
  const surfaceFrac = theirCount ? theirText.filter((t) => t.length < 24 || surfaceRe.test(t)).length / theirCount : 0;
  signs.push({
    id: 'surface',
    label: 'Surface-level topics',
    detail: 'Chats stay generic and never go into goals, hobbies, or how you feel.',
    score: clamp01((surfaceFrac - 0.35) / 0.5),
  });

  const questions = theirText.filter((t) => t.includes('?')).length;
  const curiosityFrac = theirCount ? questions / theirCount : 0;
  signs.push({
    id: 'zero_curiosity',
    label: 'Zero curiosity',
    detail: 'They answer if you ask, but they rarely ask about your day, life, or feelings.',
    score: theirCount >= 3 ? clamp01((0.18 - curiosityFrac) / 0.18) : 0,
  });

  const friendzone = /\b(bro|dude|sis(?:ter)?|pal|buddy|homie)\b|just friends|great friend|like a (brother|sister)/i;
  signs.push({
    id: 'friendzone',
    label: 'The "Friendzone" labeling',
    detail: 'Frequent "bro", "dude", "sister", "pal" language that draws a hard line.',
    score: friendzone.test(joinedTheirs) ? 0.85 : 0,
  });

  const buffer = /set you up|you'd be great with|you should meet|my crush|this (guy|girl|boy|man|woman) i (like|m into)/i;
  signs.push({
    id: 'friendly_buffer',
    label: 'The "Friendly Buffer"',
    detail: 'They talk about crushes on other people or try to set you up with someone else.',
    score: buffer.test(joinedTheirs) ? 0.9 : 0,
  });

  const busyNoAlt = /((i'?m |too )?busy|can'?t|rain check|maybe later|not this (week|weekend))/i;
  const offersTime = /(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|next week|how about|what about|\b\d{1,2}(:\d{2})?\s?(am|pm)\b)/i;
  const rainHits = theirText.filter((t) => busyNoAlt.test(t) && !offersTime.test(t)).length;
  signs.push({
    id: 'rain_check',
    label: 'Rain check without an alternative',
    detail: 'Interested people who are busy usually offer another time. "I\'m too busy" alone is a signal.',
    score: rainHits ? clamp01(0.45 + rainHits * 0.25) : 0,
  });

  const thirdWheel = /who else( is coming)?|bring (a |your )?friends?|make it a group|group hang|let'?s all go/i;
  signs.push({
    id: 'third_wheel',
    label: 'Always bringing a third wheel',
    detail: 'They dodge one-on-one time by asking who else is coming or inviting others.',
    score: thirdWheel.test(joinedTheirs) ? 0.85 : 0,
  });

  const flake = /(can'?t make it|something came up|have to cancel|gonna cancel|flaking)/i;
  const amends = /(sorry|apolog|reschedul|make it up|next time|how about)/i;
  const flakeHits = theirText.filter((t) => flake.test(t) && !amends.test(t)).length;
  signs.push({
    id: 'flaking',
    label: 'Flaking and no apology',
    detail: 'Last-minute cancels with no effort to reschedule or make amends.',
    score: flakeHits ? clamp01(0.5 + flakeHits * 0.25) : 0,
  });

  const cv = medDelay > 0 ? stdev(delays) / medDelay : 0;
  signs.push({
    id: 'mixed_signals',
    label: 'Mixed signals',
    detail: 'Hot one day, silent the next. The mixed signal itself is the answer — stay patient and gather evidence.',
    score: delays.length >= 3 ? clamp01((cv - 0.7) / 1.1) : 0,
  });

  const applicable = signs.filter((s) => Number.isFinite(s.score));
  const combined = applicable.length
    ? Math.round((applicable.reduce((s, x) => s + x.score, 0) / applicable.length) * 100)
    : 0;
  const score = textMsgs.length < MIN_MESSAGES ? Math.min(combined, 40) : combined;

  return {
    otherUserId,
    score,
    statusLabel: statusFromScore(score),
    channelMode: 'Text Logs',
    riskIndex: Math.round((score / 100) * 100) / 100,
    threshold: DISINTEREST_WARN_THRESHOLD,
    warningSent: false,
    signs: signs.filter((s) => s.score >= 0.25).sort((a, b) => b.score - a.score),
    sampleSize: textMsgs.length,
    analyzedAt: new Date().toISOString(),
  };
}

export async function shouldSendDisinterestWarning(viewerUserId: string, otherUserId: string, score: number): Promise<boolean> {
  if (score < DISINTEREST_WARN_THRESHOLD) return false;
  const rows = await readWarnings();
  const prev = rows.find((r) => r.viewerUserId === viewerUserId && r.otherUserId === otherUserId);
  if (prev && Date.now() - new Date(prev.lastWarnedAt).getTime() < COOLDOWN_MS) return false;
  return true;
}

export async function markDisinterestWarned(viewerUserId: string, otherUserId: string, score: number): Promise<void> {
  const rows = await readWarnings();
  const idx = rows.findIndex((r) => r.viewerUserId === viewerUserId && r.otherUserId === otherUserId);
  const next: StoredWarning = {
    viewerUserId,
    otherUserId,
    lastWarnedAt: new Date().toISOString(),
    lastScore: score,
  };
  if (idx >= 0) rows[idx] = next;
  else rows.push(next);
  await writeWarnings(rows);
}

export async function hasRecentDisinterestWarning(viewerUserId: string, otherUserId: string): Promise<boolean> {
  const rows = await readWarnings();
  const prev = rows.find((r) => r.viewerUserId === viewerUserId && r.otherUserId === otherUserId);
  if (!prev) return false;
  return Date.now() - new Date(prev.lastWarnedAt).getTime() < COOLDOWN_MS;
}
