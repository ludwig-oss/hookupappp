import axios from 'axios';
import { API_BASE, MEDIA_API_BASE } from '../api/config';

function authHeaders(): Record<string, string> {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Upload base64 media directly to Render when set (bypasses Vercel ~4.5MB proxy limit). */
export async function uploadMediaDataUrl(dataUrl: string, folder = 'posts'): Promise<string> {
  const base = (MEDIA_API_BASE || API_BASE).replace(/\/+$/, '');
  if (!base) {
    throw new Error('Upload server not configured. Try again in a moment.');
  }
  const res = await axios.post(
    `${base}/api/posts/upload-media`,
    { data: dataUrl, folder },
    {
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      timeout: 120_000,
    }
  );
  const url = res.data?.url;
  if (!url || typeof url !== 'string') throw new Error('Upload failed — no URL returned');
  return url;
}
