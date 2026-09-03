import axios from 'axios';
import { API_BASE } from './config';

const API_URL = API_BASE + '/api/date-match';

export interface LookingForOption {
  id: string;
  label: string;
  hint: string;
}

export interface DateIdea {
  id: string;
  category: 'hobby' | 'good_deed' | 'date';
  title: string;
  detail: string;
}

export interface PublicUserCard {
  id: string;
  name: string;
  username: string;
  profilePicture: string | null;
  interestLevel: number;
  online: boolean;
  city?: string;
  country?: string;
}

export type DateMatchStatus =
  | 'searching'
  | 'pending'
  | 'proposed'
  | 'awaiting_accept'
  | 'picking_idea'
  | 'scheduled'
  | 'completed'
  | 'cancelled'
  | 'declined'
  | 'expired';

export interface DateMatch {
  id: string;
  userId1: string;
  userId2: string;
  lookingFor: string[];
  status: DateMatchStatus;
  interest1: number;
  interest2: number;
  user1Accepted: boolean;
  user2Accepted: boolean;
  user1FreeSlots: string[];
  user2FreeSlots: string[];
  agreedSlot: string | null;
  ideaId: string | null;
  ideaTitle: string | null;
  ideaDetail: string | null;
  ideaCategory: DateIdea['category'] | null;
  scheduledAt: string | null;
  chatUnlocked: boolean;
  user1Continue: boolean | null;
  user2Continue: boolean | null;
  user1GoingWell: boolean | null;
  user2GoingWell: boolean | null;
  cancelledBy: string | null;
  cancelReason: string | null;
  cancelProofUrl: string | null;
  finePaidTo: string | null;
  fineEur: number;
  createdAt: string;
  updatedAt: string;
}

export interface DateChatLock {
  locked: boolean;
  unlockAt: string | null;
  matchId: string | null;
  reason: string;
  scheduledAt: string | null;
  ideaTitle: string | null;
}

export interface PitchOffer {
  id: string;
  fromUserId: string;
  toUserId: string;
  source: 'reject' | 'direct';
  text: string;
  status: 'awaiting_pitch' | 'pending_review' | 'accepted' | 'rejected';
  createdAt: string;
  other?: PublicUserCard | null;
}

export interface LawyerMessage {
  id: string;
  fromUserId: string;
  content: string;
  createdAt: string;
}

export interface LawyerSession {
  id: string;
  clientUserId: string;
  targetUserId: string | null;
  guideUserId: string;
  status: 'picking' | 'pitching' | 'accepted' | 'rejected' | 'closed';
  lastMessageUntil: string | null;
  messages: LawyerMessage[];
  client?: PublicUserCard | null;
  target?: PublicUserCard | null;
  guide?: PublicUserCard | null;
}

export interface DateMatchCatalog {
  lookingFor: LookingForOption[];
  ideas: DateIdea[];
  hobbyCount: number;
  goodDeedCount: number;
  dateCount: number;
  freeSearchesPerMonth: number;
  cancellationFineEur: number;
  quota: {
    used: number;
    limit: number | null;
    remaining: number | null;
    unlimited: boolean;
    monthKey: string;
  };
  tier: 'free' | 'plus' | 'gold' | 'platinum';
  interestLevel: number;
  features: {
    unlimitedSearches: boolean;
    pitchOnReject: boolean;
    unlimitedCountries: boolean;
    guideLawyer: boolean;
    directPitch: boolean;
  };
}

export const dateMatchAPI = {
  catalog: async (): Promise<DateMatchCatalog> => {
    const { data } = await axios.get(`${API_URL}/catalog`);
    return data;
  },
  search: async (lookingFor: string[]) => {
    const { data } = await axios.post(`${API_URL}/search`, { lookingFor });
    return data as {
      quota: DateMatchCatalog['quota'];
      searching: boolean;
      match: DateMatch | null;
      other: PublicUserCard | null;
      me: PublicUserCard | null;
      needUpgrade?: boolean;
    };
  },
  cancelSearch: async () => {
    const { data } = await axios.post(`${API_URL}/search/cancel`);
    return data;
  },
  poll: async () => {
    const { data } = await axios.get(`${API_URL}/poll`);
    return data as {
      searching: boolean;
      match: DateMatch | null;
      other: PublicUserCard | null;
      me: PublicUserCard | null;
    };
  },
  mine: async () => {
    const { data } = await axios.get(`${API_URL}/mine`);
    return data as {
      active: Array<{ match: DateMatch; other: PublicUserCard | null }>;
      pending: Array<{ match: DateMatch; other: PublicUserCard | null }>;
      past: Array<{ match: DateMatch; other: PublicUserCard | null }>;
    };
  },
  setAvailability: async (matchId: string, slots: string[]) => {
    const { data } = await axios.post(`${API_URL}/availability`, { matchId, slots });
    return data as { match: DateMatch };
  },
  respond: async (matchId: string, accept: boolean) => {
    const { data } = await axios.post(`${API_URL}/respond`, { matchId, accept });
    return data as { match: DateMatch };
  },
  spin: async (matchId: string) => {
    const { data } = await axios.post(`${API_URL}/spin`, { matchId });
    return data as { match: DateMatch };
  },
  cancelDate: async (matchId: string, reason: string, proofUrl?: string) => {
    const { data } = await axios.post(`${API_URL}/cancel`, { matchId, reason, proofUrl });
    return data as { match: DateMatch };
  },
  howGoing: async (matchId: string, goingWell: boolean, wantContinue: boolean) => {
    const { data } = await axios.post(`${API_URL}/how-going`, { matchId, goingWell, wantContinue });
    return data as { match: DateMatch; recommendGuide: boolean; continueTalking: boolean | null; removed: boolean };
  },
  pitches: async () => {
    const { data } = await axios.get(`${API_URL}/pitches`);
    return data as { toWrite: PitchOffer[]; incoming: PitchOffer[] };
  },
  pitchCandidates: async () => {
    const { data } = await axios.get(`${API_URL}/pitch/candidates`);
    return data as { users: PublicUserCard[] };
  },
  startDirectPitch: async (toUserId: string) => {
    const { data } = await axios.post(`${API_URL}/pitch/direct`, { toUserId });
    return data as { pitch: PitchOffer };
  },
  submitPitch: async (pitchId: string, text: string) => {
    const { data } = await axios.post(`${API_URL}/pitch/text`, { pitchId, text });
    return data as { pitch: PitchOffer };
  },
  respondPitch: async (pitchId: string, accept: boolean) => {
    const { data } = await axios.post(`${API_URL}/pitch/respond`, { pitchId, accept });
    return data as { pitch: PitchOffer; openChat?: boolean; chatUserId?: string | null };
  },
  lawyerGuides: async () => {
    const { data } = await axios.get(`${API_URL}/lawyer/guides`);
    return data as { guides: Array<{ id: string; userId: string; name: string; profilePicture: string | null; categories: string[]; rating: number; region: string }> };
  },
  lawyerSessions: async () => {
    const { data } = await axios.get(`${API_URL}/lawyer/sessions`);
    return data as { sessions: LawyerSession[] };
  },
  summonLawyer: async (guideUserId: string) => {
    const { data } = await axios.post(`${API_URL}/lawyer/summon`, { guideUserId });
    return data as { session: LawyerSession };
  },
  lawyerCandidates: async (sessionId: string) => {
    const { data } = await axios.get(`${API_URL}/lawyer/candidates`, { params: { sessionId } });
    return data as { users: PublicUserCard[]; client: PublicUserCard | null };
  },
  lawyerPick: async (sessionId: string, targetUserId: string) => {
    const { data } = await axios.post(`${API_URL}/lawyer/pick`, { sessionId, targetUserId });
    return data as { session: LawyerSession };
  },
  lawyerMessage: async (sessionId: string, content: string) => {
    const { data } = await axios.post(`${API_URL}/lawyer/message`, { sessionId, content });
    return data as { session: LawyerSession };
  },
  lawyerRespond: async (sessionId: string, accept: boolean) => {
    const { data } = await axios.post(`${API_URL}/lawyer/respond`, { sessionId, accept });
    return data as { session: LawyerSession; openChat?: boolean; chatUserId?: string | null };
  },
};
