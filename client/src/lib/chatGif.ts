import { isVideoMediaUrl } from './media';

export const CHAT_GIF_PREFIX = 'HOOKUPGIF:';

export type ChatGifKind = 'gif' | 'video' | 'emoji';

export type ChatGifPayload = {
  url: string;
  name: string;
  kind: ChatGifKind;
};

export function encodeChatGif(payload: ChatGifPayload): string {
  const name = payload.name.trim().slice(0, 48) || 'Sticker';
  const kind: ChatGifKind =
    payload.kind ||
    (isEmojiOnly(payload.url) ? 'emoji' : isVideoMediaUrl(payload.url) ? 'video' : 'gif');
  return `${CHAT_GIF_PREFIX}${JSON.stringify({ url: payload.url, name, kind })}`;
}

export function parseChatGif(content: string): ChatGifPayload | null {
  const raw = String(content || '').trim();
  if (!raw.startsWith(CHAT_GIF_PREFIX)) return null;
  try {
    const parsed = JSON.parse(raw.slice(CHAT_GIF_PREFIX.length)) as Partial<ChatGifPayload>;
    if (!parsed?.url || typeof parsed.url !== 'string') return null;
    const name = String(parsed.name || '').trim().slice(0, 48) || 'Sticker';
    const kind: ChatGifKind =
      parsed.kind === 'video' || parsed.kind === 'emoji' || parsed.kind === 'gif'
        ? parsed.kind
        : isEmojiOnly(parsed.url)
          ? 'emoji'
          : isVideoMediaUrl(parsed.url)
            ? 'video'
            : 'gif';
    return { url: parsed.url, name, kind };
  } catch {
    return null;
  }
}

export function isEmojiOnly(text: string): boolean {
  const s = String(text || '').trim();
  if (!s || s.length > 16) return false;
  try {
    return /^[\p{Emoji_Presentation}\p{Extended_Pictographic}\u200d\ufe0f\s]+$/u.test(s);
  } catch {
    return s.length <= 8 && !/[A-Za-z0-9]/.test(s);
  }
}

export function isLegacyChatMediaUrl(content: string): boolean {
  const raw = String(content || '').trim();
  if (raw.startsWith('data:image/') || raw.startsWith('data:video/')) return true;
  if (!/^https?:\/\//i.test(raw)) return false;
  if (raw.includes('giphy.com') || raw.includes('tenor.com') || raw.includes('giphy.gif')) return true;
  return raw.toLowerCase().includes('gif') || /\.(gif|webp|png|jpg|jpeg|mp4|webm)(\?|#|$)/i.test(raw);
}

export function previewChatContent(content: string): string {
  const gif = parseChatGif(content);
  if (gif) return `🖼️ ${gif.name}`;
  const raw = String(content || '').trim();
  if (raw.startsWith('data:audio/')) return '🎤 Voice';
  if (raw.startsWith('data:image') || raw.startsWith('data:video')) return '📷 Media';
  if (isLegacyChatMediaUrl(raw)) return '🖼️ Sticker';
  if (raw.length > 40) return `${raw.slice(0, 40)}…`;
  return raw;
}

function savedKey(userId: string): string {
  return `hookup:savedGifs:${userId}`;
}

export function loadSavedGifs(userId: string): ChatGifPayload[] {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(savedKey(userId));
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is ChatGifPayload => item && typeof item.url === 'string' && typeof item.name === 'string')
      .slice(0, 80);
  } catch {
    return [];
  }
}

export function saveGif(userId: string, payload: ChatGifPayload): ChatGifPayload[] {
  const next = [payload, ...loadSavedGifs(userId).filter((g) => g.url !== payload.url)].slice(0, 80);
  try {
    localStorage.setItem(savedKey(userId), JSON.stringify(next));
  } catch {
    /* quota */
  }
  return next;
}

export function unsaveGif(userId: string, url: string): ChatGifPayload[] {
  const next = loadSavedGifs(userId).filter((g) => g.url !== url);
  try {
    localStorage.setItem(savedKey(userId), JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

export function isGifSaved(userId: string, url: string): boolean {
  return loadSavedGifs(userId).some((g) => g.url === url);
}
