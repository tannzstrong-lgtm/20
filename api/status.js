const { requireAuth } = require('../lib/auth');
const { getVideoTask } = require('../lib/provider');
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed' }); }
  if (!requireAuth(req, res)) return;
  const taskId = typeof req.query?.taskId === 'string' ? req.query.taskId : '';
  if (!taskId || taskId.length > 500 || /[\r\n]/.test(taskId)) return res.status(400).json({ error: 'taskId tidak valid.' });
  try { return res.status(200).json(await getVideoTask(taskId)); }
  catch (err) { console.error('[TannnVideoAI] poll failed:', err.message); return res.status(502).json({ error: err.message || 'Gagal mengambil status task.' }); }
};
