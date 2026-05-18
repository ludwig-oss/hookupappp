import axios from 'axios';

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

export { axios };
