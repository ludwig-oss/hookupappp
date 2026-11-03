/** Turn API / axios failures into a string safe to show in the UI. */
export function formatApiError(value: unknown, fallback = 'Something went wrong'): string {
  if (value == null) return fallback;
  if (typeof value === 'string') {
    const t = value.trim();
    if (!t) return fallback;
    if (t.startsWith('<')) return 'Server returned an error page instead of JSON.';
    if (/infinite\s*loop/i.test(t)) return 'Server redirect loop. Try again in a moment.';
    return t.length > 400 ? `${t.slice(0, 399)}…` : t;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>;
    if (typeof o.error !== 'undefined') {
      const nested = formatApiError(o.error, '');
      if (nested) return nested;
    }
    if (typeof o.message === 'string' && o.message.trim()) return o.message.trim();
    if (typeof o.code === 'string' && o.code.trim()) return o.code.trim();
  }
  return fallback;
}

export function formatAxiosError(err: unknown, fallback: string): string {
  const ax = err as {
    response?: { data?: unknown; status?: number };
    message?: string;
    code?: string;
  };

  if (ax?.response?.data !== undefined) {
    const fromBody = formatApiError(ax.response.data, '');
    if (fromBody) return fromBody;
    const st = ax.response.status;
    if (st === 508) return 'Server redirect loop. Try again in a moment.';
    if (st === 503) return 'Service unavailable. The API may still be waking up.';
    if (st === 502) return 'Bad gateway. The API server may be down.';
    if (st === 429) return 'Too many attempts. Please wait a few minutes and try again.';
    if (st) return `${fallback} (HTTP ${st})`;
  }

  if (!ax?.response) {
    const code = ax?.code;
    const msg = String(ax?.message || '');
    if (code === 'ECONNABORTED' || msg.includes('timeout')) {
      return 'Request timed out. Check your connection and try again.';
    }
    if (msg === 'Network Error' || code === 'ERR_NETWORK') {
      return "Can't reach the server. Check your connection and try again.";
    }
    if (msg) return msg;
  }

  return fallback;
}
