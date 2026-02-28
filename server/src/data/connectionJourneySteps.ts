/**
 * Connection Journey: pool of 20+ unique activities. Each journey gets 7 random steps
 * so it's different with every partner and never the same game twice in a row.
 * Types: challenge, game, quiz, gift, surprise, deep (deep conversation).
 */

export type StepType = 'challenge' | 'game' | 'quiz' | 'gift' | 'surprise' | 'deep';

export interface ConnectionJourneyStep {
  id: string;
  type: StepType;
  title: string;
  subtitle: string;
  instructions: string;
  chatPrompt?: string;
  quizQuestion?: string;
  options?: string[];
}

export const CONNECTION_JOURNEY_DAYS = 7;

/** Pool of 20+ unique steps – no repeats within a journey; different mix per partner. */
export const CONNECTION_JOURNEY_POOL: ConnectionJourneyStep[] = [
  {
    id: 'two-truths-lie',
    type: 'quiz',
    title: 'Two truths and a lie',
    subtitle: 'Break the ice',
    instructions: 'Each sends 3 statements: 2 true, 1 lie. The other guesses the lie. Take turns.',
    chatPrompt: "Here are my two truths and a lie — guess which is the lie: 1) ... 2) ... 3) ...",
  },
  {
    id: 'cook-or-perform',
    type: 'challenge',
    title: 'Win them over with a skill',
    subtitle: 'Cook, create, or perform',
    instructions: 'Cook or bake something and send a photo (or the recipe). Or send a voice note reading a poem or lyric you think they\'d like.',
    chatPrompt: "I took the connection challenge — here's what I made for you: [photo/voice note]",
  },
  {
    id: 'emoji-story',
    type: 'game',
    title: 'Emoji story',
    subtitle: 'Tell a story in 5 emojis',
    instructions: 'One sends 5 emojis that tell a mini story. The other guesses, then swap. Be creative!',
    chatPrompt: "My emoji story for you: [paste 5 emojis] — can you guess what it means?",
  },
  {
    id: 'draw-each-other',
    type: 'surprise',
    title: 'Draw each other',
    subtitle: 'Doodle your partner',
    instructions: 'Draw or doodle the other person (silly is fine!). Send a photo or screenshot. They do the same for you.',
    chatPrompt: "Here's my masterpiece — I drew you! [send your drawing]",
  },
  {
    id: 'perfect-gift',
    type: 'gift',
    title: 'The perfect gift',
    subtitle: 'Describe a gift you\'d give them',
    instructions: 'Describe the perfect gift you\'d give them and why. No need to buy it — show you pay attention.',
    chatPrompt: "If I could give you one perfect gift, it would be... [describe it and why]",
  },
  {
    id: 'three-compliments',
    type: 'challenge',
    title: 'Three compliments (not about looks)',
    subtitle: 'Prove you see them',
    instructions: 'Send 3 genuine compliments about personality, choices, or something they said. They reply with 3 for you.',
    chatPrompt: "Three things I really appreciate about you: 1) ... 2) ... 3) ...",
  },
  {
    id: 'would-you-rather',
    type: 'game',
    title: 'Would you rather',
    subtitle: '5 questions, compare answers',
    instructions: 'Take turns asking "Would you rather A or B?" Both answer. Do at least 5 rounds and see how you match.',
    chatPrompt: "Would you rather [option A] or [option B]? I'd pick...",
  },
  {
    id: 'song-for-you',
    type: 'surprise',
    title: 'A song for you',
    subtitle: 'Share a song that reminds you of them',
    instructions: 'Share one song (link or name) that reminds you of them or they\'d love, and one sentence why. They share one back.',
    chatPrompt: "This song reminds me of you / I think you'd love this: [song] — because...",
  },
  {
    id: 'dream-date',
    type: 'challenge',
    title: 'Plan their dream date',
    subtitle: 'Design the ideal first date for them',
    instructions: 'Describe the perfect first date you\'d plan for them based on what you\'ve learned. Then they plan one for you.',
    chatPrompt: "The dream first date I'd plan for you: [describe where, what you'd do, and why]",
  },
  {
    id: 'know-each-other',
    type: 'quiz',
    title: 'How well do you know each other?',
    subtitle: 'Quick fire questions',
    instructions: 'Take turns asking things like "What\'s my favorite comfort food?" "What would I do on a free Sunday?" Answer for each other. 5 questions each.',
    chatPrompt: "My question for you: [e.g. What's my favorite comfort food?] — I think your answer is...",
  },
  {
    id: 'never-told-anyone',
    type: 'deep',
    title: 'One thing I\'ve never told anyone',
    subtitle: 'Share something real',
    instructions: 'Each shares one small thing you\'ve never told anyone. The other responds with support or a similar secret. Builds trust.',
    chatPrompt: "Something I've never told anyone: ...",
  },
  {
    id: 'childhood-dream',
    type: 'deep',
    title: 'What did you want to be when you grew up?',
    subtitle: 'Dreams then and now',
    instructions: 'Share what you wanted to be as a kid and whether you still want that or something different. Ask each other why.',
    chatPrompt: "When I was little I wanted to be... Now I think... What about you?",
  },
  {
    id: 'bucket-list',
    type: 'deep',
    title: 'One thing on your bucket list',
    subtitle: 'Dreams and adventures',
    instructions: 'Share one thing you really want to do before you die. Why that one? Then ask them theirs.',
    chatPrompt: "One thing on my bucket list is... because... What's yours?",
  },
  {
    id: 'fear-or-hope',
    type: 'deep',
    title: 'One fear and one hope',
    subtitle: 'Vulnerability check-in',
    instructions: 'Share one small fear and one hope you have right now. No judgment — just listen and respond with care.',
    chatPrompt: "Right now one fear I have is... and one hope is...",
  },
  {
    id: 'grateful-for',
    type: 'deep',
    title: 'Three things you\'re grateful for today',
    subtitle: 'Gratitude share',
    instructions: 'Each share 3 things you\'re grateful for today (can be tiny). Then talk about why one of theirs stood out.',
    chatPrompt: "Three things I'm grateful for today: 1) ... 2) ... 3) ...",
  },
  {
    id: 'word-association',
    type: 'game',
    title: 'Word association chain',
    subtitle: 'One word at a time',
    instructions: 'Start with one word. The other replies with the first word that comes to mind. Keep going for 10 rounds. See where you end up!',
    chatPrompt: "Word association — you say a word, I'll say the first that comes to mind. Start: [word]",
  },
  {
    id: 'guess-the-movie',
    type: 'game',
    title: 'Guess the movie in 3 emojis',
    subtitle: 'Emoji movie quiz',
    instructions: 'One sends 3 emojis that describe a movie. The other guesses. Swap. Do 3 movies each.',
    chatPrompt: "Guess this movie: [3 emojis]",
  },
  {
    id: 'voice-note-story',
    type: 'challenge',
    title: '30-second voice story',
    subtitle: 'Tell a tiny story with your voice',
    instructions: 'Send a voice note telling a 30-second true story (something funny or memorable that happened to you). They reply with one too.',
    chatPrompt: "[Send a voice note — 30 sec story]",
  },
  {
    id: 'virtual-coffee',
    type: 'gift',
    title: 'Virtual coffee or tea',
    subtitle: 'Describe your perfect cup for them',
    instructions: 'Describe the exact coffee or tea you\'d make for them (how you\'d prepare it, where you\'d sit). They do the same for you.',
    chatPrompt: "If we were having a coffee right now I'd make you... [describe the drink and the moment]",
  },
  {
    id: 'pet-peeve-and-love',
    type: 'deep',
    title: 'One pet peeve, one thing you love',
    subtitle: 'Little truths',
    instructions: 'Share one small pet peeve and one small thing you love (habits, sounds, weather). Keeps it light but real.',
    chatPrompt: "One pet peeve: ... One thing I love: ...",
  },
  {
    id: 'superpower-pick',
    type: 'quiz',
    title: 'If you could have one superpower',
    subtitle: 'Dream superpower',
    instructions: 'Each picks one superpower and why. Then guess what superpower they\'d give you.',
    chatPrompt: "If I could have one superpower it would be... because... What would you pick for me?",
  },
  {
    id: 'desert-island-three',
    type: 'game',
    title: 'Desert island: 3 things',
    subtitle: 'Stranded together',
    instructions: 'You\'re stuck on a desert island. Each pick 3 things you\'d want (can be objects, people, skills). Compare and explain.',
    chatPrompt: "Desert island — my 3 things: 1) ... 2) ... 3) ... What are yours?",
  },
  {
    id: 'photo-from-your-day',
    type: 'surprise',
    title: 'One photo from your day',
    subtitle: 'A glimpse into your life',
    instructions: 'Send one photo from today (or this week) — something that shows your life right now. Explain in one sentence. They do the same.',
    chatPrompt: "One photo from my day: [send photo] — [one sentence]",
  },
  {
    id: 'compliment-battle',
    type: 'game',
    title: 'Compliment battle',
    subtitle: 'Who can be nicer?',
    instructions: 'Take turns sending one genuine compliment. No repeating. Go until someone can\'t think of another. Winner wins the heart.',
    chatPrompt: "Compliment battle — here's one: ...",
  },
  {
    id: 'time-machine',
    type: 'deep',
    title: 'Where would you go in a time machine?',
    subtitle: 'One moment in time',
    instructions: 'If you could go to one moment in the past or future, what would it be and why? Share and ask each other.',
    chatPrompt: "If I had a time machine I'd go to... because...",
  },
  {
    id: 'recipe-swap',
    type: 'gift',
    title: 'Recipe swap',
    subtitle: 'Share a recipe that means something',
    instructions: 'Share one recipe that matters to you (family, comfort, memory). Explain why. They share one back.',
    chatPrompt: "A recipe that means a lot to me: [name/dish]. Why: ...",
  },
  {
    id: 'five-words-describe-me',
    type: 'quiz',
    title: '5 words that describe you',
    subtitle: 'Self in five words',
    instructions: 'Each send 5 words you think describe yourself. The other sends 5 words they think describe you. Compare!',
    chatPrompt: "5 words I think describe me: ... What 5 words would you use for me?",
  },
  {
    id: 'would-you-forgive',
    type: 'deep',
    title: 'One thing you\'d find hard to forgive',
    subtitle: 'Boundaries and values',
    instructions: 'Share one thing you\'d find really hard to forgive in a partner (without being preachy). Then listen to theirs. Keeps it honest.',
    chatPrompt: "One thing I'd find hard to forgive is... because...",
  },
  {
    id: 'best-advice',
    type: 'deep',
    title: 'Best advice you\'ve ever received',
    subtitle: 'Wisdom that stuck',
    instructions: 'Share the best advice anyone ever gave you and how it changed you. They share theirs.',
    chatPrompt: "The best advice I ever got was... It changed how I...",
  },
];

/** Get step by id */
export function getStepById(id: string): ConnectionJourneyStep | undefined {
  return CONNECTION_JOURNEY_POOL.find((s) => s.id === id);
}

/** Pick N random step IDs without replacement. Each journey gets a different mix. */
export function pickRandomStepIds(count: number): string[] {
  const ids = CONNECTION_JOURNEY_POOL.map((s) => s.id);
  const shuffled = [...ids].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

/** Get the next step for a journey: first in assignedStepIds not in completedStepIds. */
export function getNextStepFromAssigned(
  assignedStepIds: string[],
  completedStepIds: string[]
): ConnectionJourneyStep | null {
  const nextId = assignedStepIds.find((id) => !completedStepIds.includes(id));
  return nextId ? getStepById(nextId) ?? null : null;
}

/** Current day (1-based) from assigned steps: index of next step, or 7 if all done. */
export function getCurrentDayFromAssigned(
  assignedStepIds: string[],
  completedStepIds: string[]
): number {
  const idx = assignedStepIds.findIndex((id) => !completedStepIds.includes(id));
  if (idx === -1) return CONNECTION_JOURNEY_DAYS;
  return idx + 1;
}

/** Build allSteps for UI: from assignedStepIds with day = index + 1, completed from completedStepIds. */
export function getAllStepsForJourney(
  assignedStepIds: string[],
  completedStepIds: string[]
): { id: string; day: number; type: string; title: string; completed: boolean }[] {
  return assignedStepIds.map((id, i) => {
    const step = getStepById(id);
    return {
      id,
      day: i + 1,
      type: step?.type ?? 'challenge',
      title: step?.title ?? 'Step',
      completed: completedStepIds.includes(id),
    };
  });
}
