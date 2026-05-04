/**
 * Vercel Node serverless: proxy /api/* → BACKEND_URL.
 * Fixes: (1) POST body not always on req.body, (2) path as /auth/... vs /api/auth/...
 */
function getBackendBase() {
  const raw =
    process.env.BACKEND_URL ||
    process.env.VITE_API_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    '';
  return raw.replace(/\/+$/, '');
}

function extractApiPath(req) {
  const pathParam = req.query?.path;
  if (pathParam !== undefined && pathParam !== null && String(pathParam).length > 0) {
    if (Array.isArray(pathParam)) {
      return pathParam.map((s) => decodeURIComponent(String(s))).join('/');
    }
    return decodeURIComponent(String(pathParam));
  }
  let pathOnly = (req.url || '').split('?')[0] || '';
  if (!pathOnly.startsWith('/')) pathOnly = '/' + pathOnly;
  if (pathOnly.startsWith('/api/')) {
    return decodeURIComponent(pathOnly.slice('/api/'.length));
  }
  // Vercel may invoke with path already relative to /api
  if (pathOnly.length > 1) {
    const rest = pathOnly.startsWith('/') ? pathOnly.slice(1) : pathOnly;
    if (rest && !rest.startsWith('_')) return decodeURIComponent(rest);
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

async function bodyForUpstream(req) {
  if (req.body !== undefined && req.body !== null) {
    if (Buffer.isBuffer(req.body)) return { body: req.body, contentType: null };
    if (typeof req.body === 'string') return { body: Buffer.from(req.body, 'utf8'), contentType: null };
    if (typeof req.body === 'object') {
      return {
        body: Buffer.from(JSON.stringify(req.body), 'utf8'),
        contentType: 'application/json',
      };
    }
  }
  const method = (req.method || 'GET').toUpperCase();
  if (method === 'GET' || method === 'HEAD') return { body: undefined, contentType: null };

  const chunks = [];
  try {
    for await (const chunk of req) {
      chunks.push(chunk);
    }
  } catch {
    return { body: undefined, contentType: null };
  }
  if (!chunks.length) return { body: undefined, contentType: null };
  return { body: Buffer.concat(chunks), contentType: null };
}

module.exports = async function handler(req, res) {
  const base = getBackendBase();
  if (!base) {
    res.status(503).setHeader('Content-Type', 'application/json');
    res.send(
      JSON.stringify({
        error:
          'API proxy: set BACKEND_URL in Vercel (your Render URL, no trailing slash). Or set VITE_API_URL on Vercel and FRONTEND_URL on Render for direct API + CORS.',
      })
    );
    return;
  }

  const apiPath = extractApiPath(req);
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
  const { body: rawBody, contentType: inferredCt } = await bodyForUpstream(req);
  let body;
  if (method !== 'GET' && method !== 'HEAD') {
    body = rawBody && rawBody.length ? rawBody : undefined;
    if (body && inferredCt && !headers.has('content-type')) {
      headers.set('content-type', inferredCt);
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
        error: 'Could not reach backend. Confirm BACKEND_URL and that Render is awake.',
      })
    );
  }
};
