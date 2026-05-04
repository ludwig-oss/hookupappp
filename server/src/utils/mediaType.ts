/** Infer image vs video from stored URL or data URL (highlights, stories). */
export function inferMediaTypeFromUrl(url: string): 'image' | 'video' {
  if (!url) return 'image';
  const lower = url.toLowerCase();
  if (lower.startsWith('data:video')) return 'video';
  if (/^data:[^;]*video\//.test(lower)) return 'video';
  if (/\.(mp4|webm|mov|m4v|ogg)(\?|#|$)/i.test(lower)) return 'video';
  if (lower.includes('/video/upload/')) return 'video';
  return 'image';
}
