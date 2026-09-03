/**
 * Fallback list when GET /api/improvement/categories fails (e.g. Vercel without backend URL, CORS, offline).
 * MUST stay in sync with server/src/models/improvement.ts → IMPROVEMENT_CATEGORIES (same ids).
 * (No import from api/improvement — avoids circular dependency.)
 */
export const DEFAULT_IMPROVEMENT_CATEGORIES: Array<{
  id: string;
  name: string;
  description: string;
  icon: string;
}> = [
  { id: 'style-fashion', name: 'Style & Fashion', description: 'Build your personal style, grooming, and wardrobe confidence', icon: '👔' },
  { id: 'communication', name: 'Communication in Relationships', description: 'Express yourself clearly and listen better with your partner', icon: '💬' },
  { id: 'texting', name: 'Texting & DMs', description: 'Master texting, when to reply, and keeping the spark over messages', icon: '📱' },
  { id: 'bedroom', name: 'Bedroom & Intimacy', description: 'Improve intimacy, connection, and address bedroom concerns', icon: '💕' },
  { id: 'keeping-partner', name: 'Keeping a Girlfriend or Boyfriend', description: 'Build a lasting relationship and avoid common breakup pitfalls', icon: '💑' },
  { id: 'couples-relationship', name: 'Couples in a Relationship', description: 'For people already together — get a guide for relationship problems, and apply here if you are good at helping couples', icon: '💞' },
  { id: 'relationship-problems', name: 'Relationship Problems', description: 'Work through trust, jealousy, distance, or recurring arguments', icon: '🔄' },
  { id: 'conflict-couples', name: 'Fighting & Conflict in Relationships', description: 'Handle disagreements without damaging the relationship', icon: '🤝' },
  { id: 'trust', name: 'Trust & Honesty', description: 'Build trust, be transparent, and repair it when it\'s broken', icon: '🔐' },
  { id: 'jealousy', name: 'Managing Jealousy', description: 'Deal with jealousy and insecurity in a healthy way', icon: '😤' },
  { id: 'first-date', name: 'First Dates', description: 'Plan first dates, make a great impression, and reduce nerves', icon: '🎯' },
  { id: 'asking-out', name: 'Asking Someone Out', description: 'Get the confidence and approach to ask someone out', icon: '🌹' },
  { id: 'flirting', name: 'Flirting & Attraction', description: 'Show interest, read signals, and flirt without being awkward', icon: '😉' },
  { id: 'conversation-dating', name: 'Conversation on Dates', description: 'Keep dates fun with good conversation and no awkward silences', icon: '🗣️' },
  { id: 'body-language-dating', name: 'Body Language & Signals', description: 'Read and send the right non-verbal cues when dating', icon: '👀' },
  { id: 'rejection', name: 'Handling Rejection', description: 'Bounce back from rejection and keep your confidence', icon: '💪' },
  { id: 'confidence-dating', name: 'Dating Confidence', description: 'Feel confident approaching people and going on dates', icon: '✨' },
  { id: 'emotional-intimacy', name: 'Emotional Intimacy', description: 'Open up, be vulnerable, and connect on a deeper level', icon: '🧠' },
  { id: 'long-distance', name: 'Long-Distance Relationships', description: 'Keep the connection strong when you\'re apart', icon: '✈️' },
  { id: 'boundaries', name: 'Setting Boundaries', description: 'Know your limits and communicate them in relationships', icon: '🚧' },
  { id: 'expectations', name: 'Expectations & Compatibility', description: 'Align expectations and know when you\'re compatible', icon: '⚖️' },
  { id: 'getting-back', name: 'Getting Back Together', description: 'Navigate getting back with an ex or fixing a broken relationship', icon: '🔄' },
  { id: 'moving-on', name: 'Moving On & Letting Go', description: 'Heal after a breakup and get ready to date again', icon: '🌅' },
  { id: 'exclusivity', name: 'Exclusivity & Defining the Relationship', description: 'Have the "what are we?" talk and define the relationship', icon: '💍' },
  { id: 'meeting-family', name: 'Meeting Family & Friends', description: 'Make a good impression when meeting their circle', icon: '👨‍👩‍👧‍👦' },
  { id: 'quality-time', name: 'Quality Time & Dates', description: 'Plan meaningful dates and spend quality time together', icon: '📅' },
  { id: 'apologies', name: 'Apologizing & Making Up', description: 'Say sorry the right way and repair after a fight', icon: '🙏' },
  { id: 'support-partner', name: 'Supporting Your Partner', description: 'Be there for your partner through tough times', icon: '🤗' },
  { id: 'keeping-spark', name: 'Keeping the Spark Alive', description: 'Avoid the relationship going stale and keep romance alive', icon: '🔥' },
  { id: 'dating-apps', name: 'Dating Apps & Profiles', description: 'Create a great profile and chat effectively on apps', icon: '📲' },
  { id: 'red-flags', name: 'Spotting Red Flags', description: 'Recognize unhealthy patterns and when to walk away', icon: '🚩' },
  { id: 'self-worth', name: 'Self-Worth in Dating', description: 'Value yourself and avoid settling or people-pleasing', icon: '💎' },
];

export const COUPLE_GUIDE_CATEGORY_IDS: string[] = [
  'couples-relationship',
  'relationship-problems',
  'keeping-partner',
  'conflict-couples',
  'communication',
  'trust',
  'jealousy',
  'keeping-spark',
  'apologies',
  'emotional-intimacy',
  'quality-time',
  'support-partner',
];
