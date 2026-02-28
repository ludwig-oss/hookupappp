/** Relationship tip of the day – proven advice. One per day (by day index). */
export const RELATIONSHIP_TIPS = [
  "Small gestures matter. A random 'thinking of you' text can brighten your partner's day.",
  "Listen to understand, not to reply. Validation goes a long way in arguments.",
  "Schedule quality time. Life gets busy; protect your couple time like a meeting.",
  "Say thank you for the little things. It keeps appreciation alive.",
  "Give each other space. Healthy relationships need trust and independence.",
  "Address issues early. Resentment grows when small things are left unsaid.",
  "Celebrate each other's wins. Be your partner's biggest fan.",
  "Apologize when you're wrong. A sincere sorry can defuse conflict quickly.",
  "Keep dating. Plan surprises and date nights even after years together.",
  "Touch often. Non-sexual affection (hand-holding, hugs) builds connection.",
  "Share your goals. Couples who align on the future stay stronger.",
  "Laugh together. Humor is one of the strongest bonds.",
  "Don't assume – ask. 'What did you mean?' prevents misunderstandings.",
  "Forgive and let go. Holding grudges erodes trust over time.",
  "Support their hobbies. Showing interest in what they love shows you care.",
  "Communicate needs clearly. Your partner isn't a mind reader.",
  "Put phones away during quality time. Presence matters more than notifications.",
  "Remember why you chose them. Revisit good memories when times get tough.",
  "Compromise isn't losing. It's both people winning a little.",
  "Say 'I love you' in their language – words, time, gifts, acts, touch.",
  "Handle conflict in private. Never embarrass your partner in front of others.",
  "Take responsibility for your part. It takes two to argue.",
  "Create rituals. Morning coffee together or Sunday walks build consistency.",
  "Stay curious about them. People change; keep asking and listening.",
  "Protect the relationship from outside negativity. You're a team.",
  "Express appreciation out loud. Don't assume they know you're grateful.",
  "Give the benefit of the doubt. Assume good intent when possible.",
  "Keep the friendship. The best partners are also best friends.",
  "Respect boundaries. Everyone needs personal space and privacy.",
  "Work on yourself. A better you makes a better us.",
];

/** Proven dating/relationship solutions by problem keyword. Shown when user says things aren't going well. */
export const RELATIONSHIP_SOLUTIONS: Record<string, string[]> = {
  communication: [
    "Set a weekly 15-minute 'check-in' where you both share one thing that went well and one thing that bothered you.",
    "Use 'I feel...' statements instead of 'You always...' to reduce defensiveness.",
    "Try the 10-minute rule: each person talks for 10 minutes without interruption while the other only listens.",
    "Consider couples therapy or a communication workshop – experts can give tools that stick.",
  ],
  boring: [
    "Plan one new activity together per week – a new restaurant, game, or walk in a new area.",
    "Ask each other 'Would you rather' or 'What's something you've never told me?' to spark conversation.",
    "Create a shared bucket list and pick one item to do this month.",
    "Switch off who plans date night – surprise each other.",
  ],
  arguing: [
    "Take a 20-minute cool-off before continuing the conversation. Set a timer and come back.",
    "Focus on one issue at a time. Don't bring up past fights in the current one.",
    "Try writing your side in a message first – it forces clarity and reduces heat.",
    "Consider a neutral phrase like 'I need a pause' so both know to step back without blame.",
  ],
  trust: [
    "Be consistent: do what you say and say what you mean. Trust is built in small, repeated actions.",
    "Share your schedule and check in when plans change – not as surveillance, but as respect.",
    "If something broke trust, agree on one concrete action to rebuild (e.g. more transparency, therapy).",
    "Give it time. Rebuilding trust often takes longer than the incident that broke it.",
  ],
  distance: [
    "Schedule a daily 5-minute call or video chat, even when busy.",
    "Send voice notes or short videos so they hear and see you, not just text.",
    "Plan the next visit or trip together so you have something to look forward to.",
    "Do the same activity 'together' from afar – watch the same movie and text during it.",
  ],
  jealousy: [
    "Talk about what triggers jealousy without accusing. Often it's insecurity, not the partner's behavior.",
    "Agree on boundaries you're both comfortable with (e.g. what's okay with exes, friends).",
    "Reassure each other with words and actions. Sometimes 'I choose you' needs to be said and shown.",
    "If it's severe, consider individual therapy – jealousy often stems from past experiences.",
  ],
  default: [
    "Schedule a calm, distraction-free time to talk about what's not working. One topic at a time.",
    "Write down what you appreciate about your partner before the conversation – it helps balance criticism.",
    "Consider talking to a relationship counselor. Even a few sessions can give you new tools.",
    "Ask: 'What do you need from me right now?' and really listen to the answer.",
  ],
};

/** Conversation topic suggestions when chat is quiet or boring. */
export const TOPIC_SUGGESTIONS = [
  "What's one thing you're looking forward to this week?",
  "If we could take a trip anywhere next month, where would you pick?",
  "What's a song that always puts you in a good mood?",
  "What's something you've been meaning to try but haven't yet?",
  "What's your favorite memory from when we first met?",
  "What's one thing I could do that would make your day better?",
  "If you could have dinner with anyone, who would it be?",
  "What's a small win you had recently?",
  "What's something that made you laugh recently?",
  "What's one thing you're grateful for today?",
];

/** Date idea suggestions for couples. */
export const DATE_IDEAS = [
  "Coffee or brunch at a new spot",
  "Evening walk in a park or by the water",
  "Cook a meal together at home",
  "Movie night (theater or couch)",
  "Board game or card game night",
  "Try a new workout or class together",
  "Museum or gallery visit",
  "Picnic with your favorite snacks",
  "Stargazing somewhere quiet",
  "Breakfast for dinner – pancakes and pajamas",
];

function getDayIndex(): number {
  const start = new Date(2025, 0, 1);
  const now = new Date();
  const diff = Math.floor((now.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  return Math.abs(diff) % RELATIONSHIP_TIPS.length;
}

export function getTipOfDay(): string {
  return RELATIONSHIP_TIPS[getDayIndex()];
}

export function getTopicSuggestion(): string {
  return TOPIC_SUGGESTIONS[Math.floor(Math.random() * TOPIC_SUGGESTIONS.length)];
}

export function getDateIdea(): string {
  return DATE_IDEAS[Math.floor(Math.random() * DATE_IDEAS.length)];
}

export function getSolutionsForProblem(problemText: string): string[] {
  const lower = (problemText || '').toLowerCase();
  for (const [key, solutions] of Object.entries(RELATIONSHIP_SOLUTIONS)) {
    if (key !== 'default' && lower.includes(key)) return solutions;
  }
  return RELATIONSHIP_SOLUTIONS.default;
}
