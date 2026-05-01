/** Diagnostic: GET /api/vercel-ping — confirms Vercel deploys /api serverless routes. */
module.exports = (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.status(200).send(JSON.stringify({ ok: true, via: 'vercel-ping', method: req.method || 'GET' }));
};
