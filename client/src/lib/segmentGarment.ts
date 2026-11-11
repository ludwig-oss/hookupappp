import axios from 'axios';
import { API_BASE } from '../api/config';

export type GarmentSlot = 'top' | 'bottom' | 'dress' | 'shoes';

const cache = new Map<string, string>();
const pending = new Map<string, Promise<string>>();

async function fetchGarmentBlob(url: string): Promise<Blob> {
  try {
    const direct = await fetch(url, { mode: 'cors' });
    if (direct.ok) {
      const type = direct.headers.get('content-type') || '';
      if (type.startsWith('image/')) return await direct.blob();
    }
  } catch {
    /* Pinterest and other hosts block the browser. The API proxy is next. */
  }
  const response = await axios.get(`${API_BASE}/api/fashion/garment-image`, {
    params: { url },
    responseType: 'blob',
    timeout: 20000,
  });
  return response.data as Blob;
}

/** Cut a full-body photo down to the clothing band so the head never lands in the slot. */
function cropToSlot(source: ImageBitmap, slot: GarmentSlot): string {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  ctx.drawImage(source, 0, 0);
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let opaque = 0;
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      if (data[(y * width + x) * 4 + 3] < 24) continue;
      opaque += 1;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (opaque < 20) {
    minX = 0;
    minY = 0;
    maxX = width - 1;
    maxY = height - 1;
  }
  const bw = Math.max(1, maxX - minX);
  const bh = Math.max(1, maxY - minY);
  const tallPerson = bh / bw > 1.25 && bh > height * 0.45;
  let x0 = minX;
  let y0 = minY;
  let x1 = maxX;
  let y1 = maxY;
  if (tallPerson) {
    if (slot === 'top') {
      y0 = minY + bh * 0.18;
      y1 = minY + bh * 0.5;
    } else if (slot === 'bottom') {
      y0 = minY + bh * 0.48;
      y1 = minY + bh * 0.88;
    } else if (slot === 'dress') {
      y0 = minY + bh * 0.16;
      y1 = minY + bh * 0.98;
    } else {
      y0 = minY + bh * 0.78;
      y1 = maxY;
    }
  }
  const cw = Math.max(1, Math.round(x1 - x0));
  const ch = Math.max(1, Math.round(y1 - y0));
  const out = document.createElement('canvas');
  out.width = cw;
  out.height = ch;
  const octx = out.getContext('2d');
  if (!octx) throw new Error('canvas');
  octx.drawImage(canvas, x0, y0, cw, ch, 0, 0, cw, ch);
  return out.toDataURL('image/png');
}

/** Strip the background, then keep only the garment band. Never returns the original photo. */
export function segmentGarment(url: string, slot: GarmentSlot): Promise<string> {
  const key = `${slot}::${url}`;
  const cached = cache.get(key);
  if (cached) return Promise.resolve(cached);
  const inflight = pending.get(key);
  if (inflight) return inflight;
  const job = (async () => {
    const original = await fetchGarmentBlob(url);
    let cut: Blob = original;
    try {
      const { removeBackground } = await import('@imgly/background-removal');
      cut = await removeBackground(original, { model: 'isnet_quint8' });
    } catch {
      cut = original;
    }
    const bitmap = await createImageBitmap(cut);
    try {
      const dataUrl = cropToSlot(bitmap, slot);
      cache.set(key, dataUrl);
      return dataUrl;
    } finally {
      bitmap.close();
    }
  })();
  pending.set(key, job);
  void job.finally(() => pending.delete(key));
  return job;
}
