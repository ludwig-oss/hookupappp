import type { ChatGifPayload } from '../lib/chatGif';

export type CatalogGif = ChatGifPayload & {
  id: string;
  category: 'Reactions' | 'Love' | 'Funny' | 'Hype' | 'Mood';
};

/** Google Noto animated emoji — looping stickers that play in chat (no Giphy hotlink block). */
function noto(codepoint: string): string {
  return `https://fonts.gstatic.com/s/e/notoemoji/latest/${codepoint}/512.webp`;
}

/** Named looping stickers for chat — pick it, send it, name flashes under it. */
export const GIF_CATALOG: CatalogGif[] = [
  { id: 'wave', name: 'Hey', category: 'Reactions', kind: 'gif', url: noto('1f44b') },
  { id: 'thumbsup', name: 'Yes', category: 'Reactions', kind: 'gif', url: noto('1f44d') },
  { id: 'nope', name: 'Nope', category: 'Reactions', kind: 'gif', url: noto('1f44e') },
  { id: 'ok', name: 'Okay', category: 'Reactions', kind: 'gif', url: noto('1f44c') },
  { id: 'clap', name: 'Clap clap', category: 'Reactions', kind: 'gif', url: noto('1f44f') },
  { id: 'pray', name: 'Please', category: 'Reactions', kind: 'gif', url: noto('1f64f') },
  { id: 'think', name: 'Hmm', category: 'Reactions', kind: 'gif', url: noto('1f914') },
  { id: 'hands-up', name: 'Hands up', category: 'Reactions', kind: 'gif', url: noto('1f64c') },
  { id: 'point', name: 'This', category: 'Reactions', kind: 'gif', url: noto('1f449') },
  { id: 'hug', name: 'Hug', category: 'Reactions', kind: 'gif', url: noto('1f917') },
  { id: 'hearts', name: 'Hearts', category: 'Love', kind: 'gif', url: noto('2764_fe0f') },
  { id: 'heart-eyes', name: 'Heart eyes', category: 'Love', kind: 'gif', url: noto('1f60d') },
  { id: 'kiss', name: 'Kiss', category: 'Love', kind: 'gif', url: noto('1f618') },
  { id: 'sparkle-heart', name: 'Sparkle heart', category: 'Love', kind: 'gif', url: noto('1f496') },
  { id: 'love-you', name: 'Love you', category: 'Love', kind: 'gif', url: noto('1f970') },
  { id: 'wink', name: 'Wink', category: 'Love', kind: 'gif', url: noto('1f609') },
  { id: 'blush', name: 'Blush', category: 'Love', kind: 'gif', url: noto('1f60a') },
  { id: 'two-hearts', name: 'Two hearts', category: 'Love', kind: 'gif', url: noto('1f495') },
  { id: 'cupid', name: 'Crush', category: 'Love', kind: 'gif', url: noto('1f498') },
  { id: 'kiss-mark', name: 'Mwah', category: 'Love', kind: 'gif', url: noto('1f48b') },
  { id: 'shy', name: 'Shy', category: 'Love', kind: 'gif', url: noto('1f97a') },
  { id: 'fire', name: 'Fire', category: 'Hype', kind: 'gif', url: noto('1f525') },
  { id: 'party', name: 'Party', category: 'Hype', kind: 'gif', url: noto('1f389') },
  { id: 'starstruck', name: 'Starstruck', category: 'Hype', kind: 'gif', url: noto('1f929') },
  { id: 'hundred', name: '100', category: 'Hype', kind: 'gif', url: noto('1f4af') },
  { id: 'sparkles', name: 'Sparkles', category: 'Hype', kind: 'gif', url: noto('2728') },
  { id: 'star', name: 'Glow', category: 'Hype', kind: 'gif', url: noto('1f31f') },
  { id: 'hot', name: 'Hot', category: 'Hype', kind: 'gif', url: noto('1f975') },
  { id: 'celebrate', name: 'Celebrate', category: 'Hype', kind: 'gif', url: noto('1f973') },
  { id: 'laugh', name: 'LOL', category: 'Funny', kind: 'gif', url: noto('1f602') },
  { id: 'rofl', name: 'Dead', category: 'Funny', kind: 'gif', url: noto('1f923') },
  { id: 'wink-tongue', name: 'Playful', category: 'Funny', kind: 'gif', url: noto('1f61c') },
  { id: 'peach', name: 'Peach', category: 'Funny', kind: 'gif', url: noto('1f351') },
  { id: 'pepper', name: 'Spicy', category: 'Funny', kind: 'gif', url: noto('1f336') },
  { id: 'side-eye', name: 'Side eye', category: 'Funny', kind: 'gif', url: noto('1f928') },
  { id: 'hand-mouth', name: 'Oops', category: 'Funny', kind: 'gif', url: noto('1f92d') },
  { id: 'cool', name: 'Cool', category: 'Mood', kind: 'gif', url: noto('1f60e') },
  { id: 'sad', name: 'Sad', category: 'Mood', kind: 'gif', url: noto('1f622') },
  { id: 'cry', name: 'Crying', category: 'Mood', kind: 'gif', url: noto('1f62d') },
  { id: 'angry', name: 'Mad', category: 'Mood', kind: 'gif', url: noto('1f621') },
  { id: 'sleepy', name: 'Sleepy', category: 'Mood', kind: 'gif', url: noto('1f634') },
  { id: 'flushed', name: 'Nervous', category: 'Mood', kind: 'gif', url: noto('1f633') },
  { id: 'melting', name: 'Melting', category: 'Mood', kind: 'gif', url: noto('1fae0') },
  { id: 'rainbow', name: 'Rainbow', category: 'Mood', kind: 'gif', url: noto('1f308') },
];

export const GIF_CATEGORIES: CatalogGif['category'][] = ['Reactions', 'Love', 'Funny', 'Hype', 'Mood'];

export const EMOJI_GROUPS: Array<{ id: string; label: string; emojis: string[] }> = [
  {
    id: 'smileys',
    label: 'Smileys',
    emojis: ['😀', '😁', '😂', '🤣', '😊', '😍', '🤩', '😘', '😉', '😎', '🥰', '😇', '🥲', '😋', '😜', '🤗', '🤔', '😴', '😭', '😤', '😡', '🥶', '🥵', '😱', '🙈', '👀'],
  },
  {
    id: 'hearts',
    label: 'Hearts',
    emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '❣️', '💋'],
  },
  {
    id: 'gestures',
    label: 'Gestures',
    emojis: ['👍', '👎', '👏', '🙌', '👋', '🤝', '🙏', '💪', '✌️', '🤞', '🤟', '👌', '👆', '👇', '👈', '👉', '👊', '🫶'],
  },
  {
    id: 'people',
    label: 'People',
    emojis: ['🙂', '🙃', '😏', '😌', '😔', '🥺', '😳', '😬', '🙄', '😶', '🫠', '😈', '👻', '💋', '💃', '🕺', '🧚', '👑'],
  },
  {
    id: 'fun',
    label: 'Fun',
    emojis: ['🔥', '✨', '⭐', '🌈', '🌸', '🌹', '🎉', '🎊', '🥳', '🍾', '🥂', '☕', '🍕', '🍫', '🍑', '🌶️', '🎵', '💬'],
  },
];

export function searchCatalog(query: string): CatalogGif[] {
  const q = query.trim().toLowerCase();
  if (!q) return GIF_CATALOG;
  return GIF_CATALOG.filter(
    (g) => g.name.toLowerCase().includes(q) || g.category.toLowerCase().includes(q) || g.id.includes(q)
  );
}
