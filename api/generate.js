const { requireAuth } = require('../lib/auth');
const { createVideoTask } = require('../lib/provider');
function bodyOf(req) { if (req.body && typeof req.body === 'object') return req.body; if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch (_) {} } return {}; }
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
  if (!requireAuth(req, res)) return;
  const body = bodyOf(req);
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  const sceneIndex = Number(body.sceneIndex);
  const aspectRatio = ['9:16', '16:9', '1:1'].includes(body.aspectRatio) ? body.aspectRatio : '9:16';
  const duration = Number(body.duration) || 5;
  if (prompt.length < 8 || prompt.length > 6000) return res.status(400).json({ error: 'Prompt wajib 8–6.000 karakter.' });
  if (!Number.isInteger(sceneIndex) || sceneIndex < 0 || sceneIndex > 11) return res.status(400).json({ error: 'Nomor adegan tidak valid.' });
  if (duration !== 5) return res.status(400).json({ error: 'Aplikasi ini mengirim klip 5 detik untuk target video 60 detik.' });
  try {
    const result = await createVideoTask({ prompt, aspectRatio, duration });
    return res.status(200).json({ ...result, sceneIndex });
  } catch (err) {
    console.error('[TannnVideoAI] create-task failed:', err.message);
    return res.status(502).json({ error: err.message || 'Gagal mengirim task ke penyedia Seedance.' });
  }
};
