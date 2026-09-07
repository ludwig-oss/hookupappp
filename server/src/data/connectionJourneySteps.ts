/**
 * Connection Journey: 50+ chemistry-builders. Each pair gets 7 mixed steps
 * (games, quizzes, challenges, surprises — not a stack of interview questions).
 * Types: challenge, game, quiz, gift, surprise, deep (deep conversation).
 */

export type StepType = 'challenge' | 'game' | 'quiz' | 'gift' | 'surprise' | 'deep';
export type PlayAction = 'xo' | 'would-you-rather' | 'truth-or-dare';

export interface ConnectionJourneyStep {
  id: string;
  type: StepType;
  title: string;
  subtitle: string;
  instructions: string;
  chatPrompt?: string;
  quizQuestion?: string;
  options?: string[];
  playAction?: PlayAction;
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
    playAction: 'would-you-rather',
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
  {
    id: 'tic-tac-toe',
    type: 'game',
    title: 'Tic-tac-toe (XO)',
    subtitle: 'A quick round',
    instructions: 'Play one round of XO in chat. Loser answers a question the winner picks.',
    chatPrompt: "XO — you're up. Loser answers my question.",
    playAction: 'xo',
  },
  {
    id: 'truth-or-dare-round',
    type: 'game',
    title: 'Truth or dare',
    subtitle: 'Keep it PG and fun',
    instructions: 'Take turns: truth or dare. Three rounds each. Dares stay in chat (voice note, selfie, silly task).',
    chatPrompt: "Truth or dare — I pick truth. Ask me anything (within reason).",
    playAction: 'truth-or-dare',
  },
  {
    id: 'this-or-that-speed',
    type: 'game',
    title: 'This or that — speed round',
    subtitle: '10 lightning picks',
    instructions: 'Fire 10 this-or-that (beach or mountains, texts or calls, early or late). Both answer fast. No essays.',
    chatPrompt: "This or that, go: coffee or tea?",
    playAction: 'would-you-rather',
  },
  {
    id: 'twenty-questions',
    type: 'game',
    title: '20 questions',
    subtitle: 'Guess who or what',
    instructions: 'One thinks of a person/place/thing. The other asks yes/no questions. Max 20. Then swap.',
    chatPrompt: "20 questions — I'm thinking of something. Ask yes/no.",
  },
  {
    id: 'rock-paper-scissors',
    type: 'game',
    title: 'Rock paper scissors',
    subtitle: 'Best of 5',
    instructions: 'Type rock, paper, or scissors on 3-2-1. Best of 5. Winner picks the next song or snack for a date.',
    chatPrompt: "RPS — 3-2-1: rock.",
  },
  {
    id: 'story-one-sentence',
    type: 'game',
    title: 'One-sentence story',
    subtitle: 'Build a story together',
    instructions: 'Start a story in one sentence. They add one. Keep going until it is ridiculous or 12 lines.',
    chatPrompt: "Story time — first line: Once, at 2am, I...",
  },
  {
    id: 'riddle-swap',
    type: 'quiz',
    title: 'Riddle swap',
    subtitle: 'Stump each other',
    instructions: 'Each sends one riddle. No googling. If they get it, they ask one personal question.',
    chatPrompt: "Riddle: I have cities but no houses, mountains but no trees. What am I?",
  },
  {
    id: 'finish-the-lyric',
    type: 'game',
    title: 'Finish the lyric',
    subtitle: 'Song drop',
    instructions: 'Send one line of a song. They finish it or name the track. Three each.',
    chatPrompt: "Finish this lyric: \"Don't stop believin'...\"",
  },
  {
    id: 'two-photos-guess',
    type: 'surprise',
    title: 'Two photos, one fake',
    subtitle: 'Spot the bit',
    instructions: 'Send two photos from your life — one is a bit of a stretch (old, joke, not actually you doing it). They guess which.',
    chatPrompt: "Two photos — which one is the stretch? [photo 1] [photo 2]",
  },
  {
    id: 'voice-note-compliment',
    type: 'gift',
    title: 'Voice-note compliment',
    subtitle: 'Say it out loud',
    instructions: 'Send a 15-second voice note with one specific compliment. Not about looks first.',
    chatPrompt: "[voice note] One thing I like about how you talk is...",
  },
  {
    id: 'plan-cheap-date',
    type: 'challenge',
    title: 'Plan a €10 date',
    subtitle: 'Budget chemistry',
    instructions: 'Each plans a date that costs €10 or less in their city. Vote on which you would actually do.',
    chatPrompt: "€10 date I'd take you on: ...",
  },
  {
    id: 'teach-me-one-thing',
    type: 'challenge',
    title: 'Teach me one thing',
    subtitle: '2-minute lesson',
    instructions: 'Teach them one tiny skill (fold a shirt, a word in your language, a life hack). They teach one back.',
    chatPrompt: "Today I'm teaching you: ... Here's how...",
  },
  {
    id: 'green-flag-hunt',
    type: 'quiz',
    title: 'Green flag hunt',
    subtitle: 'What you actually want',
    instructions: 'Each lists 3 green flags you look for. Circle one on theirs you already noticed in them.',
    chatPrompt: "My 3 green flags: 1) ... 2) ... 3) ... I already see this one in you: ...",
  },
  {
    id: 'dealbreaker-kind',
    type: 'deep',
    title: 'One kind dealbreaker',
    subtitle: 'Values, not a fight',
    instructions: 'Share one dealbreaker without attacking anyone. Ask theirs. No debate — just hear it.',
    chatPrompt: "One dealbreaker for me is... because I need...",
  },
  {
    id: 'morning-vs-night',
    type: 'quiz',
    title: 'Morning person or night owl',
    subtitle: 'Lifestyle fit',
    instructions: 'Share your real sleep/wake, weekends, and how you recharge. See if the clocks match.',
    chatPrompt: "I'm more of a ... person. Weekends I ... How do you recharge?",
  },
  {
    id: 'map-your-weekend',
    type: 'challenge',
    title: 'Map a perfect weekend',
    subtitle: 'No pressure to book',
    instructions: 'Describe Saturday 10am to Sunday night as if you already get along. Compare. Steal the best bits.',
    chatPrompt: "Perfect weekend with you: Saturday we ... Sunday we ...",
  },
  {
    id: 'pet-names-ban',
    type: 'game',
    title: 'Banned pet names',
    subtitle: 'Keep it real',
    instructions: 'Each lists 2 pet names you never want. Then pick 1 silly name you would allow as a joke.',
    chatPrompt: "Never call me ... Joke pass: you can call me ... once.",
  },
  {
    id: 'screenshot-your-lockscreen',
    type: 'surprise',
    title: 'Lock screen swap',
    subtitle: 'A tiny window in',
    instructions: 'If you are comfortable, screenshot your lock screen (hide notifications). Explain why that wallpaper.',
    chatPrompt: "Lock screen (notifications hidden): [photo] — I keep this because...",
  },
  {
    id: 'unpopular-opinion',
    type: 'game',
    title: 'Unpopular opinion',
    subtitle: 'Low-stakes spice',
    instructions: 'Share one harmless unpopular opinion (food, movies, sports). They share one. No lectures.',
    chatPrompt: "Unpopular opinion: pineapple on pizza is ... Your turn.",
  },
  {
    id: 'comfort-food-story',
    type: 'gift',
    title: 'Comfort food story',
    subtitle: 'A memory on a plate',
    instructions: 'Name your comfort food and the person or moment attached. They do the same.',
    chatPrompt: "Comfort food is ... because of ...",
  },
  {
    id: 'three-apps-you-open',
    type: 'quiz',
    title: 'First 3 apps you open',
    subtitle: 'How you actually live',
    instructions: 'List the first three apps you open in the morning (no shame). Guess theirs before they say.',
    chatPrompt: "I think your first 3 apps are ... Mine are ...",
  },
  {
    id: 'dance-or-walk',
    type: 'challenge',
    title: '30-second dance or walk clip',
    subtitle: 'Energy check',
    instructions: 'Send a 30s clip walking or dancing like nobody is grading you. They reply with theirs.',
    chatPrompt: "[clip] No skill required — just the vibe.",
  },
  {
    id: 'nickname-origin',
    type: 'deep',
    title: 'A nickname you had',
    subtitle: 'Who you were',
    instructions: 'Share a nickname from school or family and whether you liked it. Ask theirs.',
    chatPrompt: "People used to call me ... I felt ... about it.",
  },
  {
    id: 'high-low-today',
    type: 'challenge',
    title: 'High and low of today',
    subtitle: 'Check-in, not an interview',
    instructions: 'Each shares one high and one low from today. Respond to theirs before adding yours.',
    chatPrompt: "Today's high: ... Low: ... What about yours?",
  },
  {
    id: 'pack-a-bag',
    type: 'game',
    title: 'Pack a bag in 5 items',
    subtitle: 'Spontaneous trip',
    instructions: 'You have 10 minutes to leave for a 2-day trip. List 5 items. Compare. Roast the extras.',
    chatPrompt: "10-minute bag: 1) ... 2) ... 3) ... 4) ... 5) ...",
  },
  {
    id: 'movie-night-vote',
    type: 'gift',
    title: 'Movie night vote',
    subtitle: 'Pick together',
    instructions: 'Each nominates 2 movies. You both rank all 4. Winner is the hypothetical first watch.',
    chatPrompt: "My 2 nominations: ... Rank all 4 when you send yours.",
  },
  {
    id: 'emoji-only-convo',
    type: 'game',
    title: 'Emoji-only for 8 messages',
    subtitle: 'No words',
    instructions: 'Next 8 messages: emojis only. Then translate what you think the other meant.',
    chatPrompt: "Emoji-only mode ON 🔒",
  },
  {
    id: 'one-boundary',
    type: 'deep',
    title: 'One boundary you are proud of',
    subtitle: 'Not a lecture',
    instructions: 'Share one boundary you keep and how it helps you. Listen to theirs. No fixing.',
    chatPrompt: "A boundary I keep: ... It helps me ...",
  },
  {
    id: 'mirror-question',
    type: 'quiz',
    title: 'Ask me the question you want asked',
    subtitle: 'Skip the small talk',
    instructions: 'Each asks the question they wish people asked them. Then answer each other.',
    chatPrompt: "The question I wish people asked: ... My answer: ...",
  },
  {
    id: 'tiny-dare-pg',
    type: 'challenge',
    title: 'Tiny PG dare',
    subtitle: 'Do something small now',
    instructions: 'Dare them to do something tiny and kind (text a friend thanks, drink water, step outside 2 min). Proof optional.',
    chatPrompt: "Tiny dare: go drink water and send a 👍 when done. Your dare for me?",
  },
  {
    id: 'hangman-one-word',
    type: 'game',
    title: 'Hangman (one word)',
    subtitle: 'Guess the word',
    instructions: 'One picks a single word (food, city, movie). The other guesses letters. Then swap.',
    chatPrompt: "Hangman: _ _ _ _ _  (5 letters). Guess a letter.",
  },
  {
    id: 'yes-no-only',
    type: 'game',
    title: 'Yes/no only — 8 messages',
    subtitle: 'No explanations',
    instructions: 'Next 8 messages: only yes or no. Then you each explain what you actually meant.',
    chatPrompt: "Yes/no mode ON. First question: are you more shy or more bold in person?",
  },
  {
    id: 'playlist-three',
    type: 'gift',
    title: '3-song playlist',
    subtitle: 'A tiny mixtape',
    instructions: 'Send 3 songs: one that is you, one for a first hang, one that is a mood. They send 3 back.',
    chatPrompt: "Your 3-song mix: 1) me 2) us hanging 3) a mood — ...",
  },
  {
    id: 'coin-flip-tiny-dare',
    type: 'challenge',
    title: 'Coin flip tiny dare',
    subtitle: 'Heads or tails',
    instructions: 'Flip (or pick). Heads: send a voice note. Tails: send a photo of something near you. Both do it.',
    chatPrompt: "Coin flip — I got heads, so here's a voice note. Your flip?",
    playAction: 'truth-or-dare',
  },
  {
    id: 'color-mood',
    type: 'quiz',
    title: 'Color of today',
    subtitle: 'Mood check',
    instructions: 'Pick a color for your mood today and one sentence why. Guess theirs before they say.',
    chatPrompt: "Today's color is ... because ... I think yours is ...",
  },
  {
    id: 'secret-handshake-emoji',
    type: 'game',
    title: 'Secret handshake in emojis',
    subtitle: 'Make a ritual',
    instructions: 'Invent a 4-emoji handshake. They add a 5th. Use it once later in the chat.',
    chatPrompt: "Handshake draft: 🤝🔥🌙✨ — add one.",
  },
  {
    id: 'guess-my-order',
    type: 'quiz',
    title: 'Guess my coffee/food order',
    subtitle: 'Pay attention',
    instructions: 'Guess their usual order. Then reveal yours. Closest guess asks one extra question.',
    chatPrompt: "I think you order ... Mine is ...",
  },
  {
    id: 'two-minute-voice-date',
    type: 'challenge',
    title: '2-minute voice date',
    subtitle: 'Skip typing',
    instructions: 'Each sends one voice note up to 2 minutes: name, week, and one thing you want them to know.',
    chatPrompt: "[voice note] 2-minute date — your turn after.",
  },
  {
    id: 'hide-seek-emoji',
    type: 'game',
    title: 'Emoji hide and seek',
    subtitle: 'Find the odd one',
    instructions: 'Hide one emoji that does not belong in a row of 8. They find it. Then swap.',
    chatPrompt: "Find the odd emoji: 🍕🍔🌮🍣🍩🍜🥗🎈",
  },
  {
    id: 'roast-your-photo',
    type: 'surprise',
    title: 'Roast your own photo',
    subtitle: 'Keep it kind',
    instructions: 'Send a photo and roast yourself first (one line). They add one kind roast. No mean shots.',
    chatPrompt: "[photo] I'll go first: this is me pretending I have my life together.",
  },
  {
    id: 'compatibility-speed-quiz',
    type: 'quiz',
    title: 'Speed compatibility',
    subtitle: '6 fast picks',
    instructions: 'Both answer: cats/dogs, city/nature, texts/calls, spicy/mild, plan/spontaneous, early/late. Compare.',
    chatPrompt: "Speed quiz: dogs, city, texts, spicy, spontaneous, late. You?",
    playAction: 'would-you-rather',
  },
  {
    id: 'build-a-date-in-emojis',
    type: 'game',
    title: 'Date in 6 emojis',
    subtitle: 'Plan without pressure',
    instructions: 'Describe a hypothetical date in exactly 6 emojis. They decode it, then send theirs.',
    chatPrompt: "Date in 6 emojis: ☕🚶🎵🌙🍦🚌 — decode me.",
  },
];

export const CONNECTION_JOURNEY_MIX_VERSION = 2;

/** Get step by id */
export function getStepById(id: string): ConnectionJourneyStep | undefined {
  return CONNECTION_JOURNEY_POOL.find((s) => s.id === id);
}

/** Pick N random step IDs, mixing games/challenges/quizzes so it is not all questions. */
export function pickRandomStepIds(count: number): string[] {
  const buckets = new Map<StepType, string[]>();
  for (const step of CONNECTION_JOURNEY_POOL) {
    const list = buckets.get(step.type) || [];
    list.push(step.id);
    buckets.set(step.type, list);
  }
  for (const list of buckets.values()) {
    list.sort(() => Math.random() - 0.5);
  }
  const order: StepType[] = ['game', 'challenge', 'quiz', 'surprise', 'gift', 'deep'];
  const picked: string[] = [];
  let guard = 0;
  while (picked.length < Math.min(count, CONNECTION_JOURNEY_POOL.length) && guard < 80) {
    for (const t of order) {
      const list = buckets.get(t);
      if (!list?.length) continue;
      const id = list.pop();
      if (id) picked.push(id);
      if (picked.length >= count) break;
    }
    guard += 1;
  }
  return picked;
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
