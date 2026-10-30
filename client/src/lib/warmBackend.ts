function abortAfter(ms: number): AbortSignal {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(ms);
  }
  const ctrl = new AbortController();
  window.setTimeout(() => ctrl.abort(), ms);
  return ctrl.signal;
}

const RENDER_API = 'https://hookupappp.onrender.com';

/** Ask the API to wake up as soon as the site opens. Does not block the screen. */
export function wakeBackend(): void {
  if (typeof window === 'undefined') return;
  const host = window.location.hostname;
  const direct =
    host === 'hookupapp.dev' || host.endsWith('.hookupapp.dev') || host.endsWith('.vercel.app');
  const urls = direct
    ? [`${RENDER_API}/api/health`, `${window.location.origin}/api/health`]
    : [`${window.location.origin}/api/health`];
  for (const url of urls) {
    fetch(url, { cache: 'no-store', credentials: 'omit', signal: abortAfter(45000) }).catch(() => {});
  }
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
