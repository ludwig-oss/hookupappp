import { compressImageDataUrl } from './compressImage';
import { isVideoMediaUrl } from './media';

/** Stay under Vercel serverless ~4.5MB JSON body limit when using same-origin /api proxy. */
const PROXY_SAFE_CHARS = 3_500_000;

/** Shrink images and reject oversized videos before upload. */
export async function prepareMediaForUpload(dataUrl: string): Promise<string> {
  if (isVideoMediaUrl(dataUrl)) {
    if (dataUrl.length > PROXY_SAFE_CHARS) {
      throw new Error('Video is too large. Use a shorter clip (max ~3 seconds) or pick a photo.');
    }
    return dataUrl;
  }

  let out = await compressImageDataUrl(dataUrl, 1080, 0.85);
  if (out.length > PROXY_SAFE_CHARS) {
    out = await compressImageDataUrl(dataUrl, 720, 0.72);
  }
  if (out.length > PROXY_SAFE_CHARS) {
    out = await compressImageDataUrl(dataUrl, 480, 0.65);
  }
  if (out.length > PROXY_SAFE_CHARS) {
    throw new Error('Image is too large even after compression. Try a smaller photo.');
  }
  return out;
}

/** Cloudinary / HTTPS URLs are small enough to cache in localStorage. */
export function profilePictureForStorage(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.length < 500_000) return url;
  return null;
}
