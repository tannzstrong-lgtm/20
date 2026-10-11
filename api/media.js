const { isIP } = require('node:net');
const dns = require('node:dns').promises;
const { Readable } = require('node:stream');
const { requireAuth } = require('../lib/auth');

function isPrivateIp(address) {
  const ip = String(address).toLowerCase().replace(/^::ffff:/, '');
  if (ip === '::1' || ip === '::' || ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80:')) return true;
  if (ip.includes(':')) return false;
  const a = ip.split('.').map(Number); if (a.length !== 4 || a.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  return a[0] === 10 || a[0] === 127 || a[0] === 0 || (a[0] === 169 && a[1] === 254) || (a[0] === 172 && a[1] >= 16 && a[1] <= 31) || (a[0] === 192 && a[1] === 168) || (a[0] === 100 && a[1] >= 64 && a[1] <= 127) || a[0] >= 224;
}
async function allowedUrl(raw) {
  let url; try { url = new URL(raw); } catch (_) { throw new Error('URL video tidak valid.'); }
  if (url.protocol !== 'https:' || url.username || url.password || !url.hostname) throw new Error('Hanya URL video HTTPS publik yang diizinkan.');
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host === 'metadata.google.internal') throw new Error('Host media tidak diizinkan.');
  const allow = (process.env.SEEDANCE_MEDIA_HOSTS || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
  if (allow.length && !allow.some(domain => host === domain || host.endsWith(`.${domain}`))) throw new Error('Hostname media tidak ada di whitelist SEEDANCE_MEDIA_HOSTS.');
  const ipType = isIP(host);
  if (ipType) { if (isPrivateIp(host)) throw new Error('IP privat tidak diizinkan.'); }
  else {
    let addresses; try { addresses = await dns.lookup(host, { all: true, verbatim: true }); } catch (_) { throw new Error('Hostname media tidak bisa di-resolve.'); }
    if (!addresses.length || addresses.some(item => isPrivateIp(item.address))) throw new Error('Host media mengarah ke jaringan privat dan diblokir.');
  }
  return url;
}
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'private, max-age=120');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed' }); }
  if (!requireAuth(req, res)) return;
  const raw = typeof req.query?.url === 'string' ? req.query.url : '';
  if (!raw || raw.length > 5000) return res.status(400).json({ error: 'URL video tidak valid.' });
  try {
    let url = await allowedUrl(raw);
    const headers = { Accept: 'video/*, application/octet-stream;q=0.9, */*;q=0.5' };
    if (typeof req.headers.range === 'string' && /^bytes=\d*-\d*$/.test(req.headers.range)) headers.Range = req.headers.range;
    let upstream;
    for (let redirectCount = 0; redirectCount <= 4; redirectCount++) {
      upstream = await fetch(url, { method: 'GET', headers, redirect: 'manual', signal: AbortSignal.timeout(60000) });
      if (![301, 302, 303, 307, 308].includes(upstream.status)) break;
      const location = upstream.headers.get('location');
      if (!location || redirectCount === 4) throw new Error('Redirect media tidak valid atau terlalu banyak.');
      url = await allowedUrl(new URL(location, url).href);
    }
    if (!upstream.ok && upstream.status !== 206) { const status = upstream.status === 404 ? 404 : 502; return res.status(status).json({ error: `Media provider mengembalikan HTTP ${upstream.status}.` }); }
    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'video/mp4');
    for (const key of ['content-length', 'content-range', 'accept-ranges']) { const value = upstream.headers.get(key); if (value) res.setHeader(key === 'content-length' ? 'Content-Length' : key === 'content-range' ? 'Content-Range' : 'Accept-Ranges', value); }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (!upstream.body) return res.end();
    Readable.fromWeb(upstream.body).pipe(res);
  } catch (err) {
    console.error('[TannnVideoAI] media proxy failed:', err.message);
    if (!res.headersSent) return res.status(400).json({ error: err.message || 'Tidak bisa membaca media video.' });
    res.destroy(err);
  }
};
