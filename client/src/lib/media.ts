/** True if URL / data URL points to video (highlights, stories, Cloudinary). */
export function isVideoMediaUrl(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  if (lower.startsWith('data:video')) return true;
  if (/^data:[^;]*video\//.test(lower)) return true;
  if (/\.(mp4|webm|mov|m4v|ogg)(\?|#|$)/i.test(lower)) return true;
  if (lower.includes('/video/upload/')) return true;
  return false;
}
