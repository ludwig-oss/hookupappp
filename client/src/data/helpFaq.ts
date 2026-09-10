export interface HelpFaqItem {
  category: string;
  q: string;
  a: string;
  keywords?: string[];
}

export type HelpNavTarget =
  | 'profile'
  | 'settings'
  | 'activity'
  | 'compatibility'
  | 'connections'
  | 'highlights'
  | 'lovefeed'
  | 'chat'
  | 'events'
  | 'datematch';

export interface HelpNavLink {
  target: HelpNavTarget;
  label: string;
  icon: string;
  hint: string;
}

export const HELP_NAV_LINKS: HelpNavLink[] = [
  { target: 'profile', label: 'Profile', icon: '👤', hint: 'Photo, city, reviews, health' },
  { target: 'settings', label: 'Settings', icon: '⚙️', hint: 'Privacy, safety, language' },
  { target: 'activity', label: 'Activity Stream', icon: '◇', hint: 'Find people in your region' },
  { target: 'chat', label: 'Communication', icon: '◉', hint: 'Chats, meetups, unmatch' },
  { target: 'lovefeed', label: 'Love Life Feed', icon: '♥', hint: 'Posts & community' },
  { target: 'highlights', label: 'Highlights', icon: '✦', hint: 'Spin wheel games' },
  { target: 'compatibility', label: 'Compatibility', icon: '⚡', hint: 'Guides & sessions' },
  { target: 'connections', label: 'Connections', icon: '▣', hint: 'Nearby & venues' },
  { target: 'events', label: 'Events', icon: '📅', hint: 'Create or join meetups' },
  { target: 'datematch', label: 'Date Arena', icon: '⚔', hint: 'Match, accept, fun date roll' },
];

export const HELP_FAQ: HelpFaqItem[] = [
  {
    category: 'Getting around',
    q: 'How does the whole app work?',
    a: 'Home is your control center. Tap a card to open it: Profile (your page), Activity Stream (discover by region), Date Arena (set up a date), Compatibility (guides), Connections (nearby), Highlights (wheel games), Love Life Feed (posts), Communication (chat), Events (meetups), and Help (here). Bottom buttons: PROFILE, HOME, LOGOUT. Set country and city in Profile first. School may pop up with a daily lesson. Dating tips appear occasionally based on your gender. Women see an SOS button on home when not inside another widget.',
    keywords: ['overview', 'app work', 'home', 'start'],
  },
  {
    category: 'Getting around',
    q: 'Where is Settings?',
    a: 'Open Profile (👤 card or PROFILE button), then tap ⚙️ Settings at the top. You can also go directly if you have the link saved. Settings has privacy, notifications, filters, emergency contacts, language, theme, reports & blocking, and account password.',
    keywords: ['settings', 'preferences', 'gear'],
  },
  {
    category: 'Getting around',
    q: 'How do I get started?',
    a: '1) Finish profile setup and set country/city. 2) Verify your photo if prompted. 3) Open Activity Stream — search any city in your country or worldwide, confirm to see people. 4) Send interest — chat only after accept. Free: 3 accepted; Plus/Gold/Platinum = unlimited. 5) When matched, use Communication to chat. 6) Explore Settings for safety and notifications.',
    keywords: ['get started', 'begin', 'new user'],
  },
  {
    category: 'Profile & account',
    q: 'How do I edit my profile?',
    a: 'Tap Profile on home or the PROFILE button. Update photo, age, country, city, and highlights. Changes auto-save. For bio, filters, visibility, and emergency contacts, use Settings → Profile & preferences.',
    keywords: ['profile', 'edit', 'photo', 'city'],
  },
  {
    category: 'Profile & account',
    q: 'What is the green "Photo verified" badge?',
    a: 'After uploading a photo, you may be asked for a quick selfie scan (left, center, right). Verified users get a green badge on Profile and Activity Stream. Changing your photo requires verifying again—this reduces catfishing.',
    keywords: ['verify', 'catfish', 'badge', 'selfie'],
  },
  {
    category: 'Profile & account',
    q: 'What are reviews on my profile?',
    a: 'You can leave a review from someone\'s profile (1–5 stars + comment), or from chat via Unmatch / End chat & Rate. Reviews stay on the other person\'s profile—they cannot delete them but can reply once. Your profile shows reviews about you plus an overall star average (like an app store rating). Serious claims show as unproven until court evidence is submitted.',
    keywords: ['review', 'rating', 'stars', 'unmatch review'],
  },
  {
    category: 'Profile & account',
    q: 'How do health results work on Profile?',
    a: 'In Profile you can add health test results and respond to view requests. In chat, tap a match\'s profile to request viewing their shared results (they must approve). Use this before meeting in person if you both agree.',
    keywords: ['health', 'std', 'test results'],
  },
  {
    category: 'Meeting people',
    q: 'What is Date Arena?',
    a: 'Date Arena (⚔) finds you a date using what you picked at signup (serious, casual, and the other intents). You can change that in Date Arena before you search. Choose My city only or Whole country (any city). You get 3 free searches a month; Plus, Gold, or Platinum unlocks unlimited. Matches pair similar interest levels. Both must Accept and pick when you are free. Then tap ? to roll a hobby, good deed, or cheap eat/drink neither of you has done. Chat stays locked until the date day. Cancelling without sick/emergency proof is a €10 fine paid to the other person. After the date, both of you choose whether to keep talking.',
    keywords: ['date arena', 'match', 'fun date', 'question mark', 'fine', 'accept'],
  },
  {
    category: 'Meeting people',
    q: 'How do Plus, Gold, and Platinum work?',
    a: 'Settings → Premium. Plus (€68/month): unlimited Date Arena searches, pitch yourself if someone declines your interest, unlimited other-country interest, and unlimited Activity Stream connections after your 3 free accepted interests. Gold: a guide hand-picks someone and pitches you in a 3-person room like a lawyer; they get a monthly cut. Platinum: pitch someone directly without showing interest first. Guides are summoned from Date Arena if you paid Gold. Plus, Gold, or Platinum all give unlimited Activity send/accept.',
    keywords: ['premium', 'plus', 'gold', 'platinum', 'pitch', 'guide lawyer'],
  },
  {
    category: 'Meeting people',
    q: 'How do I find people in my region?',
    a: 'Activity Stream (◇) → pick a country, optionally any city (e.g. you live in Frankfurt, search Berlin — or another country worldwide) → Confirm region — see people here. Send interest; chat only after accept. Free: 3 accepted interests; Plus / Gold / Platinum = unlimited. Set your own country/city in Profile so others find you too.',
    keywords: ['region', 'activity', 'find people'],
  },
  {
    category: 'Meeting people',
    q: 'How do I send or receive interests?',
    a: 'In Activity Stream after confirming region (any city in your country or worldwide), tap Send interest. View received interests to accept or decline. Only after accept can you keep talking in Communications. Free accounts: 3 accepted interests, then Plus, Gold, or Platinum for unlimited. Wheel games in Highlights can also send connection requests.',
    keywords: ['interest', 'match', 'accept'],
  },
  {
    category: 'Meeting people',
    q: 'What is Connections (▣)?',
    a: 'Shows nearby users (with location on) and venue discovery. Search real places: leave type on None to find any park, shop, or place by name (live map). Or filter by bar/café/etc. Buzz to show interest. Enable location in Settings/device so others can see you when appropriate.',
    keywords: ['connections', 'nearby', 'buzz', 'venue'],
  },
  {
    category: 'Meeting people',
    q: 'What is the walking partner popup?',
    a: 'If outdoor walk matching is enabled in Settings, you may get a popup suggesting someone nearby for a walk. Complete the life quiz if asked. You can dismiss it or send interest to open chat.',
    keywords: ['walk', 'walking', 'outdoor'],
  },
  {
    category: 'Communication',
    q: 'How do I chat with someone?',
    a: 'Communication (◉) lists conversations. Tap one to open. Send text, images, or voice. Tap their name/avatar for profile, meetup tools, and health options. Menu (⋮): rate, speed date, mute, unmatch, block.',
    keywords: ['chat', 'message', 'communication', 'talk', 'inbox', 'dm'],
  },
  {
    category: 'Communication',
    q: 'What is the 24-hour reply rule?',
    a: 'After you match or show mutual interest, whoever received the last message has 24 hours to reply. If they do not, the match may end automatically. Watch for a Reply badge with time left in your chat list.',
    keywords: ['24 hour', '24h', 'reply', 'deadline', 'respond', 'did not reply'],
  },
  {
    category: 'Communication',
    q: 'How does unmatch and rating work?',
    a: 'In chat menu (⋮) tap Unmatch. You will see a review screen: 1–5 stars, comment, and policy checkbox. Submit & unmatch or skip review. Reviews appear on their profile. False claims can lead to ban—serious allegations are marked innocent until proven guilty.',
    keywords: ['unmatch', 'rate', 'review before unmatch'],
  },
  {
    category: 'Communication',
    q: 'What is Connection Journey?',
    a: 'In an active chat, a connection host joins after you say Hi. Then you talk — the host mixes games, quizzes, XO, dares, and tiny challenges (50+ in the pool, 7 per match) and only jumps in if it goes quiet or you have been chatting a while. Pause host anytime if it is interrupting.',
    keywords: ['connection journey', 'challenge', 'journey', 'host', 'games', 'quiz'],
  },
  {
    category: 'Communication',
    q: 'How do I get help with what to text?',
    a: 'In a chat, tap SOS for live texting help (openers, replies, what to say next). On Home, tap Ask [your guide] for extra coaching. That is extra help — you already picked a guide in the required program. Chat SOS is not the safety SOS on Home for emergencies.',
    keywords: ['texting help', 'sos', 'what to say', 'ask guide', 'ai guide'],
  },
  {
    category: 'Account',
    q: 'Stay logged in vs signing out when I close the tab',
    a: 'Leave Stay logged in off (the default) and closing a tab or leaving the page signs you out. Check Stay logged in on login (or in Settings) to stay signed in on that device without entering PIN or password again.',
    keywords: ['stay logged in', 'logout', 'close tab', 'session', 'password'],
  },
  {
    category: 'Safety & meetups',
    q: 'How do in-person meetups work in chat?',
    a: 'Plan via meetup tools: agree on a public venue from suggested spots (parks, coffee to-go, plazas—not private homes). You have about 7 days to meet after matching or the match may end. Repeatedly stalling meetups can lead to suspension over time (this app is for serious users). Before meeting: boundaries checklist, hold your ID to the camera to scan it (saved only until you confirm you arrived home safe, then deleted), expected return time, and optional safety video check-in. Each person pays their own way.',
    keywords: ['meetup', 'venue', '7 day', 'meet in person'],
  },
  {
    category: 'Safety & meetups',
    q: 'Women\'s SOS on the home screen',
    a: 'Female users see SOS on home (when no other widget is open). It can alert nearby women on the app and offers a quick link to call emergency services (e.g. 911). Press volume down three times where supported as a shortcut. Add emergency contacts in Settings.',
    keywords: ['sos', 'women', 'emergency', 'safety alert'],
  },
  {
    category: 'Safety & meetups',
    q: 'How do I report or block someone?',
    a: 'Settings → Reports & Blocking to manage blocked users and reports. In Communication, open ⋮ on a chat → Block. Blocking stops contact; reporting helps moderators review abuse.',
    keywords: ['report', 'block', 'abuse'],
  },
  {
    category: 'Safety & meetups',
    q: 'Emergency contacts and meetup check-in',
    a: 'Settings → add emergency contacts (phone/app). When you plan a meetup in chat, you can set expected return time and submit a short safety check-in video. Your emergency contact may be notified per your plan settings.',
    keywords: ['emergency contact', 'check-in', 'safety video'],
  },
  {
    category: 'Tips & learning',
    q: 'What are dating tip popups?',
    a: 'Men and women get occasional "Dating tip" popups on home (~every 3–4 months). They are short hints with pros if you follow them and cons if you skip them. Tap × or Got it to dismiss. Tips rotate so you see new advice over time.',
    keywords: ['dating tip', 'hint', 'popup', 'educate'],
  },
  {
    category: 'Tips & learning',
    q: 'What are the “Respect tip” popups for men?',
    a: 'Male users get short “Respect tip · public safety” reminders about what to avoid doing to women in public (catcalling, blocking paths, following, unwanted touching, doxxing, retaliation, etc.). They show a couple times a month at first, then less over time. Tap × or Got it to dismiss and continue what you were doing.',
    keywords: ['respect tip', 'harassment', 'public safety', 'catcalling', 'stalking'],
  },
  {
    category: 'Tips & learning',
    q: 'What is School / daily lessons?',
    a: 'You may see a School notification for a daily class on relationships and self-improvement. For men, daily self-improvement is required: warnings start after 3 skips in a row, and after 5 skips in a row visibility is reduced automatically (you can mark work busy or emergency, and completing a class clears the penalty). There is no skip quiz — every user must pick 1 to 5 problem areas and choose a guide before using the rest of the app. After 2 months the guide grades whether you progressed.',
    keywords: ['school', 'daily', 'lesson', 'quiz', 'class'],
  },
  {
    category: 'Social & games',
    q: 'How does the Love Life Feed work?',
    a: 'Love Life Feed (♥) shows community posts on dating and relationships. Like, comment, share to Communication, or create your own with + Post. When someone leaves a relationship, the app automatically posts HERE WE GO — SINGLE AGAIN in their city (no name), with a photo from their profile and why they are single (or “Reasons are private”). For 24 hours you can show interest; then a russian roulette picks 7 lucky people who are added to their chats to help them move on.',
    keywords: ['love feed', 'post', 'community'],
  },
  {
    category: 'Social & games',
    q: 'What is Compatibility (⚡)?',
    a: 'Browse guides by category, send a request, and track sessions. A guide is required: choose 1 to 5 problem areas, then pick a guide. Couples also get relationship-problem guides. If you are good at helping couples, apply as a guide in those areas. After they accept, they grade you in 2 months.',
    keywords: ['compatibility', 'guides', 'sessions', 'skip quiz', 'grade'],
  },
  {
    category: 'Social & games',
    q: 'How does Bedroom flow with Mei work?',
    a: 'Open Ask [your guide], search last longer / positions / TermAct / foreplay, or pick Mei and tap Bedroom flow or TermAct. Positions: three warmup tips, then a 59-step loop with a timer. TermAct: 80 boy-to-girl tactics (for men with a woman) and 80 girl-to-boy (for women with a man), countdown, skip/previous/reset. Wear an earphone so Mei can talk you through it, or use silent mode and put the phone where it cannot be seen — the bar is a fake “video,” not a film. Stop if it hurts. Adults, both into it. First 5 AI crew helps are free; then Plus/Gold/Platinum (unlimited) or pay once to the app.',
    keywords: ['mei', 'sex', 'positions', 'last longer', 'bedroom', 'intimacy', 'premature', 'termact', 'foreplay'],
  },
  {
    category: 'Social & games',
    q: 'Do I pay for AI crew help the same way as a human guide?',
    a: 'Human guides still charge per session (Stripe card checkout); most of that goes to the person, with a platform fee. AI crew desks (outfit, face, bedroom/TermAct, lessons) give you 5 free helps. After that you need Plus, Gold, or Platinum for unlimited, or pay a one-time fee each time you get helped. That one-time money goes 100% to the app account, not a human guide. When you plan a date in chat, we ask once if you want tips from Ask [your guide].',
    keywords: ['premium', 'pay', 'free helps', 'ai crew', 'termact', 'plus', 'gold', 'platinum'],
  },
  {
    category: 'Social & games',
    q: 'How does Face & look with Elena work?',
    a: 'Open Ask [your guide] on Home, then Face & look. Elena is the appearance specialist. Upload three daylight photos — frontal, left profile, right profile. You get skin type, blemish scores, a 50-step habit plan, a 6-month after preview, and a full look (outfit + hair) she picks for you. Chat to change one piece. Nothing saves until you answer “Do you like this look?” Outfit help is the clothes-only desk next to it.',
    keywords: ['face', 'skin', 'elena', 'appearance', 'mewing', 'after results', 'hair', 'glow up'],
  },
  {
    category: 'Social & games',
    q: 'How does outfit help with my guide work?',
    a: 'Open Ask [your guide] on Home, then Outfit help. They ask what you are dressing for. Type it or tap the mic and describe it. You get two looks on a slider, fitted on your photo, a winner, and wardrobe folders. Elena is the style specialist; any crew member can still run the desk. Full studio try-on (IDM-VTON) uses a key in server/.env if you add one.',
    keywords: ['outfit', 'fashion', 'elena', 'what to wear', 'wardrobe', 'voice note'],
  },
  {
    category: 'Social & games',
    q: 'Do I have to get a guide?',
    a: 'Yes. You choose 1 to 5 areas where you have the most problems, then send a request to a guide. Couples in a relationship also get a couple guide for relationship problems. If you are good at helping couples, apply as a guide in Compatibility. There is no skip quiz. After they accept, they work with you for 2 months, then grade you.',
    keywords: ['guide required', 'problem areas', 'skip quiz', 'grade', '2 months', 'mandatory guide'],
  },
  {
    category: 'Social & games',
    q: 'What are Events (📅)?',
    a: 'Create or join public meetups by city. Approve join requests and chat with attendees. Always meet in public places first.',
    keywords: ['events', 'meetup event'],
  },
  {
    category: 'Social & games',
    q: 'What is the spin wheel in Highlights?',
    a: 'Spin for one of six mini-games (Blind Date, Picture Pick, etc.) with users in your region. Needs others in your area—if empty, try Activity Stream.',
    keywords: ['wheel', 'spin', 'highlights'],
  },
  {
    category: 'Social & games',
    q: 'How does Blind Date work?',
    a: 'Random match in your area, timed prompts, then Yes/No on fit. Mutual Yes reveals identities and lets you connect in Communication.',
    keywords: ['blind date'],
  },
  {
    category: 'Social & games',
    q: 'How does Picture Pick work?',
    a: 'Pick a vibe card; we reveal someone from your region. Send a connection request; chat if they accept.',
    keywords: ['picture pick', 'vibe'],
  },
  {
    category: 'Social & games',
    q: 'How does Compatibility Rush work?',
    a: 'Chemistry build-up, then one person with a match score and a countdown to send request or pass.',
    keywords: ['compatibility rush'],
  },
  {
    category: 'Social & games',
    q: 'How does Lucky Like work?',
    a: 'Blurred profile, one peek hint, then Like or Pass. Like sends a request and reveals who it was.',
    keywords: ['lucky like'],
  },
  {
    category: 'Social & games',
    q: 'How does Speed Pick work?',
    a: 'Three people, 5-second countdown—pick one or auto-pick. Send request; chat if accepted.',
    keywords: ['speed pick'],
  },
  {
    category: 'Social & games',
    q: 'How does Mystery Message work?',
    a: 'Anonymous user from your area; send a one-liner with your connection request.',
    keywords: ['mystery message'],
  },
  {
    category: 'Profile & account',
    q: 'How do I change my language?',
    a: 'Settings → Accessibility & Appearance → Language. Changes apply immediately.',
    keywords: ['language', 'translate'],
  },
  {
    category: 'Profile & account',
    q: 'How do I add or remove highlights?',
    a: 'Profile → HIGHLIGHTS: + on a highlight to add items, or Add Highlight for new. Delete with × on Profile cards.',
    keywords: ['highlight', 'story'],
  },
  {
    category: 'Social & games',
    q: 'How do I like, comment or share a post?',
    a: 'Open Love Life Feed (♥). On any post tap the heart to like, 💬 or Comments to write or reply, and Share to send it in Communication. The person who posted it can reply to comments too. Only the owner can delete their post.',
    keywords: ['like', 'comment', 'share', 'reply to comment', 'love life', 'feed post'],
  },
  {
    category: 'Social & games',
    q: 'How do I delete my post?',
    a: 'Only you can delete a post you created. Open Love Life Feed (or your Profile → Posts), find your post, tap Delete. Other people will not see a delete button on your post.',
    keywords: ['delete post', 'remove post', 'trash'],
  },
  {
    category: 'Profile & account',
    q: 'How does photo verification work?',
    a: 'To prove you are real, the app asks for a live selfie compared to your visible profile photo (not email or phone). After about a month you must verify again. If you skip reminders you can be locked until you scan. Open Profile if you see a verification prompt.',
    keywords: ['photo verification', 'selfie scan', 'catfish', 'locked', 'verify photo'],
  },
  {
    category: 'Safety & meetups',
    q: 'How does the ID camera scan work?',
    a: 'When you mention going on a date in Communication, a meetup plan opens. Hold your ID to the camera (front then back). It is saved only until you tap that you arrived home safe — then it is deleted. Location tracking is only during the date.',
    keywords: ['id scan', 'id camera', 'hold id', 'arrived home', 'date safety'],
  },
  {
    category: 'Profile & account',
    q: 'How do I turn notifications on or off?',
    a: 'Open Settings → notifications. You can control push, email, messages, matches, likes, sound, vibrate, and quiet hours. Use Register / allow notifications on your device if push is off.',
    keywords: ['notification', 'push', 'alert', 'quiet hours', 'sound'],
  },
];

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'i', 'im', "i'm", 'is', 'it', 'to', 'how', 'do', 'does', 'can', 'could', 'would',
  'what', 'where', 'why', 'when', 'which', 'my', 'me', 'you', 'your', 'of', 'in', 'on', 'for', 'and',
  'or', 'with', 'this', 'that', 'app', 'please', 'help', 'need', 'want', 'about', 'tell', 'show',
  'get', 'got', 'just', 'someone', 'something', 'there', 'here', 'also',
]);

export const HELP_SHORTCUTS: { phrase: string; target: HelpNavTarget }[] = [
  { phrase: 'Activity Stream', target: 'activity' },
  { phrase: 'Love Life Feed', target: 'lovefeed' },
  { phrase: 'Communication', target: 'chat' },
  { phrase: 'Compatibility', target: 'compatibility' },
  { phrase: 'Connections', target: 'connections' },
  { phrase: 'Highlights', target: 'highlights' },
  { phrase: 'Settings', target: 'settings' },
  { phrase: 'Profile', target: 'profile' },
  { phrase: 'Events', target: 'events' },
];

export interface HelpMatch {
  userQuestion: string;
  matchedQuestion: string | null;
  answer: string;
  /** Numbered how-to steps when we can infer intent */
  steps: string[];
  targets: HelpNavTarget[];
  related: HelpFaqItem[];
  confidence: 'high' | 'medium' | 'low';
}

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9#\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

export function targetsFromText(text: string): HelpNavTarget[] {
  const found: HelpNavTarget[] = [];
  for (const s of HELP_SHORTCUTS) {
    if (new RegExp(`\\b${s.phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text) && !found.includes(s.target)) {
      found.push(s.target);
    }
  }
  return found;
}

function detectSection(input: string): HelpNavTarget | null {
  const u = input.toLowerCase();
  const wantsPlace = /\b(where|open|go to|take me|show me|find|how do i (get|go|open)|section|page|screen|tab)\b/.test(u);
  const map: [HelpNavTarget, RegExp][] = [
    ['activity', /\b(activity stream|activity|discover|see active|region)\b/],
    ['datematch', /\b(date arena|date match|fun date|question mark|arena)\b/],
    ['chat', /\b(communication|chat|message|inbox|dm|unmatch|24\s*h)\b/],
    ['settings', /\b(settings|privacy|notification|language|theme|password|gear)\b/],
    ['profile', /\b(profile|my photo|my page|edit profile|bio)\b/],
    ['lovefeed', /\b(love life|love feed|feed|post|like a post|comment)\b/],
    ['connections', /\b(connections|nearby|buzz|venue)\b/],
    ['highlights', /\b(highlights|spin wheel|wheel game|blind date)\b/],
    ['compatibility', /\b(compatibility|guides?|sessions?|coach)\b/],
    ['events', /\b(events?|join (an )?event)\b/],
  ];
  for (const [target, re] of map) {
    if (re.test(u) && (wantsPlace || re.test(u))) {
      if (wantsPlace || map.filter(([, r]) => r.test(u)).length === 1) return target;
    }
  }
  if (wantsPlace) {
    for (const [target, re] of map) {
      if (re.test(u)) return target;
    }
  }
  return null;
}

function scoreFaq(userQ: string, faq: HelpFaqItem): number {
  const u = userQ.toLowerCase().trim();
  const ut = tokenize(userQ);
  if (!ut.length && !u) return 0;
  let score = 0;
  const qLow = faq.q.toLowerCase();
  if (qLow === u) return 1000;
  if (qLow.includes(u) && u.length >= 8) score += 40;
  for (const k of faq.keywords || []) {
    const kl = k.toLowerCase();
    if (u.includes(kl)) score += 14 + Math.min(kl.length, 12);
  }
  const hay = tokenize(`${faq.q} ${(faq.keywords || []).join(' ')} ${faq.a.slice(0, 180)}`);
  const haySet = new Set(hay);
  for (const t of ut) {
    if (haySet.has(t)) score += 8;
    else {
      for (const h of haySet) {
        if (h.length >= 4 && t.length >= 4 && (h.startsWith(t) || t.startsWith(h))) {
          score += 3;
          break;
        }
      }
    }
  }
  return score;
}

export function babyStepsFor(target: HelpNavTarget | null, userQ: string): string[] {
  const u = userQ.toLowerCase();
  if (/\bunmatch\b/.test(u) || /\bblock\b/.test(u)) {
    return [
      'Open Communication (chat list).',
      'Open the conversation with that person.',
      'Use the menu / actions → Unmatch (or Block if you need safety).',
      'Confirm — you will not see each other in chat after that.',
    ];
  }
  if (/\b(24\s*h|reply deadline|must reply)\b/.test(u)) {
    return [
      'Open the chat with that match.',
      'Look for the yellow reply-deadline banner near the top.',
      'Send any real message before the timer hits zero.',
      'If you miss it, the match can unmatch automatically — reply sooner next time.',
    ];
  }
  if (/\b(sos|texting help|ask amara|guide)\b/.test(u)) {
    return [
      'In a chat, tap SOS (or Ask Amara on Home).',
      'Choose AI guide (5 free helps) or Human guide (pay upfront).',
      'AI: pick a guide mind, get reply suggestions from your thread.',
      'Human: pay, spin/pick a live guide, optionally share screen.',
    ];
  }
  if (/\b(safety|activation word|shield|mic)\b/.test(u)) {
    return [
      'Open Personal safety shield from Home.',
      'Set an activation word (3+ letters) and allow the microphone.',
      'Tap “I’m going out — arm shield” when you leave.',
      'Shout your word, tap Help, or use taps/volume — nearby people get your pin.',
    ];
  }
  if (/\b(confession|booth)\b/.test(u)) {
    return [
      'From Home open Confession Booth.',
      'Agree to the terms (simulator skips payment).',
      'Pick an AI helper or human guide.',
      'Talk privately — AI stays in character turn by turn; End session when done.',
    ];
  }
  const map: Record<HelpNavTarget, string[]> = {
    profile: [
      'Tap PROFILE (bottom) or the Profile card on Home.',
      'Add photo, age, country, and city so matches work.',
      'Add Stories / Highlights so others see your vibe.',
      'Save — then explore Activity Stream or Communication.',
    ],
    settings: [
      'Open Profile → tap ⚙️ Settings (top).',
      'Set privacy, language, and emergency contacts.',
      'Review safety / notifications tabs.',
      'Come back to Help anytime if you get stuck.',
    ],
    activity: [
      'From Home tap Activity Stream.',
      'Confirm your region (country; city optional).',
      'Browse people online in that area.',
      'Send interest / open a profile when someone fits.',
    ],
    chat: [
      'From Home tap Communication.',
      'Open a conversation (or start from a match).',
      'Use GIF / games / SOS tools in the toolbar.',
      'Plan meetups carefully — use safety features when you go out.',
    ],
    lovefeed: [
      'From Home tap Love Life Feed.',
      'Scroll posts from the community.',
      'Like / comment, or create your own post.',
      'Use it to warm up chats with shared topics.',
    ],
    connections: [
      'From Home tap Connections.',
      'Allow location for Nearby.',
      'Buzz someone close, or search a venue.',
      'Accept buzzes and move the chat forward.',
    ],
    highlights: [
      'From Home tap Highlights.',
      'Spin the wheel for icebreaker games.',
      'Follow the prompt with your match in chat.',
      'Come back for a new spin anytime.',
    ],
    compatibility: [
      'From Home tap Compatibility.',
      'Pick or keep your AI guide (Amara & crew).',
      'Ask about texting, dates, boundaries, style…',
      'Use free helps first; premium unlocks unlimited AI help.',
    ],
    events: [
      'From Home tap Events.',
      'Browse meetups or create one.',
      'Join and chat with attendees.',
      'Show up safely — share plans with a contact.',
    ],
    datematch: [
      'From Home tap Date Arena.',
      'Set what you are looking for.',
      'Accept / pitch / roll fun date ideas.',
      'Move good matches into Communication to plan.',
    ],
  };
  if (target && map[target]) return map[target];
  return [
    'Type what you want in the search bar (example: “how do I unmatch”).',
    'Read the answer — highlighted words are tappable shortcuts.',
    'Tap a Go where you need card if you already know the section.',
    'Repeat with a clearer question if the first answer is not enough.',
  ];
}

/** Word descriptions for Help cards — explain first, open later. */
export function explainHelpSection(target: HelpNavTarget): HelpMatch {
  const link = HELP_NAV_LINKS.find((l) => l.target === target);
  const name = link?.label || target;
  const blurb: Record<HelpNavTarget, string> = {
    profile:
      'Profile is your public page: photo, age, city, stories, highlights, health, and reviews. Finish it so people can find and trust you. Reviews you receive stay forever.',
    settings:
      'Settings controls privacy, language, notifications, emergency contacts, and account security. Open it from your Profile gear icon.',
    activity:
      'Activity Stream lists people by country/city. Browse freely, send interest, and when they accept you both land in Communication.',
    chat:
      'Communication is your inbox: chats, games, meetup safety, SOS texting help, and unmatch. Reply in time or the match can end.',
    lovefeed:
      'Love Life Feed is the community wall — posts, likes, and comments so you can warm up chats with shared topics.',
    highlights:
      'Highlights is the spin wheel of mini-games (Blind Date, Picture Pick, and more) with people in your region. Spin to play — it is a game launcher, not a phone dialer.',
    compatibility:
      'Compatibility is where you pick an AI guide (Amara & crew). They coach texting, dates, style, and boundaries. First helps are free, then premium.',
    connections:
      'Connections shows nearby people and venues. Buzz someone close, search places, and move good vibes into chat.',
    events:
      'Events lets you create or join meetups. Chat with attendees and share plans safely with a contact.',
    datematch:
      'Date Arena searches for a date match: vs screen → both Accept → roll “?” for a plan → you are scheduled. Simulator mocks appear when the sim is running.',
  };
  return {
    userQuestion: `How does ${name} work?`,
    matchedQuestion: `How ${name} works`,
    answer: blurb[target] || `${name}: ${link?.hint || ''}`,
    steps: babyStepsFor(target, name),
    targets: [target],
    related: HELP_FAQ.filter((f) => targetsFromText(f.a + f.q).includes(target)).slice(0, 3),
    confidence: 'high',
  };
}

function stepsFromAnswer(answer: string): string[] {
  const parts = answer
    .split(/(?<=\.)\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20)
    .slice(0, 4);
  return parts.length >= 2 ? parts : [];
}

export function getHelpMatch(input: string): HelpMatch {
  const userQuestion = input.trim();
  if (!userQuestion) {
    return {
      userQuestion: '',
      matchedQuestion: null,
      answer:
        'Type what you need — for example “how do I unmatch”, “24 hour reply”, “safety word”, or “where is Settings”. I will answer in baby steps and light up shortcuts you can tap.',
      steps: babyStepsFor(null, ''),
      targets: ['settings', 'chat', 'activity'],
      related: HELP_FAQ.slice(0, 3),
      confidence: 'low',
    };
  }

  const section = detectSection(userQuestion);
  const ranked = HELP_FAQ
    .map((faq) => ({ faq, score: scoreFaq(userQuestion, faq) }))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0];
  const related = ranked.slice(1, 4).filter((r) => r.score >= 10).map((r) => r.faq);

  if (best && best.score >= 14) {
    const targets = Array.from(
      new Set([...targetsFromText(best.faq.a + ' ' + best.faq.q), ...(section ? [section] : [])])
    );
    const steps = babyStepsFor(section || targets[0] || null, userQuestion);
    const fromAns = stepsFromAnswer(best.faq.a);
    return {
      userQuestion,
      matchedQuestion: best.faq.q,
      answer: best.faq.a,
      steps: steps.length ? steps : fromAns,
      targets: targets.length ? targets : section ? [section] : ['chat'],
      related,
      confidence: best.score >= 28 ? 'high' : 'medium',
    };
  }

  if (section) {
    const link = HELP_NAV_LINKS.find((l) => l.target === section);
    const name = link?.label || section;
    return {
      userQuestion,
      matchedQuestion: `Open ${name}`,
      answer: `Here’s the path to ${name}. ${link ? link.hint + '.' : ''} Tap the shortcut below when you’re ready — or follow the baby steps.`,
      steps: babyStepsFor(section, userQuestion),
      targets: [section],
      related: ranked.filter((r) => r.score > 0).slice(0, 3).map((r) => r.faq),
      confidence: 'medium',
    };
  }

  return {
    userQuestion,
    matchedQuestion: null,
    answer:
      'I am not totally sure yet — try naming the place or the action (unmatch, SOS, safety shield, Activity Stream, Settings). Below are starter steps; tap a shortcut to jump.',
    steps: babyStepsFor(null, userQuestion),
    targets: ['chat', 'activity', 'settings', 'profile'],
    related: ranked.filter((r) => r.score > 0).slice(0, 3).map((r) => r.faq),
    confidence: 'low',
  };
}

/** @deprecated use getHelpMatch */
export function getAnswerForQuestion(input: string): string {
  return getHelpMatch(input).answer;
}

export const HELP_CATEGORIES = [...new Set(HELP_FAQ.map((f) => f.category))];
