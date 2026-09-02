import axios from 'axios';
import { getAuthToken } from '../lib/authStorage';

const RETRY_STATUSES = new Set([502, 503, 504]);
const RETRY_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete']);

axios.defaults.timeout = 45000;

/** Attach JWT from localStorage on every request (survives signup finally-block bugs). */
axios.interceptors.request.use((config) => {
  if (config.timeout == null) config.timeout = 45000;
  if (typeof localStorage === 'undefined') return config;
  const url = String(config.url || '');
  const skipAuth =
    /\/api\/auth\/(login|login-pin|signup|signup-pin|forgot-pin|forgot-password|reset-pin|reset-password|report-stolen)/.test(
      url
    );
  if (skipAuth) return config;
  const token = getAuthToken();
  if (token) {
    config.headers = config.headers ?? {};
    if (!config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

/** Retry once when Render is waking from sleep (502/503/504). */
axios.interceptors.response.use(
  (res) => res,
  async (err) => {
    const cfg = err?.config;
    const status = err?.response?.status;
    if (
      cfg &&
      !cfg.__retriedOnce &&
      status &&
      RETRY_STATUSES.has(status) &&
      RETRY_METHODS.has(String(cfg.method || 'get').toLowerCase())
    ) {
      cfg.__retriedOnce = true;
      await new Promise((r) => setTimeout(r, 2500));
      return axios(cfg);
    }
    return Promise.reject(err);
  }
);

export { axios };
