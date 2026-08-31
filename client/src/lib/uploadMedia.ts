import axios from 'axios';
import { API_BASE, MEDIA_API_BASE } from '../api/config';
import { compressImageFile } from './compressImage';

function authHeaders(): Record<string, string> {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
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
  const timer = window.setTimeout(() => controller.abort(), 180_000);
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
      throw new Error('Upload timed out. Try a smaller photo or a shorter video.');
    }
    throw err;
  } finally {
    window.clearTimeout(timer);
  }
}

/** Compress photos, then upload the file. Videos go straight as multipart. */
export async function prepareAndUploadFile(file: File, folder: string): Promise<string> {
  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');
  if (!isImage && !isVideo) {
    throw new Error('Please choose a photo or video.');
  }
  if (isImage) {
    let blob = await compressImageFile(file, 1080, 0.82);
    if (blob.size > 2_500_000) {
      blob = await compressImageFile(file, 720, 0.72);
    }
    const name = (file.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg';
    return uploadMediaFile(blob, folder, name);
  }
  if (file.size > 80 * 1024 * 1024) {
    throw new Error('Video is too large (max 80MB). Try a shorter clip.');
  }
  return uploadMediaFile(file, folder, file.name || 'video.mp4');
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
