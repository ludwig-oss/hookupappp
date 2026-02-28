import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

export interface CompatibilityQuestion {
  id: string;
  question: string;
  type: 'multiple_choice' | 'scale' | 'yes_no';
  options?: string[];
  category: 'personality' | 'values' | 'lifestyle' | 'relationship';
}

export interface CompatibilityAnswer {
  questionId: string;
  answer: string | number;
}

export interface CompatibilityResult {
  userId: string;
  answers: CompatibilityAnswer[];
  completedAt: Date | string;
  personalityType?: string;
  scores: {
    openness: number;
    conscientiousness: number;
    extraversion: number;
    agreeableness: number;
    neuroticism: number;
  };
}

const QUESTIONS_PATH = join(process.cwd(), 'server', 'data', 'compatibility-questions.json');
const RESULTS_PATH = join(process.cwd(), 'server', 'data', 'compatibility-results.json');

const defaultQuestions: CompatibilityQuestion[] = [
  {
    id: 'q1',
    question: 'How important is spontaneity in a relationship?',
    type: 'scale',
    category: 'lifestyle',
  },
  {
    id: 'q2',
    question: 'Do you prefer staying in or going out?',
    type: 'multiple_choice',
    options: ['Staying in', 'Going out', 'Mix of both'],
    category: 'lifestyle',
  },
  {
    id: 'q3',
    question: 'How do you handle conflict?',
    type: 'multiple_choice',
    options: ['Discuss immediately', 'Take time to think', 'Avoid confrontation', 'Seek compromise'],
    category: 'personality',
  },
  {
    id: 'q4',
    question: 'How important is physical attraction?',
    type: 'scale',
    category: 'values',
  },
  {
    id: 'q5',
    question: 'Do you want children?',
    type: 'yes_no',
    category: 'relationship',
  },
  {
    id: 'q6',
    question: 'How do you express love?',
    type: 'multiple_choice',
    options: ['Words of affirmation', 'Quality time', 'Physical touch', 'Acts of service', 'Gifts'],
    category: 'personality',
  },
  {
    id: 'q7',
    question: 'How important is financial stability?',
    type: 'scale',
    category: 'values',
  },
  {
    id: 'q8',
    question: 'Do you prefer planning or going with the flow?',
    type: 'multiple_choice',
    options: ['Detailed planning', 'Loose planning', 'Go with the flow'],
    category: 'personality',
  },
  {
    id: 'q9',
    question: 'How do you recharge?',
    type: 'multiple_choice',
    options: ['Alone time', 'Social activities', 'Physical activity', 'Creative pursuits'],
    category: 'personality',
  },
  {
    id: 'q10',
    question: 'How important is shared interests?',
    type: 'scale',
    category: 'values',
  },
];

async function readQuestions(): Promise<CompatibilityQuestion[]> {
  try {
    const data = await readFile(QUESTIONS_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    const dir = join(process.cwd(), 'server', 'data');
    await import('fs/promises').then(fs => fs.mkdir(dir, { recursive: true }));
    await writeFile(QUESTIONS_PATH, JSON.stringify(defaultQuestions, null, 2));
    return defaultQuestions;
  }
}

async function readResults(): Promise<CompatibilityResult[]> {
  try {
    const data = await readFile(RESULTS_PATH, 'utf-8');
    const results = JSON.parse(data);
    return results.map((r: CompatibilityResult) => ({
      ...r,
      completedAt: r.completedAt ? new Date(r.completedAt) : new Date(),
    }));
  } catch {
    return [];
  }
}

async function writeResults(results: CompatibilityResult[]): Promise<void> {
  const dir = join(process.cwd(), 'server', 'data');
  await import('fs/promises').then(fs => fs.mkdir(dir, { recursive: true }));
  await writeFile(RESULTS_PATH, JSON.stringify(results, null, 2));
}

export async function getCompatibilityQuestions(): Promise<CompatibilityQuestion[]> {
  return readQuestions();
}

export async function saveCompatibilityResult(userId: string, answers: CompatibilityAnswer[]): Promise<CompatibilityResult> {
  const results = await readResults();
  
  // Calculate personality scores (simplified Big Five model)
  const scores = {
    openness: 50,
    conscientiousness: 50,
    extraversion: 50,
    agreeableness: 50,
    neuroticism: 50,
  };
  
  // Simple scoring based on answers
  answers.forEach(answer => {
    const numAnswer = typeof answer.answer === 'number' ? answer.answer : 50;
    if (answer.questionId === 'q1' || answer.questionId === 'q8') {
      scores.openness += (numAnswer - 50) * 0.5;
    }
    if (answer.questionId === 'q3' || answer.questionId === 'q6') {
      scores.agreeableness += (numAnswer - 50) * 0.5;
    }
    if (answer.questionId === 'q2' || answer.questionId === 'q9') {
      scores.extraversion += (numAnswer - 50) * 0.5;
    }
  });
  
  // Normalize scores
  Object.keys(scores).forEach(key => {
    scores[key as keyof typeof scores] = Math.max(0, Math.min(100, scores[key as keyof typeof scores]));
  });
  
  const result: CompatibilityResult = {
    userId,
    answers,
    completedAt: new Date(),
    scores,
  };
  
  // Remove old result for this user
  const filtered = results.filter(r => r.userId !== userId);
  filtered.push(result);
  await writeResults(filtered);
  
  return result;
}

export async function getCompatibilityResult(userId: string): Promise<CompatibilityResult | null> {
  const results = await readResults();
  return results.find(r => r.userId === userId) || null;
}

export async function calculateCompatibility(userId1: string, userId2: string): Promise<number> {
  const results = await readResults();
  const result1 = results.find(r => r.userId === userId1);
  const result2 = results.find(r => r.userId === userId2);
  
  if (!result1 || !result2) {
    return 0;
  }
  
  // Calculate compatibility based on score differences
  let totalDiff = 0;
  const keys: (keyof typeof result1.scores)[] = ['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'neuroticism'];
  
  keys.forEach(key => {
    const diff = Math.abs(result1.scores[key] - result2.scores[key]);
    totalDiff += diff;
  });
  
  const avgDiff = totalDiff / keys.length;
  const compatibility = Math.max(0, Math.min(100, 100 - avgDiff));
  
  return Math.round(compatibility);
}



