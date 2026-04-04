/**
 * Proxies browser /api/* → your real backend (Render, etc.).
 * Vercel rewrites: /api/:path* → /api/p/:path* (this file).
 *
 * Vercel env: BACKEND_URL = https://your-api.onrender.com (no trailing slash)
 * Fallback: VITE_API_URL or RENDER_EXTERNAL_URL
 */

const PREFIX = '/api/p/';

function getBackendBase() {
  const raw =
    process.env.BACKEND_URL ||
    process.env.VITE_API_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    '';
  return raw.replace(/\/+$/, '');
}

function extractPath(req) {
  const raw = req.url || '';
  const pathOnly = raw.split('?')[0] || '';
  if (pathOnly.startsWith(PREFIX)) {
    return decodeURIComponent(pathOnly.slice(PREFIX.length));
  }
  if (pathOnly.startsWith('/p/')) {
    return decodeURIComponent(pathOnly.slice('/p/'.length));
  }
  if (pathOnly.startsWith('/')) {
    return decodeURIComponent(pathOnly.slice(1));
  }
  return '';
}

function buildTargetUrl(req, apiPath) {
  const base = getBackendBase();
  const u = new URL(req.url || '/', 'http://localhost');
  const forwardQs = u.searchParams.toString();
  return `${base}/api/${apiPath}${forwardQs ? `?${forwardQs}` : ''}`;
}

const HOP_BY_HOP = new Set([
  'connection',
  'content-length',
  'host',
  'keep-alive',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

async function handler(req, res) {
  const base = getBackendBase();
  if (!base) {
    res.status(503).setHeader('Content-Type', 'application/json');
    res.send(
      JSON.stringify({
        error:
          'API proxy not configured. In Vercel → Settings → Environment Variables, set BACKEND_URL to your API (e.g. https://app.onrender.com) with no trailing slash.',
      })
    );
    return;
  }

  const apiPath = extractPath(req);
  if (!apiPath) {
    res.status(400).setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify({ error: 'Bad API path' }));
    return;
  }

  const target = buildTargetUrl(req, apiPath);
  const headers = new Headers();

  for (const [key, value] of Object.entries(req.headers || {})) {
    if (value == null) continue;
    const lower = key.toLowerCase();
    if (HOP_BY_HOP.has(lower)) continue;
    const v = Array.isArray(value) ? value.join(',') : value;
    headers.set(key, v);
  }

  const method = (req.method || 'GET').toUpperCase();
  let body;
  if (method !== 'GET' && method !== 'HEAD') {
    if (req.body !== undefined && req.body !== null) {
      if (typeof req.body === 'string' || Buffer.isBuffer(req.body)) {
        body = req.body;
      } else if (typeof req.body === 'object') {
        body = JSON.stringify(req.body);
        if (!headers.has('content-type')) headers.set('content-type', 'application/json');
      }
    }
  }

  try {
    const upstream = await fetch(target, { method, headers, body, redirect: 'manual' });
    res.status(upstream.status);
    upstream.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      if (lower === 'content-encoding' || lower === 'transfer-encoding') return;
      try {
        res.setHeader(key, value);
      } catch {
        /* ignore */
      }
    });
    res.send(Buffer.from(await upstream.arrayBuffer()));
  } catch (e) {
    console.error('[api proxy]', target, e);
    res.status(502).setHeader('Content-Type', 'application/json');
    res.send(
      JSON.stringify({
        error: 'Could not reach the backend API. Check BACKEND_URL and that your server is running.',
      })
    );
  }
}

module.exports = handler;
