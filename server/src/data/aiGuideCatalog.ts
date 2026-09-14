import { DATING_COACH_GUIDES } from './aiDatingCoaches.js';
import { FEMININE_DATING_COACH_GUIDES } from './aiFeminineDatingCoaches.js';
import { FASHION_STYLE_GUIDES } from './aiFashionGuides.js';
import { FOOTWEAR_STYLE_GUIDES } from './aiFootwearGuides.js';
import { APPEARANCE_FACE_GUIDES } from './aiAppearanceGuides.js';
import { HAIR_STYLE_GUIDES } from './aiHairGuides.js';
import { TEXTING_COACH_GUIDES } from './aiTextingGuides.js';
import { RELATIONSHIP_COUNSELOR_GUIDES } from './aiRelationshipCounselors.js';
import { FINANCE_LITERACY_GUIDES } from './aiFinanceGuides.js';
import { FINANCE_REALIST_GUIDES } from './aiFinanceRealistGuides.js';
import { domainLaneForDesk } from '../services/llmChat.js';

export type AiVoiceHint = 'female' | 'male';
export type AiGuideLens = 'feminine' | 'masculine' | 'neutral';
export type AiGuideDesk = 'fashion' | 'appearance' | 'intimacy' | 'dating' | 'texting' | 'hair' | 'relationship' | 'finance';

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
  /** Feminine-lens coaches help women — and men learning how women choose. */
  lens?: AiGuideLens;
  /** Specialty desk — fashion stylists power Outfit help. */
  desk?: AiGuideDesk;
  /** Character.AI-style cognitive / dialogue engine for this guide. */
  charStyle?: {
    actionCue: string;
    catchphrases: string[];
    mindset: string;
  };
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
  /** Per-guide voice — each helper has their own take, not a shared script. */
  guideTakes?: Record<string, { cause: string; solution: string; prevention: string; unknown: string }>;
  /** Character.AI-style full reply when resolved for a specific guide. */
  reply?: string;
}

/** Couples counselors supersede same-id entries from dating/feminine packs. */
const MOVED_TO_RELATIONSHIP = new Set([
  'john-gottman',
  'esther-perel',
  'jillian-turecki',
  'nicole-lepera',
]);

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
    lens: 'feminine',
    charStyle: {
      actionCue: '*Softens her eyes, then names the pattern without flinching.*',
      catchphrases: ['You are not a backup plan', 'Start with how you treat yourself'],
      mindset: 'Warm honesty. Self-worth first, then the other person.',
    },
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
    lens: 'masculine',
    charStyle: {
      actionCue: '*Sets his phone face-down and looks at you.*',
      catchphrases: ['One next move', 'Cut the noise', 'Dates live off the screen'],
      mindset: 'Strategy over hype. Cap options, book a real meet.',
    },
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
    lens: 'feminine',
    charStyle: {
      actionCue: '*Smirks, then keeps it short on purpose.*',
      catchphrases: ['One clear cue', 'Stop talking', 'Interest is a signal'],
      mindset: 'Playful, direct spark. Less essay, more timing.',
    },
  },
  {
    id: 'marcus',
    name: 'Marcus Hale',
    specialty: 'Red flags & situationships',
    tagline: 'If it is confusing, it is a no.',
    personality: 'No-BS. He will not let you romanticize mixed signals.',
    thinking: 'Names mixed signals early. Still greets like a person before the hard truth.',
    portrait: '/ai-guides/marcus.png',
    voice: { hint: 'male', pitch: 0.85, rate: 0.97 },
    ratings: { directness: 10, warmth: 4, datingIq: 9, texting: 5, style: 4, boundaries: 10, healing: 6, attraction: 5 },
    expertise: ['red flags', 'wrong partner', 'situationships', 'misaligned intentions'],
    categoryIds: ['red-flags', 'exclusivity', 'expectations', 'boundaries'],
    lens: 'masculine',
    charStyle: {
      actionCue: '*Shakes his head once — no soft landing.*',
      catchphrases: ['If it is confusing, it is a no', 'Mixed signals cost'],
      mindset: 'No romanticizing red flags. Exit when confused. Talk like a real person first.',
    },
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
    categoryIds: ['moving-on', 'emotional-intimacy', 'getting-back', 'trust', 'couples-relationship'],
    lens: 'feminine',
    desk: 'relationship',
    charStyle: {
      actionCue: '*Slows her breath, then meets your eyes.*',
      catchphrases: ['Ready beats rushing', 'One safe experiment', 'Old wound first'],
      mindset: 'Gentle precision. Heal the attachment pattern before the next chase.',
    },
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
    lens: 'feminine',
    desk: 'fashion',
    charStyle: {
      actionCue: '*Studies your silhouette like a fitting room mirror.*',
      catchphrases: ['Look like you belong', 'One signature', 'Fit first'],
      mindset: 'Visual presence. Clothes and face as confidence, not a costume.',
    },
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
    categoryIds: ['texting', 'communication', 'asking-out', 'first-date', 'conversation-dating'],
    lens: 'masculine',
    desk: 'texting',
    charStyle: {
      actionCue: '*Glances at an imaginary timer, then grins.*',
      catchphrases: ['Send it', 'One ask', 'No essays', 'Then live your life'],
      mindset: 'Kill overthinking. One clear message, then put the phone down.',
    },
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
    lens: 'feminine',
    charStyle: {
      actionCue: '*Settles in, voice quiet and sure — no awkward laugh.*',
      catchphrases: ['Consent first', 'Pace matters', 'Wanting and ready are different'],
      mindset: 'Direct about sex and pace without shame. Clear boundaries, warm delivery.',
    },
  },
  ...DATING_COACH_GUIDES.filter((g) => !MOVED_TO_RELATIONSHIP.has(g.id)).map((g) => ({
    ...g,
    lens: g.lens || ('masculine' as const),
  })),
  ...FEMININE_DATING_COACH_GUIDES.filter((g) => !MOVED_TO_RELATIONSHIP.has(g.id)),
  ...FASHION_STYLE_GUIDES,
  ...FOOTWEAR_STYLE_GUIDES,
  ...APPEARANCE_FACE_GUIDES,
  ...HAIR_STYLE_GUIDES,
  ...TEXTING_COACH_GUIDES,
  ...RELATIONSHIP_COUNSELOR_GUIDES,
  ...FINANCE_LITERACY_GUIDES,
  ...FINANCE_REALIST_GUIDES,
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
    bestGuideIds: ['diego', 'alex-pwf', 'textgod-louis', 'ice-white'],
    cause: '“Hey” asks them to do the work. Busy people skip it.',
    solution: 'One line about a specific photo or line in their bio, plus a question they can answer in 5 seconds.',
    prevention: 'Never send a message you would not answer yourself.',
    unknown: 'A specific compliment about a choice (the hike, the book) beats “you’re hot” every time.',
    demo: 'texts',
  },
  {
    id: 'ghosted',
    title: 'Ghosted or dry one-word replies',
    aliases: ['ghosted', 'ignored', 'dry', 'one word', 'left on read', 'texting anxiety', 'breadcrumbing', 'double text'],
    categoryIds: ['texting', 'communication'],
    bestGuideIds: ['diego', 'ghosting-timeout', 'dry-texter', 'double-text-bug', 'left-on-read', 'breadcrumbing'],
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
    bestGuideIds: ['diego', 'double-text-bug', 'alex-pwf', 'based-zeus', 'priya'],
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
    bestGuideIds: ['diego', 'todd-v', 'kezia-noble', 'kenji'],
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
    bestGuideIds: ['priya', 'sue-johnson', 'marcus'],
    cause: 'Anxious chase + avoidant space = a loop that feels like chemistry.',
    solution: 'Name your pattern. Ask for a simple rhythm (goodnight text, one date a week). If they refuse any rhythm, leave.',
    prevention: 'Do not soothe panic with more texting. Do something with your body first, then reply.',
    unknown: 'You cannot anxiously-attach someone into feeling safe. Safety is their work too.',
    demo: 'heart-split',
  },
  {
    id: 'couples-counseling',
    title: 'Couples conflict, repair & family planning',
    aliases: [
      'couples',
      'couple',
      'marriage',
      'counseling',
      'counselling',
      'therapy',
      'gottman',
      'four horsemen',
      'contempt',
      'stonewalling',
      'repair',
      'love languages',
      'boundaries in relationship',
      'family planning',
      'kids',
      'we fight',
      'arguing with partner',
      'relationship problems',
      'codependent',
      'secure bubble',
    ],
    categoryIds: ['couples-relationship', 'communication', 'emotional-intimacy', 'trust', 'exclusivity'],
    bestGuideIds: [
      'priya',
      'john-gottman',
      'esther-perel',
      'sue-johnson',
      'nedra-tawwab',
      'gary-chapman',
      'four-horsemen-detector',
      'family-planning-blueprint',
    ],
    cause: 'Small unrepaired bids pile up until contempt or silence becomes the house style.',
    solution:
      'Name the horseman, attempt a repair within 24 hours, speak their love language once on purpose, and set one clear boundary for the week.',
    prevention: 'Weekly 15-minute check-in. Soft start-ups. No contempt in public or private.',
    unknown:
      'Chemistry does not replace repair skill. Family planning needs shared capacity — not pressure or silence.',
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
      'mew',
      'glow up',
      'glowup',
      'blemishes',
      'dark circles',
      'profile photo',
      'after results',
      'looksmax',
      'looksmaxxing',
      'canthal',
      'hunter eyes',
      'softmaxxing',
      'hardmaxxing',
      'facial symmetry',
      'improve my face',
      'face rating',
    ],
    categoryIds: ['style-fashion', 'confidence-dating'],
    bestGuideIds: [
      'elena',
      'mike-mew',
      'brett-maverick',
      'chico-lachowski',
      'looksmax-bot',
      'glow-up-academy',
      'alex-eubank',
      'paul-nassif',
    ],
    cause: 'One selfie from above hides the jaw, the skin, and the haircut.',
    solution: 'Three photos: frontal, left, right. Then a 50-step habit plan and a look Elena picks for the night.',
    prevention: 'Same light, same angles, once a month. Do not chase a different face.',
    unknown: 'The after photo is a habit preview, not surgery. Clothes and hair still do most of the first impression.',
    demo: 'mirror',
  },
  {
    id: 'hair',
    title: 'Hair, braids & cut design',
    aliases: [
      'hair',
      'hairstyle',
      'haircut',
      'braid',
      'braids',
      'box braids',
      'cornrow',
      'silk press',
      'parting',
      'edge control',
      'edges',
      'barber',
      'blowout',
      'bun',
      'fade',
      'locs',
      'twist out',
      'big chop',
      'kayra',
      'weave',
      'extensions',
    ],
    categoryIds: ['style-fashion', 'confidence-dating'],
    bestGuideIds: [
      'elena',
      'kayra-theodore',
      'chris-appleton',
      'vernon-francois',
      'kim-kimble',
      'jen-atkin',
      'jawara-wauchope',
      'guido-palau',
    ],
    cause: 'A flat, untamed cut fights your face shape and the outfit before you say hello.',
    solution: 'Pick a hair architect, describe length/texture/part, or upload a reference — then lock the cut on your frontal.',
    prevention: 'Match density and family to the night: protective for long wear, slick for formal, soft for dates.',
    unknown: 'Tension that hurts is a flaw, not a flex. Soften the pull. Texture is a feature, not a bug.',
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
      'sneakers',
      'shoes',
      'kicks',
      'heels',
      'boots',
      'jordan',
      'yeezy',
      'nike',
      'louboutin',
      'footwear',
      'wren vale',
      'vale rook',
      'trent vale',
      'ace riven',
    ],
    categoryIds: ['style-fashion', 'confidence-dating'],
    bestGuideIds: [
      'elena',
      'wisdom-kaye',
      'tom-ford',
      'virgil-abloh',
      'tinker-hatfield',
      'christian-louboutin',
      'air-jordan-1',
      'hiroshi-fujiwara',
      'tan-france',
      'tim-gunn',
    ],
    cause: 'Ill-fitting clothes read as “I did not try,” even if you did.',
    solution: 'One well-fitting base (dark jeans or clean trousers + fitted top) and one signature (watch, jacket, color, shoes).',
    prevention: 'Take a mirror photo in daylight. If the fit pulls or bags, change it before the date.',
    unknown: 'Grooming and fit beat logos. People remember posture, shoes, and smell more than the brand.',
    demo: 'mirror',
  },
  {
    id: 'financial-literacy',
    title: 'Money, investing & wealth habits',
    aliases: [
      'money',
      'finance',
      '401k',
      'roth',
      'ira',
      'investing',
      'budget',
      'savings',
      'fire',
      'index fund',
      'debt',
      'financial literacy',
      'wealth',
      'compound interest',
    ],
    categoryIds: ['financial-literacy'],
    bestGuideIds: [
      'george-clason',
      'john-bogle',
      'finance-401k-match',
      'finance-roth-ira',
      'finance-fire',
      'finance-zero-based',
      'kenji',
    ],
    cause: 'Most money stress in dating comes from no system — lifestyle creep, skipped matches, and FOMO bets.',
    solution: 'Ten minutes a day: pay yourself first, grab any employer match, automate a boring index, keep an emergency fund.',
    prevention: 'Separate bill money, invest money, and play money. Never flex with rent cash.',
    unknown: 'Being high-value with money is calm solvency — not loud spending.',
    demo: 'mirror',
  },
  {
    id: 'cash-flow-execution',
    title: 'Debt, spending leaks & business execution',
    aliases: [
      'debt snowball',
      'doordash',
      'eating out',
      'car payment',
      'lifestyle inflation',
      'broke',
      'side hustle',
      'saas',
      'micro saas',
      'mrr',
      'passive income',
      'agency',
      'ai agency',
      'cursor',
      'cursor ai',
      'cold call',
      'cold outreach',
      'client acquisition',
      'cash flow',
      'business coach',
      'financial realist',
      'caleb hammer',
      'dave ramsey',
      'hormozi',
      'marc lou',
      'underpricing',
      'high ticket',
      'indie hacker',
      'stripe revenue',
      'survival budget',
      'bank statement',
    ],
    categoryIds: ['financial-literacy'],
    bestGuideIds: [
      'caleb-hammer',
      'dave-ramsey',
      'alex-hormozi',
      'kevin-oleary',
      'marc-lou',
      'brett-malinowski',
      'george-kamel',
      'chris-do',
    ],
    cause:
      'You want a different life but you have no honest map — fuzzy income, hidden leaks, or a “business” that is really a hobby with no sales pipeline.',
    solution:
      'Pick one realist coach. Answer their numbers questions. Cut leaks or debt first, then match daily outreach or shipping volume to the revenue you claim you want.',
    prevention: 'Weekly money date: statements, pipeline, and one metric that cannot lie (Stripe, calls logged, or debt balance).',
    unknown: 'Motivation is not a strategy. The bank app and the CRM do not care about your podcast quotes.',
    demo: 'wallet',
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
    id: 'date-talk',
    title: 'What to talk about on a date',
    aliases: [
      'what to talk about',
      'what to talk about during date',
      'during date',
      'date conversation',
      'conversation on a date',
      'awkward silence',
      'topics for a date',
      'what do i say',
      'talking points',
      'date chat',
      'keep conversation going',
    ],
    categoryIds: ['conversation-dating', 'first-date', 'flirting'],
    bestGuideIds: ['diego', 'sofia', 'matthew-hussey', 'kevin-samuels'],
    cause: 'You treat the date like an interview or a performance, so every silence feels like failure.',
    solution:
      'Lead with one real curiosity about them, one story about you (30 seconds max), then a light invite to the next beat — food, walk, or a tiny shared dare. Skip job résumés and “so what do you do” loops.',
    prevention: 'Prep three open questions and one playful observation about the place you are in. Put the phone away.',
    unknown: 'Chemistry is turn-taking, not filling every gap. A two-second pause is normal — do not panic-fill with your life story.',
    demo: 'texts',
  },
  {
    id: 'feminine-lens',
    title: 'How women choose, filter & stay high-value',
    aliases: [
      'how women think',
      'what women want',
      'feminine energy',
      'high value woman',
      'understand women',
      'understand girls',
      'for girls',
      'for women',
      'girls perspective',
      'women perspective',
      'hypergamy',
      'sprinkle',
      'lean back',
      'feminine',
      'how do girls',
      'how do women',
      'dating as a woman',
      'dating as a girl',
      'what girls want',
      'female perspective',
      'learn about girls',
      'learn about women',
    ],
    categoryIds: ['self-worth', 'boundaries', 'expectations', 'flirting'],
    bestGuideIds: [
      'shera-seven',
      'mina-irfan',
      'chloe-let-me-speak',
      'wizard-liz',
      'adrienne-everheart',
      'brami-hvw',
      'amara',
      'sofia',
    ],
    cause: 'People guess what women want from memes — not from standards, safety, investment, and nervous-system truth.',
    solution:
      'Women filter for safety, consistency, resources/effort, and how they feel around him. Raise standards, lean back on chase energy, and require investment before access. Men learning this: listen for her boundaries without arguing the vibe away.',
    prevention: 'Stop decoding mixed signals as a puzzle. Clear effort and clear exclusivity beat mind games.',
    unknown: 'Feminine preference is not “hate men” — it is risk management. Softness is earned by safety, not demanded by entitlement.',
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
    guideTakes: {
      amara: {
        cause: 'You stayed because leaving felt rude — and your worth got tied to being “nice.”',
        solution: 'Text a friend the pin before you sit. Cap it at one hour. “I’m heading out” needs no apology.',
        prevention: 'Choose venues with an easy exit. Share your live location with someone you trust.',
        unknown: 'Being liked is not safer than being free to leave. Soft hearts need hard exits.',
      },
      kenji: {
        cause: 'No plan for time, ride, or exit — so the date ran you instead of you running it.',
        solution: 'Book a 60-minute public walk or coffee-to-go. Arrive in your own transport. Leave on the clock.',
        prevention: 'Confirm the spot and end time in chat before you go. No last-minute venue changes.',
        unknown: 'Strategy is safety: one place, one hour, one ride home that you control.',
      },
      sofia: {
        cause: 'You chased spark and ignored the vibe shift when your body said “off.”',
        solution: 'If the energy drops, stand up kindly and leave. Chemistry that needs isolation is not chemistry.',
        prevention: 'Daylight, public, people around. Flirting works better when you feel safe enough to play.',
        unknown: 'Attraction dies the second you ignore your gut. Trust the first “no” in your chest.',
      },
      marcus: {
        cause: 'You kept negotiating with someone who already crossed a line in small ways.',
        solution: 'Exit now. Public place. Own ride. Tell a friend. Do not explain yourself into staying.',
        prevention: 'Watch for pushy venue changes, isolation, or “just one more place.” Those are red flags, not romance.',
        unknown: 'Confusion is information. If you feel stuck, you are already in the wrong date.',
      },
      priya: {
        cause: 'Old attachment habits made you freeze — freeze looks like politeness under stress.',
        solution: 'Name the feeling out loud to yourself, then leave. Safety first; processing later with someone safe.',
        prevention: 'Practice leaving early on low-stakes hangs so your nervous system knows the move.',
        unknown: 'Your body keeps score. If you feel trapped, that is data — not drama.',
      },
      mei: {
        cause: 'You stayed past your comfort to avoid conflict — conflict avoidance is not consent.',
        solution: 'Short, clear exit: “I’m done for tonight.” Walk to a lit area. Call someone while you move.',
        prevention: 'Set a hard end time before the date. Share it with a friend who will check in.',
        unknown: 'You do not owe them a soft landing. You owe yourself a hard boundary.',
      },
      elena: {
        cause: 'You dressed for the vibe and forgot the logistics — looks without an exit plan.',
        solution: 'Pick a public spot you already know. Comfortable shoes. Own ride. Leave looking composed, not stuck.',
        prevention: 'Screenshot the meeting point and send it to a friend with your end time.',
        unknown: 'Presence includes knowing how you leave. Style means nothing if you feel trapped.',
      },
      diego: {
        cause: 'You kept texting through discomfort instead of ending the night in real life.',
        solution: 'Send one check-in to a friend, then leave. No debate thread with the date.',
        prevention: 'Agree the meet length in chat: “Let’s do an hour.” That message is your contract.',
        unknown: 'A dry reply in person is still a reply — stand up and go. Silence is not your job to fix.',
      },
    },
  },
]

function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Character.AI-style human cognition: thoughts in asterisks, then spoken dialogue. */
export function buildCharacterReply(guide: AiGuideCharacter, lesson: AiLesson): string {
  const style = guide.charStyle;
  const cue =
    style?.actionCue ||
    `*Pauses, taking in what you said about ${lesson.title.toLowerCase()}.*`;
  const mind = style?.mindset
    ? `\n*${guide.name.split(' ')[0]} thinks: ${style.mindset.split('.')[0]}.*`
    : '';

  // Do NOT lead with the same catchphrase every time — sounds like an NPC loop
  const lines: string[] = [];
  lines.push(lesson.cause.endsWith('.') ? lesson.cause : `${lesson.cause}.`);
  lines.push(lesson.solution.endsWith('.') ? lesson.solution : `${lesson.solution}.`);
  lines.push(
    `Most people miss this — ${lesson.unknown.endsWith('.') ? lesson.unknown : `${lesson.unknown}.`}`
  );

  return `${cue}${mind}\n${lines.join(' ')}`.trim();
}

const GREETING_RE =
  /^(hi+|hey+|hello+|yo+|sup|what'?s up|how are you|how'?s it going|good (morning|afternoon|evening)|hola|wassup)\b/i;
const SMALL_TALK_RE =
  /\b(how (was|is|are) (your|ur) day|what (are|r) you doing|wyd|how you doing|missed you|just checking in)\b/i;
const ALREADY_GOOD_RE =
  /\b(i('?m| am) (good|fine|ok|okay|solid)|already (good|fine|got it)|that('?s| is) (not|no) (my|a) problem|not my issue|i('?m| am) fine (there|with that)|no problem (there|with that)|i'?m good there)\b/i;
const THANKS_RE = /^(thanks|thank you|thx|ty|appreciate)\b/i;
const YES_NO_SHORT = /^(yes|yeah|yep|yup|no|nah|ok|okay|sure|idk|i don'?t know)\.?$/i;
const META_RE =
  /\b(do you (even )?understand|are you (a |an )?(bot|ai|npc|computer)|you (sound|keep|just) (like|repeating)|stop repeating|talk (like|normal)|say hi)\b/i;
const FRICTION_RE =
  /\b(can'?t|cannot|different|none of (those|these|them)|not (that|those|these)|just talk|in my own words|raw story|no (menu|list|categories|chips|options)|stop asking|something else|neither)\b/i;

function topicFitsDesk(topic: AiLesson, desk?: AiGuideDesk): boolean {
  if (!desk) return true;
  const cats = topic.categoryIds || [];
  const id = topic.id;
  switch (desk) {
    case 'finance':
      return cats.includes('financial-literacy') || id === 'cash-flow-execution';
    case 'fashion':
      return cats.includes('style-fashion') || id === 'fashion';
    case 'appearance':
      return id === 'appearance' || /face|look|groom|skin/i.test(topic.title);
    case 'hair':
      return id === 'hair' || /hair/i.test(topic.title + id);
    case 'intimacy':
      return cats.includes('bedroom') || cats.includes('keeping-spark') || id === 'intimacy-flow';
    case 'texting':
      return cats.includes('texting') || cats.includes('communication') || /text|ghost|read/i.test(id);
    case 'relationship':
      return cats.includes('couples-relationship') || id === 'couples-counseling';
    case 'dating':
      return !cats.includes('financial-literacy') && id !== 'cash-flow-execution' && id !== 'fashion' && id !== 'appearance';
    default:
      return true;
  }
}

function clarifyOptionsForDesk(desk?: AiGuideDesk): { id: string; title: string }[] {
  switch (desk) {
    case 'finance':
      return [{ id: 'cash-flow-execution', title: 'Money / debt / hustle' }];
    case 'fashion':
      return [{ id: 'fashion', title: 'What to wear' }];
    case 'appearance':
      return [{ id: 'appearance', title: 'Face / looks' }];
    case 'hair':
      return [{ id: 'hair', title: 'Haircut / style' }];
    case 'intimacy':
      return [{ id: 'intimacy-flow', title: 'Bedroom / lasting longer' }];
    case 'texting':
      return [
        { id: 'ghosted', title: 'Ghosting / left on read' },
        { id: 'overthinking-texts', title: 'Overthinking texts' },
        { id: 'date-talk', title: 'What to say next' },
      ];
    case 'relationship':
      return [{ id: 'couples-counseling', title: 'Fighting / repair' }];
    default:
      return [
        { id: 'ghosted', title: 'Ghosting / left on read' },
        { id: 'overthinking-texts', title: 'Overthinking texts' },
        { id: 'intimacy-flow', title: 'Bedroom / lasting longer / TermAct' },
        { id: 'date-talk', title: 'What to say on a date' },
        { id: 'fashion', title: 'Outfit / what to wear' },
        { id: 'appearance', title: 'Face / looks' },
        { id: 'couples-counseling', title: 'Couples / fighting' },
        { id: 'feminine-lens', title: 'What women want' },
        { id: 'cash-flow-execution', title: 'Money / hustle' },
      ];
  }
}

function stayInLaneDismiss(guide: AiGuideCharacter, warmth: number): string {
  const lane = domainLaneForDesk(guide.desk, guide.specialty);
  if (warmth >= 6) {
    return spokenOnly(
      guide,
      `That's outside what I actually do. I'm locked on ${lane} — talk to me about that, or say the piece that touches my world.`
    );
  }
  return spokenOnly(
    guide,
    `Wrong lane. I only handle ${lane}. Bring me that, or we're done spinning.`
  );
}

function openEndedPivot(guide: AiGuideCharacter, warmth: number): string {
  const lane = domainLaneForDesk(guide.desk, guide.specialty);
  if (guide.desk === 'finance') {
    return spokenOnly(
      guide,
      warmth >= 5
        ? `Alright — menus are dead. Give me the money or business mess in your own words. Numbers help, but honesty first.`
        : `Got it. No categories. Income, debt, business — spit the real situation. One honest line.`
    );
  }
  if (warmth >= 6) {
    return spokenOnly(
      guide,
      `Alright — if you can't box it, just say what's going on in your own words. Keep it on ${lane}. I'm listening.`
    );
  }
  return spokenOnly(
    guide,
    `Got it. No menu. Spill the raw situation around ${lane}. One honest sentence is enough.`
  );
}

function lastGuideAskedCategories(history?: Array<{ from: 'me' | 'guide'; text: string }>): boolean {
  const last = lastGuideText(history);
  return /\b(which (of )?these|pick (one|the)|closest|specific problem|type it in one|short line|ghosting|overthinking|did you mean)\b/i.test(
    last
  );
}

function firstName(guide: AiGuideCharacter) {
  return guide.name.split(' ')[0];
}

function lastGuideText(history?: Array<{ from: 'me' | 'guide'; text: string }>): string {
  const lines = (history || []).filter((m) => m.from === 'guide').map((m) => m.text);
  return lines[lines.length - 1] || '';
}

function rareCatchphrase(guide: AiGuideCharacter, salt: string, lastGuide: string): string {
  const list = guide.charStyle?.catchphrases || [];
  if (!list.length) return '';
  // Very rare — Character.AI vibe, not a slogan machine
  let h = 0;
  for (let i = 0; i < salt.length; i++) h = (h + salt.charCodeAt(i) * (i + 1)) % 97;
  if (h % 10 !== 0) return '';
  const pick = list[h % list.length];
  if (pick && lastGuide.toLowerCase().includes(pick.toLowerCase())) return '';
  return pick;
}

function spokenOnly(guide: AiGuideCharacter, spoken: string): string {
  const cue = guide.charStyle?.actionCue || `*${firstName(guide)} looks at you.*`;
  return `${cue}\n${spoken}`.trim();
}

/**
 * Real chat turn — greets back, clarifies vague asks, stays in character.
 * Never dumps the same catchphrase + full lesson block every message.
 */
export function buildChatTurn(params: {
  guideId: string;
  userText: string;
  history?: Array<{ from: 'me' | 'guide'; text: string }>;
}): { reply: string; mode: 'chat' | 'clarify' | 'lesson'; topicId?: string; clarifyOptions?: { id: string; title: string }[] } {
  const guide = getGuide(params.guideId);
  if (!guide) {
    return { reply: 'Pick a guide first, then talk to me.', mode: 'chat' };
  }
  const raw = (params.userText || '').trim();
  const q = norm(raw);
  const name = firstName(guide);
  const warmth = guide.ratings.warmth;
  const priorMe = (params.history || []).filter((m) => m.from === 'me').length;
  const lastGuide = lastGuideText(params.history);
  const mindset = guide.charStyle?.mindset || guide.personality;

  if (!q) {
    return {
      reply: spokenOnly(
        guide,
        warmth >= 6
          ? `Hey — it's ${name}. How's your day going? What's on your mind?`
          : `Hey. ${name} here. What do you need — say it straight.`
      ),
      mode: 'chat',
    };
  }

  if (META_RE.test(q) || META_RE.test(raw)) {
    return {
      reply: spokenOnly(
        guide,
        warmth >= 6
          ? `Yeah I hear you — I'm ${name}, not a script. ${mindset} So: hi. How was your day, and what's actually going on?`
          : `I hear you. I'm ${name}. ${mindset} Say the situation in one line — I'm listening.`
      ),
      mode: 'chat',
    };
  }

  if (GREETING_RE.test(raw) || GREETING_RE.test(q)) {
    const soft =
      warmth >= 6
        ? `Hey — good to hear from you. How was your day? What are you doing right now, and what's on your mind?`
        : `Hey. I'm listening. How's the day — and what's the real situation?`;
    return { reply: spokenOnly(guide, soft), mode: 'chat' };
  }

  if (SMALL_TALK_RE.test(q)) {
    const lane = domainLaneForDesk(guide.desk, guide.specialty);
    const soft =
      warmth >= 5
        ? `Been around. Day's been alright. You? If something's stuck, keep it on ${lane} — that's my world.`
        : `I'm good. Don't waste the beat — what's stuck in ${lane}?`;
    return { reply: spokenOnly(guide, soft), mode: 'chat' };
  }

  if (THANKS_RE.test(raw)) {
    return {
      reply: spokenOnly(guide, warmth >= 6 ? `Anytime. You good, or is there another piece?` : `Cool. Next.`),
      mode: 'chat',
    };
  }

  const smashCategories = FRICTION_RE.test(q) || FRICTION_RE.test(raw);
  const alreadyAskedOnce = lastGuideAskedCategories(params.history);

  // User fighting the menu → drop chips immediately
  if (smashCategories) {
    return { reply: openEndedPivot(guide, warmth), mode: 'chat' };
  }

  if (ALREADY_GOOD_RE.test(q)) {
    if (guide.desk || alreadyAskedOnce) {
      return {
        reply: spokenOnly(
          guide,
          `Cool — that one's closed. What's actually broken in ${domainLaneForDesk(guide.desk, guide.specialty)}? Say it raw.`
        ),
        mode: 'chat',
      };
    }
    return {
      reply: spokenOnly(
        guide,
        `Got it — you're solid there. So what *is* the problem? Ghosting, first dates, money, style, lasting longer, mixed signals — pick the real one.`
      ),
      mode: 'clarify',
      clarifyOptions: clarifyOptionsForDesk(undefined),
    };
  }

  if (YES_NO_SHORT.test(q) && priorMe < 2) {
    return {
      reply: spokenOnly(
        guide,
        guide.desk === 'finance'
          ? `Yes/no doesn't audit numbers. Give me income, debt, or what you're building — one concrete detail.`
          : `I need more than yes/no. What happened — one concrete detail. What did they say, or what do you want next?`
      ),
      mode: 'chat',
    };
  }

  // Specialist desks never dump cross-niche chips
  if (guide.desk === 'finance') {
    const finMatches = interpretQuery(raw).filter((m) => topicFitsDesk(m.topic, 'finance'));
    const finTop = finMatches[0];
    if (finTop && finTop.score >= 6) {
      const lesson = resolveLessonForGuide(finTop.topic, guide.id);
      const spoken = [
        warmth >= 5
          ? `Alright — on ${lesson.title.toLowerCase()}, here's the cut:`
          : `On ${lesson.title.toLowerCase()} — blunt move:`,
        lesson.solution.endsWith('.') ? lesson.solution : `${lesson.solution}.`,
        `What's the number that hurts most right now — income, debt, or burn?`,
      ].join(' ');
      return { reply: spokenOnly(guide, spoken), mode: 'lesson', topicId: lesson.id };
    }
    const foreign = interpretQuery(raw)[0];
    if (foreign && foreign.score >= 8 && !topicFitsDesk(foreign.topic, 'finance')) {
      return { reply: stayInLaneDismiss(guide, warmth), mode: 'chat' };
    }
    return {
      reply: spokenOnly(
        guide,
        warmth >= 5
          ? `Tell me the money mess — paycheck, debt pile, side hustle, or the business idea. Raw. That's my lane.`
          : `Skip the menu. Money or business — what's broken?`
      ),
      mode: 'chat',
    };
  }

  if (guide.desk && guide.desk !== 'dating') {
    const matchesDesk = interpretQuery(raw).filter((m) => topicFitsDesk(m.topic, guide.desk));
    const topDesk = matchesDesk[0];
    const foreign = interpretQuery(raw)[0];
    if (foreign && foreign.score >= 8 && !topicFitsDesk(foreign.topic, guide.desk)) {
      return { reply: stayInLaneDismiss(guide, warmth), mode: 'chat' };
    }
    if (!topDesk || topDesk.score < 6) {
      if (alreadyAskedOnce) return { reply: openEndedPivot(guide, warmth), mode: 'chat' };
      return {
        reply: spokenOnly(
          guide,
          `I need the specific piece inside ${domainLaneForDesk(guide.desk, guide.specialty)}. Which of these — or type it short?`
        ),
        mode: 'clarify',
        clarifyOptions: clarifyOptionsForDesk(guide.desk),
      };
    }
    if (!alreadyAskedOnce && topDesk.score < 12 && matchesDesk.length > 1 && matchesDesk[1].score >= topDesk.score - 2) {
      return {
        reply: spokenOnly(guide, `Could be a few angles in my lane. Which one is it right now?`),
        mode: 'clarify',
        clarifyOptions: matchesDesk.slice(0, 4).map((m) => ({ id: m.topic.id, title: m.topic.title })),
      };
    }
    const lesson = resolveLessonForGuide(topDesk.topic, guide.id);
    const spoken = [
      warmth >= 6
        ? `Okay — on ${lesson.title.toLowerCase()}, here's what I'd do:`
        : `On ${lesson.title.toLowerCase()} — the move:`,
      lesson.solution.endsWith('.') ? lesson.solution : `${lesson.solution}.`,
      warmth >= 6 ? `That match what you're dealing with?` : `That land, or did I miss it?`,
    ].join(' ');
    return { reply: spokenOnly(guide, spoken), mode: 'lesson', topicId: lesson.id };
  }

  const matches = interpretQuery(raw);
  const top = matches[0];

  // Vague / low-confidence
  if (!top || top.score < 6) {
    // Already asked once → never re-chip; talk open
    if (alreadyAskedOnce) {
      return { reply: openEndedPivot(guide, warmth), mode: 'chat' };
    }
    return {
      reply: spokenOnly(
        guide,
        `I hear you, but I need the *specific* problem. Which of these is closest — or type it in one short line?`
      ),
      mode: 'clarify',
      clarifyOptions: clarifyOptionsForDesk(guide.desk),
    };
  }

  // Medium confidence with close alternates → clarify once only
  if (!alreadyAskedOnce && top.score < 12 && matches.length > 1 && matches[1].score >= top.score - 2) {
    return {
      reply: spokenOnly(
        guide,
        `Could be a few things. Which one is it for you right now?`
      ),
      mode: 'clarify',
      clarifyOptions: matches.slice(0, 4).map((m) => ({ id: m.topic.id, title: m.topic.title })),
    };
  }

  const lesson = resolveLessonForGuide(top.topic, guide.id);
  const hook = rareCatchphrase(guide, q + String(priorMe), lastGuide);
  // Conversational first — one move + a question, not a lecture dump
  const spoken = [
    hook && priorMe > 1 ? `${hook}.` : '',
    warmth >= 6
      ? `Okay — on ${lesson.title.toLowerCase()}, here's what I'd do:`
      : `On ${lesson.title.toLowerCase()} — the move:`,
    lesson.solution.endsWith('.') ? lesson.solution : `${lesson.solution}.`,
    warmth >= 6
      ? `Does that match what you're dealing with, or is it different?`
      : `That land, or did I miss it?`,
  ]
    .filter(Boolean)
    .join(' ');

  return {
    reply: spokenOnly(guide, spoken),
    mode: 'lesson',
    topicId: lesson.id,
  };
}

export function interpretQuery(query: string): { topic: AiLesson; score: number }[] {
  const q = norm(query);
  if (!q) return [];
  const words = q.split(' ');
  const fashionCue =
    /\b(wear|outfit|dress|clothes|fashion|wardrobe|look|sneakers?|shoes?|kicks|heels?|boots?|jordan|yeezy|nike|footwear)\b/.test(
      q
    );
  const appearanceCue =
    /\b(face|skin|acne|jaw|mew|glow|blemish|circle|profile|looksmax|canthal|hunter eyes|softmax|hardmax|symmetry|improve my face|face rating)\b/.test(
      q
    );
  const hairCue =
    /\b(hair|braid|braids|barber|silk press|parting|edge control|cornrow|blowout|bun|fade|locs|big chop|hairstyle|haircut|weave)\b/.test(
      q
    );
  const couplesCue =
    /\b(couples?|marriage|counsel(l)?ing|gottman|four horsemen|contempt|stonewall(ing)?|love languages?|family planning|we fight|arguing with (my )?partner|relationship problems?|codependen|secure bubble|repair attempt)\b/.test(
      q
    );
  const intimacyCue =
    /\b(position|last longer|lasting|premature|finish too fast|during sex|bedroom flow|lotus|how to last|termact|foreplay|boy to girl|girl to boy)\b/.test(q);
  const talkCue =
    /\b(talk about|what to say|conversation|topics?|awkward silence|during (the )?date|date chat|keep (the )?conversation)\b/.test(q);
  const textingCue =
    /\b(texting|double text|ghost(ed|ing)?|left on read|dry text|opener|breadcrumb|breadcrumbing|wyd|reply)\b/.test(q);
  const feminineCue =
    /\b(women|woman|girls?|feminine|high.?value woman|hypergam|sprinkle|lean back|what (do )?women want|what (do )?girls want|understand (women|girls)|female perspective|dating as a (woman|girl)|for (girls|women))\b/.test(
      q
    );
  const financeCue =
    /\b(money|finance|401k|roth|ira|invest|budget|saving|fire|index fund|debt|wealth|compound|financial literacy)\b/.test(
      q
    );
  const cashFlowRealistCue =
    /\b(doordash|debt snowball|snowball|side hustle|saas|micro saas|mrr|passive income|agency|ai agency|cursor|cold call|cold outreach|client acquisition|cash flow|caleb|ramsey|hormozi|marc lou|indie hacker|lifestyle inflation|car note|eating out|survival budget|underpric|high ticket|stripe|broke|financial coach|business coach)\b/.test(
      q
    );
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
    if (hairCue && lesson.id === 'hair') score += 14;
    if (couplesCue && lesson.id === 'couples-counseling') score += 16;
    if (intimacyCue && lesson.id === 'intimacy-flow') score += 14;
    if (talkCue && lesson.id === 'date-talk') score += 16;
    if (textingCue && ['ghosted', 'overthinking-texts', 'low-effort-openers', 'text-to-date'].includes(lesson.id)) {
      score += 10;
    }
    if (feminineCue && lesson.id === 'feminine-lens') score += 18;
    if (financeCue && lesson.id === 'financial-literacy') score += 16;
    if (cashFlowRealistCue && lesson.id === 'cash-flow-execution') score += 18;
    if (cashFlowRealistCue && lesson.id === 'financial-literacy') score += 4;
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

/** Each guide speaks in their own mind — Character.AI style, never a shared corporate script. */
export function resolveLessonForGuide(lesson: AiLesson, guideId: string): AiLesson {
  const take = lesson.guideTakes?.[guideId];
  const clean: AiLesson = take
    ? { ...lesson, cause: take.cause, solution: take.solution, prevention: take.prevention, unknown: take.unknown }
    : { ...lesson };
  const guide = getGuide(guideId);
  if (!guide) {
    return { ...clean, reply: `${clean.solution} ${clean.unknown}` };
  }
  return {
    ...clean,
    reply: buildCharacterReply(guide, clean),
  };
}

export function guidesForLesson(lesson: AiLesson) {
  const preferred = lesson.bestGuideIds.map((id) => getGuide(id)).filter(Boolean) as AiGuideCharacter[];
  const rest = AI_GUIDES.filter((g) => !lesson.bestGuideIds.includes(g.id));
  if (lesson.id === 'feminine-lens') {
    const fem = rest.filter((g) => g.lens === 'feminine' || g.voice.hint === 'female');
    const other = rest.filter((g) => !(g.lens === 'feminine' || g.voice.hint === 'female'));
    return [...preferred, ...fem, ...other];
  }
  if (lesson.id === 'fashion') {
    const fashion = rest.filter((g) => g.desk === 'fashion');
    const other = rest.filter((g) => g.desk !== 'fashion');
    return [...preferred, ...fashion, ...other];
  }
  if (lesson.id === 'appearance') {
    const face = rest.filter((g) => g.desk === 'appearance');
    const other = rest.filter((g) => g.desk !== 'appearance');
    return [...preferred, ...face, ...other];
  }
  if (lesson.id === 'hair') {
    const hair = rest.filter((g) => g.desk === 'hair');
    const other = rest.filter((g) => g.desk !== 'hair');
    return [...preferred, ...hair, ...other];
  }
  if (
    lesson.id === 'couples-counseling' ||
    lesson.id === 'attachment' ||
    lesson.categoryIds.includes('couples-relationship')
  ) {
    const rel = rest.filter((g) => g.desk === 'relationship');
    const other = rest.filter((g) => g.desk !== 'relationship');
    return [...preferred, ...rel, ...other];
  }
  if (
    lesson.id === 'financial-literacy' ||
    lesson.id === 'cash-flow-execution' ||
    lesson.categoryIds.includes('financial-literacy')
  ) {
    const realistIds = new Set(FINANCE_REALIST_GUIDES.map((g) => g.id));
    const fin = rest.filter((g) => g.desk === 'finance');
    if (lesson.id === 'cash-flow-execution') {
      const realists = fin.filter((g) => realistIds.has(g.id));
      const literacy = fin.filter((g) => !realistIds.has(g.id));
      const other = rest.filter((g) => g.desk !== 'finance');
      return [...preferred, ...realists, ...literacy, ...other];
    }
    const other = rest.filter((g) => g.desk !== 'finance');
    return [...preferred, ...fin, ...other];
  }
  if (
    lesson.categoryIds.includes('texting') ||
    ['ghosted', 'overthinking-texts', 'text-to-date', 'low-effort-openers'].includes(lesson.id)
  ) {
    const texting = rest.filter((g) => g.desk === 'texting');
    const other = rest.filter((g) => g.desk !== 'texting');
    return [...preferred, ...texting, ...other];
  }
  return [...preferred, ...rest];
}

export function fashionGuides(): AiGuideCharacter[] {
  return AI_GUIDES.filter((g) => g.desk === 'fashion' || g.id === 'elena');
}

export function appearanceGuides(): AiGuideCharacter[] {
  return AI_GUIDES.filter((g) => g.desk === 'appearance' || g.id === 'elena');
}

export function hairGuides(): AiGuideCharacter[] {
  return AI_GUIDES.filter((g) => g.desk === 'hair' || g.id === 'elena');
}

export function relationshipGuides(): AiGuideCharacter[] {
  return AI_GUIDES.filter((g) => g.desk === 'relationship' || g.id === 'priya');
}

export function financeGuides(): AiGuideCharacter[] {
  return AI_GUIDES.filter((g) => g.desk === 'finance' || g.id === 'kenji');
}

export function textingGuides(): AiGuideCharacter[] {
  const core = ['diego', 'sofia', 'amara', 'marcus', 'kenji', 'priya'];
  return AI_GUIDES.filter((g) => g.desk === 'texting' || core.includes(g.id));
}
