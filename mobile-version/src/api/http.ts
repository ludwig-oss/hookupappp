import axios, { type InternalAxiosRequestConfig } from 'axios';
import { getAuthToken } from '../session/authStorage';
import { emitPhotoLockRequired, type PhotoLockDetail } from '../session/photoLock';

const RETRY_STATUSES = new Set([502, 503, 504]);
const RETRY_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete']);

type RetryConfig = InternalAxiosRequestConfig & { __retriedOnce?: boolean };

axios.defaults.timeout = 45000;

/** Attach the JWT on every request except public auth routes. */
axios.interceptors.request.use((config) => {
  if (config.timeout == null) config.timeout = 45000;
  const url = String(config.url || '');
  const skipAuth =
    /\/api\/auth\/(login|login-pin|signup|signup-pin|forgot-pin|forgot-password|reset-pin|reset-password|report-stolen)/.test(
      url
    );
  if (skipAuth) return config;
  const token = getAuthToken();
  if (token && !config.headers.Authorization && !config.headers.authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/** Retry once when the host is waking from sleep. A failed request never signs the phone out. */
axios.interceptors.response.use(
  (res) => res,
  async (err) => {
    const code = err?.response?.data?.code;
    if (code === 'PHOTO_VERIFICATION_REQUIRED') {
      emitPhotoLockRequired((err.response?.data?.photoLock as PhotoLockDetail) || null);
    }
    const cfg = err?.config as RetryConfig | undefined;
    const status = err?.response?.status as number | undefined;
    const message = String(err?.message || '');
    const dropped =
      !status &&
      (err?.code === 'ERR_NETWORK' ||
        err?.code === 'ECONNABORTED' ||
        err?.code === 'ECONNRESET' ||
        err?.code === 'ETIMEDOUT' ||
        message === 'Network Error' ||
        /timeout|network request failed/i.test(message));
    if (
      cfg &&
      !cfg.__retriedOnce &&
      RETRY_METHODS.has(String(cfg.method || 'get').toLowerCase()) &&
      ((status && RETRY_STATUSES.has(status)) || dropped)
    ) {
      cfg.__retriedOnce = true;
      await new Promise((r) => setTimeout(r, status ? 2500 : 1200));
      return axios(cfg);
    }
    return Promise.reject(err);
  }
);

export { axios };
