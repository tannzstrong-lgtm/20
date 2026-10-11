(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const sceneBeats = [
    ['Hook pembuka', 'Buka dengan visual kuat yang langsung menarik perhatian dan memperkenalkan misteri utama.'],
    ['Kenalkan karakter', 'Perlihatkan tokoh utama, ciri visual yang mudah dikenali, dan lingkungan tempat ia berada.'],
    ['Konflik muncul', 'Tampilkan kejadian yang mengganggu keadaan awal dan mulai membangun ketegangan.'],
    ['Reaksi emosional', 'Fokus pada ekspresi, gestur, dan reaksi emosional tokoh utama.'],
    ['Taruhan meningkat', 'Perbesar risiko dan tekanan; gunakan komposisi serta gerakan kamera yang dinamis.'],
    ['Petunjuk pertama', 'Tunjukkan detail atau petunjuk visual yang mengubah cara penonton memahami konflik.'],
    ['Aksi dimulai', 'Masukkan aksi yang jelas terbaca, koreografi aman, dan pergerakan kamera yang sinematik.'],
    ['Perubahan keadaan', 'Balikkan situasi dengan kejadian tak terduga yang masih masuk akal untuk cerita.'],
    ['Konfrontasi', 'Hadapkan tokoh utama dengan sumber konflik dalam momen penuh tensi.'],
    ['Klimaks', 'Sajikan momen paling intens dan visual paling kuat dari keseluruhan cerita.'],
    ['Akibat', 'Perlihatkan akibat dari klimaks serta perubahan yang dialami tokoh utama.'],
    ['Twist penutup', 'Akhiri dengan kejutan, citra memorable, atau cliffhanger yang membuat penonton ingin lanjut.']
  ];
  const state = {
    style: 'Realistis sinematik', scenes: sceneBeats.map((b, i) => ({ index: i, title: b[0], beat: b[1], detail: '', status: 'queued', taskId: null, videoUrl: null, error: '' })),
    generating: false, rendering: false, finalUrl: null, finalBlob: null, appAccess: false, toastTimer: null
  };

  async function api(path, options = {}) {
    const response = await fetch(path, { credentials: 'same-origin', ...options, headers: { ...(options.headers || {}), ...(options.body ? { 'Content-Type': 'application/json' } : {}) } });
    let data = {};
    try { data = await response.json(); } catch (_) {}
    if (!response.ok) throw new Error(data.error || `Permintaan gagal (${response.status})`);
    return data;
  }
  function toast(message) {
    const el = $('toast'); el.textContent = message; el.classList.add('show');
    clearTimeout(state.toastTimer); state.toastTimer = setTimeout(() => el.classList.remove('show'), 3600);
  }
  function setMessage(message, type = '') {
    const el = $('statusMessage'); el.textContent = message; el.className = `status-message ${type}`.trim();
  }
  function setPipeline(id, status, labelId) {
    const el = $(id); el.classList.remove('done', 'running');
    if (status) el.classList.add(status);
    if (labelId) $(labelId).textContent = status === 'done' ? 'SELESAI' : status === 'running' ? 'BERJALAN' : 'MENUNGGU';
  }
  function completedCount() { return state.scenes.filter(s => s.status === 'done' && s.videoUrl).length; }
  function refreshProgress() {
    const count = completedCount();
    const all = count === 12;
    $('sceneDoneCount').textContent = count;
    $('progressScenes').innerHTML = `${count} <span>/ 12</span>`;
    const percent = Math.round(count / 12 * 100);
    $('progressPercent').textContent = `${percent}%`;
    $('progressBar').style.width = `${percent}%`;
    $('progressLabel').textContent = state.rendering ? 'Merender video final' : state.generating ? 'Membuat klip AI' : all ? 'Semua klip selesai' : count ? 'Generasi sebagian selesai' : 'Menunggu prompt';
    $('renderButton').disabled = !all || state.rendering || state.generating;
    $('renderButton').classList.toggle('hidden', !all && !state.rendering);
    $('renderButton').innerHTML = state.rendering ? '<span>◌</span> Sedang merender...' : '<span>▣</span> Gabungkan klip menjadi video';
    $('generateButton').disabled = state.generating || state.rendering;
    $('generateButtonText').textContent = state.generating ? 'Sedang membuat klip...' : count && !all ? 'Lanjutkan / ulangi adegan' : all ? 'Generate ulang video' : 'Buat video 60 detik';
    if (count > 0) setPipeline('pipelineGenerate', all ? 'done' : state.generating ? 'running' : '', 'pipelineGenerateState');
    if (state.rendering) setPipeline('pipelineRender', 'running', 'pipelineRenderState');
    else if (state.finalBlob) setPipeline('pipelineRender', 'done', 'pipelineRenderState');
    else setPipeline('pipelineRender', '', 'pipelineRenderState');
    $('emptyPreview').classList.toggle('hidden', !!state.finalBlob);
    $('finalVideo').classList.toggle('hidden', !state.finalBlob);
    $('downloadButton').classList.toggle('hidden', !state.finalBlob);
  }
  function renderScenes() {
    $('sceneList').innerHTML = '';
    state.scenes.forEach((scene, index) => {
      const card = document.createElement('article'); card.className = 'scene-card'; card.dataset.index = index;
      const top = document.createElement('div'); top.className = 'scene-card-top'; top.setAttribute('role', 'button'); top.setAttribute('tabindex', '0'); top.setAttribute('aria-expanded', 'false');
      const num = document.createElement('span'); num.className = 'scene-number'; num.textContent = String(index + 1).padStart(2, '0');
      const meta = document.createElement('div'); meta.className = 'scene-meta';
      const title = document.createElement('strong'); title.textContent = scene.title;
      const sub = document.createElement('small'); sub.textContent = scene.detail.trim() || scene.beat;
      meta.append(title, sub);
      const badge = document.createElement('span'); badge.className = `scene-status ${scene.status === 'done' ? 'success' : scene.status === 'working' ? 'working' : ''}`; badge.textContent = scene.status === 'done' ? 'SELESAI' : scene.status === 'working' ? 'GENERATE' : scene.status === 'error' ? 'GAGAL' : '5 DETIK';
      const toggle = document.createElement('span'); toggle.className = 'scene-toggle'; toggle.textContent = '⌄';
      top.append(num, meta, badge, toggle);
      const editor = document.createElement('div'); editor.className = 'scene-editor';
      const label = document.createElement('label'); label.textContent = `Detail tambahan adegan ${index + 1}`;
      const textarea = document.createElement('textarea'); textarea.className = 'scene-textarea'; textarea.maxLength = 1200; textarea.placeholder = 'Opsional: detail lokasi, aksi, angle kamera, kostum, ekspresi, atau transisi...'; textarea.value = scene.detail;
      textarea.addEventListener('input', () => { scene.detail = textarea.value; sub.textContent = scene.detail.trim() || scene.beat; });
      const tools = document.createElement('div'); tools.className = 'scene-tools';
      const hint = document.createElement('span'); hint.className = 'helper-text'; hint.textContent = 'Opsional · maks. 1.200 karakter';
      const retry = document.createElement('button'); retry.className = 'mini-button'; retry.type = 'button'; retry.textContent = scene.status === 'error' ? 'Coba lagi' : 'Siap'; retry.disabled = state.generating || scene.status !== 'error';
      retry.addEventListener('click', () => generateOne(index));
      tools.append(hint, retry); editor.append(label, textarea, tools);
      if (scene.error) { const err = document.createElement('div'); err.className = 'scene-error'; err.textContent = scene.error; editor.append(err); }
      if (scene.videoUrl) { const link = document.createElement('a'); link.className = 'scene-video-link'; link.href = mediaUrl(scene.videoUrl); link.target = '_blank'; link.rel = 'noopener'; link.textContent = 'Buka klip hasil ↗'; editor.append(link); }
      top.addEventListener('click', () => { const open = card.classList.toggle('open'); top.setAttribute('aria-expanded', String(open)); });
      top.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); top.click(); } });
      card.append(top, editor); $('sceneList').append(card);
    });
    refreshProgress();
  }
  function mediaUrl(raw) { return `/api/media?url=${encodeURIComponent(raw)}`; }
  function makeScenePrompt(scene, story, genre, ratio) {
    const ratioDescription = ratio === '9:16' ? 'format vertikal 9:16 untuk video mobile' : ratio === '16:9' ? 'format layar lebar 16:9' : 'format persegi 1:1';
    return `${story}\n\nADEGAN ${scene.index + 1} DARI 12 — ${scene.title}. ${scene.beat}${scene.detail.trim() ? ` Detail khusus adegan: ${scene.detail.trim()}.` : ''}\n\nARAHAN PRODUKSI: Genre ${genre}. Gaya visual ${state.style}. ${ratioDescription}. Target durasi tepat 5 detik. Buat aksi utama mudah dipahami dan selesai atau mencapai momen visual yang kuat dalam klip singkat. Jaga identitas visual karakter utama, umur dewasa jika relevan, ciri wajah, rambut, pakaian, palet warna, dan suasana tetap konsisten antaradegan berdasarkan deskripsi cerita. Sinematografi profesional, pencahayaan terarah, gerakan kamera halus yang bermakna, gerak tubuh alami, detail sinematik tinggi. Jangan tambahkan teks, watermark, logo, atau subtitle yang tidak diminta. Adegan harus sesuai dengan cerita dan menjadi bagian dari film berdurasi 60 detik. Jika model mendukung audio, gunakan ambience/suara yang selaras dengan adegan tanpa mengubah cerita.`;
  }
  async function createTask(scene, prompt) {
    const data = await api('/api/generate', { method: 'POST', body: JSON.stringify({ sceneIndex: scene.index, prompt, aspectRatio: $('ratioSelect').value, duration: 5 }) });
    if (data.videoUrl) return { directUrl: data.videoUrl, taskId: null };
    if (!data.taskId) throw new Error('API tidak mengembalikan task ID. Periksa format respons API Seedance.');
    return { taskId: data.taskId };
  }
  async function pollTask(taskId, scene) {
    for (let attempt = 0; attempt < 120; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 6000));
      const data = await api(`/api/status?taskId=${encodeURIComponent(taskId)}`);
      const status = String(data.status || 'processing').toLowerCase();
      if (data.videoUrl && (['succeeded', 'success', 'completed', 'complete', 'done'].includes(status) || !status)) return data.videoUrl;
      if (['failed', 'error', 'cancelled', 'canceled', 'rejected'].includes(status)) throw new Error(data.error || data.message || 'Tugas video gagal dari penyedia API.');
      scene.providerStatus = status;
      updateSceneRuntime(scene.index);
    }
    throw new Error('Menunggu hasil terlalu lama (12 menit). Kamu bisa coba generate adegan ini lagi.');
  }
  function updateSceneRuntime(index) {
    const card = $('sceneList').querySelector(`[data-index="${index}"]`); if (!card) return;
    const scene = state.scenes[index]; const badge = card.querySelector('.scene-status');
    badge.className = `scene-status ${scene.status === 'done' ? 'success' : scene.status === 'working' ? 'working' : ''}`;
    badge.textContent = scene.status === 'done' ? 'SELESAI' : scene.status === 'working' ? 'GENERATE' : scene.status === 'error' ? 'GAGAL' : '5 DETIK';
    const retry = card.querySelector('.mini-button'); if (retry) { retry.disabled = state.generating || scene.status !== 'error'; retry.textContent = scene.status === 'error' ? 'Coba lagi' : 'Siap'; }
    const err = card.querySelector('.scene-error'); if (err) err.remove();
    if (scene.error) { const el = document.createElement('div'); el.className = 'scene-error'; el.textContent = scene.error; card.querySelector('.scene-editor').append(el); }
    const sub = card.querySelector('.scene-meta small'); if (sub) sub.textContent = scene.status === 'working' ? `Sedang memproses · ${scene.providerStatus || 'mengirim tugas'}` : scene.detail.trim() || scene.beat;
    refreshProgress();
  }
  async function generateOne(index) {
    const scene = state.scenes[index];
    if (state.generating || state.rendering) return;
    const story = $('storyPrompt').value.trim();
    if (!story) { $('storyPrompt').focus(); toast('Tulis ide cerita terlebih dahulu.'); return; }
    state.generating = true; scene.status = 'working'; scene.error = ''; scene.videoUrl = null; scene.taskId = null;
    renderScenes(); setPipeline('pipelineGenerate', 'running', 'pipelineGenerateState');
    setMessage(`Mengirim adegan ${index + 1}/12 ke Seedance 2.0...`); refreshProgress();
    try {
      const response = await createTask(scene, makeScenePrompt(scene, story, $('genreSelect').value, $('ratioSelect').value));
      scene.taskId = response.taskId;
      scene.videoUrl = response.directUrl || await pollTask(response.taskId, scene);
      scene.status = 'done'; scene.error = ''; setMessage(`Adegan ${index + 1} selesai.` , 'success');
    } catch (err) { scene.status = 'error'; scene.error = err.message || 'Terjadi kesalahan.'; setMessage(`Adegan ${index + 1} gagal: ${scene.error}`, 'error'); }
    finally { state.generating = false; renderScenes(); refreshProgress(); }
  }
  async function startGeneration() {
    if (state.generating || state.rendering) return;
    const story = $('storyPrompt').value.trim();
    if (story.length < 8) { $('storyPrompt').focus(); toast('Tulis cerita yang lebih lengkap (minimal 8 karakter).'); return; }
    if (completedCount() === 12) {
      const confirmed = window.confirm('Semua adegan sudah selesai. Generate ulang akan membuat 12 tugas AI baru dan dapat menimbulkan biaya API lagi. Lanjutkan?');
      if (!confirmed) return;
      state.scenes.forEach(scene => { scene.status = 'queued'; scene.taskId = null; scene.videoUrl = null; scene.error = ''; });
    }
    state.generating = true;
    if (state.finalUrl) URL.revokeObjectURL(state.finalUrl);
    state.finalBlob = null; state.finalUrl = null; $('finalVideo').removeAttribute('src'); $('downloadButton').removeAttribute('href');
    const storySnapshot = story; const genre = $('genreSelect').value; const ratio = $('ratioSelect').value;
    const pending = state.scenes.filter(s => !(s.status === 'done' && s.videoUrl));
    state.scenes.forEach(s => { if (!(s.status === 'done' && s.videoUrl)) { s.status = 'queued'; s.error = ''; } });
    renderScenes(); setPipeline('pipelineGenerate', 'running', 'pipelineGenerateState'); setPipeline('pipelineRender', '', 'pipelineRenderState');
    setMessage(`Memulai ${pending.length} adegan. Dua klip diproses secara bersamaan; biaya API dapat dikenakan oleh penyedia.`);
    let next = 0; let failed = 0;
    const worker = async () => {
      while (true) {
        const idx = next++; if (idx >= pending.length) return;
        const scene = pending[idx]; scene.status = 'working'; scene.error = ''; updateSceneRuntime(scene.index);
        setMessage(`Mengirim dan menunggu adegan ${scene.index + 1}/12. Jangan tutup tab selama proses berlangsung.`);
        try {
          const job = await createTask(scene, makeScenePrompt(scene, storySnapshot, genre, ratio));
          scene.taskId = job.taskId;
          scene.videoUrl = job.directUrl || await pollTask(job.taskId, scene);
          if (!scene.videoUrl) throw new Error('Tugas selesai tanpa URL video yang dapat dibaca.');
          scene.status = 'done'; scene.error = ''; scene.providerStatus = 'succeeded';
        } catch (err) { scene.status = 'error'; scene.error = err.message || 'Terjadi kesalahan pada penyedia API.'; failed++; }
        updateSceneRuntime(scene.index);
      }
    };
    try {
      await Promise.all([worker(), worker()]);
      const count = completedCount();
      if (count === 12) {
        setMessage('Semua 12 klip berhasil dibuat. Tekan “Gabungkan klip menjadi video” untuk merender satu file 60 detik.', 'success');
        setPipeline('pipelineGenerate', 'done', 'pipelineGenerateState'); toast('Semua adegan berhasil dibuat.');
      } else {
        setMessage(`${count}/12 adegan berhasil dibuat. ${failed} adegan gagal. Tekan tombol generate lagi untuk melanjutkan dan mengulang adegan yang gagal.`, 'error');
        toast(`${count}/12 adegan selesai; beberapa perlu dicoba ulang.`);
      }
    } finally { state.generating = false; renderScenes(); refreshProgress(); }
  }
  function waitEvent(target, eventName, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { cleanup(); reject(new Error(`Timeout saat memuat media (${eventName}).`)); }, timeout);
      const success = () => { cleanup(); resolve(); };
      const failure = () => { cleanup(); reject(new Error('Klip tidak bisa diputar. Periksa URL media/CORS dan respons penyedia.')); };
      function cleanup() { clearTimeout(timer); target.removeEventListener(eventName, success); target.removeEventListener('error', failure); }
      target.addEventListener(eventName, success, { once: true }); target.addEventListener('error', failure, { once: true });
    });
  }
  async function renderFinalVideo() {
    if (state.rendering || state.generating || completedCount() !== 12) return;
    if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) { toast('Browser ini tidak mendukung render video. Buka dengan Chrome/Edge terbaru.'); return; }
    const ratio = $('ratioSelect').value;
    const dims = ratio === '16:9' ? [1280, 720] : ratio === '1:1' ? [900, 900] : [720, 1280];
    const canvas = document.createElement('canvas'); [canvas.width, canvas.height] = dims;
    const ctx = canvas.getContext('2d', { alpha: false });
    const video = document.createElement('video'); video.playsInline = true; video.preload = 'auto'; video.muted = false; video.crossOrigin = 'anonymous';
    video.style.position = 'fixed'; video.style.width = '2px'; video.style.height = '2px'; video.style.opacity = '0'; video.style.pointerEvents = 'none'; video.style.left = '-10px'; document.body.append(video);
    let audioCtx, audioSource, recorder, renderStream, rafId, stopLoop = false;
    try {
      state.rendering = true; refreshProgress(); setPipeline('pipelineRender', 'running', 'pipelineRenderState');
      $('renderProgressWrap').classList.remove('hidden'); $('renderProgressLabel').textContent = 'Memuat adegan pertama...'; $('renderProgressValue').textContent = '0%'; $('renderProgressBar').style.width = '0%';
      $('downloadButton').classList.add('hidden'); state.finalBlob = null;
      video.src = mediaUrl(state.scenes[0].videoUrl); video.load(); await waitEvent(video, 'loadeddata', 45000);
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); await audioCtx.resume(); audioSource = audioCtx.createMediaElementSource(video); const audioDest = audioCtx.createMediaStreamDestination(); audioSource.connect(audioDest); renderStream = canvas.captureStream(30); audioDest.stream.getAudioTracks().forEach(t => renderStream.addTrack(t)); }
      catch (_) { renderStream = canvas.captureStream(30); }
      const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find(type => MediaRecorder.isTypeSupported(type));
      if (!mime) throw new Error('Browser tidak mendukung output WebM. Gunakan Chrome atau Edge versi terbaru.');
      const chunks = []; recorder = new MediaRecorder(renderStream, { mimeType: mime, videoBitsPerSecond: 4500000, audioBitsPerSecond: 128000 });
      recorder.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
      const recordingDone = new Promise((resolve, reject) => { recorder.onstop = () => resolve(); recorder.onerror = () => reject(new Error('Perekaman video gagal di browser.')); });
      const draw = () => {
        if (stopLoop) return;
        ctx.fillStyle = '#070710'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        if (video.readyState >= 2 && video.videoWidth && video.videoHeight) {
          const sourceRatio = video.videoWidth / video.videoHeight, targetRatio = canvas.width / canvas.height;
          let sx = 0, sy = 0, sw = video.videoWidth, sh = video.videoHeight;
          if (sourceRatio > targetRatio) { sw = video.videoHeight * targetRatio; sx = (video.videoWidth - sw) / 2; }
          else { sh = video.videoWidth / targetRatio; sy = (video.videoHeight - sh) / 2; }
          ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
        }
        rafId = requestAnimationFrame(draw);
      };
      draw(); recorder.start(1000);
      for (let i = 0; i < state.scenes.length; i++) {
        if (i > 0) {
          video.pause();
          if (recorder.state === 'recording') recorder.pause();
          video.src = mediaUrl(state.scenes[i].videoUrl); video.load();
          await waitEvent(video, 'loadeddata', 45000);
        }
        try { await video.play(); } catch (e) { throw new Error('Browser menolak memutar klip. Klik render setelah mengaktifkan pemutaran media, lalu coba lagi.'); }
        if (i > 0 && recorder.state === 'paused') recorder.resume();
        $('renderProgressLabel').textContent = `Merender adegan ${i + 1} dari 12`;
        const start = performance.now();
        while (performance.now() - start < 5000) {
          const elapsed = performance.now() - start;
          const pct = Math.min(99, Math.floor((i * 5000 + elapsed) / 60000 * 100));
          $('renderProgressValue').textContent = `${pct}%`; $('renderProgressBar').style.width = `${pct}%`;
          await new Promise(r => setTimeout(r, 180));
        }
        video.pause();
      }
      stopLoop = true; cancelAnimationFrame(rafId); recorder.stop(); await recordingDone;
      const blob = new Blob(chunks, { type: mime });
      if (blob.size < 10000) throw new Error('File hasil render terlalu kecil. Coba ulangi render atau periksa video hasil API.');
      if (state.finalUrl) URL.revokeObjectURL(state.finalUrl);
      state.finalBlob = blob; state.finalUrl = URL.createObjectURL(blob);
      $('finalVideo').src = state.finalUrl; $('finalVideo').load(); $('downloadButton').href = state.finalUrl; $('downloadButton').download = `tannnvideo-ai-60s-${new Date().toISOString().slice(0,10)}.webm`;
      $('renderProgressLabel').textContent = 'Render selesai'; $('renderProgressValue').textContent = '100%'; $('renderProgressBar').style.width = '100%';
      setMessage('Video final berhasil dirender di perangkat ini. Durasi render ditargetkan 60 detik; codec dan suara tergantung dukungan browser serta klip sumber.', 'success');
      setPipeline('pipelineRender', 'done', 'pipelineRenderState'); toast('Video final siap di-download.');
    } catch (err) {
      setMessage(`Render gagal: ${err.message || 'Kesalahan yang tidak diketahui.'}`, 'error'); toast('Render gagal. Baca pesan status untuk detail.');
    } finally {
      stopLoop = true; if (rafId) cancelAnimationFrame(rafId); if (recorder && recorder.state !== 'inactive') { try { recorder.stop(); } catch (_) {} }
      if (renderStream) renderStream.getTracks().forEach(t => t.stop()); if (audioCtx) { try { await audioCtx.close(); } catch (_) {} }
      video.pause(); video.removeAttribute('src'); video.load(); video.remove(); state.rendering = false; refreshProgress();
      if (state.finalBlob) $('renderButton').classList.add('hidden'); else $('renderButton').classList.remove('hidden');
    }
  }
  function resetStoryboard() {
    if (state.generating || state.rendering) return;
    state.scenes.forEach((s, i) => { s.detail = ''; s.status = 'queued'; s.taskId = null; s.videoUrl = null; s.error = ''; });
    state.finalBlob = null; if (state.finalUrl) URL.revokeObjectURL(state.finalUrl); state.finalUrl = null;
    $('finalVideo').removeAttribute('src'); $('downloadButton').removeAttribute('href'); $('renderProgressWrap').classList.add('hidden'); setMessage('Storyboard direset. Masukkan cerita lalu generate lagi.'); renderScenes(); refreshProgress();
  }
  async function checkSession() {
    try {
      const data = await api('/api/session');
      if (data.authenticated) { state.appAccess = true; $('loginOverlay').classList.add('hidden'); }
      else { $('loginOverlay').classList.remove('hidden'); $('accessCode').focus(); }
    } catch (_) { $('loginOverlay').classList.remove('hidden'); $('loginError').textContent = 'Periksa konfigurasi API/session pada Vercel.'; }
    try {
      const health = await api('/api/health');
      if (!health.seedanceConfigured) setMessage('Konfigurasi Seedance belum lengkap. Isi SEEDANCE_API_KEY, SEEDANCE_API_BASE_URL, dan SEEDANCE_MODEL di Vercel.', 'error');
    } catch (_) {}
  }
  $('loginForm').addEventListener('submit', async e => {
    e.preventDefault(); $('loginError').textContent = '';
    try { await api('/api/session', { method: 'POST', body: JSON.stringify({ code: $('accessCode').value }) }); $('accessCode').value = ''; $('loginOverlay').classList.add('hidden'); state.appAccess = true; toast('Berhasil masuk ke studio.'); checkSession(); }
    catch (err) { $('loginError').textContent = err.message || 'Kode akses salah.'; }
  });
  $('logoutButton').addEventListener('click', async () => { try { await api('/api/session', { method: 'DELETE' }); } catch (_) {} state.appAccess = false; $('loginOverlay').classList.remove('hidden'); $('accessCode').focus(); });
  $('storyPrompt').addEventListener('input', () => $('charCount').textContent = `${$('storyPrompt').value.length} / 3000`);
  document.querySelectorAll('.style-chip').forEach(chip => chip.addEventListener('click', () => { document.querySelectorAll('.style-chip').forEach(c => c.classList.remove('selected')); chip.classList.add('selected'); state.style = chip.dataset.style; }));
  $('generateButton').addEventListener('click', startGeneration);
  $('renderButton').addEventListener('click', renderFinalVideo);
  $('resetStoryboardButton').addEventListener('click', resetStoryboard);
  renderScenes(); refreshProgress(); checkSession();
  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
})();
