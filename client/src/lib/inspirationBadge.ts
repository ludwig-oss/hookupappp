export type InspirationMatch = {
  sourcePlatform?: string;
  celebrityOrBoardName?: string | null;
  extractedTags?: string[];
};

export function inspirationContextLine(
  match?: InspirationMatch | null,
  garmentHint?: string
): string {
  const platform = String(match?.sourcePlatform || '').toLowerCase();
  const who = String(match?.celebrityOrBoardName || '').trim();
  const hint = (garmentHint || '').toLowerCase();

  if (platform === 'celebrity_streetwear' || /bieber|streetwear|celebrity/i.test(who)) {
    const name = who.replace(/\s*streetwear\s*/i, '').trim() || 'Hailey Bieber';
    return `Inspired by ${name}'s Streetwear`;
  }
  if (platform === 'pinterest' || /pinterest|autumn|board/i.test(who)) {
    const board = who || 'Autumn Styles';
    return `Trending on Pinterest boards for ${board}`;
  }
  if (platform === 'fashion_show') {
    return `Inspired by ${who || 'the runway'} look`;
  }
  if (/plaid|clueless/i.test(`${who} ${hint}`)) {
    return "Inspired by Clueless's yellow plaid set";
  }
  if (/shimmer|velvet|crop|street/i.test(hint)) {
    return "Inspired by Hailey Bieber's Streetwear";
  }
  return 'Trending on Pinterest boards for Autumn Styles';
}
