import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import type { OAuthProvider } from '../lib/oauth';
import './Auth.css';

const VALID: OAuthProvider[] = ['google', 'facebook', 'apple'];
const RENDER_API = 'https://hookupappp.onrender.com';

/** hookupapp.dev's own /api proxy stops at 10s. Phones are slower than a desk browser, so call Render directly. */
function apiBases(): string[] {
  const host = window.location.hostname;
  const direct = host === 'hookupapp.dev' || host.endsWith('.hookupapp.dev') || host.endsWith('.vercel.app');
  const bases = direct ? [RENDER_API] : [];
  if (!bases.includes(window.location.origin)) bases.push(window.location.origin);
  return bases;
}

async function fetchApi(path: string, init: RequestInit): Promise<{ res: Response; raw: string }> {
  let last = 'Sign-in failed. Try again.';
  for (const base of apiBases()) {
    try {
      const res = await fetch(`${base}${path}`, init);
      const raw = await res.text();
      if (looksLikeHostPage(raw, res.headers.get('content-type'))) {
        last = 'Server is waking up. Wait a few seconds and try again.';
        continue;
      }
      return { res, raw };
    } catch {
      last = 'Server is waking up. Wait a few seconds and try again.';
    }
  }
  throw new Error(last);
}

function looksLikeHostPage(raw: string, contentType: string | null): boolean {
  return !contentType?.includes('json') || /<html|onrender\.com/i.test(raw);
}

/** Phone sign-in stores an exp:// or app scheme return in the OAuth state. */
function appReturnFromState(state: string): string {
  if (!state) return '';
  try {
    const pad = state.replace(/-/g, '+').replace(/_/g, '/');
    const padded = pad + '='.repeat((4 - (pad.length % 4)) % 4);
    const parsed = JSON.parse(atob(padded)) as { a?: string };
    const target = parsed.a || '';
    const url = new URL(target);
    if (url.username || url.password) return '';
    const scheme = url.protocol.replace(/:$/, '').toLowerCase();
    if (scheme !== 'exp' && scheme !== 'exps' && scheme !== 'hookup' && scheme !== 'app.hookup.mobile') return '';
    return url.toString();
  } catch {
    return '';
  }
}

function finishSignIn(token: string, setup: string, state: string) {
  const appReturn = appReturnFromState(state);
  if (appReturn) {
    const join = appReturn.includes('?') ? '&' : '?';
    window.location.replace(`${appReturn}${join}token=${encodeURIComponent(token)}&setup=${setup}`);
    return;
  }
  window.location.replace(
    `${window.location.origin}/auth/callback?token=${encodeURIComponent(token)}&setup=${setup}`
  );
}

/** Google/Apple/Facebook redirect here first — we wake the API, then finish without showing the host page. */
const OAuthReturn = () => {
  const { provider = '' } = useParams<{ provider: string }>();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState('');

  useEffect(() => {
    if (!VALID.includes(provider as OAuthProvider)) {
      setError('Unknown sign-in provider.');
      return;
    }
    let cancelled = false;
    (async () => {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const state = hashParams.get('state') || searchParams.get('state') || '';
      const hashError = hashParams.get('error_description') || hashParams.get('error');
      if (hashError) {
        setError(hashError);
        return;
      }
      const idToken = hashParams.get('id_token') || searchParams.get('id_token');
      if (cancelled) return;
      if (provider === 'google' && idToken) {
        const { res, raw } = await fetchApi('/api/auth/google/id-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ idToken, state }),
        });
        const data = JSON.parse(raw) as { token?: string; setup?: string; error?: string };
        if (!res.ok || !data.token) {
          setError(data.error || 'Google sign-in failed. Try again.');
          return;
        }
        const setup = data.setup === '1' ? '1' : '0';
        finishSignIn(data.token, setup, state);
        return;
      }
      const qs = new URLSearchParams(searchParams);
      qs.set('format', 'json');
      const { res, raw } = await fetchApi(`/api/auth/${provider}/callback?${qs.toString()}`, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      if (cancelled) return;
      const data = JSON.parse(raw) as { token?: string; setup?: string; error?: string };
      if (!res.ok || !data.token) {
        setError(data.error || 'Sign-in failed. Try again.');
        return;
      }
      const setup = data.setup === '1' ? '1' : '0';
      finishSignIn(data.token, setup, state);
    })().catch(() => {
      if (!cancelled) setError('Sign-in failed. Try again.');
    });
    return () => {
      cancelled = true;
    };
  }, [provider, searchParams]);

  if (error) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <h1 className="auth-title">Sign-in issue</h1>
          <div className="error-message">{error}</div>
          <Link to="/login?mode=login" className="auth-button" style={{ display: 'inline-block', textDecoration: 'none' }}>
            Back to Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-title">Finishing sign-in…</h1>
        <p className="auth-subtitle">Connecting to your account — this only takes a moment.</p>
        <div className="oauth-spinner" aria-hidden />
      </div>
    </div>
  );
};

export default OAuthReturn;
