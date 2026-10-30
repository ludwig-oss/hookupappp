export type OAuthProvider = 'google' | 'facebook' | 'apple';
export type OAuthIntent = 'login' | 'signup';

function allowedProviderHost(hostname: string, provider: OAuthProvider): boolean {
  const host = hostname.toLowerCase();
  if (provider === 'google') return host === 'accounts.google.com';
  if (provider === 'facebook') return host === 'www.facebook.com' || host === 'facebook.com' || host.endsWith('.facebook.com');
  return host === 'appleid.apple.com';
}

const RENDER_API = 'https://hookupappp.onrender.com';

/** Same-origin /api dies at the host's 10s limit while the API is asleep. Call the API directly too. */
function useDirectApi(): boolean {
  const host = window.location.hostname;
  return host === 'hookupapp.dev' || host.endsWith('.hookupapp.dev') || host.endsWith('.vercel.app');
}

function authTargets(provider: OAuthProvider, intent: OAuthIntent): string[] {
  const origin = window.location.origin;
  const path = `/api/auth/${provider}?return_origin=${encodeURIComponent(origin)}&intent=${intent}&format=json`;
  const targets = useDirectApi() ? [`${RENDER_API}${path}`] : [];
  targets.push(`${origin}${path}`);
  return targets;
}

function parseProviderUrl(raw: string, res: Response, provider: OAuthProvider): string {
  const isJson = (res.headers.get('content-type') || '').includes('json') && !/<html|onrender\.com/i.test(raw);
  if (!isJson || res.status >= 500) {
    throw new Error('Server is waking up — please try again.');
  }
  let data: { url?: string; error?: string };
  try {
    data = JSON.parse(raw) as { url?: string; error?: string };
  } catch {
    throw new Error('Could not start. Try again.');
  }
  if (!res.ok || !data.url) {
    throw new Error(data.error || 'Could not start. Try again.');
  }
  let dest: URL;
  try {
    dest = new URL(data.url);
  } catch {
    throw new Error('Could not start. Try again.');
  }
  if (!allowedProviderHost(dest.hostname, provider)) {
    throw new Error('Could not start. Try again.');
  }
  return data.url;
}

function attemptProviderUrl(provider: OAuthProvider, intent: OAuthIntent, budgetMs: number): Promise<string> {
  const targets = authTargets(provider, intent);
  const controllers = targets.map(() => new AbortController());
  return new Promise((resolve, reject) => {
    let open = targets.length;
    let settled = false;
    let last = 'Could not reach the server. Try again.';
    const fail = (message: string) => {
      last = message;
      open -= 1;
      if (!settled && open <= 0) {
        settled = true;
        reject(new Error(last));
      }
    };
    targets.forEach((url, i) => {
      const ms = Math.max(1000, Math.min(budgetMs, url.startsWith(RENDER_API) ? budgetMs : 8000));
      const timer = window.setTimeout(() => controllers[i].abort(), ms);
      fetch(url, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        credentials: 'omit',
        signal: controllers[i].signal,
      })
        .then(async (res) => {
          window.clearTimeout(timer);
          if (settled) return;
          try {
            const providerUrl = parseProviderUrl(await res.text(), res, provider);
            if (settled) return;
            settled = true;
            controllers.forEach((c) => c.abort());
            resolve(providerUrl);
          } catch (e: unknown) {
            fail(e instanceof Error ? e.message : last);
          }
        })
        .catch(() => {
          window.clearTimeout(timer);
          fail('Could not reach the server. Try again.');
        });
    });
  });
}

/** Keep asking until the API answers. A sleeping server often answers on a later try, not the first. */
async function loadProviderUrl(provider: OAuthProvider, intent: OAuthIntent): Promise<string> {
  const deadline = Date.now() + (useDirectApi() ? 45000 : 10000);
  let last = 'Could not reach the server. Try again.';
  while (Date.now() < deadline) {
    try {
      return await attemptProviderUrl(provider, intent, deadline - Date.now());
    } catch (e: unknown) {
      last = e instanceof Error ? e.message : last;
      if (deadline - Date.now() < 500) break;
      await new Promise((r) => setTimeout(r, 600));
    }
  }
  throw new Error(last);
}

type OAuthJob = { promise: Promise<string>; done: boolean; ok: boolean };

const pending = new Map<string, OAuthJob>();

function startJob(provider: OAuthProvider, intent: OAuthIntent): OAuthJob {
  const job: OAuthJob = { promise: loadProviderUrl(provider, intent), done: false, ok: false };
  job.promise.then(
    () => {
      job.done = true;
      job.ok = true;
    },
    () => {
      job.done = true;
    }
  );
  return job;
}

/** Start the provider request as soon as the screen opens, so the tap does not wait on a cold start. */
export function prefetchOAuth(provider: OAuthProvider, intent: OAuthIntent = 'signup'): void {
  const key = `${provider}:${intent}`;
  const existing = pending.get(key);
  if (!existing || (existing.done && !existing.ok)) pending.set(key, startJob(provider, intent));
}

/** Open the provider. Uses the request started by prefetch when the screen loaded. */
export async function redirectToOAuth(provider: OAuthProvider, intent: OAuthIntent = 'signup'): Promise<void> {
  const key = `${provider}:${intent}`;
  prefetchOAuth(provider, intent);
  const job = pending.get(key)!;
  try {
    window.location.assign(await job.promise);
  } catch (e: unknown) {
    pending.delete(key);
    throw e instanceof Error ? e : new Error('Could not reach the server. Try again.');
  }
}
