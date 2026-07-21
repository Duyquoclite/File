import { state } from './state.js';
import { api, connectWS } from './api.js';

import {
  esc,
  toast,
  ensureProgressOverlay,
  setProgressOverlay,
  hideProgressOverlay,
  getProgressInterval,
  setProgressInterval
} from './utils.js';

export {
  esc,
  toast,
  ensureProgressOverlay,
  setProgressOverlay,
  hideProgressOverlay,
  getProgressInterval,
  setProgressInterval
};


export function parseProxyHost(proxy) {
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

export function getProxyDisplay(p) {
  const host = p.proxyIp || parseProxyHost(p.proxy);
  const timezone = p.proxyTimezone || '';
  const country = p.proxyCountry || '';
  if (host && timezone && country) return `${host}:${timezone} (${country})`;
  if (host && timezone) return `${host}:${timezone}`;
  if (host && country) return `${host} (${country})`;
  if (host) return host;
  return p.proxyType || 'proxy';
}

export async function loadProfiles(search = '') {
  const q = search ? `?search=${encodeURIComponent(search)}` : '';
  try {
    const res = await api('/profiles' + q);
    if (res && res.success) {
      state.profiles = res.data.profiles || [];
      const totalEl = document.getElementById('totalProfiles');
      const runningEl = document.getElementById('runningProfiles');
      if (totalEl) totalEl.textContent = res.data.total || state.profiles.length;
      if (runningEl) runningEl.textContent = state.profiles.filter(p => p.isRunning).length;
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

export function renderProfiles() {
  const grid = document.getElementById('profileGrid');
  const empty = document.getElementById('emptyState');

  if (!grid) return;

  if (state.profiles.length === 0) {
    grid.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  // Group profiles by the full proxy value (or fallback to 'no-proxy')
  const groups = {};
  for (const p of state.profiles) {
    const proxyKey = p.proxy && p.proxy.trim() ? p.proxy.trim() : 'no-proxy';
    if (!groups[proxyKey]) groups[proxyKey] = [];
    groups[proxyKey].push(p);
  }

  const groupHtml = Object.keys(groups).map(ipKey => {
    const items = groups[ipKey];
    const extractNum = name => {
      const m = name.match(/(\d+)$/);
      return m ? parseInt(m[1], 10) : 0;
    };
    const maxNum = Math.max(...items.map(p => extractNum(p.name)));
    const padWidth = String(maxNum).length;
    items.sort((a, b) => extractNum(a.name) - extractNum(b.name));
    
    items.forEach(p => {
      const num = extractNum(p.name);
      const padded = String(num).padStart(padWidth, '0');
      p.displayName = p.name.replace(/\d+$/, padded);
    });
    const allSelected = items.every(p => state.selectedIds.has(p.id));
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
    const headerPrefixHtml = ipKey === 'no-proxy' ? 'Không có proxy' : esc(ipKey.replace(/^[a-zA-Z0-9]+:\/*/, ''));

    const titleHtml = `<span>${headerPrefixHtml}${detailsHtml}</span>`;
    
    // Convert click events to call global window helper functions mapped in app.js
    const headerHtml = `
      <input type="checkbox" class="group-checkbox" ${allSelected ? 'checked' : ''} onclick="window.toggleGroupSelect('${esc(ipKey)}', event)">
      ${titleHtml}
      <button class="btn btn-primary btn-sm" onclick="window.checkFbGroupStatus('${esc(ipKey)}', event)" style="margin-left: auto; padding: 4px 10px; font-size: 0.75rem; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px; font-weight: 600; cursor: pointer; background: var(--accent); border: none; color: white;">
        🔍 Check FB Status
      </button>
    `;


    const cards = items.map(p => {
      const fp = p.fingerprint || {};
      const isSelected = state.selectedIds.has(p.id);
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

      let tagsHtml = '';
      if (p.tags && p.tags.trim()) {
        tagsHtml = p.tags.split(',').map(tag => {
          return `<span class="meta-tag tag" style="background: rgba(99, 102, 241, 0.15); color: #818cf8; border: 1px solid rgba(99, 102, 241, 0.3); font-weight: 500;">🏷️ ${esc(tag.trim())}</span>`;
        }).join('');
      }

      return `
        <div class="${cardClass}" data-id="${p.id}">
          <div class="card-top">
            <input type="checkbox" class="card-checkbox" ${isSelected ? 'checked' : ''} onclick="window.toggleSelect('${p.id}', event)">
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
            ${categoryBadge}
            ${tagsHtml}
            <span class="meta-tag open-count" style="color: #60a5fa; background: rgba(96, 165, 250, 0.1); border: 1px solid rgba(96, 165, 250, 0.2);">🚀 Mở: ${p.openCount || 0} lần</span>
          </div>
          ${p.notes ? `
            <div class="card-notes collapsed" onclick="this.classList.toggle('collapsed'); event.stopPropagation();">
              <span class="notes-title">📝 Xem ghi chú</span>
              <div class="notes-content">${esc(p.notes)}</div>
            </div>
          ` : ''}
          <div class="card-actions">
            ${state.launchingProfileIds.has(p.id)
              ? `
                <button class="btn btn-success btn-sm" disabled style="opacity: 0.7; cursor: not-allowed;">⏳ Đang mở...</button>
                <button class="btn-icon" disabled style="opacity: 0.5; cursor: not-allowed;">Nhân bản</button>
                <button class="btn-icon" disabled style="opacity: 0.5; cursor: not-allowed;">Chi tiết</button>
                <button class="btn-icon" disabled style="opacity: 0.5; cursor: not-allowed;">Dán script tự động</button>
                <button class="btn-icon" disabled style="opacity: 0.5; cursor: not-allowed;">Tạo lại vân tay</button>
                <button class="btn-icon" disabled style="opacity: 0.5; cursor: not-allowed; color:var(--danger)">Xóa</button>
              `
              : `
                ${p.isRunning
                  ? `<button class="btn btn-warning btn-sm" onclick="window.closeProfile('${p.id}')">⏹ Đóng</button>`
                  : `<button class="btn btn-success btn-sm" onclick="window.openProfile('${p.id}')">▶ Mở</button>`
                }
                <button class="btn-icon" onclick="window.duplicateProfile('${p.id}')" title="Nhân bản">Nhân bản</button>
                <button class="btn-icon" onclick="window.showDetail('${p.id}')" title="Chi tiết">Chi tiết</button>
                <button class="btn-icon" onclick="window.openScriptEditor('${p.id}')" title="Automation">Dán script tự động</button>
                <button class="btn-icon" onclick="window.regenFingerprint('${p.id}')" title="Tạo lại fingerprint">Tạo lại vân tay</button>
                <button class="btn-icon" onclick="window.deleteProfile('${p.id}')" title="Xóa" style="color:var(--danger)">Xóa</button>
              `
            }
          </div>
        </div>
      `;
    }).join('');

    const isHidden = state.hiddenGroups.has(ipKey);
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
      if (state.layoutMode === 'column' && grid.scrollWidth > grid.clientWidth) {
        helper.style.display = 'block';
        helperWidth.style.width = grid.scrollWidth + 'px';
        helper.scrollLeft = grid.scrollLeft;
      } else {
        helper.style.display = 'none';
      }
    }, 100);
  }
}

export function renderGroupsManagementList() {
  const container = document.getElementById('groupsListContainer');
  if (!container) return;

  const groups = {};
  for (const p of state.profiles) {
    const proxyKey = p.proxy && p.proxy.trim() ? p.proxy.trim() : 'no-proxy';
    if (!groups[proxyKey]) groups[proxyKey] = [];
    groups[proxyKey].push(p);
  }

  container.innerHTML = Object.keys(groups).map(ipKey => {
    const isChecked = !state.hiddenGroups.has(ipKey);
    const label = ipKey === 'no-proxy' ? 'Không có proxy' : ipKey.replace(/^[a-zA-Z0-9]+:\/*/, '');
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
        state.hiddenGroups.delete(groupKey);
      } else {
        state.hiddenGroups.add(groupKey);
      }
      localStorage.setItem('hiddenGroups', JSON.stringify([...state.hiddenGroups]));
      renderProfiles(); // Live update
    });
  });
}

export function applyLayoutMode() {
  const grid = document.getElementById('profileGrid');
  const iconCol = document.getElementById('iconLayoutColumn');
  const iconRow = document.getElementById('iconLayoutRow');
  const txt = document.getElementById('layoutText');

  if (!grid) return;

  if (state.layoutMode === 'column') {
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

export function updateBulkUI() {
  const bulkDiv = document.getElementById('bulkActions');
  const countEl = document.getElementById('selectedCount');
  if (!bulkDiv) return;
  if (state.selectedIds.size > 0) {
    bulkDiv.style.display = 'flex';
    countEl.textContent = `${state.selectedIds.size} đã chọn`;
  } else {
    bulkDiv.style.display = 'none';
    countEl.textContent = '0 đã chọn';
  }
}

export function initUI() {
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

  // Layout mode switcher
  const btnToggleLayout = document.getElementById('btnToggleLayout');
  if (btnToggleLayout) {
    btnToggleLayout.addEventListener('click', () => {
      state.layoutMode = state.layoutMode === 'column' ? 'row' : 'column';
      localStorage.setItem('layoutMode', state.layoutMode);
      applyLayoutMode();
    });
  }

  // Theme toggle
  const btnThemeToggle = document.getElementById('btnThemeToggle');
  if (btnThemeToggle) {
    btnThemeToggle.onclick = () => {
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
    };
  }

  // Bind manage groups button
  const btnManageGroups = document.getElementById('btnManageGroups');
  if (btnManageGroups) {
    btnManageGroups.addEventListener('click', async () => {
      const { openGroupsModal } = await import('./modals.js');
      openGroupsModal();
    });
  }
  const btnCloseGroupsModal = document.getElementById('btnCloseGroupsModal');
  if (btnCloseGroupsModal) {
    btnCloseGroupsModal.addEventListener('click', async () => {
      const { closeGroupsModal } = await import('./modals.js');
      closeGroupsModal();
    });
  }
  const btnConfirmGroups = document.getElementById('btnConfirmGroups');
  if (btnConfirmGroups) {
    btnConfirmGroups.addEventListener('click', async () => {
      const { closeGroupsModal } = await import('./modals.js');
      closeGroupsModal();
    });
  }
  const btnSelectAllGroups = document.getElementById('btnSelectAllGroups');
  if (btnSelectAllGroups) {
    btnSelectAllGroups.addEventListener('click', () => {
      state.hiddenGroups.clear();
      localStorage.setItem('hiddenGroups', JSON.stringify([]));
      renderGroupsManagementList();
      renderProfiles();
    });
  }

  // Cancel bulk selection button
  const btnCancelSelect = document.getElementById('btnCancelSelect');
  if (btnCancelSelect) {
    btnCancelSelect.onclick = () => {
      state.selectedIds.clear();
      updateBulkUI();
      renderProfiles();
    };
  }

  // Search input
  let searchTimer;
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.oninput = function () {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => loadProfiles(this.value), 300);
    };
  }
}


