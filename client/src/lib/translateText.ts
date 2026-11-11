import axios from 'axios';
import { API_BASE } from '../api/config';

export async function translateText(text: string, targetLang: string, sourceLang = 'en'): Promise<string> {
  const res = await axios.post(`${API_BASE}/api/translate`, { text, targetLang, sourceLang });
  return res.data.translated as string;
}
