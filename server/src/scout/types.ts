export type ScoutMode = 'talk' | 'building';

export type PartnershipStatus =
  | 'talking'
  | 'awaiting_contract'
  | 'speed_date'
  | 'active'
  | 'ended';

export interface Profession {
  id: string;
  label: string;
  group: string;
}

export interface TimeWindow {
  id: string;
  start: string;
  end: string;
  label: string;
}

export interface ScoutCard {
  userId: string;
  name: string;
  username: string;
  professionId: string;
  professionLabel: string;
  city: string | null;
  years: number;
  quality: number;
  experienceScore: number;
}

export interface PlannedEvent {
  id: string;
  title: string;
  city: string;
  startsAt: string;
  why: string;
  source: 'two-to-four-week-board';
}

export interface ExpenseEntry {
  id: string;
  title: string;
  amountCents: number;
  paidBy: string;
  createdAt: string;
}

export interface HousePlan {
  label: string;
  priceCents: number;
  downCents: number;
  monthlyCents: number;
  iterationsPaid: number;
}

export interface MediationEntry {
  id: string;
  userId: string;
  text: string;
  reply: string;
  at: string;
}

export interface GoalEntry {
  id: string;
  label: string;
  done: boolean;
}

export interface Settlement {
  endedAt: string;
  reason: string;
  trackedCents: number;
  eachShareCents: number;
  remainderCents: number;
}

export interface PartnershipView {
  id: string;
  mode: ScoutMode;
  status: PartnershipStatus;
  partner: { id: string; name: string; username: string; professionLabel: string };
  contractText: string | null;
  iSigned: boolean;
  theySigned: boolean;
  speedDate: {
    iJoined: boolean;
    theyJoined: boolean;
    iConfirmed: boolean;
    theyConfirmed: boolean;
    live: boolean;
  } | null;
  slots: TimeWindow[];
  events: PlannedEvent[];
  tips: string[];
  goals: GoalEntry[];
  expenses: ExpenseEntry[];
  house: HousePlan | null;
  trackedCents: number;
  eachShareCents: number;
  mediation: MediationEntry[];
  settlement: Settlement | null;
}

export interface InterestView {
  id: string;
  mode: ScoutMode;
  from: { id: string; name: string; username: string; professionLabel: string };
  createdAt: string;
}

export interface ScoutState {
  onboarded: boolean;
  professionId: string | null;
  professionLabel: string | null;
  years: number;
  judgment: number;
  experienceScore: number;
  listSize: number;
  qualityFloor: number;
  board: ScoutCard[];
  incoming: InterestView[];
  partnerships: PartnershipView[];
}
