import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

export interface ProofOfLove {
  id: string;
  fromUserId: string;
  toUserId: string;
  prompt: string;
  mediaUrl: string; // Video or image
  status: 'pending' | 'verified' | 'rejected';
  submittedAt: Date | string;
  verifiedAt?: Date | string | null;
  verifiedBy?: string | null;
}

export interface ConnectionPrompt {
  id: string;
  userId1: string;
  userId2: string;
  prompt: string;
  shownAt: Date | string;
  responded: boolean;
}

export interface ChatChallenge {
  id: string;
  userId1: string;
  userId2: string;
  challengeType: string;
  gameState?: any;
  status: 'pending' | 'active' | 'completed';
  winner?: string;
  createdAt: Date | string;
  completedAt?: Date | string | null;
}

// Proof of Love Prompts (25-40 prompts)
export const PROOF_OF_LOVE_PROMPTS = [
  "Write a handwritten letter expressing your feelings and take a photo of it",
  "Cook or prepare their favorite meal and share a video of you making it",
  "Create a personalized playlist of songs that remind you of them and share a screenshot",
  "Draw or paint something that represents your connection and share a photo",
  "Record a video of you singing or playing a song dedicated to them",
  "Write a poem about them and read it in a video",
  "Plan and execute a surprise virtual date - share photos/videos of the setup",
  "Create a scrapbook or digital collage of your memories together",
  "Learn something new that they're interested in and show proof in a video",
  "Write their name or a message in a creative way (sand, skywriting, etc.) and share",
  "Record a video sharing 10 things you appreciate about them",
  "Create a personalized video message with special effects or editing",
  "Do something kind for someone else in their honor and document it",
  "Write and perform a short skit or comedy routine about your relationship",
  "Create a time capsule with items that represent your time together",
  "Learn a dance and perform it in a video dedicated to them",
  "Write a short story featuring both of you as characters",
  "Create a personalized crossword puzzle or word search about your relationship",
  "Record a video tour of a place that's special to you, explaining why",
  "Make a DIY gift that shows you put thought and effort into it",
  "Write and record a personalized song or rap about your connection",
  "Create a vision board of your future together and share photos",
  "Do a random act of kindness and document it with a video",
  "Create a personalized meme or comic strip about your relationship",
  "Record a video of you trying something new they suggested",
  "Write a gratitude list of 20 things about them and read it aloud",
  "Create a personalized workout routine and do it together virtually",
  "Make a video showing your daily routine and how you think of them",
  "Create a personalized recipe card and cook it together virtually",
  "Write a letter to your future selves about this relationship",
  "Create a personalized calendar with important dates and memories",
  "Record a video of you learning a phrase in their language (if different)",
  "Create a personalized puzzle or game for them to solve",
  "Make a video showing your favorite places and why they remind you of them",
  "Write and perform a personalized stand-up comedy routine",
  "Create a personalized map marking places significant to your relationship",
  "Record a video of you doing something outside your comfort zone for them",
  "Create a personalized photo album with captions explaining each memory",
  "Write a personalized bedtime story featuring both of you",
  "Make a video showing your support for something they care about",
];

// Connection Conversation Prompts (25-40 prompts)
export const CONNECTION_PROMPTS = [
  "What's a childhood memory that still makes you smile?",
  "What's something you've always wanted to try but haven't yet?",
  "What makes you feel most alive?",
  "What's a fear you've overcome?",
  "What's your idea of a perfect day?",
  "What's something you're grateful for today?",
  "What's a dream you've never shared with anyone?",
  "What's something that always makes you laugh?",
  "What's a lesson you learned the hard way?",
  "What's your favorite way to show someone you care?",
  "What's something you're passionate about that others might not know?",
  "What's a moment that changed your perspective on life?",
  "What's something you'd love to learn together?",
  "What's your favorite way to spend a quiet evening?",
  "What's something that makes you feel understood?",
  "What's a goal you're working towards?",
  "What's your love language? How do you prefer to receive affection?",
  "What's something you appreciate about yourself?",
  "What's a place you'd love to visit together?",
  "What's something that helps you feel connected to someone?",
  "What's your favorite way to celebrate small victories?",
  "What's something you'd love to teach someone?",
  "What's a quality you admire in others?",
  "What's something that helps you feel grounded?",
  "What's your idea of meaningful conversation?",
  "What's something you'd love to create together?",
  "What's a tradition you'd like to start?",
  "What's something that makes you feel vulnerable but safe?",
  "What's your favorite way to show appreciation?",
  "What's something you'd love to experience for the first time together?",
  "What's a value that's important to you in relationships?",
  "What's something that helps you feel seen and heard?",
  "What's your favorite way to make someone's day better?",
  "What's something you'd love to explore together?",
  "What's a memory you'd love to create together?",
  "What's something that makes you feel connected to the world?",
  "What's your favorite way to express yourself?",
  "What's something you'd love to share about your culture or background?",
  "What's a small gesture that means a lot to you?",
  "What's something you'd love to learn about each other?",
];

// Chat Challenges/Games (25-40 games)
export const CHAT_CHALLENGES = [
  { type: 'xo', name: 'Tic-Tac-Toe', description: 'Classic XO game' },
  { type: 'would-you-rather', name: 'Would You Rather', description: 'Answer fun questions' },
  { type: 'truth-or-dare', name: 'Truth or Dare', description: 'Classic game with a twist' },
  { type: 'word-association', name: 'Word Association', description: 'Connect words together' },
  { type: 'story-building', name: 'Story Building', description: 'Build a story together' },
  { type: 'guess-the-song', name: 'Guess the Song', description: 'Share lyrics, guess the song' },
  { type: 'two-truths-lie', name: 'Two Truths and a Lie', description: 'Guess which is the lie' },
  { type: 'emoji-story', name: 'Emoji Story', description: 'Tell a story using only emojis' },
  { type: 'riddle-challenge', name: 'Riddle Challenge', description: 'Solve riddles together' },
  { type: 'memory-game', name: 'Memory Game', description: 'Test your memory together' },
  { type: 'word-chain', name: 'Word Chain', description: 'Chain words together' },
  { type: 'guess-the-movie', name: 'Guess the Movie', description: 'Quote movies, guess the title' },
  { type: 'drawing-game', name: 'Drawing Game', description: 'Draw and guess' },
  { type: 'question-game', name: 'Question Game', description: 'Ask and answer questions' },
  { type: 'rhyme-time', name: 'Rhyme Time', description: 'Create rhymes together' },
  { type: 'category-game', name: 'Category Game', description: 'Name items in categories' },
  { type: 'guess-the-number', name: 'Guess the Number', description: 'Guess each other\'s numbers' },
  { type: 'compatibility-quiz', name: 'Compatibility Quiz', description: 'Answer questions together' },
  { type: 'word-search', name: 'Word Search', description: 'Find words together' },
  { type: 'scavenger-hunt', name: 'Scavenger Hunt', description: 'Find items and share photos' },
  { type: 'photo-challenge', name: 'Photo Challenge', description: 'Take photos based on prompts' },
  { type: 'song-lyrics', name: 'Song Lyrics', description: 'Complete song lyrics together' },
  { type: 'guess-the-celebrity', name: 'Guess the Celebrity', description: 'Describe and guess' },
  { type: 'this-or-that', name: 'This or That', description: 'Choose between options' },
  { type: 'never-have-i-ever', name: 'Never Have I Ever', description: 'Share experiences' },
  { type: 'guess-the-drawing', name: 'Guess the Drawing', description: 'Draw and guess together' },
  { type: 'word-puzzle', name: 'Word Puzzle', description: 'Solve word puzzles together' },
  { type: 'trivia-challenge', name: 'Trivia Challenge', description: 'Answer trivia questions' },
  { type: 'guess-the-emotion', name: 'Guess the Emotion', description: 'Express and guess emotions' },
  { type: 'story-challenge', name: 'Story Challenge', description: 'Create stories together' },
  { type: 'guess-the-place', name: 'Guess the Place', description: 'Describe places and guess' },
  { type: 'word-building', name: 'Word Building', description: 'Build words from letters' },
  { type: 'guess-the-food', name: 'Guess the Food', description: 'Describe foods and guess' },
  { type: 'completion-game', name: 'Completion Game', description: 'Complete sentences together' },
  { type: 'guess-the-color', name: 'Guess the Color', description: 'Describe and guess colors' },
  { type: 'word-match', name: 'Word Match', description: 'Match words to categories' },
  { type: 'guess-the-object', name: 'Guess the Object', description: 'Describe objects and guess' },
  { type: 'story-roulette', name: 'Story Roulette', description: 'Random story prompts' },
  { type: 'word-race', name: 'Word Race', description: 'Race to find words' },
  { type: 'guess-the-quote', name: 'Guess the Quote', description: 'Guess famous quotes' },
];

const PROOFS_PATH = join(process.cwd(), 'server', 'data', 'proofs-of-love.json');
const PROMPTS_PATH = join(process.cwd(), 'server', 'data', 'connection-prompts.json');
const CHALLENGES_PATH = join(process.cwd(), 'server', 'data', 'chat-challenges.json');

export async function readProofs(): Promise<ProofOfLove[]> {
  try {
    const data = await readFile(PROOFS_PATH, 'utf-8');
    return JSON.parse(data).map((proof: ProofOfLove) => ({
      ...proof,
      submittedAt: new Date(proof.submittedAt),
      verifiedAt: proof.verifiedAt ? new Date(proof.verifiedAt) : null,
    }));
  } catch {
    return [];
  }
}

async function writeProofs(proofs: ProofOfLove[]): Promise<void> {
  const dir = join(process.cwd(), 'server', 'data');
  await import('fs/promises').then(fs => fs.mkdir(dir, { recursive: true }));
  await writeFile(PROOFS_PATH, JSON.stringify(proofs, null, 2));
}

export async function readConnectionPrompts(): Promise<ConnectionPrompt[]> {
  try {
    const data = await readFile(PROMPTS_PATH, 'utf-8');
    return JSON.parse(data).map((prompt: ConnectionPrompt) => ({
      ...prompt,
      shownAt: new Date(prompt.shownAt),
    }));
  } catch {
    return [];
  }
}

async function writeConnectionPrompts(prompts: ConnectionPrompt[]): Promise<void> {
  const dir = join(process.cwd(), 'server', 'data');
  await import('fs/promises').then(fs => fs.mkdir(dir, { recursive: true }));
  await writeFile(PROMPTS_PATH, JSON.stringify(prompts, null, 2));
}

export async function readChallenges(): Promise<ChatChallenge[]> {
  try {
    const data = await readFile(CHALLENGES_PATH, 'utf-8');
    return JSON.parse(data).map((challenge: ChatChallenge) => ({
      ...challenge,
      createdAt: new Date(challenge.createdAt),
      completedAt: challenge.completedAt ? new Date(challenge.completedAt) : null,
    }));
  } catch {
    return [];
  }
}

async function writeChallenges(challenges: ChatChallenge[]): Promise<void> {
  const dir = join(process.cwd(), 'server', 'data');
  await import('fs/promises').then(fs => fs.mkdir(dir, { recursive: true }));
  await writeFile(CHALLENGES_PATH, JSON.stringify(challenges, null, 2));
}

export async function createProofOfLove(proofData: Omit<ProofOfLove, 'id' | 'submittedAt' | 'status' | 'verifiedAt' | 'verifiedBy'>): Promise<ProofOfLove> {
  const proofs = await readProofs();
  
  // Check if there's already a pending proof
  const existing = proofs.find(
    p => p.fromUserId === proofData.fromUserId && 
    p.toUserId === proofData.toUserId && 
    p.status === 'pending'
  );
  if (existing) {
    throw new Error('You already have a pending proof of love');
  }

  const proof: ProofOfLove = {
    ...proofData,
    id: Date.now().toString(),
    status: 'pending',
    submittedAt: new Date(),
    verifiedAt: null,
    verifiedBy: null,
  };
  proofs.push(proof);
  await writeProofs(proofs);
  return proof;
}

export async function getPendingProofs(userId: string): Promise<ProofOfLove[]> {
  const proofs = await readProofs();
  return proofs.filter(p => p.toUserId === userId && p.status === 'pending');
}

export async function verifyProof(proofId: string, verified: boolean, verifierId: string): Promise<ProofOfLove> {
  const proofs = await readProofs();
  const proof = proofs.find(p => p.id === proofId);
  if (!proof) {
    throw new Error('Proof not found');
  }

  proof.status = verified ? 'verified' : 'rejected';
  proof.verifiedAt = new Date();
  proof.verifiedBy = verifierId;
  await writeProofs(proofs);
  return proof;
}

export async function getRandomProofPrompt(): Promise<string> {
  const randomIndex = Math.floor(Math.random() * PROOF_OF_LOVE_PROMPTS.length);
  return PROOF_OF_LOVE_PROMPTS[randomIndex];
}

export async function createConnectionPrompt(promptData: Omit<ConnectionPrompt, 'id' | 'shownAt' | 'responded'>): Promise<ConnectionPrompt> {
  const prompts = await readConnectionPrompts();
  const prompt: ConnectionPrompt = {
    ...promptData,
    id: Date.now().toString(),
    shownAt: new Date(),
    responded: false,
  };
  prompts.push(prompt);
  await writeConnectionPrompts(prompts);
  return prompt;
}

export async function getRandomConnectionPrompt(): Promise<string> {
  const randomIndex = Math.floor(Math.random() * CONNECTION_PROMPTS.length);
  return CONNECTION_PROMPTS[randomIndex];
}

export async function markPromptAsResponded(promptId: string): Promise<void> {
  const prompts = await readConnectionPrompts();
  const prompt = prompts.find(p => p.id === promptId);
  if (prompt) {
    prompt.responded = true;
    await writeConnectionPrompts(prompts);
  }
}

export async function createChatChallenge(challengeData: Omit<ChatChallenge, 'id' | 'createdAt' | 'status' | 'completedAt' | 'winner'>): Promise<ChatChallenge> {
  const challenges = await readChallenges();
  const challenge: ChatChallenge = {
    ...challengeData,
    id: Date.now().toString(),
    createdAt: new Date(),
    status: 'active',
    completedAt: null,
  };
  challenges.push(challenge);
  await writeChallenges(challenges);
  return challenge;
}

export async function getActiveChallenges(userId1: string, userId2: string): Promise<ChatChallenge[]> {
  const challenges = await readChallenges();
  return challenges.filter(
    c => ((c.userId1 === userId1 && c.userId2 === userId2) || 
          (c.userId1 === userId2 && c.userId2 === userId1)) &&
    c.status === 'active'
  );
}

export async function updateChallenge(challengeId: string, updates: Partial<ChatChallenge>): Promise<ChatChallenge> {
  const challenges = await readChallenges();
  const challenge = challenges.find(c => c.id === challengeId);
  if (!challenge) {
    throw new Error('Challenge not found');
  }
  Object.assign(challenge, updates);
  await writeChallenges(challenges);
  return challenge;
}

export async function getRandomChallenge(): Promise<typeof CHAT_CHALLENGES[0]> {
  const randomIndex = Math.floor(Math.random() * CHAT_CHALLENGES.length);
  return CHAT_CHALLENGES[randomIndex];
}

export function shouldShowProofOfLove(lastProofDate: Date | null): boolean {
  if (!lastProofDate) return true; // First time
  const daysSince = (Date.now() - new Date(lastProofDate).getTime()) / (1000 * 60 * 60 * 24);
  // Show roughly weekly (5-10 days)
  return daysSince >= 5 + Math.random() * 5;
}

export function shouldShowConnectionPrompt(lastPromptDate: Date | null): boolean {
  if (!lastPromptDate) return true; // First time
  const hoursSince = (Date.now() - new Date(lastPromptDate).getTime()) / (1000 * 60 * 60);
  // Show occasionally (every 2-5 hours of chatting)
  return hoursSince >= 2 + Math.random() * 3;
}

export function shouldShowChallenge(lastChallengeDate: Date | null): boolean {
  if (!lastChallengeDate) return true; // First time
  const hoursSince = (Date.now() - new Date(lastChallengeDate).getTime()) / (1000 * 60 * 60);
  // Show occasionally (every 1-3 hours of chatting)
  return hoursSince >= 1 + Math.random() * 2;
}
