import axios from 'axios';

const API_URL = '/api/speed-date';

export interface SpeedDateSchedule {
  day1Type: 'chat' | 'video';
  day2Type: 'chat' | 'video';
  day1Time?: string;
  day2Time?: string;
}

export interface SpeedDate {
  id: string;
  user1Id: string;
  user2Id: string;
  startAt: string;
  endAt: string;
  schedule: SpeedDateSchedule;
  user1Continue?: boolean | null;
  user2Continue?: boolean | null;
  status: 'active' | 'continued' | 'ended_no';
  createdAt: string;
}

export const speedDateAPI = {
  start: async (partnerUserId: string, schedule?: Partial<SpeedDateSchedule>): Promise<{ speedDate: SpeedDate }> => {
    const res = await axios.post(`${API_URL}/start`, {
      partnerUserId,
      day1Type: schedule?.day1Type ?? 'chat',
      day2Type: schedule?.day2Type ?? 'video',
      day1Time: schedule?.day1Time,
      day2Time: schedule?.day2Time,
    });
    return res.data;
  },

  getActive: async (): Promise<{ speedDate: SpeedDate | null; partner: { id: string; name: string; profilePicture: string | null } | null }> => {
    const res = await axios.get(`${API_URL}/active`);
    return res.data;
  },

  answerContinue: async (speedDateId: string, continueTalking: boolean): Promise<{
    speedDate: SpeedDate;
    otherAnswered?: boolean;
    otherWantsContinue?: boolean;
    upliftingMessage?: string | null;
  }> => {
    const res = await axios.post(`${API_URL}/${speedDateId}/continue`, { continueTalking });
    return res.data;
  },

  getUplifting: async (): Promise<{ message: string }> => {
    const res = await axios.get(`${API_URL}/uplifting`);
    return res.data;
  },
};
