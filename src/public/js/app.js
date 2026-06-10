/**
 * Chrome Profile Manager - Frontend App
 */
const API = '/api';
let profiles = [];
let selectedIds = new Set();
let currentScriptProfileId = null;
let currentFingerprintDraft = null;
let ws = null;
const hiddenGroups = new Set(JSON.parse(localStorage.getItem('hiddenGroups') || '[]'));
let layoutMode = localStorage.getItem('layoutMode') || 'column';

// ====== Auth Helpers ======
function getCookie(name) {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match[2] : null;
}
let authToken = localStorage.getItem('authToken') || getCookie('authToken');
let isSetupMode = false;

// ====== API Helpers ======
async function api(url, opts = {}) {
  opts.headers = {
    'Content-Type': 'application/json',
    ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
    ...(opts.headers || {})
  };
  if (opts.body && typeof opts.body === 'object') opts.body = JSON.stringify(opts.body);
  const r = await fetch(API + url, opts);

  if (r.status === 401) {
    // Unauthorized -> redirect to login page
    localStorage.removeItem('authToken');
    window.location.href = '/login.html';
    return { success: false, error: 'Unauthorized' };
  }

  const data = await r.json();
  return data;
}

// ====== Toast ======
function toast(msg, type = 'info') {
  const c = document.getElementById('toastContainer');
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

// ====== Progress Overlay =====
let progressInterval = null;
function ensureProgressOverlay() {
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

function setProgressOverlay(message, subtext, percent) {
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

function hideProgressOverlay() {
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

// ====== Modal Helpers =====
function openModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('active');
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('active');
}

function showMessageModal({ title = 'Thông báo', message = '', okText = 'Đóng' } = {}) {
  const modal = document.getElementById('messageModal');
  if (!modal) { window.alert(message); return; }
  const titleEl = document.getElementById('messageModalTitle');
  const msgEl = document.getElementById('messageModalMessage');
  const okBtn = document.getElementById('messageModalOk');
  if (titleEl) titleEl.textContent = title;
  if (msgEl) msgEl.textContent = message;
  if (okBtn) okBtn.textContent = okText;
  openModal('messageModal');
}

// ====== Confirm Modal (promise-based) =====
let confirmResolver = null;
function showConfirm({ title = 'Xác nhận', message = 'Bạn có chắc chắn?', confirmText = 'Xác nhận', cancelText = 'Hủy' } = {}) {
  return new Promise(resolve => {
    const modal = document.getElementById('confirmModal');
    if (!modal) { resolve(window.confirm(message)); return; }
    const titleEl = document.getElementById('confirmModalTitle');
    const msgEl = document.getElementById('confirmModalMessage');
    const okBtn = document.getElementById('confirmModalConfirm');
    const cancelBtn = document.getElementById('confirmModalCancel');
    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = message;
    if (okBtn) okBtn.textContent = confirmText;
    if (cancelBtn) cancelBtn.textContent = cancelText;
    confirmResolver = resolve;
    modal.classList.add('active');
  });
}

function closeConfirmModal(result = false) {
  const modal = document.getElementById('confirmModal');
  if (modal) modal.classList.remove('active');
  if (confirmResolver) {
    confirmResolver(result);
    confirmResolver = null;
  }
}

const _confirmModalEl = document.getElementById('confirmModal');
if (_confirmModalEl) {
  const okBtn = document.getElementById('confirmModalConfirm');
  const cancelBtn = document.getElementById('confirmModalCancel');
  const closeBtn = document.getElementById('confirmModalClose');
  if (okBtn) okBtn.onclick = () => closeConfirmModal(true);
  if (cancelBtn) cancelBtn.onclick = () => closeConfirmModal(false);
  if (closeBtn) closeBtn.onclick = () => closeConfirmModal(false);
  _confirmModalEl.onclick = function (e) { if (e.target === this) closeConfirmModal(false); };
}
const _messageModalEl = document.getElementById('messageModal');
if (_messageModalEl) {
  const okBtn = document.getElementById('messageModalOk');
  const closeBtn = document.getElementById('messageModalClose');
  if (okBtn) okBtn.onclick = () => closeModal('messageModal');
  if (closeBtn) closeBtn.onclick = () => closeModal('messageModal');
  _messageModalEl.onclick = function (e) { if (e.target === this) closeModal('messageModal'); };
}
// ====== Load Profiles ======
async function loadProfiles(search = '') {
  const q = search ? `?search=${encodeURIComponent(search)}` : '';
  try {
    const res = await api('/profiles' + q);
    if (res && res.success) {
      profiles = res.data.profiles || [];
      const totalEl = document.getElementById('totalProfiles');
      const runningEl = document.getElementById('runningProfiles');
      if (totalEl) totalEl.textContent = res.data.total || profiles.length;
      if (runningEl) runningEl.textContent = profiles.filter(p => p.isRunning).length;
      renderProfiles();
      return;
    }
    toast(res?.error || 'Không thể tải profiles', 'error');
  } catch (err) {
    console.error('loadProfiles error', err);
    toast('Lỗi kết nối tới server. Hãy đảm bảo server đang chạy.', 'error');
    const grid = document.getElementById('profileGrid');
    const empty = document.getElementById('emptyState');
    if (grid) grid.innerHTML = '';
    if (empty) empty.style.display = 'block';
  }
}

function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

function parseProxyHost(proxy) {
  if (!proxy) return '';
  try {
    let normalized = proxy.trim();
    if (!/^[a-zA-Z]+:\/\//.test(normalized)) {
      normalized = 'http://' + normalized;
    }
    const url = new URL(normalized);
    return url.hostname || '';
  } catch (err) {
    const cleaned = proxy.replace(/^[a-zA-Z]+:\/\//, '').split('@').pop();
    return cleaned.split(':')[0] || cleaned;
  }
}

function getProxyDisplay(p) {
  const host = p.proxyIp || parseProxyHost(p.proxy);
  const timezone = p.proxyTimezone || '';
  const country = p.proxyCountry || '';
  if (host && timezone && country) return `${host}:${timezone} (${country})`;
  if (host && timezone) return `${host}:${timezone}`;
  if (host && country) return `${host} (${country})`;
  if (host) return host;
  return p.proxyType || 'proxy';
}

// ====== Render Profiles ======
function renderProfiles() {
  const grid = document.getElementById('profileGrid');
  const empty = document.getElementById('emptyState');

  if (!grid) return;

  if (profiles.length === 0) {
    grid.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  // Group profiles by the full proxy value (or fallback to 'no-proxy')
  const groups = {};
  for (const p of profiles) {
    const proxyKey = p.proxy && p.proxy.trim() ? p.proxy.trim() : 'no-proxy';
    if (!groups[proxyKey]) groups[proxyKey] = [];
    groups[proxyKey].push(p);
  }

  const groupHtml = Object.keys(groups).map(ipKey => {
    const items = groups[ipKey];
    // Extract numeric suffix, determine padding based on max number
    const extractNum = name => {
      const m = name.match(/(\d+)$/);
      return m ? parseInt(m[1], 10) : 0;
    };
    const maxNum = Math.max(...items.map(p => extractNum(p.name)));
    const padWidth = String(maxNum).length;
    // Sort numerically
    items.sort((a, b) => extractNum(a.name) - extractNum(b.name));
    // Create displayName with padded number
    items.forEach(p => {
      const num = extractNum(p.name);
      const padded = String(num).padStart(padWidth, '0');
      p.displayName = p.name.replace(/\d+$/, padded);
    });
    const allSelected = items.every(p => selectedIds.has(p.id));
    const firstItem = items[0];
    const country = firstItem ? (firstItem.proxyCountry || '') : '';
    const timezone = firstItem ? (firstItem.proxyTimezone || '') : '';
    let detailsHtml = '';
    if (country && timezone) {
      detailsHtml = ` - <span style="color: #2ecc71; font-weight: 500;">${esc(country)}</span> (<span style="color: #f1c40f;">${esc(timezone)}</span>)`;
    } else if (country) {
      detailsHtml = ` - <span style="color: #2ecc71; font-weight: 500;">${esc(country)}</span>`;
    } else if (timezone) {
      detailsHtml = ` - <span style="color: #f1c40f;">${esc(timezone)}</span>`;
    }
    const headerPrefixHtml = ipKey === 'no-proxy' ? 'Không có proxy' : esc(ipKey);
    const headerHtml = `
      <input type="checkbox" class="group-checkbox" ${allSelected ? 'checked' : ''} onclick="toggleGroupSelect('${esc(ipKey)}', event)">
      <span>${headerPrefixHtml}${detailsHtml}</span>
    `;

    const cards = items.map(p => {
      const fp = p.fingerprint || {};
      const isSelected = selectedIds.has(p.id);
      const statusClass = p.isRunning ? 'running' : '';
      const cardClass = `profile-card ${statusClass} ${isSelected ? 'selected' : ''}`;

      let categoryBadge = '';
      if (p.proxy && p.proxyType !== 'none') {
        const cat = p.proxyCategory || 'undetermined';
        if (cat === 'static') {
          categoryBadge = `<span class="meta-tag" style="background: rgba(46, 204, 113, 0.1); color: #2ecc71; border: 1px solid rgba(46, 204, 113, 0.2); font-weight: 500;">Tĩnh</span>`;
        } else if (cat === 'dynamic') {
          categoryBadge = `<span class="meta-tag" style="background: rgba(241, 196, 15, 0.1); color: #f1c40f; border: 1px solid rgba(241, 196, 15, 0.2); font-weight: 500;">Động</span>`;
        } else {
          categoryBadge = `<span class="meta-tag" style="background: rgba(99, 102, 241, 0.1); color: #818cf8; border: 1px solid rgba(99, 102, 241, 0.2); font-weight: 500;">Chưa xác định</span>`;
        }
      }

      return `
        <div class="${cardClass}" data-id="${p.id}">
          <div class="card-top">
            <input type="checkbox" class="card-checkbox" ${isSelected ? 'checked' : ''} onclick="toggleSelect('${p.id}', event)">
            <div class="card-status">
              <div class="status-dot ${p.isRunning ? 'running' : 'closed'}"></div>
              ${p.isRunning ? 'Đang chạy' : 'Đã đóng'}
            </div>
          </div>
          <div class="card-name">${esc(p.displayName || p.name)}</div>
          <div class="card-id">${p.id.substring(0, 8)}...</div>
          <div class="card-meta">
            <span class="meta-tag">${fp.platform || 'Win32'}</span>
            <span class="meta-tag">${fp.screen ? fp.screen.width + 'x' + fp.screen.height : '1920x1080'}</span>
            ${p.proxy ? `<span class="meta-tag proxy">${esc(p.proxyIp || parseProxyHost(p.proxy))}</span>` : ''}
            ${categoryBadge}
            <span class="meta-tag open-count" style="color: #60a5fa; background: rgba(96, 165, 250, 0.1); border: 1px solid rgba(96, 165, 250, 0.2);">🚀 Mở: ${p.openCount || 0} lần</span>
            ${p.notes ? `<span class="meta-tag notes">📝 ${esc(p.notes.substring(0, 20))}</span>` : ''}
          </div>
          <div class="card-actions">
            ${p.isRunning
          ? `<button class="btn btn-warning btn-sm" onclick="closeProfile('${p.id}')">⏹ Đóng</button>`
          : `<button class="btn btn-success btn-sm" onclick="openProfile('${p.id}')">▶ Mở</button>`
        }
            <button class="btn-icon" onclick="duplicateProfile('${p.id}')" title="Nhân bản">Nhân bản</button>
            <button class="btn-icon" onclick="showDetail('${p.id}')" title="Chi tiết">Chi tiết</button>
            <button class="btn-icon" onclick="openScriptEditor('${p.id}')" title="Automation">Dán script tự động</button>
            <button class="btn-icon" onclick="regenFingerprint('${p.id}')" title="Tạo lại fingerprint">Tạo lại vân tay</button>
            <button class="btn-icon" onclick="deleteProfile('${p.id}')" title="Xóa" style="color:var(--danger)">Xóa</button>
          </div>
        </div>
      `;
    }).join('');

    const isHidden = hiddenGroups.has(ipKey);
    return `
      <div class="proxy-group" style="${isHidden ? 'display: none !important;' : ''}">
        <div class="proxy-group-header">${headerHtml}</div>
        <div class="group-cards">${cards}</div>
      </div>
    `;
  }).join('');

  grid.innerHTML = groupHtml;

  // Update top scroll helper width based on current rendered content
  const helper = document.getElementById('topScrollHelper');
  const helperWidth = document.getElementById('topScrollWidth');
  if (helper && helperWidth) {
    setTimeout(() => {
      if (layoutMode === 'column' && grid.scrollWidth > grid.clientWidth) {
        helper.style.display = 'block';
        helperWidth.style.width = grid.scrollWidth + 'px';
        helper.scrollLeft = grid.scrollLeft;
      } else {
        helper.style.display = 'none';
      }
    }, 100);
  }
}

function renderGroupsManagementList() {
  const container = document.getElementById('groupsListContainer');
  if (!container) return;

  // Group current profiles exactly as we do in renderProfiles
  const groups = {};
  for (const p of profiles) {
    const proxyKey = p.proxy && p.proxy.trim() ? p.proxy.trim() : 'no-proxy';
    if (!groups[proxyKey]) groups[proxyKey] = [];
    groups[proxyKey].push(p);
  }

  container.innerHTML = Object.keys(groups).map(ipKey => {
    const isChecked = !hiddenGroups.has(ipKey);
    const label = ipKey === 'no-proxy' ? 'Không có proxy' : ipKey;
    const count = groups[ipKey].length;
    return `
      <label style="display:flex; align-items:center; justify-content:space-between; padding:8px 12px; background:var(--bg-glass); border:1px solid var(--border); border-radius:var(--radius-sm); cursor:pointer; margin-bottom: 2px;">
        <div style="display:flex; align-items:center; gap:10px;">
          <input type="checkbox" class="group-visibility-checkbox" data-group="${esc(ipKey)}" ${isChecked ? 'checked' : ''} style="width:16px; height:16px; accent-color:var(--accent);">
          <span style="font-size:0.9rem; font-weight:500;">${esc(label)}</span>
        </div>
        <span class="meta-tag" style="background:rgba(99, 102, 241, 0.1); color:var(--accent); font-size:0.75rem;">${count} profiles</span>
      </label>
    `;
  }).join('');

  // Bind checkbox change events
  container.querySelectorAll('.group-visibility-checkbox').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const groupKey = e.target.dataset.group;
      if (e.target.checked) {
        hiddenGroups.delete(groupKey);
      } else {
        hiddenGroups.add(groupKey);
      }
      localStorage.setItem('hiddenGroups', JSON.stringify([...hiddenGroups]));
      renderProfiles(); // Live update
    });
  });
}

function openGroupsModal() {
  renderGroupsManagementList();
  document.getElementById('groupsModal').classList.add('active');
}

function closeGroupsModal() {
  document.getElementById('groupsModal').classList.remove('active');
}

function applyLayoutMode() {
  const grid = document.getElementById('profileGrid');
  const iconCol = document.getElementById('iconLayoutColumn');
  const iconRow = document.getElementById('iconLayoutRow');
  const txt = document.getElementById('layoutText');

  if (!grid) return;

  if (layoutMode === 'column') {
    grid.classList.remove('layout-row');
    grid.classList.add('layout-column');
    if (iconCol) iconCol.style.display = 'inline-block';
    if (iconRow) iconRow.style.display = 'none';
    if (txt) txt.textContent = 'Dạng Cột';
  } else {
    grid.classList.remove('layout-column');
    grid.classList.add('layout-row');
    if (iconCol) iconCol.style.display = 'none';
    if (iconRow) iconRow.style.display = 'inline-block';
    if (txt) txt.textContent = 'Dạng Hàng';
  }

  // Refresh layouts/scrollbar helper
  renderProfiles();
}

// ====== Profile Actions ======
async function duplicateProfile(id) {
  const overlay = ensureProgressOverlay();
  setProgressOverlay('Đang nhân bản profile...', 'Bắt đầu sao chép...', 0);
  let progress = 0;
  progressInterval = setInterval(() => {
    if (progress < 90) {
      progress += Math.floor(Math.random() * 8) + 4;
      setProgressOverlay('Đang nhân bản profile...', 'Đang sao chép dữ liệu...', progress);
    }
  }, 300);

  try {
    const res = await api(`/profiles/${id}/duplicate`, { method: 'POST' });
    if (res.success) {
      setProgressOverlay('Hoàn thành!', 'Đã nhân bản profile thành công.', 100);
      await new Promise(resolve => setTimeout(resolve, 500));
      toast('Đã nhân bản thành công!', 'success');
      loadProfiles();
    } else {
      setProgressOverlay('Lỗi', res.error || 'Lỗi nhân bản', 100);
      toast(res.error || 'Lỗi nhân bản', 'error');
    }
  } catch (error) {
    setProgressOverlay('Lỗi', 'Không thể kết nối tới server', 100);
    toast(error.message || 'Lỗi nhân bản', 'error');
  } finally {
    if (progressInterval) { clearInterval(progressInterval); progressInterval = null; }
    setTimeout(hideProgressOverlay, 600);
  }
}

async function openProfile(id) {
  toast('Đang mở Chrome...', 'info');
  const res = await api(`/profiles/${id}/open`, { method: 'POST' });
  if (res.success) { toast('Chrome đã mở!', 'success'); loadProfiles(); }
  else toast(res.error || 'Lỗi', 'error');
}

async function closeProfile(id) {
  const res = await api(`/profiles/${id}/close`, { method: 'POST' });
  if (res.success) { toast('Chrome đã đóng', 'success'); loadProfiles(); }
  else toast(res.error || 'Lỗi', 'error');
}

async function deleteProfile(id) {
  const confirmed = await showConfirm({
    title: 'Xóa profile',
    message: 'Bạn chắc chắn muốn xóa profile này?',
    confirmText: 'Xóa',
    cancelText: 'Hủy'
  });
  if (!confirmed) return;

  setProgressOverlay('Đang xóa profile...', 'Đang xử lý yêu cầu xóa...', 0);
  try {
    const res = await api(`/profiles/${id}`, { method: 'DELETE' });
    if (res.success) {
      setProgressOverlay('Hoàn thành!', 'Đã xóa profile thành công.', 100);
      await new Promise(resolve => setTimeout(resolve, 500));
      toast('Đã xóa profile', 'success');
      loadProfiles();
    } else {
      setProgressOverlay('Lỗi', res.error || 'Lỗi xóa profile', 100);
      toast(res.error || 'Lỗi', 'error');
    }
  } catch (error) {
    setProgressOverlay('Lỗi', 'Không thể kết nối tới server', 100);
    toast(error.message || 'Lỗi xóa profile', 'error');
  } finally {
    setTimeout(hideProgressOverlay, 600);
  }
}

async function regenFingerprint(id) {
  const res = await api(`/profiles/${id}/regenerate-fingerprint`, { method: 'POST' });
  if (res.success) {
    showMessageModal({
      title: 'Tạo lại fingerprint',
      message: 'Đã tạo lại fingerprint thành công cho profile.',
      okText: 'Đóng'
    });
    loadProfiles();
  } else {
    showMessageModal({
      title: 'Lỗi tạo lại fingerprint',
      message: res.error || 'Không thể tạo lại fingerprint.',
      okText: 'Đóng'
    });
  }
}

function toggleSelect(id, e) {
  e.stopPropagation();
  if (selectedIds.has(id)) selectedIds.delete(id);
  else selectedIds.add(id);

  updateBulkUI();
  renderProfiles();
}

function toggleGroupSelect(groupKey, e) {
  e.stopPropagation();
  const groupProfiles = profiles.filter(p => {
    const pk = p.proxy && p.proxy.trim() ? p.proxy.trim() : 'no-proxy';
    return pk === groupKey;
  });

  const allSelected = groupProfiles.every(p => selectedIds.has(p.id));
  
  if (allSelected) {
    groupProfiles.forEach(p => selectedIds.delete(p.id));
  } else {
    groupProfiles.forEach(p => selectedIds.add(p.id));
  }

  updateBulkUI();
  renderProfiles();
}
if (document.getElementById('btnCancelSelect')) {
  document.getElementById('btnCancelSelect').onclick = () => { selectedIds.clear(); updateBulkUI(); renderProfiles(); };
}

// Bulk UI updater
function updateBulkUI() {
  const bulkDiv = document.getElementById('bulkActions');
  const countEl = document.getElementById('selectedCount');
  if (!bulkDiv) return;
  if (selectedIds.size > 0) {
    bulkDiv.style.display = 'flex';
    countEl.textContent = `${selectedIds.size} đã chọn`;
  } else {
    bulkDiv.style.display = 'none';
    countEl.textContent = '0 đã chọn';
  }
}

// Bulk action buttons
document.getElementById('btnBulkOpen')?.addEventListener('click', async () => {
  for (const id of selectedIds) await openProfile(id);
  selectedIds.clear();
  updateBulkUI();
  renderProfiles();
});

document.getElementById('btnBulkClose')?.addEventListener('click', async () => {
  for (const id of selectedIds) await closeProfile(id);
  selectedIds.clear();
  updateBulkUI();
  renderProfiles();
});

document.getElementById('btnBulkDelete')?.addEventListener('click', async () => {
  if (!await showConfirm({ title: 'Xóa', message: 'Xóa các profile đã chọn?' })) return;
  for (const id of selectedIds) await api(`/profiles/${id}`, { method: 'DELETE' });
  selectedIds.clear();
  updateBulkUI();
  renderProfiles();
});

// Helper to convert file to base64
function getBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = error => reject(error);
  });
}

// ====== Create Profile ======
document.getElementById('btnCloseModal').onclick = () => closeModal('createModal');
document.getElementById('btnCancelCreate').onclick = () => closeModal('createModal');

document.getElementById('proxyType').onchange = function () {
  document.getElementById('proxyInputGroup').style.display = this.value === 'none' ? 'none' : 'block';
};

document.getElementById('fpToggle').onclick = () => {
  const d = document.getElementById('fpDetails');
  const c = document.querySelector('.fp-chevron');
  if (d.style.display === 'none') { d.style.display = 'block'; c.classList.add('open'); }
  else { d.style.display = 'none'; c.classList.remove('open'); }
};

document.getElementById('fpModeAuto').onchange = updateFingerprintMode;
document.getElementById('fpModeManual').onchange = updateFingerprintMode;
document.getElementById('btnRandomFingerprint').onclick = loadFingerprintSample;

document.getElementById('btnCreate').onclick = () => {
  openModal('createModal');

  loadFingerprintSample();
};

document.getElementById('btnConfirmCreate').onclick = async () => {
  const name = document.getElementById('profileName').value.trim();
  if (!name) { toast('Vui lòng nhập tên profile', 'error'); return; }
  const proxyType = document.getElementById('proxyType').value;
  const proxyAddr = document.getElementById('proxyAddress').value.trim();
  let proxy = '';
  if (proxyType !== 'none' && proxyAddr) {
    proxy = proxyAddr.includes('://') ? proxyAddr : `${proxyType}://${proxyAddr}`;
  }

  const proxyStatusEl = document.getElementById('proxyStatus');
  if (proxy && proxyType !== 'none') {
    await ensureProxyMetadata('proxyAddress', 'proxyType', 'proxyStatus');
  }
  const body = {
    name,
    notes: document.getElementById('profileNotes').value,
    proxy,
    proxyType,
    proxyIp: proxyStatusEl?.dataset.proxyIp || '',
    proxyCountry: proxyStatusEl?.dataset.proxyCountry || '',
    proxyTimezone: proxyStatusEl?.dataset.proxyTimezone || '',
  };

  if (document.getElementById('fpModeManual').checked) {
    body.fingerprint = getFingerprintFromFields();
  }



  const res = await api('/profiles', {
    method: 'POST',
    body,
  });

  if (res.success) {
    toast(`Profile "${name}" đã tạo!`, 'success');
    closeModal('createModal');
    document.getElementById('profileName').value = '';
    document.getElementById('profileNotes').value = '';
    document.getElementById('proxyAddress').value = '';
    document.getElementById('proxyType').value = 'none';

    document.getElementById('proxyInputGroup').style.display = 'none';
    document.getElementById('fpModeAuto').checked = true;
    updateFingerprintMode();
    loadProfiles();
  } else toast(res.error || 'Lỗi', 'error');
};

async function loadFingerprintSample() {
  const res = await api('/profiles/fingerprint-sample');
  if (!res.success) {
    toast(res.error || 'Không thể tạo fingerprint mẫu', 'error');
    return;
  }
  currentFingerprintDraft = res.data;
  populateFingerprintFields(currentFingerprintDraft);
}

function populateFingerprintFields(fp) {
  if (!fp) fp = {};
  document.getElementById('fpUA').value = fp.userAgent || '';
  document.getElementById('fpPlatform').value = fp.platform || 'Win32';
  document.getElementById('fpScreenWidth').value = fp.screen?.width || 1920;
  document.getElementById('fpScreenHeight').value = fp.screen?.height || 1080;
  document.getElementById('fpLang').value = fp.languages ? fp.languages.join(', ') : 'vi-VN, en-US';
  document.getElementById('fpTZ').value = fp.timezone || 'Asia/Ho_Chi_Minh';
  document.getElementById('fpWebGL').value = fp.webgl?.renderer || '';
  document.getElementById('fpCores').value = fp.hardwareConcurrency || 8;
  document.getElementById('fpRAM').value = fp.deviceMemory || 16;
}

function getFingerprintFromFields() {
  const ua = document.getElementById('fpUA').value.trim();
  const platform = document.getElementById('fpPlatform').value;
  const width = parseInt(document.getElementById('fpScreenWidth').value, 10) || 1920;
  const height = parseInt(document.getElementById('fpScreenHeight').value, 10) || 1080;
  const languages = document.getElementById('fpLang').value.split(',').map(v => v.trim()).filter(Boolean);
  const timezone = document.getElementById('fpTZ').value.trim();
  const webgl = document.getElementById('fpWebGL').value.trim();
  const cores = parseInt(document.getElementById('fpCores').value, 10) || undefined;
  const ram = parseInt(document.getElementById('fpRAM').value, 10) || undefined;

  const fp = {
    userAgent: ua || undefined,
    platform,
    screen: { width, height },
    languages,
    timezone: timezone || undefined,
    hardwareConcurrency: cores,
    deviceMemory: ram,
  };
  if (webgl) fp.webgl = { renderer: webgl };
  return fp;
}

function updateFingerprintMode() {
  const manual = document.getElementById('fpModeManual').checked;
  const randomButton = document.getElementById('btnRandomFingerprint');
  const details = document.getElementById('fpDetails');
  const chevron = document.querySelector('.fp-chevron');
  randomButton.style.display = manual ? 'inline-flex' : 'none';
  if (manual) {
    if (details.style.display === 'none') {
      details.style.display = 'block';
      chevron.classList.add('open');
    }
  } else {
    details.style.display = 'none';
    chevron.classList.remove('open');
  }
}

// ====== Check Proxy ======
async function checkProxyUI(proxyInputId, proxyTypeId, statusElId) {
  const proxy = document.getElementById(proxyInputId).value.trim();
  const proxyType = document.getElementById(proxyTypeId).value;
  const statusEl = document.getElementById(statusElId);

  if (!proxy || proxyType === 'none') {
    statusEl.style.display = 'block';
    statusEl.style.color = 'var(--danger)';
    statusEl.textContent = 'Vui lòng nhập proxy và chọn loại proxy';
    return;
  }

  statusEl.style.display = 'block';
  statusEl.style.color = 'var(--info)';
  statusEl.textContent = 'Đang kiểm tra...';

  const res = await api('/proxy/check', {
    method: 'POST',
    body: { proxy, proxyType }
  });

  if (res.success) {
    statusEl.style.color = 'var(--text-primary)';
    statusEl.dataset.proxyIp = res.data.ip || '';
    statusEl.dataset.proxyCountry = res.data.countryName || res.data.country || '';
    statusEl.dataset.proxyTimezone = res.data.timezone || '';

    const typeBadge = `<span style="background:rgba(99, 102, 241, 0.2); color:#818cf8; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; margin-left: 8px; border: 1px solid rgba(99, 102, 241, 0.4); font-weight: normal;">Chưa xác định (cần theo dõi)</span>`;

    statusEl.innerHTML = `
      <div style="background:var(--bg-glass); border:1px solid var(--success); padding:10px; border-radius:var(--radius-sm); margin-top:8px;">
        <div style="color:var(--success); font-weight:600; margin-bottom:6px; display: flex; align-items: center;">
          <span>✅ Proxy hoạt động (${res.data.timeMs}ms)</span>
          ${typeBadge}
        </div>
        <div style="display:grid; grid-template-columns: 80px 1fr; gap:4px; font-size:0.8rem;">
          <span style="color:var(--text-muted)">IP:</span> <strong>${res.data.ip}</strong>
          <span style="color:var(--text-muted)">Quốc gia:</span> <strong>${res.data.countryName || res.data.country}</strong>
          <span style="color:var(--text-muted)">Múi giờ:</span> <strong>${res.data.timezone}</strong>
          <span style="color:var(--text-muted)">ISP:</span> <strong>${res.data.isp}</strong>
        </div>
      </div>
    `;
    const infoEl = document.getElementById(statusElId.replace('Status', 'Info'));
    if (infoEl) {
      infoEl.textContent = `Thông tin: ${getProxyDisplay({ proxy, proxyIp: res.data.ip, proxyCountry: res.data.countryName || res.data.country, proxyTimezone: res.data.timezone })}`;
    }
  } else {
    statusEl.style.color = 'var(--danger)';
    statusEl.textContent = `❌ Lỗi: ${res.error}`;
  }
}

async function ensureProxyMetadata(proxyInputId, proxyTypeId, statusElId) {
  const proxy = document.getElementById(proxyInputId).value.trim();
  const proxyType = document.getElementById(proxyTypeId).value;
  const statusEl = document.getElementById(statusElId);
  if (!proxy || proxyType === 'none') return false;
  if (statusEl?.dataset.proxyIp || statusEl?.dataset.proxyCountry || statusEl?.dataset.proxyTimezone) {
    return true;
  }
  await checkProxyUI(proxyInputId, proxyTypeId, statusElId);
  return Boolean(statusEl?.dataset.proxyIp || statusEl?.dataset.proxyCountry || statusEl?.dataset.proxyTimezone);
}

document.getElementById('btnCheckProxy').onclick = () => checkProxyUI('proxyAddress', 'proxyType', 'proxyStatus');
document.getElementById('btnCheckBulkProxy').onclick = () => checkProxyUI('bulkProxy', 'bulkProxyType', 'bulkProxyStatus');

// ====== Bulk Create ======
document.getElementById('btnBulkCreate').onclick = () => openModal('bulkCreateModal');
document.getElementById('btnCloseBulkModal').onclick = () => closeModal('bulkCreateModal');
document.getElementById('btnCancelBulk').onclick = () => closeModal('bulkCreateModal');

document.getElementById('btnConfirmBulk').onclick = async () => {
  const count = parseInt(document.getElementById('bulkCount').value) || 10;
  const namePrefix = document.getElementById('bulkPrefix').value.trim() || 'Profile'; const startIndex = parseInt(document.getElementById('bulkStart').value) || 1;
  const proxyType = document.getElementById('bulkProxyType').value;
  const proxy = document.getElementById('bulkProxy').value.trim();

  const bulkProxyStatusEl = document.getElementById('bulkProxyStatus');
  if (proxy && proxyType !== 'none') {
    await ensureProxyMetadata('bulkProxy', 'bulkProxyType', 'bulkProxyStatus');
  }
  const res = await api('/profiles/bulk-create', {
    method: 'POST',
    body: {
      count,
      namePrefix,
      startIndex,
      proxy: proxy ? proxy : '',
      proxyType,
      proxyIp: bulkProxyStatusEl?.dataset.proxyIp || '',
      proxyCountry: bulkProxyStatusEl?.dataset.proxyCountry || '',
      proxyTimezone: bulkProxyStatusEl?.dataset.proxyTimezone || '',
    }
  });

  if (res.success) {
    toast(`Đã tạo ${res.data.count} profiles!`, 'success');
    closeModal('bulkCreateModal');
    loadProfiles();
  } else toast(res.error || 'Lỗi', 'error');
};

// ====== Detail Modal ======
async function showDetail(id) {
  const res = await api(`/profiles/${id}`);
  if (!res.success) { toast('Lỗi', 'error'); return; }
  const p = res.data;
  const fp = p.fingerprint || {};
  const fontPreview = fp.fonts && fp.fonts.length > 0 ? esc(fp.fonts.slice(0, 6).join(', ')) : '—';
  const fontCount = fp.fonts ? fp.fonts.length : 0;
  const uaBrands = fp.userAgentData?.brands
    ? fp.userAgentData.brands.map(b => `${b.brand} ${b.version}`).join(', ')
    : (() => {
      const ua = fp.userAgent || '';
      const isEdge = ua.includes(' Edg/');
      const version = (ua.match(/(?:Chrome|Chromium|Edg)\/([0-9]+)/) || [])[1] || '100';
      return isEdge
        ? `Chromium ${version}, Google Chrome ${version}, Microsoft Edge ${version}`
        : `Chromium ${version}, Google Chrome ${version}`;
    })();
  const doNotTrack = fp.doNotTrack === '1' ? 'Có' : 'Không';
  const touchPoints = fp.maxTouchPoints !== undefined ? fp.maxTouchPoints : '—';
  const historyLength = fp.historyLength || '—';
  const gpuName = fp.gpu?.name || '—';
  const gpuVendor = fp.gpu?.vendor || '—';
  const gpuArch = fp.gpu?.architecture || '—';
  const webglVendor = fp.webgl?.vendor || '—';

  document.getElementById('detailTitle').textContent = p.name;
  document.getElementById('detailBody').innerHTML = `
    <div class="detail-section">
      <h4>Thông tin cơ bản</h4>
      <div class="form-group">
        <label>Tên</label>
        <input type="text" id="editName" value="${esc(p.name)}">
      </div>
      <div class="form-group">
        <label>Ghi chú</label>
        <textarea id="editNotes" rows="2">${esc(p.notes)}</textarea>
      </div>
      <div class="form-group">
        <label>Số lần đã mở</label>
        <div style="font-size: 0.9rem; font-weight: 600; color: #60a5fa; margin-top: 4px; display: flex; align-items: center; gap: 6px;">
          <span>🚀 ${p.openCount || 0} lần</span>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Loại Proxy</label>
          <select id="editProxyType">
            <option value="none" ${p.proxyType === 'none' ? 'selected' : ''}>Không</option>
            <option value="http" ${p.proxyType === 'http' ? 'selected' : ''}>HTTP</option>
            <option value="https" ${p.proxyType === 'https' ? 'selected' : ''}>HTTPS</option>
            <option value="socks5" ${p.proxyType === 'socks5' ? 'selected' : ''}>SOCKS5</option>
          </select>
        </div>
        <div class="form-group">
          <label>Proxy</label>
          <div style="display:flex; gap:8px;">
            <input type="text" id="editProxy" value="${esc(p.proxy)}">
            <button class="btn btn-secondary" id="btnCheckEditProxy" type="button" style="padding:0 12px; height:auto;">Kiểm tra</button>
          </div>
          <div id="editProxyInfo" style="font-size:0.8rem; margin-top:8px; color:var(--text-muted);">
            ${p.proxy ? `Thông tin: ${esc(getProxyDisplay(p))}` : ''}
          </div>
          <div id="editProxyStatus" style="font-size:0.8rem; margin-top:6px; display:none;"></div>
          <div id="editProxyCategory" style="font-size:0.8rem; margin-top:6px;">
            Trạng thái: 
            ${(() => {
              const cat = p.proxyCategory || 'undetermined';
              if (cat === 'static') return `<span style="background:rgba(46, 204, 113, 0.2); color:#2ecc71; padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(46, 204, 113, 0.4); font-weight: normal;">Proxy Tĩnh</span>`;
              if (cat === 'dynamic') return `<span style="background:rgba(241, 196, 15, 0.2); color:#f1c40f; padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(241, 196, 15, 0.4); font-weight: normal;">Proxy Động</span>`;
              return `<span style="background:rgba(99, 102, 241, 0.2); color:#818cf8; padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(99, 102, 241, 0.4); font-weight: normal;">Chưa xác định (đang theo dõi...)</span>`;
            })()}
          </div>
        </div>
    </div>

    <div class="detail-section">
      <h4>Fingerprint <button class="btn btn-ghost btn-sm" id="btnToggleFP" style="margin-left:12px;">Hiện</button></h4>
      <div id="detailFingerprint" style="display:none;">
      <div class="detail-grid">
        <div class="detail-item"><div class="label">User Agent</div><div class="value">${esc(fp.userAgent || '—')}</div></div>
        <div class="detail-item"><div class="label">Brands</div><div class="value">${esc(uaBrands)}</div></div>
        <div class="detail-item"><div class="label">Platform</div><div class="value">${esc(fp.platform || '—')}</div></div>
        <div class="detail-item"><div class="label">Language</div><div class="value">${fp.languages ? fp.languages.join(', ') : '—'}</div></div>
        <div class="detail-item"><div class="label">Timezone</div><div class="value">${esc(fp.timezone || '—')}</div></div>
        <div class="detail-item"><div class="label">Do Not Track</div><div class="value">${doNotTrack}</div></div>
        <div class="detail-item"><div class="label">Screen</div><div class="value">${fp.screen ? fp.screen.width + 'x' + fp.screen.height : '—'}</div></div>
        <div class="detail-item"><div class="label">Touch Points</div><div class="value">${touchPoints}</div></div>
        <div class="detail-item"><div class="label">WebGL Renderer</div><div class="value">${esc(fp.webgl?.renderer || '—')}</div></div>
        <div class="detail-item"><div class="label">WebGL Vendor</div><div class="value">${esc(webglVendor)}</div></div>
        <div class="detail-item"><div class="label">GPU</div><div class="value">${esc(gpuName)}</div></div>
        <div class="detail-item"><div class="label">GPU Vendor</div><div class="value">${esc(gpuVendor)}</div></div>
        <div class="detail-item"><div class="label">GPU Arch</div><div class="value">${esc(gpuArch)}</div></div>
        <div class="detail-item"><div class="label">CPU Cores</div><div class="value">${fp.hardwareConcurrency || '—'}</div></div>
        <div class="detail-item"><div class="label">RAM</div><div class="value">${fp.deviceMemory ? fp.deviceMemory + ' GB' : '—'}</div></div>
        <div class="detail-item"><div class="label">Fonts</div><div class="value">${fontPreview}${fontCount ? ' + ' + fontCount + ' fonts' : ''}</div></div>
        <div class="detail-item"><div class="label">History Length</div><div class="value">${historyLength}</div></div>
        </div>
      </div>
    </div>
    <div class="detail-section">
      <h4>ID</h4>
      <code style="font-size:0.8rem;color:var(--text-muted);word-break:break-all;">${p.id}</code>
    </div>
  `;

  document.getElementById('btnSaveDetail').onclick = async () => {
    const editProxyStatusEl = document.getElementById('editProxyStatus');
    const body = {
      name: document.getElementById('editName').value,
      notes: document.getElementById('editNotes').value,
      proxy: document.getElementById('editProxy').value,
      proxyType: document.getElementById('editProxyType').value,
    };
    // Append proxy metadata only if a check was performed (dataset populated)
    if (editProxyStatusEl?.dataset.proxyIp) {
      body.proxyIp = editProxyStatusEl.dataset.proxyIp;
      body.proxyCountry = editProxyStatusEl.dataset.proxyCountry || '';
      body.proxyTimezone = editProxyStatusEl.dataset.proxyTimezone || '';
    }

    const r = await api(`/profiles/${id}`, {
      method: 'PUT',
      body,
    });
    if (r.success) { toast('Đã lưu!', 'success'); closeModal('detailModal'); loadProfiles(); }
    else toast(r.error || 'Lỗi', 'error');
  };

  document.getElementById('btnCheckEditProxy').onclick = () => checkProxyUI('editProxy', 'editProxyType', 'editProxyStatus');

  if (p.proxy && p.proxyType !== 'none' && !p.proxyCountry && !p.proxyTimezone) {
    await ensureProxyMetadata('editProxy', 'editProxyType', 'editProxyStatus');
    const infoEl = document.getElementById('editProxyInfo');
    if (infoEl) {
      infoEl.textContent = `Thông tin: ${getProxyDisplay({ proxy: p.proxy, proxyIp: document.getElementById('editProxyStatus')?.dataset.proxyIp, proxyCountry: document.getElementById('editProxyStatus')?.dataset.proxyCountry, proxyTimezone: document.getElementById('editProxyStatus')?.dataset.proxyTimezone })}`;
    }
  }
  openModal('detailModal');

  // Attach fingerprint toggle
  const btnToggleFP = document.getElementById('btnToggleFP');
  const fpContainer = document.getElementById('detailFingerprint');
  if (btnToggleFP && fpContainer) {
    let fpVisible = false;
    btnToggleFP.onclick = () => {
      fpVisible = !fpVisible;
      fpContainer.style.display = fpVisible ? 'block' : 'none';
      btnToggleFP.textContent = fpVisible ? 'Ẩn' : 'Hiện';
    };
  }
}

document.getElementById('btnCloseDetail').onclick = () => closeModal('detailModal');
document.getElementById('btnCloseDetail2').onclick = () => closeModal('detailModal');

// ====== Script Editor ======
function openScriptEditor(id) {
  currentScriptProfileId = id;
  document.getElementById('scriptName').value = '';
  document.getElementById('scriptCode').value = '';
  document.getElementById('scriptLogs').style.display = 'none';
  document.getElementById('logOutput').innerHTML = '';
  openModal('scriptModal');
}
document.getElementById('btnCloseScript').onclick = () => closeModal('scriptModal');

document.getElementById('btnSaveScript').onclick = async () => {
  const name = document.getElementById('scriptName').value.trim() || 'Untitled';
  const code = document.getElementById('scriptCode').value;
  if (!code) { toast('Vui lòng nhập code', 'error'); return; }

  const res = await api(`/automation/${currentScriptProfileId}/scripts`, {
    method: 'POST', body: { name, code }
  });
  if (res.success) toast('Script đã lưu!', 'success');
  else toast(res.error || 'Lỗi', 'error');
};

document.getElementById('btnRunScript').onclick = async () => {
  const code = document.getElementById('scriptCode').value;
  if (!code) { toast('Vui lòng nhập code', 'error'); return; }

  const logDiv = document.getElementById('scriptLogs');
  const logOut = document.getElementById('logOutput');
  logDiv.style.display = 'block';
  logOut.innerHTML = '<div class="log-line info">▶ Đang chạy script...</div>';

  // Use WebSocket for real-time logs
  connectWS();
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ action: 'run-script', profileId: currentScriptProfileId, code }));
  } else {
    // Fallback to HTTP
    const res = await api(`/automation/${currentScriptProfileId}/run`, {
      method: 'POST', body: { code }
    });
    if (res.success) {
      (res.data.logs || []).forEach(l => {
        logOut.innerHTML += `<div class="log-line ${l.type}">[${l.type}] ${esc(l.text)}</div>`;
      });
      logOut.innerHTML += `<div class="log-line info">✅ Hoàn thành${res.data.result ? ': ' + esc(res.data.result) : ''}</div>`;
    } else {
      logOut.innerHTML += `<div class="log-line error">❌ ${esc(res.error)}</div>`;
    }
  }
};
async function logout() {
  // Call server to clear cookie
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: authToken ? { 'Authorization': 'Bearer ' + authToken } : {},
    });
  } catch (e) { /* ignore */ }

  // Clear localStorage
  localStorage.removeItem('authToken');
  authToken = null;

  // Clear client-side cookies too
  document.cookie = 'authToken=;expires=' + new Date(0).toUTCString() + ';path=/';

  window.location.href = '/login.html';
}

const logoutBtn = document.getElementById('btnLogout');
if (logoutBtn) logoutBtn.onclick = logout;

updateFingerprintMode();

// ====== WebSocket ======
function connectWS() {
  if (ws && ws.readyState === WebSocket.OPEN) return;
  try {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      const logOut = document.getElementById('logOutput');
      if (data.type === 'log' || data.type === 'console') {
        logOut.innerHTML += `<div class="log-line log">[LOG] ${esc(data.text)}</div>`;
      } else if (data.type === 'error') {
        logOut.innerHTML += `<div class="log-line error">[ERROR] ${esc(data.text)}</div>`;
      } else if (data.type === 'info') {
        logOut.innerHTML += `<div class="log-line info">${esc(data.text)}</div>`;
      } else if (data.type === 'result') {
        if (data.success) {
          logOut.innerHTML += `<div class="log-line info">✅ Hoàn thành${data.result ? ': ' + esc(data.result) : ''}</div>`;
        } else {
          logOut.innerHTML += `<div class="log-line error">❌ ${esc(data.error)}</div>`;
        }
      }
      logOut.scrollTop = logOut.scrollHeight;
    };
  } catch (e) { /* WS unavailable, use HTTP fallback */ }
}

// ====== Search ======
let searchTimer;
document.getElementById('searchInput').oninput = function () {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => loadProfiles(this.value), 300);
};

// ====== Close modals on overlay click ======
document.querySelectorAll('.modal-overlay').forEach(el => {
  el.onclick = function (e) { if (e.target === this) this.classList.remove('active'); };
});

// ====== Auto-resolve duplicate dynamic proxy IPs ======
let isAutoResolving = false;
async function autoResolveDuplicateDynamicIPs() {
  if (isAutoResolving) return;
  isAutoResolving = true;
  try {
    const groups = {};
    for (const p of profiles) {
      if (!p.proxy || p.proxyType === 'none') continue;
      const proxyKey = p.proxy.trim();
      if (!groups[proxyKey]) groups[proxyKey] = [];
      groups[proxyKey].push(p);
    }

    let updatedAny = false;

    // 1. Ensure all profiles in groups of size > 1 have initial IPs
    for (const proxyKey of Object.keys(groups)) {
      const groupProfiles = groups[proxyKey];
      if (groupProfiles.length <= 1) continue;

      for (const p of groupProfiles) {
        if (!p.proxyIp) {
          const res = await api('/proxy/check', {
            method: 'POST',
            body: { proxy: p.proxy, proxyType: p.proxyType }
          });
          if (res.success && res.data.ip) {
            p.proxyIp = res.data.ip;
            p.proxyCountry = res.data.countryName || res.data.country || '';
            p.proxyTimezone = res.data.timezone || '';
            updatedAny = true;
            await api(`/profiles/${p.id}`, {
              method: 'PUT',
              body: {
                proxyIp: p.proxyIp,
                proxyCountry: p.proxyCountry,
                proxyTimezone: p.proxyTimezone
              }
            });
          }
        }
      }
    }

    // 2. Identify and filter dynamic proxy groups, mapping keepers and redundants
    const dynamicGroups = [];
    const allRedundants = [];
    const groupDataList = [];

    for (const proxyKey of Object.keys(groups)) {
      const groupProfiles = groups[proxyKey];
      if (groupProfiles.length <= 1) continue;

      const proxyHost = parseProxyHost(proxyKey).replace(/[\[\]]/g, '').trim();
      const isDynamic = groupProfiles.some(p => {
        if (p.proxyCategory === 'dynamic') return true;
        const cleanIp = (p.proxyIp || '').replace(/[\[\]]/g, '').trim();
        return cleanIp && cleanIp !== proxyHost;
      });

      if (isDynamic) {
        dynamicGroups.push(proxyKey);
        
        // Group profiles by currently recorded IP
        const ipGroups = {};
        for (const p of groupProfiles) {
          const cleanIp = (p.proxyIp || '').replace(/[\[\]]/g, '').trim() || 'no-ip';
          if (!ipGroups[cleanIp]) ipGroups[cleanIp] = [];
          ipGroups[cleanIp].push(p);
        }

        const keepers = [];
        const redundants = [];

        for (const ip of Object.keys(ipGroups)) {
          const list = ipGroups[ip];
          keepers.push(list[0]);
          if (list.length > 1) {
            redundants.push(...list.slice(1));
          }
        }

        allRedundants.push(...redundants);
        groupDataList.push({
          proxyKey,
          groupProfiles,
          proxyHost,
          keepers,
          redundants
        });
      }
    }

    // 3. Process dynamic groups for IP rotation
    const changedProfiles = [];

    for (const { proxyKey, groupProfiles, proxyHost, keepers, redundants } of groupDataList) {
      if (redundants.length === 0) {
        continue;
      }

      // Call proxy check ONCE this minute to see if the dynamic IP has rotated
      const sampleProfile = groupProfiles[0];
      const res = await api('/proxy/check', {
        method: 'POST',
        body: { proxy: sampleProfile.proxy, proxyType: sampleProfile.proxyType }
      });

      if (res.success && res.data.ip) {
        const newIp = res.data.ip.replace(/[\[\]]/g, '').trim();

        // Check if the new IP is unique (not matching any keeper's IP)
        const isNewIpUnique = keepers.every(k => {
          const keeperIp = (k.proxyIp || '').replace(/[\[\]]/g, '').trim();
          return keeperIp !== newIp;
        });

        if (isNewIpUnique) {
          // It's a new unique IP! We take ONE redundant profile and update it.
          const target = redundants[0];
          const oldIp = target.proxyIp || '';
          
          target.proxyIp = res.data.ip;
          target.proxyCountry = res.data.countryName || res.data.country || '';
          target.proxyTimezone = res.data.timezone || '';
          updatedAny = true;

          changedProfiles.push({
            name: target.name,
            oldIp: oldIp || 'Chưa có',
            newIp: target.proxyIp
          });

          await api(`/profiles/${target.id}`, {
            method: 'PUT',
            body: {
              proxyIp: target.proxyIp,
              proxyCountry: target.proxyCountry,
              proxyTimezone: target.proxyTimezone
            }
          });
        }
      }
    }

    if (updatedAny) {
      toast('Đã tự động xoay IP thành công cho các proxy trùng lặp.', 'success');
      loadProfiles();
    }
  } catch (err) {
    console.error('[AutoProxy] Gặp lỗi trong quá trình tự động xoay IP:', err);
  } finally {
    isAutoResolving = false;
  }
}

// ====== Auto-refresh running status ======
setInterval(() => { loadProfiles(document.getElementById('searchInput').value); }, 5000);

// ====== Bulk Script Runner ======
const btnBulkRunScript = document.getElementById('btnBulkRunScript');
const bulkScriptModal = document.getElementById('bulkScriptModal');
const btnCloseBulkScript = document.getElementById('btnCloseBulkScript');
const btnCancelBulkScript = document.getElementById('btnCancelBulkScript');
const btnRunBulkScript = document.getElementById('btnRunBulkScript');
const bulkScriptCode = document.getElementById('bulkScriptCode');
const bulkLogOutput = document.getElementById('bulkLogOutput');
const bulkScriptLogs = document.getElementById('bulkScriptLogs');

if (btnBulkRunScript) {
  btnBulkRunScript.onclick = () => {
    const selectedCount = selectedIds.size;
    if (selectedCount === 0) {
      toast('Vui lòng chọn ít nhất một profile', 'error');
      return;
    }
    document.getElementById('bulkScriptSelectedCount').textContent = selectedCount;
    bulkScriptLogs.style.display = 'none';
    bulkLogOutput.innerHTML = '';
    bulkScriptCode.value = '';
    openModal('bulkScriptModal');
  };
}

if (btnCloseBulkScript) btnCloseBulkScript.onclick = () => closeModal('bulkScriptModal');
if (btnCancelBulkScript) btnCancelBulkScript.onclick = () => closeModal('bulkScriptModal');

if (btnRunBulkScript) {
  btnRunBulkScript.onclick = async () => {
    const code = bulkScriptCode.value.trim();
    if (!code) {
      toast('Vui lòng nhập code script', 'error');
      return;
    }

    bulkScriptLogs.style.display = 'block';
    bulkLogOutput.innerHTML = '';
    btnRunBulkScript.disabled = true;
    btnCancelBulkScript.disabled = true;

    const ids = Array.from(selectedIds);
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const p = profiles.find(item => item.id === id);
      const name = p ? p.name : id;
      
      const logLine = document.createElement('div');
      logLine.className = 'log-line info';
      logLine.innerHTML = `[${i + 1}/${ids.length}] 🤖 Đang chuẩn bị chạy cho: <strong>${esc(name)}</strong>...`;
      bulkLogOutput.appendChild(logLine);
      bulkLogOutput.scrollTop = bulkLogOutput.scrollHeight;

      let wasRunning = p ? p.isRunning : false;
      if (!wasRunning) {
        logLine.innerHTML += ` (đang khởi động trình duyệt...)`;
        try {
          const openRes = await api(`/profiles/${id}/open`, { method: 'POST' });
          if (!openRes.success) {
            const errLine = document.createElement('div');
            errLine.className = 'log-line error';
            errLine.textContent = `❌ Lỗi khởi động: ${openRes.error}`;
            bulkLogOutput.appendChild(errLine);
            continue;
          }
          await new Promise(r => setTimeout(r, 3000));
        } catch (e) {
          const errLine = document.createElement('div');
          errLine.className = 'log-line error';
          errLine.textContent = `❌ Lỗi kết nối khởi động: ${e.message}`;
          bulkLogOutput.appendChild(errLine);
          continue;
        }
      }

      try {
        const runRes = await api(`/automation/${id}/run`, {
          method: 'POST',
          body: { code }
        });
        if (runRes.success) {
          const successLine = document.createElement('div');
          successLine.className = 'log-line success';
          successLine.innerHTML = `✅ Hoàn thành script cho <strong>${esc(name)}</strong>${runRes.data?.result ? ': ' + esc(runRes.data.result) : ''}`;
          bulkLogOutput.appendChild(successLine);
        } else {
          const errLine = document.createElement('div');
          errLine.className = 'log-line error';
          errLine.innerHTML = `❌ Lỗi thực thi cho <strong>${esc(name)}</strong>: ${esc(runRes.error)}`;
          bulkLogOutput.appendChild(errLine);
        }
      } catch (err) {
        const errLine = document.createElement('div');
        errLine.className = 'log-line error';
        errLine.innerHTML = `❌ Lỗi kết nối chạy script cho <strong>${esc(name)}</strong>: ${esc(err.message)}`;
        bulkLogOutput.appendChild(errLine);
      }

      if (!wasRunning) {
        try {
          await api(`/profiles/${id}/close`, { method: 'POST' });
        } catch (e) {}
      }
      
      bulkLogOutput.scrollTop = bulkLogOutput.scrollHeight;
    }

    btnRunBulkScript.disabled = false;
    btnCancelBulkScript.disabled = false;
    toast('Hoàn thành chạy script hàng loạt!', 'success');
  };
}

// ====== Init ======
loadProfiles().then(() => {
  setInterval(autoResolveDuplicateDynamicIPs, 60000);

  // Sync top scrollbar helper with profileGrid
  const helper = document.getElementById('topScrollHelper');
  const grid = document.getElementById('profileGrid');
  if (helper && grid) {
    let isSyncingHelper = false;
    let isSyncingGrid = false;
    helper.addEventListener('scroll', () => {
      if (!isSyncingHelper) {
        isSyncingGrid = true;
        grid.scrollLeft = helper.scrollLeft;
        isSyncingGrid = false;
      }
    });
    grid.addEventListener('scroll', () => {
      if (!isSyncingGrid) {
        isSyncingHelper = true;
        helper.scrollLeft = grid.scrollLeft;
        isSyncingHelper = false;
      }
    });
  }

  // Bind groups modal event listeners
  const btnManageGroups = document.getElementById('btnManageGroups');
  if (btnManageGroups) {
    btnManageGroups.addEventListener('click', openGroupsModal);
  }
  const btnCloseGroupsModal = document.getElementById('btnCloseGroupsModal');
  if (btnCloseGroupsModal) {
    btnCloseGroupsModal.addEventListener('click', closeGroupsModal);
  }
  const btnConfirmGroups = document.getElementById('btnConfirmGroups');
  if (btnConfirmGroups) {
    btnConfirmGroups.addEventListener('click', closeGroupsModal);
  }
  const btnSelectAllGroups = document.getElementById('btnSelectAllGroups');
  if (btnSelectAllGroups) {
    btnSelectAllGroups.addEventListener('click', () => {
      hiddenGroups.clear();
      localStorage.setItem('hiddenGroups', JSON.stringify([]));
      renderGroupsManagementList();
      renderProfiles();
    });
  }

  // Bind layout mode toggle listener
  const btnToggleLayout = document.getElementById('btnToggleLayout');
  if (btnToggleLayout) {
    btnToggleLayout.addEventListener('click', () => {
      layoutMode = layoutMode === 'column' ? 'row' : 'column';
      localStorage.setItem('layoutMode', layoutMode);
      applyLayoutMode();
    });
  }
  // ====== Update Modal Handling ======
  const btnCheckUpdate = document.getElementById('btnCheckUpdate');
  const updateModal = document.getElementById('updateModal');
  const btnCloseUpdateModal = document.getElementById('btnCloseUpdateModal');
  const btnCancelUpdate = document.getElementById('btnCancelUpdate');
  const btnConfirmUpdate = document.getElementById('btnConfirmUpdate');

  const updateGithubRepoInput = document.getElementById('updateGithubRepo');
  const updateGithubBranchInput = document.getElementById('updateGithubBranch');

  // Pre-fill fields from localStorage or defaults
  if (updateGithubRepoInput) {
    updateGithubRepoInput.value = localStorage.getItem('updateGithubRepo') || 'Duyquoclite/File';
  }
  if (updateGithubBranchInput) {
    updateGithubBranchInput.value = localStorage.getItem('updateGithubBranch') || 'main';
  }

  const btnUploadUpdate = document.getElementById('btnUploadUpdate');

  if (btnCheckUpdate) {
    btnCheckUpdate.onclick = async () => {
      openModal('updateModal');
      try {
        const res = await api('/update/status');
        const uploadSection = document.getElementById('uploadSection');
        if (uploadSection) {
          uploadSection.style.display = res.hasKey ? 'block' : 'none';
        }
      } catch (err) {
        console.error('Failed to get status:', err);
      }
    };
  }

  if (btnCloseUpdateModal) btnCloseUpdateModal.onclick = () => closeModal('updateModal');
  if (btnCancelUpdate) btnCancelUpdate.onclick = () => closeModal('updateModal');

  if (btnUploadUpdate) {
    btnUploadUpdate.onclick = async () => {
      const repo = updateGithubRepoInput.value.trim();
      const branch = updateGithubBranchInput.value.trim();

      if (!repo) {
        toast('Vui lòng nhập GitHub Repository (owner/repo).', 'error');
        return;
      }

      btnUploadUpdate.disabled = true;
      btnUploadUpdate.textContent = 'Đang đẩy mã nguồn lên GitHub...';

      try {
        const res = await api('/update/github-push', {
          method: 'POST',
          body: { repo, branch }
        });

        if (res.success) {
          toast('Đẩy mã nguồn lên GitHub thành công!', 'success');
        } else {
          toast(res.error || 'Lỗi khi đẩy mã nguồn.', 'error');
        }
      } catch (err) {
        toast('Lỗi kết nối đẩy mã nguồn: ' + err.message, 'error');
      } finally {
        btnUploadUpdate.disabled = false;
        btnUploadUpdate.textContent = '📤 Đẩy mã nguồn lên GitHub';
      }
    };
  }

  if (btnConfirmUpdate) {
    btnConfirmUpdate.onclick = async () => {
      const repo = updateGithubRepoInput.value.trim();
      const branch = updateGithubBranchInput.value.trim();

      if (!repo) {
        toast('Vui lòng nhập GitHub Repository (owner/repo).', 'error');
        return;
      }

      // Save to localStorage for convenience
      localStorage.setItem('updateGithubRepo', repo);
      localStorage.setItem('updateGithubBranch', branch);

      btnConfirmUpdate.disabled = true;
      btnConfirmUpdate.textContent = 'Đang tải bản cập nhật...';

      try {
        const res = await api('/update/github-apply', {
          method: 'POST',
          body: { repo, branch }
        });

        if (res.success) {
          toast('Cập nhật thành công! Server đang khởi động lại...', 'success');
          closeModal('updateModal');

          // Countdown to reload the page
          let count = 5;
          const interval = setInterval(() => {
            if (count <= 0) {
              clearInterval(interval);
              window.location.reload();
            } else {
              toast(`Trang sẽ tự tải lại sau ${count} giây...`, 'info');
              count--;
            }
          }, 1000);
        } else {
          toast(res.error || 'Cập nhật thất bại.', 'error');
          btnConfirmUpdate.disabled = false;
          btnConfirmUpdate.textContent = 'Cập nhật ngay';
        }
      } catch (err) {
        toast('Lỗi kết nối tải bản cập nhật: ' + err.message, 'error');
        btnConfirmUpdate.disabled = false;
        btnConfirmUpdate.textContent = 'Cập nhật ngay';
      }
    };
  }

  applyLayoutMode();
});
connectWS();
