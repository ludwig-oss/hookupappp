export interface PersonCard {
  id: string;
  name: string;
  username: string;
  age: number | null;
  profilePicture: string | null;
  city: string | null;
  distanceKm: number | null;
  bestQuality: string;
  futurePlans: string;
  polishedQuality: string;
  polishedFuture: string;
  workingOnSelf: boolean;
}

export interface Prompt {
  id: string;
  text: string;
}

export interface BattleView {
  id: string;
  status: 'live' | 'matched' | 'ejected';
  phase: 'wingman' | 'ejection' | 'matched' | 'ejected';
  startedAt: string;
  wingmanEndsAt: string;
  ejectEndsAt: string;
  serverNow: string;
  prompt: Prompt;
  me: PersonCard;
  partner: PersonCard;
  myConfirmed: boolean;
  partnerConfirmed: boolean;
  ejectedByMe: boolean;
  youWereRejected: boolean;
  ejectReason: string | null;
  matchedUserId: string | null;
}

export interface ProfileInput {
  searchText: string;
  maxDistanceKm: number;
  bestQuality: string;
  futurePlans: string;
  workingOnSelf: boolean;
}

export interface CoachStep {
  id: string;
  title: string;
  body: string;
  field?: 'quality' | 'plans' | 'opener';
  options?: string[];
}

export interface BattleBlock {
  code: 'underage' | 'need_gender' | 'need_age';
  message: string;
}

export interface BattleState {
  profile: ProfileInput;
  triesLeft: number;
  freeRemaining: number;
  paidRemaining: number;
  priceEur: number;
  packRounds: number;
  coachLocked: boolean;
  coach: { steps: CoachStep[]; rejectionsInWindow: number } | null;
  tips: string[] | null;
  coachOpener: string | null;
  battle: BattleView | null;
  outcome: BattleView | null;
  preview: PersonCard | null;
  allocationNote: string | null;
  blocked: BattleBlock | null;
  emptyReason: string | null;
  /** True once Start Live Battle has put this user in the open pool. */
  searching: boolean;
  /** How this round picks the other person: age band, a high-interest date, or anyone. */
  pairMode?: 'age' | 'hot' | 'random';
  searchingSince?: string | null;
}

export interface SpotlightCard {
  userId: string;
  bestQuality: string;
  futurePlans: string;
  polishedQuality: string;
  polishedFuture: string;
}
