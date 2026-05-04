/**
 * Photos storage (S3-style): upload images/videos to CDN and return URL.
 * When Cloudinary is configured, media goes to Cloudinary; otherwise we keep data URLs (dev fallback).
 */

import { inferMediaTypeFromUrl } from './mediaType.js';

function base64ToDataUrl(base64: string, mimeType: string = 'image/jpeg'): string {
  if (base64.startsWith('data:')) return base64;
  return `data:${mimeType};base64,${base64}`;
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
 */
export async function uploadMedia(data: string, folder: string = 'media'): Promise<string> {
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
