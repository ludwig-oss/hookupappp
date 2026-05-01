/**
 * Edge: proxy /api/* → BACKEND_URL (runs before SPA static rewrites).
 */
export const config = {
  matcher: '/api/:path*',
};

export default async function middleware(request: Request): Promise<Response> {
  const backend = (process.env.BACKEND_URL || process.env.VITE_API_URL || '').replace(/\/+$/, '');
  if (!backend) {
    return new Response(
      JSON.stringify({
        error:
          'BACKEND_URL not configured. Vercel → Environment Variables → BACKEND_URL (API URL, no trailing slash).',
      }),
      { status: 503, headers: { 'content-type': 'application/json; charset=utf-8' } }
    );
  }

  const url = new URL(request.url);
  const pathPart = url.pathname.replace(/^\/api\/?/, '');
  if (!pathPart) {
    return new Response(JSON.stringify({ error: 'Bad API path' }), {
      status: 400,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }

  const target = `${backend}/api/${pathPart}${url.search}`;
  const headers = new Headers();
  request.headers.forEach((value, key) => {
    const low = key.toLowerCase();
    if (low === 'host' || low === 'connection' || low === 'keep-alive' || low === 'content-length') return;
    headers.set(key, value);
  });

  let body: ArrayBuffer | undefined;
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
    return new Response(JSON.stringify({ error: 'Could not reach backend.' }), {
      status: 502,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }
}
