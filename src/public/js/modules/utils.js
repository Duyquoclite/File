let progressInterval = null;

export function esc(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}

export function toast(msg, type = 'info') {
  const c = document.getElementById('toastContainer');
  if (!c) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  c.appendChild(t);
  const duration = type === 'error' ? 6000 : 3500;
  setTimeout(() => { 
    t.style.opacity = '0'; 
    setTimeout(() => t.remove(), 300); 
  }, duration);
}

export function ensureProgressOverlay() {
  let overlay = document.getElementById('progressOverlay');
  if (overlay) return overlay;
  overlay = document.createElement('div');
  overlay.id = 'progressOverlay';
  overlay.className = 'progress-overlay';
  overlay.innerHTML = `
    <div class="progress-card">
      <div class="progress-title">Đang xử lý...</div>
      <div class="progress-subtitle">Vui lòng đợi</div>
      <div class="progress-bar"><div class="progress-fill" style="width:0%"></div></div>
      <div class="progress-meta"><span class="progress-percent">0%</span></div>
    </div>
  `;
  document.body.appendChild(overlay);
  return overlay;
}

export function setProgressOverlay(message, subtext, percent) {
  const overlay = ensureProgressOverlay();
  overlay.classList.add('active');
  overlay.querySelector('.progress-title').textContent = message;
  overlay.querySelector('.progress-subtitle').textContent = subtext;
  const fill = overlay.querySelector('.progress-fill');
  const pct = Math.min(100, Math.max(0, percent));
  if (fill) fill.style.width = pct + '%';
  const percentEl = overlay.querySelector('.progress-percent');
  if (percentEl) percentEl.textContent = pct + '%';
}

export function hideProgressOverlay() {
  const overlay = document.getElementById('progressOverlay');
  if (!overlay) return;
  overlay.classList.remove('active');
  const fill = overlay.querySelector('.progress-fill');
  if (fill) fill.style.width = '0%';
  const percentEl = overlay.querySelector('.progress-percent');
  if (percentEl) percentEl.textContent = '0%';
  if (progressInterval) {
    clearInterval(progressInterval);
    progressInterval = null;
  }
}

export function getProgressInterval() {
  return progressInterval;
}

export function setProgressInterval(interval) {
  progressInterval = interval;
}
