import axios from 'axios';

const API_URL = '/api/chat-engagement';

export interface ProofOfLove {
  id: string;
  fromUserId: string;
  toUserId: string;
  prompt: string;
  mediaUrl: string;
  status: 'pending' | 'verified' | 'rejected';
  submittedAt: string;
  verifiedAt?: string | null;
  verifiedBy?: string | null;
}

export interface ConnectionPrompt {
  id: string;
  userId1: string;
  userId2: string;
  prompt: string;
  shownAt: string;
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
  createdAt: string;
  completedAt?: string | null;
}

export const chatEngagementAPI = {
  // Proof of Love
  submitProofOfLove: async (data: {
    toUserId: string;
    prompt: string;
    mediaUrl: string;
    userId: string;
  }): Promise<{ message: string; proof: ProofOfLove }> => {
    const response = await axios.post(`${API_URL}/proof/submit`, data);
    return response.data;
  },

  getPendingProofs: async (userId: string): Promise<{ proofs: ProofOfLove[] }> => {
    const response = await axios.get(`${API_URL}/proof/pending`, { params: { userId } });
    return response.data;
  },

  verifyProof: async (data: {
    proofId: string;
    verified: boolean;
    userId: string;
  }): Promise<{ message: string; proof: ProofOfLove }> => {
    const response = await axios.post(`${API_URL}/proof/verify`, data);
    return response.data;
  },

  getProofPrompt: async (): Promise<{ prompt: string }> => {
    const response = await axios.get(`${API_URL}/proof/prompt`);
    return response.data;
  },

  checkProofStatus: async (data: {
    userId: string;
    otherUserId: string;
  }): Promise<{ shouldShow: boolean; hasPendingProof: boolean; lastProofDate: string | null }> => {
    const response = await axios.get(`${API_URL}/proof/check`, { params: data });
    return response.data;
  },

  // Connection Prompts
  getConnectionPrompt: async (data: {
    userId: string;
    otherUserId: string;
  }): Promise<{ prompt: ConnectionPrompt }> => {
    const response = await axios.get(`${API_URL}/prompt`, { params: data });
    return response.data;
  },

  checkConnectionPrompt: async (data: {
    userId: string;
    otherUserId: string;
  }): Promise<{ shouldShow: boolean; lastPromptDate: string | null }> => {
    const response = await axios.get(`${API_URL}/prompt/check`, { params: data });
    return response.data;
  },

  markPromptResponded: async (promptId: string): Promise<{ message: string }> => {
    const response = await axios.post(`${API_URL}/prompt/responded`, { promptId });
    return response.data;
  },

  // Challenges
  createChallenge: async (data: {
    otherUserId: string;
    challengeType: string;
    gameState?: any;
    userId: string;
  }): Promise<{ message: string; challenge: ChatChallenge }> => {
    const response = await axios.post(`${API_URL}/challenge/create`, data);
    return response.data;
  },

  getChallenges: async (data: {
    userId: string;
    otherUserId: string;
  }): Promise<{ challenges: ChatChallenge[] }> => {
    const response = await axios.get(`${API_URL}/challenge/list`, { params: data });
    return response.data;
  },

  updateChallenge: async (data: {
    challengeId: string;
    gameState?: any;
    status?: string;
    winner?: string;
  }): Promise<{ message: string; challenge: ChatChallenge }> => {
    const response = await axios.post(`${API_URL}/challenge/update`, data);
    return response.data;
  },

  getRandomChallenge: async (): Promise<{ challenge: { type: string; name: string; description: string } }> => {
    const response = await axios.get(`${API_URL}/challenge/random`);
    return response.data;
  },

  checkChallengeStatus: async (data: {
    userId: string;
    otherUserId: string;
  }): Promise<{ shouldShow: boolean; lastChallengeDate: string | null }> => {
    const response = await axios.get(`${API_URL}/challenge/check`, { params: data });
    return response.data;
  },
};
