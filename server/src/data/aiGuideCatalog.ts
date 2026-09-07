export type AiVoiceHint = 'female' | 'male';

export interface AiGuideRatings {
  directness: number;
  warmth: number;
  datingIq: number;
  texting: number;
  style: number;
  boundaries: number;
  healing: number;
  attraction: number;
}

export interface AiGuideCharacter {
  id: string;
  name: string;
  specialty: string;
  tagline: string;
  personality: string;
  thinking: string;
  portrait: string;
  voice: { hint: AiVoiceHint; pitch: number; rate: number };
  ratings: AiGuideRatings;
  expertise: string[];
  categoryIds: string[];
}

export interface AiLesson {
  id: string;
  title: string;
  aliases: string[];
  categoryIds: string[];
  bestGuideIds: string[];
  cause: string;
  solution: string;
  prevention: string;
  unknown: string;
  demo: string;
}

export const AI_GUIDES: AiGuideCharacter[] = [
  {
    id: 'amara',
    name: 'Amara Cole',
    specialty: 'Self-worth & friendzone',
    tagline: 'You are not a backup plan.',
    personality: 'Warm, slow, and honest. She names the pattern without shaming you.',
    thinking: 'Starts with how you treat yourself, then the other person.',
    portrait: '/ai-guides/amara.png',
    voice: { hint: 'female', pitch: 1.05, rate: 0.92 },
    ratings: { directness: 7, warmth: 10, datingIq: 8, texting: 6, style: 5, boundaries: 9, healing: 8, attraction: 6 },
    expertise: ['low self-esteem', 'friendzone', 'hyper-independence', 'fear of rejection'],
    categoryIds: ['self-worth', 'rejection', 'confidence-dating', 'boundaries'],
  },
  {
    id: 'kenji',
    name: 'Kenji Sato',
    specialty: 'Apps & getting dates',
    tagline: 'Stop swiping. Start choosing.',
    personality: 'Calm strategist. Short plans, no hype.',
    thinking: 'Cuts noise first: time, money, options. Then one next move.',
    portrait: '/ai-guides/kenji.png',
    voice: { hint: 'male', pitch: 0.92, rate: 0.95 },
    ratings: { directness: 8, warmth: 5, datingIq: 10, texting: 7, style: 6, boundaries: 7, healing: 4, attraction: 6 },
    expertise: ['dating apps', 'choice overload', 'getting dates', 'money on dates'],
    categoryIds: ['dating-apps', 'first-date', 'asking-out', 'quality-time'],
  },
  {
    id: 'sofia',
    name: 'Sofia Reyes',
    specialty: 'Flirting & spark',
    tagline: 'Interest is a signal, not a speech.',
    personality: 'Playful and direct. She makes flirting feel simple.',
    thinking: 'Body, timing, one clear cue. Then stop talking.',
    portrait: '/ai-guides/sofia.png',
    voice: { hint: 'female', pitch: 1.12, rate: 1.04 },
    ratings: { directness: 8, warmth: 8, datingIq: 7, texting: 8, style: 7, boundaries: 6, healing: 4, attraction: 10 },
    expertise: ['flirting', 'attraction', 'awkward dates', 'hard to get'],
    categoryIds: ['flirting', 'body-language-dating', 'conversation-dating', 'asking-out'],
  },
  {
    id: 'marcus',
    name: 'Marcus Hale',
    specialty: 'Red flags & situationships',
    tagline: 'If it is confusing, it is a no.',
    personality: 'No-BS. He will not let you romanticize mixed signals.',
    thinking: 'Looks at pattern, not potential. Names the cost of staying.',
    portrait: '/ai-guides/marcus.png',
    voice: { hint: 'male', pitch: 0.85, rate: 0.97 },
    ratings: { directness: 10, warmth: 4, datingIq: 9, texting: 5, style: 4, boundaries: 10, healing: 6, attraction: 5 },
    expertise: ['red flags', 'wrong partner', 'situationships', 'misaligned intentions'],
    categoryIds: ['red-flags', 'exclusivity', 'expectations', 'boundaries'],
  },
  {
    id: 'priya',
    name: 'Priya Nair',
    specialty: 'Healing & attachment',
    tagline: 'Ready beats rushing.',
    personality: 'Gentle, precise, never fluffy. She slows you down on purpose.',
    thinking: 'Finds the old wound, then one safe experiment with a new person.',
    portrait: '/ai-guides/priya.png',
    voice: { hint: 'female', pitch: 1.0, rate: 0.9 },
    ratings: { directness: 6, warmth: 9, datingIq: 7, texting: 5, style: 4, boundaries: 8, healing: 10, attraction: 4 },
    expertise: ['past relationships', 'attachment', 'fear of vulnerability', 'readiness'],
    categoryIds: ['moving-on', 'emotional-intimacy', 'getting-back', 'trust'],
  },
  {
    id: 'elena',
    name: 'Elena Volkov',
    specialty: 'Style, face & first impression',
    tagline: 'Look like you already belong.',
    personality: 'Crisp and visual. She reads skin and bone, then clothes and hair.',
    thinking: 'Three photos, then fit, hair, one signature. Not a shopping list.',
    portrait: '/ai-guides/elena.png',
    voice: { hint: 'female', pitch: 0.98, rate: 0.96 },
    ratings: { directness: 7, warmth: 5, datingIq: 6, texting: 4, style: 10, boundaries: 6, healing: 3, attraction: 8 },
    expertise: ['fashion', 'appearances', 'skin', 'hair', 'first dates', 'presence'],
    categoryIds: ['style-fashion', 'first-date', 'body-language-dating', 'confidence-dating'],
  },
  {
    id: 'diego',
    name: 'Diego Alvarez',
    specialty: 'Texting & nerves',
    tagline: 'Send it. Then live your life.',
    personality: 'Friendly coach. He kills overthinking with a timer.',
    thinking: 'One message, one ask, one pause. No essays.',
    portrait: '/ai-guides/diego.png',
    voice: { hint: 'male', pitch: 0.95, rate: 1.02 },
    ratings: { directness: 7, warmth: 8, datingIq: 7, texting: 10, style: 5, boundaries: 6, healing: 5, attraction: 7 },
    expertise: ['texting anxiety', 'ghosting', 'dry replies', 'moving to a date'],
    categoryIds: ['texting', 'communication', 'asking-out', 'first-date'],
  },
  {
    id: 'mei',
    name: 'Mei Lin',
    specialty: 'Intimacy, pace & the bedroom',
    tagline: 'Wanting it and being ready are different.',
    personality: 'Quietly direct. She talks about sex, pace, and no without awkwardness.',
    thinking: 'Consent first. Then a shape you can hold, TermAct if you want a paced loop, and how not to rush the ending.',
    portrait: '/ai-guides/mei.png',
    voice: { hint: 'female', pitch: 1.02, rate: 0.93 },
    ratings: { directness: 8, warmth: 7, datingIq: 6, texting: 5, style: 6, boundaries: 9, healing: 7, attraction: 7 },
    expertise: ['sex', 'sexual incompatibility', 'pressure', 'saying no', 'lasting longer', 'positions', 'foreplay', 'termact'],
    categoryIds: ['bedroom', 'emotional-intimacy', 'boundaries', 'keeping-spark'],
  },
];

export const AI_LESSONS: AiLesson[] = [
  {
    id: 'swipe-burnout',
    title: 'Endless swiping, no real dates',
    aliases: ['swipe', 'burnout', 'addicted to matches', 'too many options', 'choice overload', 'dating app'],
    categoryIds: ['dating-apps'],
    bestGuideIds: ['kenji', 'diego'],
    cause: 'The app rewards matches, not meetings. Your brain treats new faces like snacks.',
    solution: 'Cap swipes at 15 a day. Message 3 people. Ask one of them out this week.',
    prevention: 'Hide the app after 20 minutes. Dates live off the screen.',
    unknown: 'Most people look better in person than in 6 photos. Swiping trains you to reject them first.',
    demo: 'swipe',
  },
  {
    id: 'low-effort-openers',
    title: 'Low-effort openers / I cannot stand out',
    aliases: ['hey', 'opener', 'stand out', 'first message', 'dry opener'],
    categoryIds: ['dating-apps', 'texting'],
    bestGuideIds: ['diego', 'sofia'],
    cause: '“Hey” asks them to do the work. Busy people skip it.',
    solution: 'One line about a specific photo or line in their bio, plus a question they can answer in 5 seconds.',
    prevention: 'Never send a message you would not answer yourself.',
    unknown: 'A specific compliment about a choice (the hike, the book) beats “you’re hot” every time.',
    demo: 'texts',
  },
  {
    id: 'ghosted',
    title: 'Ghosted or dry one-word replies',
    aliases: ['ghosted', 'ignored', 'dry', 'one word', 'left on read', 'texting anxiety'],
    categoryIds: ['texting', 'communication'],
    bestGuideIds: ['diego', 'amara'],
    cause: 'They are low-interest or overwhelmed. Your follow-ups raise the cost of answering.',
    solution: 'One clear ping: “Want to grab coffee Thursday?” If they stay dry, close it and move.',
    prevention: 'Ask for a time within 5 messages. Chat that never books a date is a hobby, not a match.',
    unknown: 'Interest is shown by effort, not by “I’m just bad at texting.”',
    demo: 'texts',
  },
  {
    id: 'overthinking-texts',
    title: 'Overthinking every text',
    aliases: ['overthink', 'overthinking', 'waiting to reply', 'reply games', 'texting anxiety'],
    categoryIds: ['texting'],
    bestGuideIds: ['diego', 'priya'],
    cause: 'You are trying to control their feeling of you. That is not possible over text.',
    solution: 'Write it once. Wait 10 minutes. Send. Put the phone in another room.',
    prevention: 'If a message needs a paragraph, it needs a call.',
    unknown: 'Reply-time games only work on people who are already unsure. Secure people just answer.',
    demo: 'timer',
  },
  {
    id: 'text-to-date',
    title: 'Stuck in chat, never a real date',
    aliases: ['never meet', 'move off app', 'phone call', 'ask out', 'getting dates'],
    categoryIds: ['asking-out', 'texting', 'first-date'],
    bestGuideIds: ['diego', 'kenji'],
    cause: 'Chat feels safe. A date can reject you in 3D.',
    solution: 'After two good exchanges, offer a specific plan: place + day + time.',
    prevention: 'Rule: if they will not pick a day in a week, they are entertainment, not a date.',
    unknown: 'People who want you will help schedule. “Soon” without a day is a soft no.',
    demo: 'two-doors',
  },
  {
    id: 'situationship',
    title: 'Stuck in a situationship',
    aliases: ['situationship', 'what are we', 'undefined', 'casual when i want more', 'mixed signals'],
    categoryIds: ['exclusivity', 'expectations'],
    bestGuideIds: ['marcus', 'priya'],
    cause: 'Ambiguity protects the person who wants less. You keep hoping they will upgrade you.',
    solution: 'Ask once, clearly: “I want exclusive. Do you?” Believe the first answer.',
    prevention: 'Do not do girlfriend work on a maybe. Pull back access until it is named.',
    unknown: 'If asking “what are we?” would ruin it, it was already not it.',
    demo: 'two-doors',
  },
  {
    id: 'self-worth',
    title: 'I feel I have nothing to offer',
    aliases: ['nothing to offer', 'low self esteem', 'not attractive', 'not enough', 'shame', 'compare', 'social media'],
    categoryIds: ['self-worth', 'confidence-dating'],
    bestGuideIds: ['amara', 'elena'],
    cause: 'You are rating yourself as a product. Dating is not a store shelf.',
    solution: 'List 3 ways you treat people well. Lead with that. Stop auditioning.',
    prevention: 'Do not date to prove you are worthy. Date to see if they are a fit.',
    unknown: 'People pick warmth and consistency over a highlight reel they cannot live with.',
    demo: 'mirror',
  },
  {
    id: 'fear-rejection',
    title: 'Fear of rejection',
    aliases: ['rejection', 'embarrassed', 'scared to ask', 'they will say no'],
    categoryIds: ['rejection', 'confidence-dating'],
    bestGuideIds: ['amara', 'sofia'],
    cause: 'Your brain treats a no like a verdict on your whole self.',
    solution: 'Ask in a low-stakes way, then go do something you like regardless of the answer.',
    prevention: 'Collect nos on purpose this month. The sting shrinks with reps.',
    unknown: 'A no is data about timing and fit, not a public scoreboard.',
    demo: 'spark',
  },
  {
    id: 'low-effort-dates',
    title: 'Dates with zero effort / flaking',
    aliases: ['flake', 'cancellation', 'low effort date', 'boring date', 'talks about themselves'],
    categoryIds: ['first-date', 'quality-time'],
    bestGuideIds: ['elena', 'marcus'],
    cause: 'You accepted a maybe. They never had to try.',
    solution: 'Confirm the morning of. If they downgrade or go vague, cancel. Do not chase.',
    prevention: 'First dates: public, 60–90 minutes, you can leave. Chemistry check, not an interview.',
    unknown: 'People who want you protect the plan. Flakes protect their options.',
    demo: 'timer',
  },
  {
    id: 'who-pays',
    title: 'Money stress and who pays',
    aliases: ['who pays', 'bill', 'broke', 'expensive date', 'financial stress', 'money'],
    categoryIds: ['first-date', 'quality-time'],
    bestGuideIds: ['kenji', 'elena'],
    cause: 'Nobody named the plan, so the bill becomes a test.',
    solution: 'Suggest a cheap clear plan (“walk + coffee, I have 45 minutes”). If you invite, be ready to cover that invite.',
    prevention: 'Pick places you can afford without resentment. Split is a sentence, not a fight.',
    unknown: 'Generosity is a pattern, not one receipt. Watch how they treat staff.',
    demo: 'wallet',
  },
  {
    id: 'red-flags',
    title: 'Ignoring red flags / same toxic type',
    aliases: ['red flag', 'toxic', 'gut', 'love bombing', 'liar', 'wrong partner', 'same type'],
    categoryIds: ['red-flags', 'boundaries'],
    bestGuideIds: ['marcus', 'amara'],
    cause: 'Chemistry with a familiar wound feels like destiny.',
    solution: 'Write your last three deal-breakers. If they hit one twice, exit. No debate.',
    prevention: 'Slow down praise. Watch behavior for 4 weeks before you attach.',
    unknown: 'Love-bombing is not romance. It is a rush to skip the part where you would notice problems.',
    demo: 'flag',
  },
  {
    id: 'past-baggage',
    title: 'Healing from a past relationship',
    aliases: ['ex', 'breakup', 'baggage', 'not ready', 'trust issues', 'healing', 'past relationship'],
    categoryIds: ['moving-on', 'trust', 'getting-back'],
    bestGuideIds: ['priya', 'amara'],
    cause: 'You are dating to numb the last person, not to meet this one.',
    solution: 'Pause new dates for 14 days. Feel the evenings. Then date with one rule: no ex stories on date 1–3.',
    prevention: 'If you cannot go a weekend without checking their page, you are not free yet.',
    unknown: 'Missing them is withdrawal. It is not proof you should go back.',
    demo: 'heart-split',
  },
  {
    id: 'vulnerability',
    title: 'Fear of being vulnerable',
    aliases: ['vulnerable', 'open up', 'walls', 'hyper independence', 'i dont need anyone'],
    categoryIds: ['emotional-intimacy', 'self-worth'],
    bestGuideIds: ['priya', 'amara'],
    cause: 'Independence kept you safe. Now it blocks closeness.',
    solution: 'Share one true, small thing. Not your whole trauma. Watch if they handle it gently.',
    prevention: 'Need is not weakness. Ask for one concrete thing and see who shows up.',
    unknown: 'Hyper-independence is often freeze, not strength. Partners cannot guess it.',
    demo: 'boundary',
  },
  {
    id: 'friendzone',
    title: 'Stuck in the friendzone',
    aliases: ['friendzone', 'just friends', 'nice guy', 'they see me as a friend'],
    categoryIds: ['flirting', 'boundaries', 'asking-out'],
    bestGuideIds: ['amara', 'sofia'],
    cause: 'You offered closeness without saying you want a date. They filed you as safe.',
    solution: 'Say it once: “I like you as more than a friend. If you don’t, I’ll step back.” Then actually step back.',
    prevention: 'Do not build a secret relationship in your head. Ask early.',
    unknown: 'Waiting longer does not turn friendship into attraction. It trains them to use you for comfort.',
    demo: 'two-doors',
  },
  {
    id: 'attachment',
    title: 'Attachment styles clashing',
    aliases: ['anxious', 'avoidant', 'attachment', 'clingy', 'hot and cold'],
    categoryIds: ['emotional-intimacy', 'communication', 'trust'],
    bestGuideIds: ['priya', 'marcus'],
    cause: 'Anxious chase + avoidant space = a loop that feels like chemistry.',
    solution: 'Name your pattern. Ask for a simple rhythm (goodnight text, one date a week). If they refuse any rhythm, leave.',
    prevention: 'Do not soothe panic with more texting. Do something with your body first, then reply.',
    unknown: 'You cannot anxiously-attach someone into feeling safe. Safety is their work too.',
    demo: 'heart-split',
  },
  {
    id: 'appearance',
    title: 'Face, skin, hair & glow-up',
    aliases: [
      'face',
      'skin',
      'acne',
      'jaw',
      'mewing',
      'glow up',
      'glowup',
      'hair',
      'blemishes',
      'dark circles',
      'profile photo',
      'after results',
    ],
    categoryIds: ['style-fashion', 'confidence-dating'],
    bestGuideIds: ['elena', 'sofia'],
    cause: 'One selfie from above hides the jaw, the skin, and the haircut.',
    solution: 'Three photos: frontal, left, right. Then a 50-step habit plan and a look Elena picks for the night.',
    prevention: 'Same light, same angles, once a month. Do not chase a different face.',
    unknown: 'The after photo is a habit preview, not surgery. Clothes and hair still do most of the first impression.',
    demo: 'mirror',
  },
  {
    id: 'fashion',
    title: 'What to wear / how I look',
    aliases: [
      'fashion',
      'outfit',
      'ugly',
      'clothes',
      'style',
      'looks',
      'what to wear',
      'what should i wear',
      'dress',
      'wardrobe',
    ],
    categoryIds: ['style-fashion', 'confidence-dating'],
    bestGuideIds: ['elena', 'sofia'],
    cause: 'Ill-fitting clothes read as “I did not try,” even if you did.',
    solution: 'One well-fitting base (dark jeans or clean trousers + fitted top) and one signature (watch, jacket, color).',
    prevention: 'Take a mirror photo in daylight. If the fit pulls or bags, change it before the date.',
    unknown: 'Grooming and fit beat logos. People remember posture and smell more than the brand.',
    demo: 'mirror',
  },
  {
    id: 'flirting',
    title: 'I do not know how to flirt',
    aliases: ['flirt', 'awkward', 'signals', 'attraction', 'chemistry'],
    categoryIds: ['flirting', 'body-language-dating'],
    bestGuideIds: ['sofia', 'elena'],
    cause: 'You either hide or perform. Flirting is a small loop: notice, name, pause.',
    solution: 'Hold eye contact a beat longer. Smile. Say one specific thing you like. Stop talking.',
    prevention: 'If they lean in or ask a question back, continue. If they go short, let it go.',
    unknown: 'Teasing only works after warmth. Strangers experience roast as attack.',
    demo: 'spark',
  },
  {
    id: 'intimacy-flow',
    title: 'Bedroom flow / lasting longer',
    aliases: [
      'positions',
      'sex positions',
      'last longer',
      'lasting longer',
      'finish too fast',
      'premature',
      'during sex',
      'bedroom flow',
      'lotus',
      'how to last',
      'dos and donts sex',
      'intimacy routine',
      'termact',
      'foreplay',
      'boy to girl',
      'girl to boy',
      'him to her',
      'her to him',
    ],
    categoryIds: ['bedroom', 'keeping-spark'],
    bestGuideIds: ['mei', 'sofia'],
    cause: 'People treat sex like a sprint or a stunt list, then finish fast or freeze.',
    solution: 'Warm up. Then one shape at a time from a 59-step loop, or TermAct — 80 boy-to-girl and 80 girl-to-boy tactics with a timer. Earphones for spoken cues, or silent with the phone out of sight. Mei gives two tips per position. Not the whole lecture at once.',
    prevention: 'Say “I’m close.” Pause. Switch jobs. Speed is how you finish early.',
    unknown: 'The interesting version is the one you can hold. Pain is a stop, not a challenge.',
    demo: 'heart-split',
  },
  {
    id: 'sex-mismatch',
    title: 'Sexual incompatibility or pressure',
    aliases: ['sex', 'incompatible', 'pressure', 'not ready', 'bedroom', 'intimacy'],
    categoryIds: ['bedroom', 'boundaries'],
    bestGuideIds: ['mei', 'priya'],
    cause: 'Nobody said pace or wants out loud, so the louder desire runs the night.',
    solution: 'Say the line: “I like you. I go slower. If that’s a problem, tell me now.” Believe the reaction.',
    prevention: 'Talk wants before clothes come off. Mismatch is allowed. Coercion is not.',
    unknown: 'Desire that only exists when you freeze is not chemistry. It is a boundary test.',
    demo: 'boundary',
  },
  {
    id: 'intentions',
    title: 'Misaligned intentions',
    aliases: ['they want casual', 'i want serious', 'intentions', 'not on the same page'],
    categoryIds: ['expectations', 'exclusivity'],
    bestGuideIds: ['marcus', 'kenji'],
    cause: 'You hoped dating would convert them. It rarely does.',
    solution: 'State your aim in week one. If they want something else, wish them well and leave.',
    prevention: 'Do not “see where it goes” for months if you already know where you need it to go.',
    unknown: 'People can like you and still not choose your future. Liking is not a plan.',
    demo: 'two-doors',
  },
  {
    id: 'power-games',
    title: 'Hard to get and tests',
    aliases: ['hard to get', 'games', 'jealous', 'tests', 'passive aggressive', 'power'],
    categoryIds: ['boundaries', 'communication'],
    bestGuideIds: ['marcus', 'sofia'],
    cause: 'Tests check if you will abandon yourself to keep them.',
    solution: 'Stay kind and plain. Do not punish, do not chase. “I’m not doing the guessing thing.”',
    prevention: 'If you have to look unaffected to keep them, they are not a rest.',
    unknown: 'Secure people do not need you to fail a quiz to earn a date.',
    demo: 'flag',
  },
  {
    id: 'catfish-photos',
    title: 'They look different than their photos',
    aliases: ['catfish', 'old photos', 'looks different', 'filters', 'not their pictures'],
    categoryIds: ['dating-apps', 'first-date', 'red-flags'],
    bestGuideIds: ['kenji', 'marcus'],
    cause: 'Apps reward the best angle, not the Tuesday face. Some people sell a past version.',
    solution: 'Video call 5 minutes before you travel. If they dodge video and light, cancel.',
    prevention: 'Recent photos, no heavy filter, and one full-body. You do the same.',
    unknown: 'Leaving is allowed. You are not rude for wanting the person you agreed to meet.',
    demo: 'photos',
  },
  {
    id: 'logistics',
    title: 'No time, money, or they live far',
    aliases: ['busy', 'no time', 'long distance', 'small town', 'schedule', 'rural', 'parenting', 'lifestyle'],
    categoryIds: ['quality-time', 'first-date'],
    bestGuideIds: ['kenji', 'elena'],
    cause: 'You are dating as if you have a free calendar. You do not.',
    solution: 'Offer one repeating slot (“Thursdays after 7”). If they cannot ever match a slot, it is not a fit.',
    prevention: 'Do not start something that only works on paper. Distance and kids need a plan in week two.',
    unknown: 'Chemistry does not commute. If the logistics never work, the relationship already failed.',
    demo: 'timer',
  },
  {
    id: 'commitment-future',
    title: 'Different timeline for marriage or kids',
    aliases: ['kids', 'marriage', 'settle', 'commitment', 'future', 'timeline', 'family pressure', 'losing myself'],
    categoryIds: ['expectations', 'exclusivity'],
    bestGuideIds: ['marcus', 'priya'],
    cause: 'You fell for the person and postponed the plan. The plan does not wait.',
    solution: 'Ask the real questions once: kids, city, money style. If the answers clash, end it kindly.',
    prevention: 'Do not date potential. Date the life they are already living.',
    unknown: 'Love can be real and still be the wrong life. Ending it early is the kind version.',
    demo: 'two-doors',
  },
  {
    id: 'unsafe-date',
    title: 'Feeling unsafe or stuck on a date',
    aliases: ['unsafe', 'uncomfortable', 'first meeting', 'awkward silence', 'leave the date', 'first date tips', 'date tips', 'tips for the date', 'going on a date'],
    categoryIds: ['first-date', 'boundaries'],
    bestGuideIds: ['mei', 'marcus'],
    cause: 'You treated the date as a contract you have to finish.',
    solution: 'Public place, own ride, 60 minutes. “I am heading out” is a full sentence. Text a friend the pin.',
    prevention: 'Tell someone where you are. Do not get in their car on date one.',
    unknown: 'Politeness is not a safety plan. Chemistry can wait. Your exit cannot.',
    demo: 'boundary',
  },
]

function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function interpretQuery(query: string): { topic: AiLesson; score: number }[] {
  const q = norm(query);
  if (!q) return [];
  const words = q.split(' ');
  const fashionCue = /\b(wear|outfit|dress|clothes|fashion|wardrobe|look)\b/.test(q);
  const appearanceCue = /\b(face|skin|acne|jaw|mew|glow|hair|blemish|circle|profile)\b/.test(q);
  const intimacyCue =
    /\b(position|last longer|lasting|premature|finish too fast|during sex|bedroom flow|lotus|how to last|termact|foreplay|boy to girl|girl to boy)\b/.test(q);
  const scored = AI_LESSONS.map((lesson) => {
    const hay = norm([lesson.title, ...lesson.aliases].join(' '));
    let score = 0;
    if (hay.includes(q)) score += 8;
    for (const w of words) {
      if (w.length < 3) continue;
      if (hay.includes(w)) score += 2;
    }
    if (fashionCue && lesson.id === 'fashion') score += 10;
    if (appearanceCue && lesson.id === 'appearance') score += 12;
    if (intimacyCue && lesson.id === 'intimacy-flow') score += 14;
    return { topic: lesson, score };
  }).filter((x) => x.score > 0);
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 3);
}

export function getGuide(id: string) {
  return AI_GUIDES.find((g) => g.id === id) || null;
}

export function getLesson(id: string) {
  return AI_LESSONS.find((l) => l.id === id) || null;
}

export function guidesForLesson(lesson: AiLesson) {
  const preferred = lesson.bestGuideIds.map((id) => getGuide(id)).filter(Boolean) as AiGuideCharacter[];
  const rest = AI_GUIDES.filter((g) => !lesson.bestGuideIds.includes(g.id));
  return [...preferred, ...rest];
}
