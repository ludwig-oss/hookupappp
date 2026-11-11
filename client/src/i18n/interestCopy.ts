import { localizeLines } from '../lib/localizeCopy';
import { INTEREST_PACKS } from './interestPacks';

export const INTEREST_EN = {
  notifyInterestTitle: 'Hook Up — interest',
  notifyInterestOne: 'Someone nearby showed interest. Accept to talk, or decline.',
  notifyInterestMany: '{n} people nearby showed interest. Accept or decline each one.',
  badgeNearby: 'Nearby · your type',
  titleShowedInterest: 'They showed interest',
  bodyShowedInterest: 'Accept to talk in Communications, or decline. They get one notice either way.',
  moreWaiting: '{n} more waiting. The list shows 10 at a time — respond and the next fills in, or open the list to search.',
  openList: 'Open list',
  notInterested: 'Not interested',
  accept: 'Accept',
  pushInterestTitle: 'Someone nearby is interested',
  pushInterestBody: 'Accept to talk, or decline. You are added to chat only if you accept.',
  badgeAccepted: 'Accepted',
  badgeDeclined: 'Declined',
  titleAccepted: 'They accepted your request',
  titleDeclined: 'They declined your request',
  bodyAccepted: 'You can talk in Communications now.',
  bodyDeclined: 'They will not be added to Communications.',
  ok: 'OK',
  openChat: 'Open chat',
  notifyAccepted: 'They accepted — you can talk in Communications.',
  notifyDeclined: 'They declined. They were not added to chat.',
  pushAcceptedTitle: 'They accepted your interest',
  pushAcceptedBody: 'You can talk in Communications now.',
  pushDeclinedTitle: 'Not interested',
  pushDeclinedBody: 'They declined. They were not added to chat.',
  nearbyBadge: 'Nearby · 50 m · your type',
  nearbyTitle: 'Someone matching you is nearby',
  nearbyBody: 'Show interest if you want. You both land in Communications only if they show interest too.',
  nearbyMore: '{n} more nearby. The list shows 10 at a time — respond and the next person fills in, or open the list.',
  showInterest: 'Show interest',
  later: 'Later',
  close: 'Close',
  notifyNearbyOne: 'Someone matching your orientation is within 50 meters. Show interest if you want.',
  notifyNearbyMany: '{n} people matching your orientation are within 50 meters.',
  notifyNearbyTitle: 'Hook Up — nearby',
  notifyInterestSent: 'Interest sent. You join Communications only if they show interest too.',
  notifyMatch: "It's a match — they're in Communications.",
  comfortInterestSent: 'Interest sent. You both join Communications only if they show interest too.',
  comfortMatch: "It's a match! They're in your Communications — start chatting.",
  comfortAlready: 'They already showed interest. Accept or decline.',
  comfortAccepted: "They're in your Communications. You can start chatting now!",
  comfortTalkLater: "They're in your Communications. Chat when you're both ready!",
  notifyAcceptedTalk: "They're in Communications. You can talk now.",
  comfortSomeoneNearby: 'Someone nearby showed interest — respond below.',
  interestSentLabel: 'Interest sent',
  pass: 'Pass',
  yes: 'Yes',
  no: 'No',
  talkLater: 'Talk later',
  statusPending: 'Pending',
  statusAccepted: 'Accepted',
  statusRejected: 'Rejected',
  statusLabel: 'Status',
  seeTranslation: 'See translation',
  seeOriginal: 'See original',
  searchLanguage: 'Search language',
  translating: 'Translating…',
  translationUnavailable: 'Translation unavailable',
  noLanguageMatch: 'No language matches that search',
  walkIncomingBadge: 'Someone is near',
  walkIncomingTitle: 'Someone nearby is interested',
  walkIncomingSub: 'Profile only — name hidden until you both match.',
  dismiss: 'Dismiss',
  yesChat: "Yes — let's chat",
  imInterested: "I'm interested",
  walkSuggestBadge: 'Someone is near · your type',
  hookUp: 'Hook Up',
  walkInterestSent: "Interest sent! When they say yes too, you'll both land in Communications. Reply within 24 hours once you match.",
  walkMatch: "It's a match — you're both in Communications! Reply within 24 hours after each message or the match ends.",
  emptyLocation: 'Turn location on to see people next to you.',
  emptyAlready: 'People nearby are already in your list — open it if the popup did not appear.',
  emptyNobody: 'Nobody matching your orientation within 50 meters right now.',
  emptyFail: 'Could not check nearby people. Open the list to try again.',
  errLocation: 'Allow location, then try again.',
} as const;

export type InterestCopy = { -readonly [K in keyof typeof INTEREST_EN]: string };

const PACK_CACHE = 'hookup:interest-pack:v1';

export function fillInterest(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => (vars[key] == null ? '' : String(vars[key])));
}

export function bundledInterestCopy(lang: string): InterestCopy | null {
  const code = (lang || 'en').toLowerCase().split('-')[0];
  return INTEREST_PACKS[code] ?? (code === 'en' ? INTEREST_EN : null);
}

function readPack(code: string): InterestCopy | null {
  try {
    const raw = localStorage.getItem(`${PACK_CACHE}:${code}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<InterestCopy>;
    const keys = Object.keys(INTEREST_EN) as (keyof InterestCopy)[];
    if (!keys.every((key) => typeof parsed[key] === 'string' && parsed[key]?.trim())) return null;
    return parsed as InterestCopy;
  } catch {
    return null;
  }
}

export async function loadInterestCopy(lang: string): Promise<InterestCopy> {
  const code = (lang || 'en').toLowerCase().split('-')[0] || 'en';
  const bundled = bundledInterestCopy(code);
  if (bundled) return bundled;
  const saved = readPack(code);
  if (saved) return saved;
  const keys = Object.keys(INTEREST_EN) as (keyof InterestCopy)[];
  const lines = await localizeLines(keys.map((key) => INTEREST_EN[key]), code, 'en');
  const out = { ...INTEREST_EN } as InterestCopy;
  keys.forEach((key, index) => {
    const line = lines[index];
    if (line?.trim()) out[key] = line;
  });
  const changed = keys.filter((key) => out[key] !== INTEREST_EN[key] && INTEREST_EN[key].length > 8).length;
  const longOnes = keys.filter((key) => INTEREST_EN[key].length > 8).length;
  if (changed >= Math.ceil(longOnes * 0.8)) {
    try {
      localStorage.setItem(`${PACK_CACHE}:${code}`, JSON.stringify(out));
    } catch {
      /* storage full */
    }
  }
  return out;
}
