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
  | 'events';

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
];

export const HELP_FAQ: HelpFaqItem[] = [
  {
    category: 'Getting around',
    q: 'How does the whole app work?',
    a: 'Home is your control center. Tap a card to open it: Profile (your page), Activity Stream (discover by region), Compatibility (guides), Connections (nearby), Highlights (wheel games), Love Life Feed (posts), Communication (chat), Events (meetups), and Help (here). Bottom buttons: PROFILE, HOME, LOGOUT. Set country and city in Profile first. School may pop up with a daily lesson. Dating tips appear occasionally based on your gender. Women see an SOS button on home when not inside another widget.',
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
    a: '1) Finish profile setup and set country/city. 2) Verify your photo if prompted. 3) Open Activity Stream, confirm your region, tap "See active users". 4) Send interest or play Highlights games. 5) When matched, use Communication to chat. 6) Explore Settings for safety and notifications.',
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
    a: 'After a match ends, you may rate the experience (1–5 stars + comment) before unmatching. Reviews stay on the other person\'s profile—they cannot delete them but can reply once. Your profile shows reviews about you plus an overall star average (like an app store rating). Serious claims show as unproven until court evidence is submitted.',
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
    q: 'How do I find people in my region?',
    a: 'Activity Stream (◇) → search country/city → Confirm region → "See active users in this region". Your own country/city in Profile must be set so others find you too.',
    keywords: ['region', 'activity', 'find people'],
  },
  {
    category: 'Meeting people',
    q: 'How do I send or receive interests?',
    a: 'In Activity Stream after confirming region, tap Send interest on a card. View received interests to accept or decline. Accepted interests open Communication. Wheel games in Highlights can also send connection requests.',
    keywords: ['interest', 'match', 'accept'],
  },
  {
    category: 'Meeting people',
    q: 'What is Connections (▣)?',
    a: 'Shows nearby users (with location on) and venue discovery. Buzz to show interest. Enable location in Settings/device so others can see you when appropriate.',
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
    keywords: ['chat', 'message', 'communication'],
  },
  {
    category: 'Communication',
    q: 'What is the 24-hour reply rule?',
    a: 'After you match or show mutual interest, whoever received the last message has 24 hours to reply. If they do not, the match may end automatically. Watch for a Reply badge with time left in your chat list.',
    keywords: ['24 hour', 'reply', 'deadline', 'respond'],
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
    a: 'In an active chat, Connection Journey offers daily challenges, games, and prompts before you both confirm you like each other. Open it from the chat tools to build rapport safely over several days.',
    keywords: ['connection journey', 'challenge', 'journey'],
  },
  {
    category: 'Safety & meetups',
    q: 'How do in-person meetups work in chat?',
    a: 'Plan via meetup tools: agree on a public venue from suggested spots (parks, coffee to-go, plazas—not private homes). You have about 7 days to meet after matching or the match may end. Repeatedly stalling meetups can lead to suspension over time (this app is for serious users). Before meeting: boundaries checklist, ID consent, expected return time, and optional safety video check-in. Each person pays their own way.',
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
    q: 'What is School / daily lessons?',
    a: 'You may see a School notification for a daily class or quiz on relationships and self-improvement. For men, daily self-improvement is required: warnings start after 3 skips in a row, and after 5 skips in a row visibility is reduced automatically (you can mark work busy or emergency, and completing a class clears the penalty). School can link you to Compatibility guides for deeper reading.',
    keywords: ['school', 'daily', 'lesson', 'quiz', 'class'],
  },
  {
    category: 'Social & games',
    q: 'How does the Love Life Feed work?',
    a: 'Love Life Feed (♥) shows community posts on dating and relationships. Like, comment, share to Communication, or create your own with + Post.',
    keywords: ['love feed', 'post', 'community'],
  },
  {
    category: 'Social & games',
    q: 'What is Compatibility (⚡)?',
    a: 'Browse guides by category, book improvement sessions, and track requests. School may send you here for guide topics.',
    keywords: ['compatibility', 'guides', 'sessions'],
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
];

export function getAnswerForQuestion(input: string): string {
  const lower = input.toLowerCase().trim();
  if (!lower) {
    return 'Type a question above, or tap a topic below.';
  }

  for (const faq of HELP_FAQ) {
    if (faq.q.toLowerCase().includes(lower) || lower.includes(faq.q.toLowerCase().slice(0, 24))) {
      return faq.a;
    }
    if (faq.keywords?.some((k) => lower.includes(k))) return faq.a;
  }

  const rules: [RegExp, string][] = [
    [/navigate|where is|find .* (page|section)|go to/i, HELP_FAQ[0].a],
    [/unmatch|review|rating|star|court|innocent/i, HELP_FAQ.find((f) => f.q.includes('unmatch'))!.a],
    [/24|reply.*hour|deadline/i, HELP_FAQ.find((f) => f.q.includes('24-hour'))!.a],
    [/meetup|venue|7 day|safety video|boundaries/i, HELP_FAQ.find((f) => f.q.includes('in-person meetups'))!.a],
    [/sos|911|volume/i, HELP_FAQ.find((f) => f.q.includes('SOS'))!.a],
    [/dating tip|hint popup/i, HELP_FAQ.find((f) => f.q.includes('dating tip'))!.a],
    [/school|daily lesson/i, HELP_FAQ.find((f) => f.q.includes('School'))!.a],
    [/walk|walking partner/i, HELP_FAQ.find((f) => f.q.includes('walking'))!.a],
  ];
  for (const [re, ans] of rules) {
    if (re.test(lower)) return ans;
  }

  return 'Try tapping "How does the whole app work?" or use Go where you need above. You can also ask about: chat, 24-hour reply, meetups, reviews, dating tips, SOS, Activity Stream, or Settings.';
}

export const HELP_CATEGORIES = [...new Set(HELP_FAQ.map((f) => f.category))];
