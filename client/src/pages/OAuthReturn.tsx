import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import type { OAuthProvider } from '../lib/oauth';
import './Auth.css';

const VALID: OAuthProvider[] = ['google', 'facebook', 'apple'];

function looksLikeHostPage(raw: string, contentType: string | null): boolean {
  return !contentType?.includes('json') || /<html|onrender\.com/i.test(raw);
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
      const hashError = hashParams.get('error_description') || hashParams.get('error');
      if (hashError) {
        setError(hashError);
        return;
      }
      const idToken = hashParams.get('id_token');
      if (cancelled) return;
      if (provider === 'google' && idToken) {
        const res = await fetch(`${window.location.origin}/api/auth/google/id-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ idToken, state: hashParams.get('state') || '' }),
        });
        const raw = await res.text();
        if (looksLikeHostPage(raw, res.headers.get('content-type'))) {
          setError('Server is waking up. Wait a few seconds and try again.');
          return;
        }
        const data = JSON.parse(raw) as { token?: string; setup?: string; error?: string };
        if (!res.ok || !data.token) {
          setError(data.error || 'Google sign-in failed. Try again.');
          return;
        }
        const setup = data.setup === '1' ? '1' : '0';
        window.location.replace(
          `${window.location.origin}/auth/callback?token=${encodeURIComponent(data.token)}&setup=${setup}`
        );
        return;
      }
      const qs = new URLSearchParams(searchParams);
      qs.set('format', 'json');
      const res = await fetch(`${window.location.origin}/api/auth/${provider}/callback?${qs.toString()}`, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        credentials: 'same-origin',
      });
      const raw = await res.text();
      if (cancelled) return;
      if (looksLikeHostPage(raw, res.headers.get('content-type'))) {
        setError('Server is waking up. Wait a few seconds and try again.');
        return;
      }
      const data = JSON.parse(raw) as { token?: string; setup?: string; error?: string };
      if (!res.ok || !data.token) {
        setError(data.error || 'Sign-in failed. Try again.');
        return;
      }
      const setup = data.setup === '1' ? '1' : '0';
      window.location.replace(
        `${window.location.origin}/auth/callback?token=${encodeURIComponent(data.token)}&setup=${setup}`
      );
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
