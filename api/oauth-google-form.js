/**
 * Google posts the sign-in token here on phones. A URL hash never survives that hop.
 * This exchanges it for a Hook Up session, then sends the browser or the app onward.
 */
const RENDER_API = 'https://hookupappp.onrender.com';

function appReturnFromState(state) {
  if (!state) return '';
  try {
    const pad = String(state).replace(/-/g, '+').replace(/_/g, '/');
    const padded = pad + '='.repeat((4 - (pad.length % 4)) % 4);
    const parsed = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
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

function readForm(req) {
  return new Promise((resolve) => {
    const body = req.body;
    if (body && typeof body === 'object' && !Buffer.isBuffer(body)) {
      resolve(body);
      return;
    }
    if (typeof body === 'string') {
      resolve(Object.fromEntries(new URLSearchParams(body)));
      return;
    }
    if (Buffer.isBuffer(body)) {
      resolve(Object.fromEntries(new URLSearchParams(body.toString('utf8'))));
      return;
    }
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      resolve(Object.fromEntries(new URLSearchParams(raw)));
    });
    req.on('error', () => resolve({}));
  });
}

function htmlBounce(dest) {
  const safe = JSON.stringify(String(dest || ''));
  return `<!doctype html><meta charset="utf-8"><title>Returning to Hook Up</title><p><a href=${safe}>Return to Hook Up</a></p><script>location.replace(${safe})</script>`;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.statusCode = 302;
    res.setHeader('Location', '/login?mode=login');
    res.end();
    return;
  }

  const form = await readForm(req);
  const idToken = String(form.id_token || form.idToken || '');
  const state = String(form.state || '');
  const providerError = String(form.error_description || form.error || '');
  if (providerError) {
    res.statusCode = 302;
    res.setHeader('Location', `/login?mode=login&oauth_error=${encodeURIComponent(providerError)}`);
    res.end();
    return;
  }
  if (!idToken) {
    res.statusCode = 302;
    res.setHeader('Location', '/login?mode=login&oauth_error=' + encodeURIComponent('Google did not return a sign-in token.'));
    res.end();
    return;
  }

  let data = {};
  try {
    const upstream = await fetch(`${RENDER_API}/api/auth/google/id-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ idToken, state }),
    });
    data = await upstream.json();
    if (!upstream.ok || !data.token) {
      throw new Error(data.error || 'Google sign-in failed. Try again.');
    }
  } catch (err) {
    // Hand the token to the page, which can wait longer than this function if the API is asleep.
    const retry =
      `/auth/oauth-return/google#id_token=${encodeURIComponent(idToken)}` +
      `&state=${encodeURIComponent(state)}`;
    const message = err instanceof Error ? err.message : '';
    if (message && !/waking|fetch|network/i.test(message)) {
      res.statusCode = 302;
      res.setHeader('Location', `/login?mode=login&oauth_error=${encodeURIComponent(message)}`);
      res.end();
      return;
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(htmlBounce(retry));
    return;
  }

  const setup = data.setup === '1' ? '1' : '0';
  const appReturn = appReturnFromState(state);
  const dest = appReturn
    ? `${appReturn}${appReturn.includes('?') ? '&' : '?'}token=${encodeURIComponent(data.token)}&setup=${setup}`
    : `/auth/callback?token=${encodeURIComponent(data.token)}&setup=${setup}`;
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(htmlBounce(dest));
};
