import axios from 'axios';
import { API_BASE } from '../api/config';

export type GarmentSlot = 'top' | 'bottom' | 'dress' | 'shoes';

const cache = new Map<string, string>();
const pending = new Map<string, Promise<string>>();

function isSkin(r: number, g: number, b: number): boolean {
  return r > 95 && g > 40 && b > 20 && r > g && r > b && r - g > 12 && r - b > 12;
}

/** A flat garment has almost no skin. A face, leg, or sunglasses-on-a-person does. */
function looksLikePerson(data: Uint8ClampedArray, width: number, height: number): boolean {
  let seen = 0;
  let skin = 0;
  let upperSkin = 0;
  let upperSeen = 0;
  const step = 16;
  for (let i = 0; i < data.length; i += step) {
    if (data[i + 3] < 24) continue;
    const pixel = i / 4;
    const y = Math.floor(pixel / width);
    seen += 1;
    const skinPx = isSkin(data[i], data[i + 1], data[i + 2]);
    if (skinPx) skin += 1;
    if (y < height * 0.38) {
      upperSeen += 1;
      if (skinPx) upperSkin += 1;
    }
  }
  if (!seen) return false;
  if (skin / seen > 0.035) return true;
  if (upperSeen > 12 && upperSkin / upperSeen > 0.08) return true;
  return false;
}

async function fetchGarmentBlob(url: string): Promise<Blob> {
  if (url.startsWith('data:')) {
    const res = await fetch(url);
    return res.blob();
  }
  try {
    const direct = await fetch(url, { mode: 'cors' });
    if (direct.ok && (direct.headers.get('content-type') || '').startsWith('image/')) {
      return await direct.blob();
    }
  } catch {
    /* Hosts that block the browser fall through to the API proxy. */
  }
  const response = await axios.get(`${API_BASE}/api/fashion/garment-image`, {
    params: { url },
    responseType: 'blob',
    timeout: 20000,
  });
  return response.data as Blob;
}

function isolateGarment(source: ImageBitmap): { url: string; person: boolean } {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  ctx.drawImage(source, 0, 0);
  const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
  if (looksLikePerson(frame.data, canvas.width, canvas.height)) {
    return { url: '', person: true };
  }
  let minX = canvas.width;
  let minY = canvas.height;
  let maxX = 0;
  let maxY = 0;
  const { data, width, height } = frame;
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      if (data[(y * width + x) * 4 + 3] < 24) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX <= minX || maxY <= minY) return { url: canvas.toDataURL('image/png'), person: false };
  const cw = Math.max(1, maxX - minX);
  const ch = Math.max(1, maxY - minY);
  const out = document.createElement('canvas');
  out.width = cw;
  out.height = ch;
  out.getContext('2d')?.drawImage(canvas, minX, minY, cw, ch, 0, 0, cw, ch);
  return { url: out.toDataURL('image/png'), person: false };
}

export class GarmentRejected extends Error {
  constructor() {
    super('person');
    this.name = 'GarmentRejected';
  }
}

/** Keep a clothing cutout. Throw when a face, body, or skin is in the photo. */
export function segmentGarment(url: string, slot: GarmentSlot): Promise<string> {
  const key = `${slot}::${url}`;
  const cached = cache.get(key);
  if (cached) return Promise.resolve(cached);
  const inflight = pending.get(key);
  if (inflight) return inflight;
  const job = (async () => {
    if (url.startsWith('data:image/svg')) {
      cache.set(key, url);
      return url;
    }
    const original = await fetchGarmentBlob(url);
    let cut: Blob = original;
    if (!url.startsWith('data:')) {
      try {
        const { removeBackground } = await import('@imgly/background-removal');
        cut = await removeBackground(original, { model: 'isnet_quint8' });
      } catch {
        cut = original;
      }
    }
    const bitmap = await createImageBitmap(cut);
    try {
      const isolated = isolateGarment(bitmap);
      if (isolated.person || !isolated.url) throw new GarmentRejected();
      cache.set(key, isolated.url);
      return isolated.url;
    } finally {
      bitmap.close();
    }
  })();
  pending.set(key, job);
  void job.finally(() => pending.delete(key));
  return job;
}
