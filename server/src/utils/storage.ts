/**
 * Photos storage (S3-style): upload images/videos to CDN and return URL.
 * When Cloudinary is configured, media goes to Cloudinary; otherwise we keep data URLs (dev fallback).
 */

import { inferMediaTypeFromUrl } from './mediaType.js';

function base64ToDataUrl(base64: string, mimeType: string = 'image/jpeg'): string {
  if (base64.startsWith('data:')) return base64;
  return `data:${mimeType};base64,${base64}`;
}

export function isRemoteMediaUrl(data: string): boolean {
  return /^https?:\/\//i.test(data.trim());
}

/** Check if Cloudinary is configured. */
export function useCloudinary(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}

/**
 * Upload an image to storage and return its URL.
 * - If Cloudinary env vars are set: upload to Cloudinary, return secure_url.
 * - Else: return data URL (current behavior for dev).
 */
export async function uploadImage(data: string, folder: string = 'profile'): Promise<string> {
  if (isRemoteMediaUrl(data)) return data.trim();
  if (useCloudinary()) {
    const { v2: cloudinary } = await import('cloudinary');
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    const dataUri = data.startsWith('data:') ? data : base64ToDataUrl(data);
    const result = await cloudinary.uploader.upload(dataUri, {
      folder: `aswp/${folder}`,
      resource_type: 'image',
    });
    return result.secure_url;
  }
  return data.startsWith('data:') ? data : base64ToDataUrl(data);
}

/**
 * Upload image or video (detected from data URL / payload). Use for highlights and stories.
 * HTTPS URLs from a prior upload are stored as-is (no second Cloudinary hop).
 */
export async function uploadMedia(data: string, folder: string = 'media'): Promise<string> {
  if (isRemoteMediaUrl(data)) return data.trim();
  const dataUri = data.startsWith('data:') ? data : base64ToDataUrl(data);
  const isVideo = inferMediaTypeFromUrl(dataUri) === 'video';
  if (useCloudinary()) {
    const { v2: cloudinary } = await import('cloudinary');
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    const result = await cloudinary.uploader.upload(dataUri, {
      folder: `aswp/${folder}`,
      resource_type: isVideo ? 'video' : 'image',
    });
    return result.secure_url;
  }
  return dataUri;
}

/** Stream a file buffer to Cloudinary (or a small data-URL fallback in local dev). */
export async function uploadMediaBuffer(
  buffer: Buffer,
  mimeType: string,
  folder: string = 'media'
): Promise<string> {
  const isVideo = mimeType.startsWith('video/');
  if (useCloudinary()) {
    const { v2: cloudinary } = await import('cloudinary');
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: `aswp/${folder}`, resource_type: isVideo ? 'video' : 'auto' },
        (err, result) => {
          if (err || !result?.secure_url) {
            reject(err instanceof Error ? err : new Error('Upload failed'));
            return;
          }
          resolve(result.secure_url);
        }
      );
      stream.end(buffer);
    });
  }
  if (buffer.length > 3_500_000) {
    throw new Error('File is too large for local storage. Try a smaller photo.');
  }
  return `data:${mimeType || 'application/octet-stream'};base64,${buffer.toString('base64')}`;
}
