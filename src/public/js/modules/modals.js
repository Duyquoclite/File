import { state, langOptions } from './state.js';
import { api } from './api.js';
import {
  toast,
  setProgressOverlay,
  hideProgressOverlay,
  loadProfiles,
  renderProfiles,
  renderGroupsManagementList,
  updateBulkUI,
  getProxyDisplay,
  esc,
  setProgressInterval,
  getProgressInterval
} from './ui.js';

let confirmResolver = null;

export function openModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('active');
}

export function closeModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('active');
}

export function showMessageModal({ title = 'Thông báo', message = '', okText = 'Đóng' } = {}) {
  const modal = document.getElementById('messageModal');
  if (!modal) {
    window.alert(message);
    return;
  }
  const titleEl = document.getElementById('messageModalTitle');
  const msgEl = document.getElementById('messageModalMessage');
  const okBtn = document.getElementById('messageModalOk');
  if (titleEl) titleEl.textContent = title;
  if (msgEl) msgEl.innerHTML = message;
  if (okBtn) okBtn.textContent = okText;
  openModal('messageModal');
}

export function showConfirm({ title = 'Xác nhận', message = 'Bạn có chắc chắn?', confirmText = 'Xác nhận', cancelText = 'Hủy' } = {}) {
  return new Promise(resolve => {
    const modal = document.getElementById('confirmModal');
    if (!modal) {
      resolve(window.confirm(message));
      return;
    }
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

export function closeConfirmModal(result = false) {
  const modal = document.getElementById('confirmModal');
  if (modal) modal.classList.remove('active');
  if (confirmResolver) {
    confirmResolver(result);
    confirmResolver = null;
  }
}

export function openGroupsModal() {
  renderGroupsManagementList();
  document.getElementById('groupsModal').classList.add('active');
}

export function closeGroupsModal() {
  document.getElementById('groupsModal').classList.remove('active');
}

export async function checkProxyUI(proxyInputId, proxyTypeId, statusElId) {
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
    statusEl.dataset.proxyLat = res.data.latitude || '';
    statusEl.dataset.proxyLon = res.data.longitude || '';

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

export async function ensureProxyMetadata(proxyInputId, proxyTypeId, statusElId) {
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

export async function duplicateProfile(id) {
  const overlay = ensureProgressOverlay();
  setProgressOverlay('Đang nhân bản profile...', 'Bắt đầu sao chép...', 0);
  let progress = 0;
  const interval = setInterval(() => {
    if (progress < 90) {
      progress += Math.floor(Math.random() * 8) + 4;
      setProgressOverlay('Đang nhân bản profile...', 'Đang sao chép dữ liệu...', progress);
    }
  }, 300);
  setProgressInterval(interval);

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
    const currentInterval = getProgressInterval();
    if (currentInterval) {
      clearInterval(currentInterval);
      setProgressInterval(null);
    }
    setTimeout(hideProgressOverlay, 600);
  }
}

export async function openProfile(id) {
  if (state.launchingProfileIds.has(id)) return;
  state.launchingProfileIds.add(id);
  toast('Đang mở Chrome...', 'info');
  renderProfiles();

  try {
    const res = await api(`/profiles/${id}/open`, { method: 'POST' });
    if (res.success) {
      toast('Chrome đã mở!', 'success');
    } else {
      toast(res.error || 'Lỗi mở Chrome', 'error');
    }
  } catch (err) {
    toast(err.message || 'Lỗi kết nối để mở Chrome', 'error');
  } finally {
    state.launchingProfileIds.delete(id);
    loadProfiles();
  }
}

export async function closeProfile(id) {
  const res = await api(`/profiles/${id}/close`, { method: 'POST' });
  if (res.success) {
    toast('Chrome đã đóng', 'success');
    loadProfiles();
  } else {
    toast(res.error || 'Lỗi', 'error');
  }
}

export async function deleteProfile(id) {
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

export async function regenFingerprint(id) {
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

export function toggleSelect(id, e) {
  e.stopPropagation();
  if (state.selectedIds.has(id)) {
    state.selectedIds.delete(id);
  } else {
    state.selectedIds.add(id);
  }

  updateBulkUI();
  renderProfiles();
}

export function toggleGroupSelect(groupKey, e) {
  e.stopPropagation();
  const groupProfiles = state.profiles.filter(p => {
    const pk = p.proxy && p.proxy.trim() ? p.proxy.trim() : 'no-proxy';
    return pk === groupKey;
  });

  const allSelected = groupProfiles.every(p => state.selectedIds.has(p.id));
  
  if (allSelected) {
    groupProfiles.forEach(p => state.selectedIds.delete(p.id));
  } else {
    groupProfiles.forEach(p => state.selectedIds.add(p.id));
  }

  updateBulkUI();
  renderProfiles();
}

// Module-level state for Cookie manager
let cookieDomains = [];
let currentCookieFormat = 'json';
let currentCookieData = null;
let isEditingCookies = false;

function syntaxHighlightJSON(json) {
  if (typeof json !== 'string') {
    json = JSON.stringify(json, undefined, 2);
  }
  json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g, function (match) {
    let cls = 'number';
    if (/^"/.test(match)) {
      if (/:$/.test(match)) {
        cls = 'key';
      } else {
        cls = 'string';
      }
    } else if (/true|false/.test(match)) {
      cls = 'boolean';
    } else if (/null/.test(match)) {
      cls = 'null';
    }
    return '<span class="json-' + cls + '">' + match + '</span>';
  });
}

async function loadCookieDomains(profileId) {
  const domainsListEl = document.getElementById('cookieDomainsList');
  if (!domainsListEl) return;
  
  domainsListEl.innerHTML = '<div style="font-size:0.85rem;color:var(--text-muted);padding:10px;">Đang tải danh sách...</div>';
  
  try {
    const res = await api(`/profiles/${profileId}/cookies`);
    if (res.success) {
      cookieDomains = res.data || [];
      renderCookieDomains(profileId, cookieDomains);
    } else {
      domainsListEl.innerHTML = `<div style="font-size:0.85rem;color:var(--danger);padding:10px;">Lỗi: ${res.error}</div>`;
    }
  } catch (err) {
    domainsListEl.innerHTML = `<div style="font-size:0.85rem;color:var(--danger);padding:10px;">Không thể kết nối server.</div>`;
  }
}

function renderCookieDomains(profileId, list, searchFilter = '') {
  const domainsListEl = document.getElementById('cookieDomainsList');
  if (!domainsListEl) return;
  
  const filtered = list.filter(item => 
    item.domain.toLowerCase().includes(searchFilter.toLowerCase())
  );
  
  if (filtered.length === 0) {
    domainsListEl.innerHTML = '<div style="font-size:0.85rem;color:var(--text-muted);padding:10px;">Không có website nào</div>';
    return;
  }
  
  domainsListEl.innerHTML = filtered.map(item => `
    <div class="cookie-domain-item" data-domain="${esc(item.domain)}">
      <span style="word-break:break-all;padding-right:8px;">${esc(item.domain)}</span>
      <span class="count">${item.count}</span>
    </div>
  `).join('');
  
  domainsListEl.querySelectorAll('.cookie-domain-item').forEach(el => {
    el.onclick = () => {
      domainsListEl.querySelectorAll('.cookie-domain-item').forEach(item => item.classList.remove('active'));
      el.classList.add('active');
      const domain = el.dataset.domain;
      selectCookieDomain(profileId, domain);
    };
  });
}

async function selectCookieDomain(profileId, domain) {
  const mainPanel = document.getElementById('cookieMainPanel');
  if (!mainPanel) return;
  
  mainPanel.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted);">Đang tải cookie...</div>';
  
  try {
    const res = await api(`/profiles/${profileId}/cookies?domain=${encodeURIComponent(domain)}`);
    if (res.success) {
      currentCookieData = res.data;
      isEditingCookies = false;
      renderCookieEditor(profileId, domain);
    } else {
      mainPanel.innerHTML = `<div style="padding:20px;color:var(--danger);">Lỗi tải cookie: ${res.error}</div>`;
    }
  } catch (err) {
    mainPanel.innerHTML = `<div style="padding:20px;color:var(--danger);">Lỗi kết nối.</div>`;
  }
}

function renderCookieEditor(profileId, domain) {
  const mainPanel = document.getElementById('cookieMainPanel');
  if (!mainPanel) return;

  const profileIsRunning = state.profiles.find(p => p.id === profileId)?.isRunning || false;
  
  let coloredJsonHtml = '';
  let jsonString = '';
  if (currentCookieData && currentCookieData.cookies) {
    const cleanList = currentCookieData.cookies.map(c => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path,
      secure: c.secure,
      httpOnly: c.httpOnly,
      sameSite: c.sameSite === 0 ? 'no_restriction' : c.sameSite === 2 ? 'strict' : 'lax',
      expires: c.expires ? Math.floor((c.expires - 11644473600000000) / 1000000000) : null
    }));
    jsonString = JSON.stringify(cleanList, null, 2);
    coloredJsonHtml = syntaxHighlightJSON(jsonString);
  }

  const rawString = currentCookieData ? currentCookieData.raw : '';

  mainPanel.innerHTML = `
    <div class="cookie-editor-container">
      <div class="cookie-header-bar">
        <div class="cookie-header-title" style="word-break:break-all;">
          🍪 ${esc(domain)}
        </div>
        <div style="display:flex; gap:12px; align-items:center;">
          <div class="cookie-format-toggles">
            <button class="cookie-format-btn ${currentCookieFormat === 'json' ? 'active' : ''}" id="btnFmtJson">JSON</button>
            <button class="cookie-format-btn ${currentCookieFormat === 'raw' ? 'active' : ''}" id="btnFmtRaw">RAW</button>
          </div>
          <div class="cookie-action-buttons">
            <button class="btn btn-secondary btn-sm" id="btnCopyCookie">Copy</button>
            ${isEditingCookies ? `
              <button class="btn btn-ghost btn-sm" id="btnCancelEditCookie">Hủy</button>
              <button class="btn btn-primary btn-sm" id="btnSaveCookie" ${profileIsRunning ? 'disabled style="opacity:0.6; cursor:not-allowed;"' : ''}>Lưu</button>
            ` : `
              <button class="btn btn-primary btn-sm" id="btnEditCookie">Chỉnh sửa</button>
            `}
          </div>
        </div>
      </div>
      
      <div class="cookie-editor-wrapper">
        ${isEditingCookies ? `
          <textarea class="cookie-editor-textarea" id="cookieTextarea" placeholder="${currentCookieFormat === 'json' ? 'Nhập cookie dạng JSON array...' : 'Nhập cookie dạng name=value; name2=value2;...'}" autocomplete="off" spellcheck="false">${currentCookieFormat === 'json' ? esc(jsonString) : esc(rawString)}</textarea>
        ` : `
          ${currentCookieFormat === 'json' ? `
            <pre class="cookie-json-pre" id="cookieJsonView"><code>${coloredJsonHtml}</code></pre>
          ` : `
            <textarea class="cookie-editor-textarea" readonly id="cookieTextarea" style="opacity: 0.85;" autocomplete="off" spellcheck="false">${esc(rawString)}</textarea>
          `}
        `}
      </div>
      
      ${profileIsRunning ? `
        <div class="cookie-warning">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          Trình duyệt đang chạy. Bạn chỉ có thể xem, vui lòng đóng trình duyệt để chỉnh sửa và lưu cookie.
        </div>
      ` : ''}
    </div>
  `;

  const btnFmtJson = document.getElementById('btnFmtJson');
  const btnFmtRaw = document.getElementById('btnFmtRaw');
  const btnCopyCookie = document.getElementById('btnCopyCookie');
  const btnEditCookie = document.getElementById('btnEditCookie');
  const btnCancelEditCookie = document.getElementById('btnCancelEditCookie');
  const btnSaveCookie = document.getElementById('btnSaveCookie');

  btnFmtJson.onclick = () => {
    if (currentCookieFormat === 'json') return;
    currentCookieFormat = 'json';
    renderCookieEditor(profileId, domain);
  };

  btnFmtRaw.onclick = () => {
    if (currentCookieFormat === 'raw') return;
    currentCookieFormat = 'raw';
    renderCookieEditor(profileId, domain);
  };

  btnCopyCookie.onclick = () => {
    const textToCopy = currentCookieFormat === 'json' ? jsonString : rawString;
    navigator.clipboard.writeText(textToCopy).then(() => {
      toast('Đã copy cookie vào clipboard!', 'success');
    }).catch(() => {
      toast('Lỗi copy cookie', 'error');
    });
  };

  if (btnEditCookie) {
    btnEditCookie.onclick = () => {
      isEditingCookies = true;
      renderCookieEditor(profileId, domain);
    };
  }

  if (btnCancelEditCookie) {
    btnCancelEditCookie.onclick = () => {
      isEditingCookies = false;
      renderCookieEditor(profileId, domain);
    };
  }

  if (btnSaveCookie && !profileIsRunning) {
    btnSaveCookie.onclick = async () => {
      const textarea = document.getElementById('cookieTextarea');
      if (!textarea) return;
      
      const content = textarea.value.trim();
      btnSaveCookie.disabled = true;
      btnSaveCookie.textContent = 'Đang lưu...';
      
      try {
        const res = await api(`/profiles/${profileId}/cookies`, {
          method: 'PUT',
          body: {
            domain,
            format: currentCookieFormat,
            content
          }
        });
        
        if (res.success) {
          toast('Đã lưu cookie thành công!', 'success');
          await loadCookieDomains(profileId);
          await selectCookieDomain(profileId, domain);
        } else {
          toast(res.error || 'Lỗi lưu cookie', 'error');
          btnSaveCookie.disabled = false;
          btnSaveCookie.textContent = 'Lưu';
        }
      } catch (err) {
        toast('Lỗi kết nối lưu cookie', 'error');
        btnSaveCookie.disabled = false;
        btnSaveCookie.textContent = 'Lưu';
      }
    };
  }
}

function initAutoGrowTextarea(id) {
  const tx = document.getElementById(id);
  if (!tx) return;
  tx.style.boxSizing = 'border-box';
  tx.style.resize = 'none';
  tx.style.overflowY = 'hidden';
  
  const resize = () => {
    tx.style.height = 'auto';
    tx.style.height = tx.scrollHeight + 'px';
  };
  
  setTimeout(resize, 50);
  tx.addEventListener('input', resize);
}

export async function showDetail(id) {
  const res = await api(`/profiles/${id}`);
  if (!res.success) {
    toast('Lỗi', 'error');
    return;
  }
  const p = res.data;
  const fp = p.fingerprint || {};
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

  document.getElementById('detailTitle').textContent = p.name;
  document.getElementById('detailBody').innerHTML = `
    <div class="modal-tabs">
      <div class="modal-tab active" id="tabConfigBtn">Cấu hình</div>
      <div class="modal-tab" id="tabCookieBtn">Cookie</div>
    </div>

    <div class="tab-content active" id="tabConfigContent">
      <div class="detail-section">
        <h4>Thông tin cơ bản</h4>
        <div class="form-group">
          <label>Tên</label>
          <input type="text" id="editName" value="${esc(p.name)}">
        </div>
        <div class="form-group">
          <label>Ghi chú</label>
          <textarea id="editNotes" rows="5">${esc(p.notes)}</textarea>
        </div>
        <div class="form-group">
          <label>Thẻ (Tags)</label>
          <input type="text" id="editTags" value="${esc(p.tags || '')}" placeholder="VD: VIA, Ads, Nuôi">
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
              <input type="text" id="editProxy" value="${esc(p.proxy ? p.proxy.replace(/^[a-zA-Z0-9]+:\/*/, '') : '')}">
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
      </div>

      <div class="detail-section">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <h4 style="margin:0;">Fingerprint</h4>
          <div style="display:flex; gap:8px;">
            <button class="btn btn-secondary btn-sm" id="btnRandomEditFp" type="button">Random fingerprint</button>
            <button class="btn btn-ghost btn-sm" id="btnToggleFP" type="button">Hiện</button>
          </div>
        </div>
        <div id="detailFingerprint" style="display:none;" class="fp-details">
          <div class="fp-item"><span>User Agent</span><input type="text" id="editFpUA" list="uaList" value="${esc(fp.userAgent || '')}"></div>
          <div class="fp-item"><span>Platform</span><input type="text" id="editFpPlatform" list="platformList" value="${esc(fp.platform || 'Win32')}"></div>
          <div class="fp-item"><span>Screen</span>
            <div style="display:flex; gap:8px;">
              <input type="number" id="editFpScreenWidth" value="${fp.screen?.width || 1920}" min="800" style="width:100px;">
              <input type="number" id="editFpScreenHeight" value="${fp.screen?.height || 1080}" min="600" style="width:100px;">
            </div>
          </div>
          <div class="fp-item"><span>Language</span><select id="editFpLang"></select></div>
          <div class="fp-item"><span>Timezone</span><input type="text" id="editFpTZ" list="tzList" value="${esc(fp.timezone || 'Asia/Ho_Chi_Minh')}"></div>
          <div class="fp-item"><span>WebGL</span><input type="text" id="editFpWebGL" list="webglList" value="${esc(fp.webgl?.renderer || '')}"></div>
          <div class="fp-item"><span>CPU Cores</span><input type="number" id="editFpCores" value="${fp.hardwareConcurrency || 8}" min="1" style="width:100px;"></div>
          <div class="fp-item"><span>RAM</span><input type="number" id="editFpRAM" value="${fp.deviceMemory || 16}" min="1" style="width:100px;"></div>
        </div>
      </div>
      <div class="detail-section">
        <h4>ID</h4>
        <code style="font-size:0.8rem;color:var(--text-muted);word-break:break-all;">${p.id}</code>
      </div>
    </div>

    <div class="tab-content" id="tabCookieContent">
      <div class="cookie-manager">
        <div class="cookie-sidebar">
          <div class="cookie-search">
            <input type="text" id="cookieSearchInput" placeholder="Tìm kiếm website...">
          </div>
          <div class="cookie-domains-list" id="cookieDomainsList">
            <!-- Loaded dynamically -->
          </div>
        </div>
        <div class="cookie-main" id="cookieMainPanel">
          <div class="cookie-placeholder">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.4">
              <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"/>
              <path d="M12 6a2 2 0 1 0 2 2 2 2 0 0 0-2-2zm0 5v5m0-9.9h.1"/>
            </svg>
            <span style="font-size: 0.9rem;">Chọn một website ở danh sách bên trái để xem và quản lý cookie.</span>
          </div>
        </div>
      </div>
    </div>
  `;

  // Attach tabs events
  const tabConfigBtn = document.getElementById('tabConfigBtn');
  const tabCookieBtn = document.getElementById('tabCookieBtn');
  const tabConfigContent = document.getElementById('tabConfigContent');
  const tabCookieContent = document.getElementById('tabCookieContent');
  const btnSaveDetail = document.getElementById('btnSaveDetail');

  tabConfigBtn.onclick = () => {
    tabConfigBtn.classList.add('active');
    tabCookieBtn.classList.remove('active');
    tabConfigContent.classList.add('active');
    tabCookieContent.classList.remove('active');
    btnSaveDetail.style.display = 'block';
  };

  tabCookieBtn.onclick = () => {
    tabConfigBtn.classList.remove('active');
    tabCookieBtn.classList.add('active');
    tabConfigContent.classList.remove('active');
    tabCookieContent.classList.add('active');
    btnSaveDetail.style.display = 'none';
    loadCookieDomains(id);
  };

  // Attach search event
  const cookieSearchInput = document.getElementById('cookieSearchInput');
  if (cookieSearchInput) {
    cookieSearchInput.oninput = (e) => {
      renderCookieDomains(id, cookieDomains, e.target.value);
    };
  }

  function getEditFingerprintFromFields() {
    const ua = document.getElementById('editFpUA').value.trim();
    const platform = document.getElementById('editFpPlatform').value;
    const width = parseInt(document.getElementById('editFpScreenWidth').value, 10) || 1920;
    const height = parseInt(document.getElementById('editFpScreenHeight').value, 10) || 1080;
    const languages = document.getElementById('editFpLang').value.split(',').map(v => v.trim()).filter(Boolean);
    const timezone = document.getElementById('editFpTZ').value.trim();
    const webgl = document.getElementById('editFpWebGL').value.trim();
    const cores = parseInt(document.getElementById('editFpCores').value, 10) || undefined;
    const ram = parseInt(document.getElementById('editFpRAM').value, 10) || undefined;

    const resFp = {
      userAgent: ua || undefined,
      platform,
      screen: { width, height },
      languages,
      timezone: timezone || undefined,
      hardwareConcurrency: cores,
      deviceMemory: ram,
    };
    if (webgl) resFp.webgl = { renderer: webgl };
    return resFp;
  }

  document.getElementById('btnSaveDetail').onclick = async () => {
    const editProxyStatusEl = document.getElementById('editProxyStatus');
    const editProxyType = document.getElementById('editProxyType').value;
    const editProxyAddr = document.getElementById('editProxy').value.trim();
    let normalizedProxy = '';
    if (editProxyType !== 'none' && editProxyAddr) {
      const schemeMatch = editProxyAddr.match(/^([a-zA-Z0-9]+):\/+(.*)$/);
      if (schemeMatch) {
        normalizedProxy = `${schemeMatch[1].toLowerCase()}://${schemeMatch[2]}`;
      } else {
        normalizedProxy = `${editProxyType}://${editProxyAddr}`;
      }
    }
    const body = {
      name: document.getElementById('editName').value,
      notes: document.getElementById('editNotes').value,
      tags: document.getElementById('editTags').value,
      proxy: normalizedProxy,
      proxyType: editProxyType,
      fingerprint: getEditFingerprintFromFields()
    };
    if (editProxyStatusEl?.dataset.proxyIp) {
      body.proxyIp = editProxyStatusEl.dataset.proxyIp;
      body.proxyCountry = editProxyStatusEl.dataset.proxyCountry || '';
      body.proxyTimezone = editProxyStatusEl.dataset.proxyTimezone || '';
      body.proxyLat = editProxyStatusEl.dataset.proxyLat || '';
      body.proxyLon = editProxyStatusEl.dataset.proxyLon || '';
    }

    const r = await api(`/profiles/${id}`, {
      method: 'PUT',
      body,
    });
    if (r.success) {
      toast('Đã lưu!', 'success');
      closeModal('detailModal');
      loadProfiles();
    } else {
      toast(r.error || 'Lỗi', 'error');
    }
  };

  document.getElementById('btnCheckEditProxy').onclick = () => checkProxyUI('editProxy', 'editProxyType', 'editProxyStatus');

  const currentLangVal = fp.languages ? fp.languages.join(', ') : 'vi-VN, vi, en-US, en';
  const editFpLangSelect = document.getElementById('editFpLang');
  if (editFpLangSelect) {
    editFpLangSelect.innerHTML = langOptions.map(opt => `<option value="${opt}">${opt}</option>`).join('');
    if (![...editFpLangSelect.options].some(o => o.value === currentLangVal)) {
      const opt = document.createElement('option');
      opt.value = currentLangVal;
      opt.textContent = currentLangVal;
      editFpLangSelect.appendChild(opt);
    }
    editFpLangSelect.value = currentLangVal;
  }

  openModal('detailModal');
  initAutoGrowTextarea('editNotes');

  if (p.proxy && p.proxyType !== 'none' && !p.proxyCountry && !p.proxyTimezone) {
    ensureProxyMetadata('editProxy', 'editProxyType', 'editProxyStatus').then(() => {
      const infoEl = document.getElementById('editProxyInfo');
      if (infoEl) {
        infoEl.textContent = `Thông tin: ${getProxyDisplay({ proxy: p.proxy, proxyIp: document.getElementById('editProxyStatus')?.dataset.proxyIp, proxyCountry: document.getElementById('editProxyStatus')?.dataset.proxyCountry, proxyTimezone: document.getElementById('editProxyStatus')?.dataset.proxyTimezone })}`;
      }
    }).catch(err => {
      console.warn("Failed to check proxy metadata background:", err);
    });
  }

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

  const btnRandomEditFp = document.getElementById('btnRandomEditFp');
  if (btnRandomEditFp) {
    btnRandomEditFp.onclick = async () => {
      const res = await api('/profiles/fingerprint-sample');
      if (res.success) {
        const sample = res.data;
        document.getElementById('editFpUA').value = sample.userAgent || '';
        document.getElementById('editFpPlatform').value = sample.platform || 'Win32';
        document.getElementById('editFpScreenWidth').value = sample.screen?.width || 1920;
        document.getElementById('editFpScreenHeight').value = sample.screen?.height || 1080;
        
        const langVal = sample.languages ? sample.languages.join(', ') : 'vi-VN, vi, en-US, en';
        const selectEl = document.getElementById('editFpLang');
        if (selectEl) {
          if (![...selectEl.options].some(o => o.value === langVal)) {
            const opt = document.createElement('option');
            opt.value = langVal;
            opt.textContent = langVal;
            selectEl.appendChild(opt);
          }
          selectEl.value = langVal;
        }

        document.getElementById('editFpTZ').value = sample.timezone || 'Asia/Ho_Chi_Minh';
        document.getElementById('editFpWebGL').value = sample.webgl?.renderer || '';
        document.getElementById('editFpCores').value = sample.hardwareConcurrency || 8;
        document.getElementById('editFpRAM').value = sample.deviceMemory || 16;
        toast('Đã random fingerprint mới!', 'success');
      } else {
        toast('Lỗi random fingerprint: ' + res.error, 'error');
      }
    };
  }
}

async function loadFingerprintSample() {
  const res = await api('/profiles/fingerprint-sample');
  if (!res.success) {
    toast(res.error || 'Không thể tạo fingerprint mẫu', 'error');
    return;
  }
  state.currentFingerprintDraft = res.data;
  populateFingerprintFields(state.currentFingerprintDraft);
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
  if (randomButton) randomButton.style.display = manual ? 'inline-flex' : 'none';
  if (details && chevron) {
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
}

export function setupModalEventListeners() {
  // Confirm Modal events
  const _confirmModalEl = document.getElementById('confirmModal');
  if (_confirmModalEl) {
    const okBtn = document.getElementById('confirmModalConfirm');
    const cancelBtn = document.getElementById('confirmModalCancel');
    const closeBtn = document.getElementById('confirmModalClose');
    if (okBtn) okBtn.onclick = () => closeConfirmModal(true);
    if (cancelBtn) cancelBtn.onclick = () => closeConfirmModal(false);
    if (closeBtn) closeBtn.onclick = () => closeConfirmModal(false);
    
    let confirmMousedownTarget = null;
    _confirmModalEl.addEventListener('mousedown', (e) => {
      confirmMousedownTarget = e.target;
    });
    _confirmModalEl.addEventListener('click', (e) => {
      if (e.target === _confirmModalEl && confirmMousedownTarget === _confirmModalEl) {
        closeConfirmModal(false);
      }
    });
  }

  // Message Modal events
  const _messageModalEl = document.getElementById('messageModal');
  if (_messageModalEl) {
    const okBtn = document.getElementById('messageModalOk');
    const closeBtn = document.getElementById('messageModalClose');
    if (okBtn) okBtn.onclick = () => closeModal('messageModal');
    if (closeBtn) closeBtn.onclick = () => closeModal('messageModal');
    
    let messageMousedownTarget = null;
    _messageModalEl.addEventListener('mousedown', (e) => {
      messageMousedownTarget = e.target;
    });
    _messageModalEl.addEventListener('click', (e) => {
      if (e.target === _messageModalEl && messageMousedownTarget === _messageModalEl) {
        closeModal('messageModal');
      }
    });
  }

  // Close modals on overlay click
  document.querySelectorAll('.modal-overlay').forEach(el => {
    if (el.id === 'confirmModal' || el.id === 'messageModal') return;

    let mousedownTarget = null;
    el.addEventListener('mousedown', (e) => {
      mousedownTarget = e.target;
    });
    el.addEventListener('click', (e) => {
      if (e.target === el && mousedownTarget === el) {
        el.classList.remove('active');
      }
    });
  });

  // Create Modal elements
  const btnCloseModal = document.getElementById('btnCloseModal');
  if (btnCloseModal) btnCloseModal.onclick = () => closeModal('createModal');
  const btnCancelCreate = document.getElementById('btnCancelCreate');
  if (btnCancelCreate) btnCancelCreate.onclick = () => closeModal('createModal');
  
  const proxyType = document.getElementById('proxyType');
  if (proxyType) {
    proxyType.onchange = function () {
      const inputGroup = document.getElementById('proxyInputGroup');
      if (inputGroup) inputGroup.style.display = this.value === 'none' ? 'none' : 'block';
    };
  }

  const fpToggle = document.getElementById('fpToggle');
  if (fpToggle) {
    fpToggle.onclick = () => {
      const d = document.getElementById('fpDetails');
      const c = document.querySelector('.fp-chevron');
      if (d && c) {
        if (d.style.display === 'none') {
          d.style.display = 'block';
          c.classList.add('open');
        } else {
          d.style.display = 'none';
          c.classList.remove('open');
        }
      }
    };
  }

  const fpModeAuto = document.getElementById('fpModeAuto');
  if (fpModeAuto) fpModeAuto.onchange = updateFingerprintMode;
  const fpModeManual = document.getElementById('fpModeManual');
  if (fpModeManual) fpModeManual.onchange = updateFingerprintMode;

  const btnRandomFingerprint = document.getElementById('btnRandomFingerprint');
  if (btnRandomFingerprint) btnRandomFingerprint.onclick = loadFingerprintSample;

  const btnCreate = document.getElementById('btnCreate');
  if (btnCreate) {
    btnCreate.onclick = () => {
      openModal('createModal');
      loadFingerprintSample();
      initAutoGrowTextarea('profileNotes');
    };
  }

  const btnConfirmCreate = document.getElementById('btnConfirmCreate');
  if (btnConfirmCreate) {
    btnConfirmCreate.onclick = async () => {
      const name = document.getElementById('profileName').value.trim();
      if (!name) {
        toast('Vui lòng nhập tên profile', 'error');
        return;
      }
      const proxyTypeValue = document.getElementById('proxyType').value;
      const proxyAddr = document.getElementById('proxyAddress').value.trim();
      let proxy = '';
      if (proxyTypeValue !== 'none' && proxyAddr) {
        const schemeMatch = proxyAddr.match(/^([a-zA-Z0-9]+):\/+(.*)$/);
        if (schemeMatch) {
          proxy = `${schemeMatch[1].toLowerCase()}://${schemeMatch[2]}`;
        } else {
          proxy = `${proxyTypeValue}://${proxyAddr}`;
        }
      }

      const proxyStatusEl = document.getElementById('proxyStatus');
      if (proxy && proxyTypeValue !== 'none') {
        await ensureProxyMetadata('proxyAddress', 'proxyType', 'proxyStatus');
      }
      const body = {
        name,
        notes: document.getElementById('profileNotes').value,
        tags: document.getElementById('profileTags').value,
        proxy,
        proxyType: proxyTypeValue,
        proxyIp: proxyStatusEl?.dataset.proxyIp || '',
        proxyCountry: proxyStatusEl?.dataset.proxyCountry || '',
        proxyTimezone: proxyStatusEl?.dataset.proxyTimezone || '',
        proxyLat: proxyStatusEl?.dataset.proxyLat || '',
        proxyLon: proxyStatusEl?.dataset.proxyLon || '',
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
        const notesEl = document.getElementById('profileNotes');
        if (notesEl) {
          notesEl.value = '';
          notesEl.style.height = 'auto';
        }
        document.getElementById('profileTags').value = '';
        document.getElementById('proxyAddress').value = '';
        document.getElementById('proxyType').value = 'none';

        const inputGroup = document.getElementById('proxyInputGroup');
        if (inputGroup) inputGroup.style.display = 'none';
        document.getElementById('fpModeAuto').checked = true;
        updateFingerprintMode();
        loadProfiles();
      } else {
        toast(res.error || 'Lỗi', 'error');
      }
    };
  }

  // Edit / Details modal Close buttons
  const btnCloseDetail = document.getElementById('btnCloseDetail');
  if (btnCloseDetail) btnCloseDetail.onclick = () => closeModal('detailModal');
  const btnCloseDetail2 = document.getElementById('btnCloseDetail2');
  if (btnCloseDetail2) btnCloseDetail2.onclick = () => closeModal('detailModal');

  // Proxy Check buttons
  const btnCheckProxy = document.getElementById('btnCheckProxy');
  if (btnCheckProxy) {
    btnCheckProxy.onclick = () => checkProxyUI('proxyAddress', 'proxyType', 'proxyStatus');
  }
  const btnCheckBulkProxy = document.getElementById('btnCheckBulkProxy');
  if (btnCheckBulkProxy) {
    btnCheckBulkProxy.onclick = () => checkProxyUI('bulkProxy', 'bulkProxyType', 'bulkProxyStatus');
  }

  // Bulk Create modal
  const btnBulkCreate = document.getElementById('btnBulkCreate');
  if (btnBulkCreate) btnBulkCreate.onclick = () => openModal('bulkCreateModal');
  const btnCloseBulkModal = document.getElementById('btnCloseBulkModal');
  if (btnCloseBulkModal) btnCloseBulkModal.onclick = () => closeModal('bulkCreateModal');
  const btnCancelBulk = document.getElementById('btnCancelBulk');
  if (btnCancelBulk) btnCancelBulk.onclick = () => closeModal('bulkCreateModal');

  const btnConfirmBulk = document.getElementById('btnConfirmBulk');
  if (btnConfirmBulk) {
    btnConfirmBulk.onclick = async () => {
      const count = parseInt(document.getElementById('bulkCount').value) || 10;
      const namePrefix = document.getElementById('bulkPrefix').value.trim() || 'Profile';
      const startIndex = parseInt(document.getElementById('bulkStart').value) || 1;
      const proxyTypeValue = document.getElementById('bulkProxyType').value;
      const proxyAddr = document.getElementById('bulkProxy').value.trim();
      let proxy = '';
      if (proxyTypeValue !== 'none' && proxyAddr) {
        const schemeMatch = proxyAddr.match(/^([a-zA-Z0-9]+):\/+(.*)$/);
        if (schemeMatch) {
          proxy = `${schemeMatch[1].toLowerCase()}://${schemeMatch[2]}`;
        } else {
          proxy = `${proxyTypeValue}://${proxyAddr}`;
        }
      }

      const bulkProxyStatusEl = document.getElementById('bulkProxyStatus');
      if (proxy && proxyTypeValue !== 'none') {
        await ensureProxyMetadata('bulkProxy', 'bulkProxyType', 'bulkProxyStatus');
      }
      const res = await api('/profiles/bulk-create', {
        method: 'POST',
        body: {
          count,
          namePrefix,
          startIndex,
          proxy: proxy ? proxy : '',
          proxyType: proxyTypeValue,
          proxyIp: bulkProxyStatusEl?.dataset.proxyIp || '',
          proxyCountry: bulkProxyStatusEl?.dataset.proxyCountry || '',
          proxyTimezone: bulkProxyStatusEl?.dataset.proxyTimezone || '',
          proxyLat: bulkProxyStatusEl?.dataset.proxyLat || '',
          proxyLon: bulkProxyStatusEl?.dataset.proxyLon || '',
          tags: document.getElementById('bulkTags').value,
        }
      });

      if (res.success) {
        toast(`Đã tạo ${res.data.count} profiles!`, 'success');
        closeModal('bulkCreateModal');
        loadProfiles();
      } else {
        toast(res.error || 'Lỗi', 'error');
      }
    };
  }

  // Pre-fill creation modal languages select dropdown
  const fpLangSelect = document.getElementById('fpLang');
  if (fpLangSelect) {
    fpLangSelect.innerHTML = langOptions.map(opt => `<option value="${opt}">${opt}</option>`).join('');
  }

  // Bulk execution events
  const btnBulkOpen = document.getElementById('btnBulkOpen');
  if (btnBulkOpen) {
    btnBulkOpen.onclick = async () => {
      for (const id of state.selectedIds) await openProfile(id);
      state.selectedIds.clear();
      updateBulkUI();
      renderProfiles();
    };
  }
  const btnBulkClose = document.getElementById('btnBulkClose');
  if (btnBulkClose) {
    btnBulkClose.onclick = async () => {
      for (const id of state.selectedIds) await closeProfile(id);
      state.selectedIds.clear();
      updateBulkUI();
      renderProfiles();
    };
  }
  const btnBulkDelete = document.getElementById('btnBulkDelete');
  if (btnBulkDelete) {
    btnBulkDelete.onclick = async () => {
      if (!await showConfirm({ title: 'Xóa', message: 'Xóa các profile đã chọn?' })) return;
      for (const id of state.selectedIds) await api(`/profiles/${id}`, { method: 'DELETE' });
      state.selectedIds.clear();
      updateBulkUI();
      renderProfiles();
    };
  }

  const btnStartMultiControl = document.getElementById('btnStartMultiControl');
  const btnStopMultiControl = document.getElementById('btnStopMultiControl');

  if (btnStartMultiControl) {
    btnStartMultiControl.onclick = async () => {
      const selected = Array.from(state.selectedIds);
      if (selected.length < 2) {
        toast('Vui lòng chọn ít nhất 2 profile để đồng bộ!', 'error');
        return;
      }
      
      const masterId = selected[0];
      const slaveIds = selected.slice(1);

      // Check if all selected profiles are running
      const runningRes = await api('/profiles/status/running');
      const runningIds = runningRes.data || [];
      
      if (!runningIds.includes(masterId)) {
        toast('Profile Master (được chọn đầu tiên) phải đang chạy!', 'error');
        return;
      }

      const offlineSlaves = slaveIds.filter(id => !runningIds.includes(id));
      if (offlineSlaves.length > 0) {
        toast('Tất cả profile được đồng bộ phải đang chạy!', 'error');
        return;
      }

      btnStartMultiControl.disabled = true;
      btnStartMultiControl.textContent = 'Đang bật...';

      const res = await api('/automation/multi-control/start', {
        method: 'POST',
        body: { masterId, slaveIds }
      });

      if (res.success) {
        toast('Đã bật điều khiển đồng bộ thành công! Hãy thao tác trên profile Master.', 'success');
        btnStartMultiControl.style.display = 'none';
        if (btnStopMultiControl) btnStopMultiControl.style.display = 'inline-block';
      } else {
        toast(res.error || 'Lỗi bật đồng bộ', 'error');
      }
      btnStartMultiControl.disabled = false;
      btnStartMultiControl.textContent = '🔗 Đồng bộ';
    };
  }

  if (btnStopMultiControl) {
    btnStopMultiControl.onclick = async () => {
      const res = await api('/automation/multi-control/stop', { method: 'POST' });
      if (res.success) {
        toast('Đã dừng đồng bộ thao tác.', 'success');
        if (btnStartMultiControl) btnStartMultiControl.style.display = 'inline-block';
        btnStopMultiControl.style.display = 'none';
      } else {
        toast(res.error || 'Lỗi', 'error');
      }
    };
  }

  // ====== Update Modal Handling ======
  const btnCheckUpdate = document.getElementById('btnCheckUpdate');
  const updateGithubRepoInput = document.getElementById('updateGithubRepo');
  const updateGithubBranchInput = document.getElementById('updateGithubBranch');

  // Pre-fill fields from localStorage or defaults
  if (updateGithubRepoInput) {
    updateGithubRepoInput.value = localStorage.getItem('updateGithubRepo') || 'Duyquoclite/File';
  }
  if (updateGithubBranchInput) {
    updateGithubBranchInput.value = localStorage.getItem('updateGithubBranch') || 'main';
  }

  const btnCloseUpdateModal = document.getElementById('btnCloseUpdateModal');
  const btnCancelUpdate = document.getElementById('btnCancelUpdate');
  const btnUploadUpdate = document.getElementById('btnUploadUpdate');
  const btnConfirmUpdate = document.getElementById('btnConfirmUpdate');

  if (btnCheckUpdate) {
    btnCheckUpdate.onclick = async () => {
      openModal('updateModal');
      // Hide progress on open
      const progressSection = document.getElementById('uploadProgressSection');
      if (progressSection) progressSection.style.display = 'none';
      const applySection = document.getElementById('applyProgressSection');
      if (applySection) applySection.style.display = 'none';

      const repo = (updateGithubRepoInput ? updateGithubRepoInput.value.trim() : '') || 'Duyquoclite/File';
      const branch = (updateGithubBranchInput ? updateGithubBranchInput.value.trim() : '') || 'main';
      const timeEl = document.getElementById('latestUpdateTime');
      const msgEl = document.getElementById('latestCommitMsg');

      if (timeEl) timeEl.textContent = 'Đang tải thông tin...';
      if (msgEl) msgEl.textContent = '';

      try {
        const ghRes = await fetch(`https://api.github.com/repos/${repo}/commits/${branch}`);
        if (ghRes.ok) {
          const data = await ghRes.json();
          const pad = (n) => String(n).padStart(2, '0');
          const date = new Date(data.commit.committer.date);
          const day = pad(date.getDate());
          const month = pad(date.getMonth() + 1);
          const year = date.getFullYear();
          const hours = pad(date.getHours());
          const minutes = pad(date.getMinutes());
          const seconds = pad(date.getSeconds());
          const formattedDate = `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
          if (timeEl) timeEl.textContent = `${formattedDate}`;
          if (msgEl) msgEl.textContent = `"${data.commit.message}"`;
        } else {
          if (timeEl) timeEl.textContent = 'Không thể kết nối kho lưu trữ GitHub.';
        }
      } catch (ghErr) {
        console.error('Failed to fetch commit info:', ghErr);
        if (timeEl) timeEl.textContent = 'Lỗi kết nối khi tải thông tin.';
      }

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

      // Reset progress UI
      const progressSection = document.getElementById('uploadProgressSection');
      const progressBar = document.getElementById('uploadProgressBar');
      const progressText = document.getElementById('uploadProgressText');
      const progressStatus = document.getElementById('uploadProgressStatus');
      const progressLog = document.getElementById('uploadProgressLog');

      if (progressSection) progressSection.style.display = 'block';
      if (progressBar) progressBar.style.width = '0%';
      if (progressText) progressText.textContent = '0%';
      if (progressStatus) progressStatus.textContent = 'Đang chuẩn bị...';
      if (progressLog) progressLog.innerHTML = '';

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
          toast('Cập nhật thành công! Máy chủ đang chuẩn bị khởi động lại...', 'success');
          closeModal('updateModal');

          let count = 10;
          const interval = setInterval(() => {
            if (count <= 0) {
              clearInterval(interval);
              window.location.reload();
            } else {
              toast(`Hệ thống sẽ tải lại sau ${count} giây...`, 'info');
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

  // Mail Checker Modal events
  const btnMailChecker = document.getElementById('btnMailChecker');
  if (btnMailChecker) {
    btnMailChecker.onclick = () => {
      openModal('mailCheckerModal');
      // Load saved raw text if any
      const savedRawText = localStorage.getItem('mailCheckerRawText') || '';
      const txtImportList = document.getElementById('txtImportList');
      if (txtImportList) txtImportList.value = savedRawText;
      
      // Auto-parse on load
      if (savedRawText) {
        renderParsedAccounts(savedRawText);
      }
    };
  }

  const btnCloseMailCheckerModal = document.getElementById('btnCloseMailCheckerModal');
  if (btnCloseMailCheckerModal) btnCloseMailCheckerModal.onclick = () => closeModal('mailCheckerModal');

  // Import Overlay triggers
  const btnImportAccounts = document.getElementById('btnImportAccounts');
  const importOverlay = document.getElementById('importOverlay');
  const btnCancelImport = document.getElementById('btnCancelImport');
  const btnConfirmImport = document.getElementById('btnConfirmImport');

  if (btnImportAccounts && importOverlay) {
    btnImportAccounts.onclick = () => {
      importOverlay.style.display = 'flex';
      const savedRawText = localStorage.getItem('mailCheckerRawText') || '';
      const txtImportList = document.getElementById('txtImportList');
      if (txtImportList) txtImportList.value = savedRawText;
    };
  }

  if (btnCancelImport && importOverlay) {
    btnCancelImport.onclick = () => {
      importOverlay.style.display = 'none';
    };
  }

  if (btnConfirmImport && importOverlay) {
    btnConfirmImport.onclick = () => {
      const txtImportList = document.getElementById('txtImportList');
      const rawText = txtImportList ? txtImportList.value : '';
      localStorage.setItem('mailCheckerRawText', rawText);
      
      renderParsedAccounts(rawText);
      importOverlay.style.display = 'none';
    };
  }

  // Render accounts list function
  function renderParsedAccounts(rawText) {
    const listContainer = document.getElementById('accountsListContainer');
    if (!listContainer) return;

    const lines = rawText.split('\n');
    const accounts = [];
    let lineIdx = 0;
    
    for (let line of lines) {
      lineIdx++;
      line = line.trim();
      if (!line || line.startsWith('#')) continue;
      if (line.includes('|')) {
        const parts = line.split('|');
        if (parts.length >= 3) {
          const email = parts[0].trim();
          const password = parts[1].trim();
          const token = parts[2].trim();
          const clientId = parts[3] ? parts[3].trim() : '9e5f94bc-e8a4-4e73-b8be-63364c29d753';
          if (email && token) {
            accounts.push({ index: lineIdx, email, password, token, clientId });
          }
        }
      }
    }

    if (accounts.length === 0) {
      listContainer.innerHTML = '<div style="padding:20px; text-align:center; color:var(--text-muted); font-size:0.8rem;">Không tìm thấy tài khoản hợp lệ. Bấm "Nhập List" để thử lại.</div>';
      return;
    }

    listContainer.innerHTML = accounts.map((acc, index) => {
      return `
        <div class="account-item" data-index="${index}" style="padding: 10px 12px; border-bottom: 1px solid var(--border); cursor: pointer; transition: all 0.2s; display: flex; flex-direction: column; gap: 4px;">
          <div style="font-weight: 600; font-size: 0.8rem; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${index + 1}. ${esc(acc.email)}
          </div>
          <div style="font-size: 0.7rem; color: var(--text-muted);">
            <span>Pass: ${esc(acc.password)}</span>
          </div>
        </div>
      `;
    }).join('');

    // Wire click listener to each account
    listContainer.querySelectorAll('.account-item').forEach(item => {
      // Hover effects
      item.addEventListener('mouseenter', () => {
        if (!item.classList.contains('selected')) {
          item.style.background = 'rgba(255,255,255,0.03)';
        }
      });
      item.addEventListener('mouseleave', () => {
        if (!item.classList.contains('selected')) {
          item.style.background = 'transparent';
        }
      });

      item.onclick = async () => {
        // Highlight selection
        listContainer.querySelectorAll('.account-item').forEach(el => {
          el.classList.remove('selected');
          el.style.background = 'transparent';
          el.style.borderLeft = 'none';
        });
        item.classList.add('selected');
        item.style.background = 'rgba(99,102,241,0.08)';
        item.style.borderLeft = '3px solid var(--accent)';

        const accIndex = parseInt(item.dataset.index);
        const account = accounts[accIndex];
        
        // Load mailbox for this account
        await loadMailboxForAccount(account);
      };
    });
  }

  // Load mailbox function
  async function loadMailboxForAccount(account) {
    const listContainer = document.getElementById('mailboxListContainer');
    const badge = document.getElementById('mailCountBadge');
    const detailContainer = document.getElementById('mailDetailContainer');
    
    if (listContainer) listContainer.innerHTML = '<div style="padding:24px; text-align:center; color:var(--text-muted);">Đang kết nối API Microsoft...</div>';
    if (detailContainer) detailContainer.innerHTML = '<div style="height:100%; display:flex; align-items:center; justify-content:center; color:var(--text-muted); text-align:center;">Chọn một email từ danh sách ở giữa để đọc chi tiết.</div>';
    if (badge) badge.textContent = '0 thư';

    try {
      const response = await api('/profiles/mail-checker/list', {
        method: 'POST',
        body: { token: account.token, clientId: account.clientId }
      });

      if (!response.success) {
        if (listContainer) listContainer.innerHTML = `<div style="padding:24px; color:#ea868f; text-align:center; font-weight:bold; font-size:0.8rem;">${esc(response.error)}</div>`;
        return;
      }

      const activeAccessToken = response.accessToken;
      const activeApiUsed = response.apiUsed;
      const emails = response.emails || [];
      if (badge) badge.textContent = `${emails.length} thư`;

      if (emails.length === 0) {
        if (listContainer) listContainer.innerHTML = '<div style="padding:24px; text-align:center; color:var(--text-muted); font-size:0.8rem;">Hộp thư trống (Inbox is empty)</div>';
        return;
      }

      listContainer.innerHTML = emails.map(email => {
        const fromAddr = email.from?.emailAddress?.address || 'Không rõ người gửi';
        const receivedDate = email.receivedDateTime ? new Date(email.receivedDateTime).toLocaleString('vi-VN') : 'Không rõ ngày';
        
        // Define folder badge styling
        let badgeHtml = '';
        if (email.folder === 'junk') {
          badgeHtml = `<span style="background: rgba(239, 68, 68, 0.15); color: #f87171; font-size: 0.65rem; padding: 1px 6px; border-radius: 4px; font-weight: 600; flex-shrink: 0; line-height: 1.2;">Junk</span>`;
        } else {
          badgeHtml = `<span style="background: rgba(16, 185, 129, 0.15); color: #34d399; font-size: 0.65rem; padding: 1px 6px; border-radius: 4px; font-weight: 600; flex-shrink: 0; line-height: 1.2;">Inbox</span>`;
        }

        return `
          <div class="mail-item" data-id="${email.id}" style="padding: 10px 12px; border-bottom: 1px solid var(--border); cursor: pointer; transition: all 0.2s; display: flex; flex-direction: column; gap: 6px;">
            <div style="display:flex; justify-content:space-between; font-weight:600; font-size:0.8rem; color:var(--text); align-items: center;">
              <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:170px;">${esc(fromAddr)}</span>
              <span style="font-size:0.7rem; color:var(--text-muted); font-weight:normal;">${receivedDate}</span>
            </div>
            <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
              <div style="font-size:0.8rem; font-weight:500; color:var(--text-secondary); text-overflow:ellipsis; overflow:hidden; white-space:nowrap; flex:1;">
                ${esc(email.subject || '(Không có tiêu đề)')}
              </div>
              ${badgeHtml}
            </div>
          </div>
        `;
      }).join('');

      // Wire click handler to each mail item
      listContainer.querySelectorAll('.mail-item').forEach(item => {
        // Hover effects
        item.addEventListener('mouseenter', () => {
          if (!item.classList.contains('selected')) {
            item.style.background = 'rgba(255,255,255,0.03)';
          }
        });
        item.addEventListener('mouseleave', () => {
          if (!item.classList.contains('selected')) {
            item.style.background = 'transparent';
          }
        });

        item.onclick = async () => {
          // Highlight selected item
          listContainer.querySelectorAll('.mail-item').forEach(el => {
            el.classList.remove('selected');
            el.style.background = 'transparent';
            el.style.borderLeft = 'none';
          });
          item.classList.add('selected');
          item.style.background = 'rgba(99,102,241,0.08)';
          item.style.borderLeft = '3px solid var(--accent)';

          const messageId = item.dataset.id;
          if (detailContainer) detailContainer.innerHTML = '<div style="height:100%; display:flex; align-items:center; justify-content:center; color:var(--text-muted); text-align:center;">Đang tải nội dung thư...</div>';

          try {
            const detailRes = await api('/profiles/mail-checker/detail', {
              method: 'POST',
              body: { accessToken: activeAccessToken, messageId, apiUsed: activeApiUsed }
            });

            if (!detailRes.success) {
              if (detailContainer) detailContainer.innerHTML = `<div style="color:#ea868f; padding:16px; font-size:0.8rem;">Lỗi: ${esc(detailRes.error)}</div>`;
              return;
            }

            // Display subject and sanitized HTML body inside iframe to prevent layout leakage
            if (detailContainer) {
              detailContainer.innerHTML = `
                <div style="margin-bottom:12px; border-bottom:1px solid var(--border); padding-bottom:12px;">
                  <h3 style="font-size:1rem; font-weight:700; color:var(--text); margin-bottom:4px;">${esc(detailRes.subject)}</h3>
                </div>
                <iframe id="mailBodyIframe" style="width:100%; border:none; height:450px; background:white; border-radius:6px;" sandbox="allow-same-origin"></iframe>
              `;

              const iframe = document.getElementById('mailBodyIframe');
              if (iframe) {
                const doc = iframe.contentDocument || iframe.contentWindow.document;
                doc.open();
                doc.write(detailRes.body || '<div style="padding:20px; font-family:sans-serif; color:#333;">Thư này không có nội dung.</div>');
                doc.close();
              }
            }

          } catch (err) {
            if (detailContainer) detailContainer.innerHTML = `<div style="color:#ea868f; padding:16px; font-size:0.8rem;">Gặp lỗi: ${esc(err.message)}</div>`;
          }
        };
      });

    } catch (err) {
      if (listContainer) listContainer.innerHTML = `<div style="padding:24px; color:#ea868f; text-align:center; font-weight:bold; font-size:0.8rem;">Lỗi kết nối: ${esc(err.message)}</div>`;
    }
  }
}

export async function checkFbGroupStatus(groupKey, event) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }

  const groupProfiles = state.profiles.filter(p => {
    const pk = p.proxy && p.proxy.trim() ? p.proxy.trim() : 'no-proxy';
    return pk === groupKey;
  });

  if (groupProfiles.length === 0) {
    toast('Không có profile nào trong nhóm này', 'info');
    return;
  }

  const confirmCheck = await showConfirm({
    title: '🔍 Xác nhận kiểm tra',
    message: `Bạn có muốn kiểm tra trạng thái Facebook của ${groupProfiles.length} profile trong nhóm này không?`,
    confirmText: 'Bắt đầu',
    cancelText: 'Hủy'
  });
  if (!confirmCheck) return;

  const total = groupProfiles.length;
  setProgressOverlay('Đang kiểm tra trạng thái Facebook...', `Đang chuẩn bị kiểm tra (0/${total})...`, 0);

  const results = [];

  for (let i = 0; i < total; i++) {
    const profile = groupProfiles[i];
    const percent = Math.round((i / total) * 100);
    
    setProgressOverlay(
      'Đang kiểm tra trạng thái Facebook...',
      `Đang check profile ${i + 1}/${total}: ${profile.name}...`,
      percent
    );

    try {
      const response = await api(`/profiles/${profile.id}/check-fb-status`, {
        method: 'POST'
      });

      if (response && response.success && response.data) {
        results.push(response.data);
      } else {
        results.push({
          id: profile.id,
          name: profile.name,
          hasCookie: false,
          isLive: false,
          reason: response?.error || 'Lỗi kết nối server'
        });
      }
    } catch (err) {
      results.push({
        id: profile.id,
        name: profile.name,
        hasCookie: false,
        isLive: false,
        reason: 'Lỗi: ' + err.message
      });
    }
  }

  // Set final progress to 100%
  setProgressOverlay('Đang kiểm tra trạng thái Facebook...', 'Hoàn thành!', 100);
  
  // Brief delay to let the user see 100% completed status
  await new Promise(resolve => setTimeout(resolve, 500));
  hideProgressOverlay();

  // Display results in showMessageModal
  const deadProfiles = results.filter(r => !r.isLive);
  const liveProfiles = results.filter(r => r.isLive);

  let messageHtml = '';
  
  if (results.length === 0) {
    messageHtml = '<p>Không nhận được dữ liệu kiểm tra.</p>';
  } else {
    messageHtml = `
      <div style="font-size: 0.95rem; line-height: 1.5; max-height: 400px; overflow-y: auto;">
        <p style="margin-bottom: 12px; font-weight: bold;">
          Tổng kết kiểm tra (${results.length} Profiles):
          <span style="color: #2ecc71; margin-left: 8px;">🟢 ${liveProfiles.length} Sống</span>
          <span style="color: #e74c3c; margin-left: 8px;">🔴 ${deadProfiles.length} Die/Chưa Đăng Nhập</span>
        </p>
    `;

    if (deadProfiles.length > 0) {
      messageHtml += `
        <div style="margin-top: 12px; border: 1px solid rgba(231, 76, 60, 0.3); background: rgba(231, 76, 60, 0.05); padding: 10px; border-radius: 6px;">
          <div style="font-weight: bold; color: #e74c3c; margin-bottom: 8px;">❌ Danh sách Profile Die hoặc Chưa Đăng Nhập:</div>
          <ul style="padding-left: 20px; margin: 0; display: flex; flex-direction: column; gap: 4px;">
            ${deadProfiles.map(r => `
              <li style="margin-bottom: 2px;">
                <b>${esc(r.name)}</b>: 
                <span style="color: #ea868f;">${esc(r.reason)}</span> 
                ${r.fbId ? `<span style="font-size: 0.8rem; color: #9ca3af;">(FB ID: ${esc(r.fbId)})</span>` : ''}
              </li>
            `).join('')}
          </ul>
        </div>
      `;
    } else {
      messageHtml += `
        <div style="margin-top: 12px; border: 1px solid rgba(46, 204, 113, 0.3); background: rgba(46, 204, 113, 0.05); padding: 10px; border-radius: 6px; color: #2ecc71; font-weight: bold;">
          🎉 Tuyệt vời! Tất cả tài khoản Facebook trong nhóm đều đang hoạt động tốt.
        </div>
      `;
    }

    if (liveProfiles.length > 0) {
      messageHtml += `
        <div style="margin-top: 12px; border: 1px solid rgba(46, 204, 113, 0.2); background: rgba(46, 204, 113, 0.02); padding: 10px; border-radius: 6px; max-height: 150px; overflow-y: auto;">
          <div style="font-weight: bold; color: #2ecc71; margin-bottom: 6px;">✅ Danh sách Profile Sống:</div>
          <ul style="padding-left: 20px; margin: 0; display: flex; flex-direction: column; gap: 2px; font-size: 0.85rem;">
            ${liveProfiles.map(r => `
              <li style="margin-bottom: 2px;">
                <b>${esc(r.name)}</b> - 
                <span style="color: #2ecc71; font-weight: 500;">${esc(r.title)}</span> 
                <span style="font-size: 0.8rem; color: #9ca3af;">(FB ID: ${esc(r.fbId)})</span>
              </li>
            `).join('')}
          </ul>
        </div>
      `;
    }

    messageHtml += `</div>`;
  }

  showMessageModal({
    title: '🔍 Kết Quả Kiểm Tra Facebook',
    message: messageHtml,
    okText: 'Đóng'
  });
}

