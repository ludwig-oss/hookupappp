/**
 * Edge middleware: proxy /api/* → BACKEND_URL before static SPA rewrites.
 * Set BACKEND_URL in Vercel (e.g. https://your-app.onrender.com, no trailing slash).
 */
export const config = {
  matcher: '/api/:path*',
};

function json(status, obj) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

export default async function middleware(request) {
  const backend = (process.env.BACKEND_URL || process.env.VITE_API_URL || '').replace(/\/+$/, '');
  if (!backend) {
    return json(503, {
      error:
        'BACKEND_URL not configured. Vercel → Settings → Environment Variables → add BACKEND_URL (your API URL, no trailing slash).',
    });
  }

  const url = new URL(request.url);
  const pathPart = url.pathname.replace(/^\/api\/?/, '');
  if (!pathPart) {
    return json(400, { error: 'Bad API path' });
  }

  const target = `${backend}/api/${pathPart}${url.search}`;
  const headers = new Headers();
  request.headers.forEach((value, key) => {
    const low = key.toLowerCase();
    if (low === 'host' || low === 'connection' || low === 'keep-alive' || low === 'content-length') return;
    headers.set(key, value);
  });

  let body;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    body = await request.arrayBuffer();
  }

  try {
    const res = await fetch(target, {
      method: request.method,
      headers,
      body: body && body.byteLength ? body : undefined,
      redirect: 'manual',
    });
    const out = new Headers();
    res.headers.forEach((value, key) => {
      const low = key.toLowerCase();
      if (low === 'content-encoding' || low === 'transfer-encoding') return;
      out.set(key, value);
    });
    return new Response(res.body, { status: res.status, headers: out });
  } catch {
    return json(502, { error: 'Could not reach backend. Check BACKEND_URL and that the API is running.' });
  }
}
