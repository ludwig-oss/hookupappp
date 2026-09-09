import axios from 'axios';
import { API_BASE, MEDIA_API_BASE } from '../api/config';
import { getAuthToken } from '../lib/authStorage';
import { compressImageFile } from './compressImage';
import { compressVideoFile, isProbablyImageFile, isProbablyVideoFile } from './compressVideo';

function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function mediaApiRoot(): string {
  return (MEDIA_API_BASE || API_BASE).replace(/\/+$/, '');
}

function uploadEndpoint(): string {
  const base = mediaApiRoot();
  return base ? `${base}/api/posts/upload-media` : '/api/posts/upload-media';
}

function uploadFileEndpoint(): string {
  const base = mediaApiRoot();
  return base ? `${base}/api/posts/upload-file` : '/api/posts/upload-file';
}

/** Upload file bytes (not JSON/base64) — avoids lag and Network Error on highlights/stories. */
export async function uploadMediaFile(file: Blob, folder = 'posts', _filename = 'media'): Promise<string> {
  const mime = file.type || 'application/octet-stream';
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 300_000);
  try {
    const res = await fetch(uploadFileEndpoint(), {
      method: 'POST',
      headers: {
        ...authHeaders(),
        'Content-Type': mime,
        'X-Upload-Folder': folder,
        'X-Upload-Content-Type': mime,
      },
      body: file,
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = typeof data?.error === 'string' ? data.error : `Upload failed (HTTP ${res.status})`;
      throw new Error(err);
    }
    const url = data?.url;
    if (!url || typeof url !== 'string') throw new Error('Upload failed — no URL returned');
    return url;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Upload timed out. Check your connection and try again.');
    }
    if (err instanceof TypeError) {
      throw new Error("Can't reach the server. Check your connection and try again.");
    }
    throw err;
  } finally {
    window.clearTimeout(timer);
  }
}

/** Compress photos and large phone videos, then upload the file. */
export async function prepareAndUploadFile(
  file: File,
  folder: string,
  onProgress?: (phase: 'compress' | 'upload') => void
): Promise<string> {
  const isImage = isProbablyImageFile(file);
  const isVideo = isProbablyVideoFile(file);
  if (!isImage && !isVideo) {
    throw new Error('Please choose a photo or video.');
  }
  if (isImage) {
    // Small phone photos: skip canvas recompress — big win on mobile.
    if (file.size <= 900_000 && /^image\/(jpe?g|png|webp)$/i.test(file.type || '')) {
      onProgress?.('upload');
      return uploadMediaFile(file, folder, file.name || 'photo.jpg');
    }
    onProgress?.('compress');
    let blob = await compressImageFile(file, folder === 'posts' ? 1280 : 1080, folder === 'posts' ? 0.78 : 0.82);
    if (blob.size > 2_000_000) {
      blob = await compressImageFile(file, 900, 0.7);
    }
    const name = (file.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg';
    onProgress?.('upload');
    return uploadMediaFile(blob, folder, name);
  }
  onProgress?.('compress');
  const compressed = await compressVideoFile(file, {
    maxDurationSec: folder === 'stories' ? 120 : folder === 'posts' ? 90 : 180,
  });
  const mime = compressed.type || file.type || 'video/mp4';
  const ext = mime.includes('webm') ? '.webm' : '.mp4';
  const named = compressed instanceof File
    ? compressed
    : new File([compressed], (file.name || 'video').replace(/\.[^.]+$/, '') + ext, { type: mime });
  onProgress?.('upload');
  return uploadMediaFile(named, folder, named.name);
}

/** Upload base64 media directly to Render when set (bypasses Vercel ~4.5MB proxy limit). */
export async function uploadMediaDataUrl(dataUrl: string, folder = 'posts'): Promise<string> {
  const res = await axios.post(
    uploadEndpoint(),
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
