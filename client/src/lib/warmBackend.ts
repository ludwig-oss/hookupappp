function abortAfter(ms: number): AbortSignal {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(ms);
  }
  const ctrl = new AbortController();
  window.setTimeout(() => ctrl.abort(), ms);
  return ctrl.signal;
}

/** Ping /api/health until the real JSON API responds (not Render's cold-start HTML). */
export async function warmBackend(maxWaitMs = 60000): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const origin = window.location.origin;
  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${origin}/api/health`, {
        cache: 'no-store',
        credentials: 'same-origin',
        signal: abortAfter(12000),
      });
      const ct = res.headers.get('content-type') || '';
      if (res.ok && ct.includes('application/json')) {
        const data = (await res.json()) as { status?: string };
        if (data?.status === 'ok') return true;
      }
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return false;
}
