/**
 * Predictive "After Results" visualizer.
 *
 * Pipeline:
 *  1. Publicize the three baseline selfies (Cloudinary if configured — Replicate needs HTTPS).
 *  2. Build a single identity-preserving prompt from detected faults.
 *  3. Try an external GenAI worker in order:
 *       APPEARANCE_GEN_URL (custom ControlNet/InstantID worker)
 *       REPLICATE_API_TOKEN → flux (img2img) with InstantID-style identity language
 *  4. If no worker returns pixels, status is `preview` and the client canvas
 *     applies landmark-safe warps (jaw, submental, blemish, under-eye) on the
 *     original photo so core identity stays 100% the same pixels.
 *
 * Simulated 6-month impact (visual language only, not a medical forecast):
 *  - submental fluid/fat: leaner under-chin (~12–15% look + gua sha drain)
 *  - mandibular/gonial: slight stack from consistent tongue posture
 *  - skin: clear spots, less redness, lighter under-eyes from the routine
 */

import { isRemoteMediaUrl, uploadImage } from '../utils/storage.js';
import type { FaultHit } from './appearanceAnalysis.js';
import type { AppearanceAngle } from './appearanceScan.js';

export type AfterEngine = 'instant-id' | 'flux' | 'custom' | 'preview';

export interface AfterAngleResult {
  angle: AppearanceAngle;
  beforeUrl: string;
  afterUrl: string | null;
  engine: AfterEngine;
}

export interface AfterBatch {
  status: 'ready' | 'preview';
  engine: AfterEngine;
  detail: string;
  angles: Record<AppearanceAngle, AfterAngleResult>;
  identityLock: {
    method: 'instant-id-or-pixel-warp';
    preserveHairline: boolean;
    preserveEyeSpacing: boolean;
    preserveNoseMouth: boolean;
    note: string;
  };
}

async function publicize(url: string): Promise<string> {
  const trimmed = (url || '').trim();
  if (!trimmed) return trimmed;
  if (isRemoteMediaUrl(trimmed)) return trimmed;
  if (trimmed.startsWith('data:')) {
    try {
      return await uploadImage(trimmed, 'appearance-after');
    } catch {
      return trimmed;
    }
  }
  return trimmed;
}

function promptFromFaults(faults: FaultHit[]): string {
  const ids = new Set(faults.map((f) => f.id));
  const bits = [
    'photorealistic same person six months later, identical identity, same hairline, same eye color, same nose, same moles',
    'natural skin, no beauty filter, no face swap, no different ethnicity, no makeup mask',
  ];
  if (ids.has('submental-fullness')) {
    bits.push('slightly leaner under-chin, less submental fullness, defined neck, gua sha drained look');
  }
  if (ids.has('low-gonial-definition') || ids.has('forward-head')) {
    bits.push('subtle stronger mandibular line and gonial angle, better head posture, not a different skull');
  }
  if (ids.has('inflammatory-acne') || ids.has('comedonal') || ids.has('post-inflammatory-marks') || ids.has('rosacea-redness')) {
    bits.push('clear skin, no acne, even tone, reduced redness');
  }
  if (ids.has('periorbital-darkness') || ids.has('heavy-lid-frame')) {
    bits.push('rested under-eyes, less dark circles, open eyes');
  }
  return bits.join(', ');
}

async function callCustomWorker(person: string, prompt: string, angle: AppearanceAngle): Promise<string | null> {
  const endpoint = process.env.APPEARANCE_GEN_URL?.trim();
  if (!endpoint) return null;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const key = (process.env.APPEARANCE_GEN_KEY || '').trim();
  if (key) headers.Authorization = `Bearer ${key}`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      task: 'appearance-after',
      human_img: person,
      prompt,
      angle,
      controlnet: true,
      instant_id: true,
      identity_lock: 1,
    }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { url?: string; output?: string | string[] };
  const out = data.url || (Array.isArray(data.output) ? data.output[0] : data.output);
  return typeof out === 'string' && out ? out : null;
}

async function callReplicate(person: string, prompt: string): Promise<string | null> {
  const token = process.env.REPLICATE_API_TOKEN?.trim();
  if (!token) return null;
  if (!isRemoteMediaUrl(person)) return null;
  const res = await fetch('https://api.replicate.com/v1/models/black-forest-labs/flux-1.1-pro/predictions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'wait=20',
    },
    body: JSON.stringify({
      input: {
        prompt,
        image: person,
        prompt_upsampling: false,
        safety_tolerance: 2,
        aspect_ratio: '3:4',
      },
    }),
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { output?: string | string[]; status?: string; urls?: { get?: string } };
  if (typeof data.output === 'string' && data.output) return data.output;
  if (Array.isArray(data.output) && data.output[0]) return data.output[0];
  const getUrl = data.urls?.get;
  if (!getUrl) return null;
  const deadline = Date.now() + 50_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2500));
    const poll = await fetch(getUrl, { headers: { Authorization: `Bearer ${token}` } });
    if (!poll.ok) continue;
    const next = (await poll.json()) as { status?: string; output?: string | string[] };
    if (next.status === 'succeeded') {
      const out = Array.isArray(next.output) ? next.output[0] : next.output;
      if (out) return out;
    }
    if (next.status === 'failed' || next.status === 'canceled') return null;
  }
  return null;
}

export async function generateAfterResults(opts: {
  frontalUrl: string;
  leftUrl: string;
  rightUrl: string;
  faults: FaultHit[];
}): Promise<AfterBatch> {
  const prompt = promptFromFaults(opts.faults);
  const identityLock = {
    method: 'instant-id-or-pixel-warp' as const,
    preserveHairline: true,
    preserveEyeSpacing: true,
    preserveNoseMouth: true,
    note: 'After images must keep the same person. Canvas preview warps the original pixels; Flux/InstantID is identity-locked in the prompt.',
  };
  const pack = (angle: AppearanceAngle, before: string, after: string | null, engine: AfterEngine): AfterAngleResult => ({
    angle,
    beforeUrl: before,
    afterUrl: after,
    engine,
  });
  const preview = (): AfterBatch => ({
    status: 'preview',
    engine: 'preview',
    detail:
      'Live after-results need APPEARANCE_GEN_URL (InstantID/ControlNet) or REPLICATE_API_TOKEN. Canvas preview keeps 100% of your pixels and simulates the 6-month habit look.',
    identityLock,
    angles: {
      frontal: pack('frontal', opts.frontalUrl, null, 'preview'),
      leftProfile: pack('leftProfile', opts.leftUrl, null, 'preview'),
      rightProfile: pack('rightProfile', opts.rightUrl, null, 'preview'),
    },
  });

  if (!process.env.APPEARANCE_GEN_URL?.trim() && !process.env.REPLICATE_API_TOKEN?.trim()) {
    return preview();
  }

  try {
    const frontal = await publicize(opts.frontalUrl);
    const left = await publicize(opts.leftUrl);
    const right = await publicize(opts.rightUrl);
    const customF = await callCustomWorker(frontal, prompt, 'frontal');
    if (customF) {
      const [l, r] = await Promise.all([
        callCustomWorker(left, prompt, 'leftProfile'),
        callCustomWorker(right, prompt, 'rightProfile'),
      ]);
      return {
        status: 'ready',
        engine: 'custom',
        detail: 'Custom InstantID/ControlNet worker returned after-results.',
        identityLock,
        angles: {
          frontal: pack('frontal', frontal, customF, 'custom'),
          leftProfile: pack('leftProfile', left, l, 'custom'),
          rightProfile: pack('rightProfile', right, r, 'custom'),
        },
      };
    }
    const fluxF = await callReplicate(frontal, prompt);
    if (fluxF) {
      const [l, r] = await Promise.all([callReplicate(left, prompt), callReplicate(right, prompt)]);
      return {
        status: 'ready',
        engine: 'flux',
        detail: 'Replicate Flux img2img. Identity is prompt-locked; review before saving.',
        identityLock,
        angles: {
          frontal: pack('frontal', frontal, fluxF, 'flux'),
          leftProfile: pack('leftProfile', left, l, 'flux'),
          rightProfile: pack('rightProfile', right, r, 'flux'),
        },
      };
    }
  } catch (err) {
    console.error('Appearance after-gen error:', err);
  }

  return preview();
}
