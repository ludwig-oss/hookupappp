import { uploadImage, isRemoteMediaUrl } from '../utils/storage.js';
import type { FashionWarp } from '../data/fashionCatalog.js';

export type TryOnEngine = 'idm-vton' | 'fashn' | 'custom' | 'preview';
export type TryOnCategory = 'upper_body' | 'lower_body' | 'dresses';

export interface TryOnResult {
  tryOnUrl: string | null;
  engine: TryOnEngine;
  status: 'ready' | 'unavailable';
  detail?: string;
}

export function categoryForLook(warp: FashionWarp, event: string, title: string): TryOnCategory {
  const hay = `${warp} ${event} ${title}`.toLowerCase();
  if (/\b(dress|midi|sundress|column|slip)\b/.test(hay) || (warp === 'drape' && event !== 'casual')) {
    return 'dresses';
  }
  if (/\b(trouser|jean|pant|skirt)\b/.test(hay) && !/\b(blazer|shirt|knit|tee)\b/.test(hay)) {
    return 'lower_body';
  }
  return 'upper_body';
}

async function publicize(url: string): Promise<string> {
  const trimmed = (url || '').trim();
  if (!trimmed) return trimmed;
  if (isRemoteMediaUrl(trimmed)) return trimmed;
  if (trimmed.startsWith('data:')) {
    try {
      return await uploadImage(trimmed, 'fashion-tryon');
    } catch {
      return trimmed;
    }
  }
  return trimmed;
}

async function callCustomWorker(person: string, garment: string, category: TryOnCategory, warp: FashionWarp): Promise<string | null> {
  const endpoint = process.env.VTON_API_URL?.trim();
  if (!endpoint) return null;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const key = process.env.VTON_API_KEY?.trim();
  if (key) headers.Authorization = `Bearer ${key}`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      person_image: person,
      garment_image: garment,
      human_img: person,
      garm_img: garment,
      category,
      warp,
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { url?: string; output?: string | string[]; tryOnUrl?: string };
  const out = data.url || data.tryOnUrl || (Array.isArray(data.output) ? data.output[0] : data.output);
  return typeof out === 'string' && out ? out : null;
}

async function callFashn(person: string, garment: string): Promise<string | null> {
  const key = process.env.FASHN_API_KEY?.trim();
  if (!key) return null;
  const run = await fetch('https://api.fashn.ai/v1/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model_name: 'tryon-v1.6',
      inputs: { model_image: person, garment_image: garment },
    }),
  });
  if (!run.ok) return null;
  const started = (await run.json()) as { id?: string; status?: string; output?: string[] };
  if (started.output?.[0]) return started.output[0];
  const id = started.id;
  if (!id) return null;
  const deadline = Date.now() + 55_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2000));
    const poll = await fetch(`https://api.fashn.ai/v1/status/${id}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!poll.ok) continue;
    const data = (await poll.json()) as { status?: string; output?: string[] };
    if (data.status === 'completed' && data.output?.[0]) return data.output[0];
    if (data.status === 'failed') return null;
  }
  return null;
}

async function callIdmVton(
  person: string,
  garment: string,
  category: TryOnCategory,
  description: string
): Promise<string | null> {
  const token = process.env.REPLICATE_API_TOKEN?.trim();
  if (!token) return null;
  if (!isRemoteMediaUrl(person) || !isRemoteMediaUrl(garment)) return null;
  const res = await fetch('https://api.replicate.com/v1/models/cuuupid/idm-vton/predictions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'wait=55',
    },
    body: JSON.stringify({
      input: {
        human_img: person,
        garm_img: garment,
        garment_des: description.slice(0, 120) || 'outfit',
        category,
        crop: true,
        steps: 30,
      },
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { output?: string; status?: string; urls?: { get?: string } };
  if (typeof data.output === 'string' && data.output) return data.output;
  const getUrl = data.urls?.get;
  if (!getUrl) return null;
  const deadline = Date.now() + 50_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2500));
    const poll = await fetch(getUrl, { headers: { Authorization: `Bearer ${token}` } });
    if (!poll.ok) continue;
    const next = (await poll.json()) as { status?: string; output?: string };
    if (next.status === 'succeeded' && next.output) return next.output;
    if (next.status === 'failed' || next.status === 'canceled') return null;
  }
  return null;
}

export async function runVirtualTryOn(opts: {
  personUrl: string | null;
  garmentUrl: string;
  warp: FashionWarp;
  event: string;
  title: string;
  pieces?: string[];
}): Promise<TryOnResult> {
  const personRaw = (opts.personUrl || '').trim();
  if (!personRaw) {
    return { tryOnUrl: null, engine: 'preview', status: 'unavailable', detail: 'Add a profile photo to see clothes on you.' };
  }
  const category = categoryForLook(opts.warp, opts.event, opts.title);
  const description = [opts.title, ...(opts.pieces || []).slice(0, 3)].join(', ');
  try {
    const person = await publicize(personRaw);
    const garment = await publicize(opts.garmentUrl);
    const custom = await callCustomWorker(person, garment, category, opts.warp);
    if (custom) return { tryOnUrl: custom, engine: 'custom', status: 'ready' };
    const fashn = await callFashn(person, garment);
    if (fashn) return { tryOnUrl: fashn, engine: 'fashn', status: 'ready' };
    const idm = await callIdmVton(person, garment, category, description);
    if (idm) return { tryOnUrl: idm, engine: 'idm-vton', status: 'ready' };
  } catch (err) {
    console.error('VTON worker error:', err);
  }
  return {
    tryOnUrl: null,
    engine: 'preview',
    status: 'unavailable',
    detail: 'Live fit preview is on. Connect REPLICATE_API_TOKEN, FASHN_API_KEY, or VTON_API_URL for full IDM-VTON drape.',
  };
}
