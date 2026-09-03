/** Ordered “classes” — day 1 is style; then dating/life topics (extend anytime). */
export interface SchoolQuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
}

export interface SchoolTopic {
  id: string;
  day: number;
  title: string;
  lessonTitle: string;
  description: string;
  icon: string;
  guideCategoryId: string;
  dailyWorkout: string;
  quiz: SchoolQuizQuestion[];
}

function q(id: string, question: string, options: string[], correctIndex: number): SchoolQuizQuestion {
  return { id, question, options, correctIndex };
}

function quizForTopic(topicName: string, focus: string): SchoolQuizQuestion[] {
  return [
    q('1', `What is the main goal of today's class on ${topicName}?`, [
      `Ignore ${focus} completely`,
      `Build real skills in ${focus} step by step`,
      'Only copy celebrities with no practice',
    ], 1),
    q('2', `If you already feel strong in ${focus}, what should you still do?`, [
      'Never learn anything new',
      'Keep working with a guide and practice anyway',
      'Skip all future classes forever',
    ], 1),
    q('3', 'How do you unlock the next class?', [
      'Complete today’s lesson and keep working with your guide',
      'Close the app without doing anything',
      'Only pay money with no effort',
    ], 0),
  ];
}

export const SCHOOL_TOPICS: SchoolTopic[] = [
  {
    id: 'style-fashion',
    day: 1,
    title: 'Style & Fashion',
    lessonTitle: 'Day 1 — Style class',
    description: 'Build a look that fits your personality, body, and budget.',
    icon: '👔',
    guideCategoryId: 'style-fashion',
    dailyWorkout: 'Pick one outfit upgrade: better fit, one signature piece, or a color that suits you.',
    quiz: [
      q('s1', 'What usually matters most for looking put-together?', ['Only expensive brands', 'Fit, grooming, and consistency', 'Buying random trends'], 1),
      q('s2', 'Before shopping, you should:', ['Buy impulsively online', 'Check what you own and what gap you have', 'Copy a stranger’s full wardrobe'], 1),
      q('s3', 'A guide can help you with style by:', ['Doing nothing practical', 'Giving personalized feedback on outfits & grooming', 'Avoiding all change'], 1),
    ],
  },
  {
    id: 'confidence-dating',
    day: 2,
    title: 'Dating Confidence',
    lessonTitle: 'Day 2 — Confidence class',
    description: 'Feel calmer and more authentic when meeting people.',
    icon: '✨',
    guideCategoryId: 'confidence-dating',
    dailyWorkout: 'Practice one 30-second intro about yourself out loud.',
    quiz: quizForTopic('Dating Confidence', 'self-confidence'),
  },
  {
    id: 'communication',
    day: 3,
    title: 'Communication',
    lessonTitle: 'Day 3 — Communication class',
    description: 'Express yourself clearly and listen with intent.',
    icon: '💬',
    guideCategoryId: 'communication',
    dailyWorkout: 'Have one honest check-in conversation (friend or date).',
    quiz: quizForTopic('Communication', 'clear talking and listening'),
  },
  {
    id: 'texting',
    day: 4,
    title: 'Texting & DMs',
    lessonTitle: 'Day 4 — Texting class',
    description: 'Keep conversations engaging without over-texting.',
    icon: '📱',
    guideCategoryId: 'texting',
    dailyWorkout: 'Send one thoughtful message instead of a dry “hey”.',
    quiz: quizForTopic('Texting', 'digital communication'),
  },
  {
    id: 'flirting',
    day: 5,
    title: 'Flirting & Attraction',
    lessonTitle: 'Day 5 — Flirting class',
    description: 'Show interest warmly without being pushy.',
    icon: '😉',
    guideCategoryId: 'flirting',
    dailyWorkout: 'Practice light, respectful flirting in a low-pressure setting.',
    quiz: quizForTopic('Flirting', 'attraction signals'),
  },
  {
    id: 'first-date',
    day: 6,
    title: 'First Dates',
    lessonTitle: 'Day 6 — First dates class',
    description: 'Plan dates that feel natural and memorable.',
    icon: '🎯',
    guideCategoryId: 'first-date',
    dailyWorkout: 'Plan one date idea with time, place, and backup plan.',
    quiz: quizForTopic('First Dates', 'first impressions'),
  },
  {
    id: 'dating-apps',
    day: 7,
    title: 'Dating Apps & Profiles',
    lessonTitle: 'Day 7 — Apps class',
    description: 'Upgrade your profile and messaging on apps.',
    icon: '📲',
    guideCategoryId: 'dating-apps',
    dailyWorkout: 'Refresh one profile photo and one bio line.',
    quiz: quizForTopic('Dating Apps', 'online profiles'),
  },
  {
    id: 'body-language-dating',
    day: 8,
    title: 'Body Language',
    lessonTitle: 'Day 8 — Body language class',
    description: 'Read and send better non-verbal signals.',
    icon: '👀',
    guideCategoryId: 'body-language-dating',
    dailyWorkout: 'Notice your posture in the mirror for 2 minutes.',
    quiz: quizForTopic('Body Language', 'non-verbal cues'),
  },
  {
    id: 'conversation-dating',
    day: 9,
    title: 'Conversation on Dates',
    lessonTitle: 'Day 9 — Conversation class',
    description: 'Keep dates flowing without awkward silences.',
    icon: '🗣️',
    guideCategoryId: 'conversation-dating',
    dailyWorkout: 'Prepare 5 open questions you actually care about.',
    quiz: quizForTopic('Conversation', 'date dialogue'),
  },
  {
    id: 'keeping-partner',
    day: 10,
    title: 'Keeping a Partner',
    lessonTitle: 'Day 10 — Relationship upkeep',
    description: 'Nurture connection so things do not go stale.',
    icon: '💑',
    guideCategoryId: 'keeping-partner',
    dailyWorkout: 'Do one small act of appreciation for someone you care about.',
    quiz: quizForTopic('Keeping a Partner', 'long-term care'),
  },
];

/** Append more improvement topics after core 10 — “limitless” path */
export function getFullCurriculum(extraCategoryIds: { id: string; name: string; description: string; icon: string }[]): SchoolTopic[] {
  const baseIds = new Set(SCHOOL_TOPICS.map((t) => t.id));
  const extra: SchoolTopic[] = [];
  let day = SCHOOL_TOPICS.length + 1;
  for (const c of extraCategoryIds) {
    if (baseIds.has(c.id)) continue;
    extra.push({
      id: c.id,
      day,
      title: c.name,
      lessonTitle: `Day ${day} — ${c.name}`,
      description: c.description,
      icon: c.icon,
      guideCategoryId: c.id,
      dailyWorkout: `Spend 15 minutes practicing one skill in ${c.name.toLowerCase()}.`,
      quiz: quizForTopic(c.name, c.name.toLowerCase()),
    });
    day++;
  }
  return [...SCHOOL_TOPICS, ...extra];
}
