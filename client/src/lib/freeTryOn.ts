import { Client } from '@gradio/client';

const SPACE = 'yisol/IDM-VTON';

function resultUrl(data: unknown): string | null {
  const first = Array.isArray(data) ? data[0] : data;
  if (!first) return null;
  if (typeof first === 'string') return first;
  if (typeof first === 'object') {
    const row = first as { url?: string; path?: string };
    if (row.url) return row.url;
    if (row.path) return row.path;
  }
  return null;
}

/** Public Hugging Face IDM-VTON. No API key. Upper-body garment on the user's photo. */
export async function freeVirtualTryOn(person: Blob, garment: Blob, description: string): Promise<string> {
  const app = await Client.connect(SPACE);
  try {
    const result = await app.predict('/tryon', {
      dict: { background: person, layers: [], composite: null },
      garm_img: garment,
      garment_des: description,
      is_checked: true,
      is_checked_crop: false,
      denoise_steps: 30,
      seed: 42,
    });
    const url = resultUrl(result.data);
    if (!url) throw new Error('empty');
    return url;
  } finally {
    app.close();
  }
}
