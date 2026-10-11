const { URL } = require('node:url');

function config() {
  const apiKey = process.env.SEEDANCE_API_KEY || '';
  const baseUrl = (process.env.SEEDANCE_API_BASE_URL || '').replace(/\/+$/, '');
  const model = process.env.SEEDANCE_MODEL || '';
  if (!apiKey || !baseUrl || !model) throw new Error('Konfigurasi belum lengkap. Isi SEEDANCE_API_KEY, SEEDANCE_API_BASE_URL, dan SEEDANCE_MODEL di Vercel.');
  let parsed;
  try { parsed = new URL(baseUrl); } catch (_) { throw new Error('SEEDANCE_API_BASE_URL bukan URL yang valid.'); }
  if (parsed.protocol !== 'https:' && process.env.NODE_ENV === 'production') throw new Error('SEEDANCE_API_BASE_URL harus memakai HTTPS.');
  return { apiKey, baseUrl, model };
}
function getTaskId(data) {
  const keys = ['task_id', 'taskId', 'id'];
  function walk(value, depth = 0) {
    if (!value || typeof value !== 'object' || depth > 6) return null;
    for (const key of keys) if (typeof value[key] === 'string' && value[key].length && /task|id/i.test(key)) return value[key];
    for (const child of Object.values(value)) { const found = walk(child, depth + 1); if (found) return found; }
    return null;
  }
  return walk(data);
}
function getStatus(data) {
  const candidates = [];
  function walk(value, depth = 0) {
    if (!value || typeof value !== 'object' || depth > 7) return;
    if (typeof value.status === 'string') candidates.push(value.status);
    for (const child of Object.values(value)) walk(child, depth + 1);
  }
  walk(data);
  return candidates.find(s => /^(created|queued|pending|running|processing|succeeded|success|completed|complete|done|failed|error|cancelled|canceled|rejected)$/i.test(s)) || candidates[0] || 'processing';
}
function getVideoUrl(data) {
  const prioritized = [];
  const fallback = [];
  function walk(value, parentKey = '', parentType = '', depth = 0) {
    if (!value || depth > 9) return;
    if (typeof value === 'string') {
      if (/^https:\/\//i.test(value)) {
        if (/(video_url|videoUrl|video_uri|videoUri|download_url|output_url|video)/i.test(parentKey) || /video/i.test(parentType)) prioritized.push(value);
        else if (/^(url|uri|href|download)$/i.test(parentKey)) fallback.push(value);
      }
      return;
    }
    if (Array.isArray(value)) { for (const item of value) walk(item, parentKey, parentType, depth + 1); return; }
    if (typeof value === 'object') {
      const type = typeof value.type === 'string' ? value.type : parentType;
      for (const [key, child] of Object.entries(value)) walk(child, key, type, depth + 1);
    }
  }
  walk(data);
  return prioritized[0] || fallback[0] || null;
}
async function requestJson(url, options, timeoutMs = 25000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch (_) { data = { raw: text.slice(0, 1200) }; }
    if (!response.ok) {
      const detail = data?.error?.message || data?.message || data?.error || `HTTP ${response.status}`;
      throw new Error(`Seedance API (${response.status}): ${String(detail).slice(0, 350)}`);
    }
    return data;
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Permintaan ke penyedia API timeout.');
    throw err;
  } finally { clearTimeout(timer); }
}
async function createVideoTask({ prompt, aspectRatio, duration }) {
  const { apiKey, baseUrl, model } = config();
  // Pola request untuk API task asinkron yang kompatibel dengan BytePlus/ModelArk.
  // Jika provider Seedance kamu memakai schema lain, sesuaikan blok body ini.
  const body = {
    model,
    content: [{ type: 'text', text: prompt }],
    ratio: aspectRatio,
    duration: Math.max(1, Math.min(15, Number(duration) || 5)),
    watermark: false
  };
  const data = await requestJson(baseUrl, { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const videoUrl = getVideoUrl(data);
  const taskId = getTaskId(data);
  if (videoUrl) return { taskId: taskId || null, videoUrl, status: getStatus(data) };
  if (!taskId) throw new Error('Respons API tidak berisi task ID. Periksa schema respons pada console/API provider.');
  return { taskId, status: getStatus(data) };
}
async function getVideoTask(taskId) {
  const { apiKey, baseUrl } = config();
  const data = await requestJson(`${baseUrl}/${encodeURIComponent(taskId)}`, { method: 'GET', headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' } });
  return { taskId, status: getStatus(data), videoUrl: getVideoUrl(data), error: data?.error?.message || data?.message || null, rawStatus: getStatus(data) };
}
module.exports = { config, createVideoTask, getVideoTask };
