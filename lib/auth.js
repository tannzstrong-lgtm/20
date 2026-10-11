const crypto = require('node:crypto');

function configuredSecret() { return process.env.APP_ACCESS_CODE || ''; }
function safeEqual(a, b) {
  const aa = Buffer.from(String(a)); const bb = Buffer.from(String(b));
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}
function cookieOptions(maxAge) {
  const secure = process.env.VERCEL === '1' ? '; Secure' : '';
  return `Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}
function signature(expiry) {
  return crypto.createHmac('sha256', configuredSecret()).update(String(expiry)).digest('hex');
}
function makeSessionCookie() {
  const expiry = Math.floor(Date.now() / 1000) + 12 * 60 * 60;
  return `tva_session=${expiry}.${signature(expiry)}; ${cookieOptions(12 * 60 * 60)}`;
}
function isAuthenticated(req) {
  const secret = configuredSecret(); if (!secret) return false;
  const cookieHeader = req.headers.cookie || '';
  const match = cookieHeader.match(/(?:^|;\s*)tva_session=([^;]+)/);
  if (!match) return false;
  const parts = match[1].split('.'); if (parts.length !== 2) return false;
  const expiry = Number(parts[0]); if (!Number.isSafeInteger(expiry) || expiry < Math.floor(Date.now() / 1000)) return false;
  return safeEqual(parts[1], signature(expiry));
}
function requireAuth(req, res) {
  if (!configuredSecret()) {
    res.status(503).json({ error: 'APP_ACCESS_CODE belum diatur di Environment Variables Vercel.' });
    return false;
  }
  if (!isAuthenticated(req)) {
    res.status(401).json({ error: 'Sesi tidak aktif. Masukkan kode akses lagi.' });
    return false;
  }
  return true;
}
function validAccessCode(code) { const secret = configuredSecret(); return !!secret && safeEqual(code || '', secret); }
function clearSessionCookie() {
  const secure = process.env.VERCEL === '1' ? '; Secure' : '';
  return `tva_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
}
module.exports = { isAuthenticated, requireAuth, validAccessCode, makeSessionCookie, clearSessionCookie };
