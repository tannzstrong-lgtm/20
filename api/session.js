const { isAuthenticated, validAccessCode, makeSessionCookie, clearSessionCookie } = require('../lib/auth');
function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch (_) {} }
  return {};
}
module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET') {
    if (!process.env.APP_ACCESS_CODE) return res.status(503).json({ authenticated: false, error: 'APP_ACCESS_CODE belum diatur di Vercel.' });
    return res.status(200).json({ authenticated: isAuthenticated(req) });
  }
  if (req.method === 'POST') {
    if (!process.env.APP_ACCESS_CODE) return res.status(503).json({ error: 'Pemilik perlu mengatur APP_ACCESS_CODE di Environment Variables Vercel terlebih dahulu.' });
    const { code } = readBody(req);
    if (typeof code !== 'string' || !validAccessCode(code)) return res.status(401).json({ error: 'Kode akses salah.' });
    res.setHeader('Set-Cookie', makeSessionCookie());
    return res.status(200).json({ authenticated: true });
  }
  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', clearSessionCookie());
    return res.status(200).json({ authenticated: false });
  }
  res.setHeader('Allow', 'GET, POST, DELETE');
  return res.status(405).json({ error: 'Method not allowed' });
};
