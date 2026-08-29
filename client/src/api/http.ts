import axios from 'axios';

const RETRY_STATUSES = new Set([502, 503, 504]);
const RETRY_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete']);

/** Attach JWT from localStorage on every request (survives signup finally-block bugs). */
axios.interceptors.request.use((config) => {
  if (typeof localStorage === 'undefined') return config;
  const token = localStorage.getItem('token');
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
