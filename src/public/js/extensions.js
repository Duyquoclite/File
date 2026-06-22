import { state } from './state.js';
import { api } from './api.js';
import { toast, esc } from './ui.js';
import { openModal, closeModal, showConfirm } from './modals.js';

export async function loadExtensions() {
  const container = document.getElementById('extensionsListContainer');
  if (!container) return;
  container.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-secondary);">Đang tải danh sách...</div>';
  
  try {
    const res = await api('/extensions');
    if (res.success) {
      if (res.data.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted);">Chưa có extension nào được cài đặt.</div>';
        return;
      }

      container.innerHTML = res.data.map(ext => {
        const char = ext.name ? ext.name.charAt(0).toUpperCase() : '🧩';
        return `
          <div class="extension-item" id="ext-item-${ext.id}">
            <div class="extension-item-left">
              <div class="extension-icon">${char}</div>
              <div class="extension-info">
                <div class="extension-name-row">
                  <span class="extension-name" title="${ext.name}">${ext.name}</span>
                  <span class="extension-version">v${ext.version}</span>
                </div>
                <div class="extension-desc" title="${ext.description}">${ext.description}</div>
              </div>
            </div>
            <button class="btn btn-danger btn-sm" onclick="window.deleteExtension('${ext.id}')">Xóa</button>
          </div>
        `;
      }).join('');
    } else {
      container.innerHTML = `<div style="text-align:center; padding:20px; color:var(--danger);">Lỗi: ${res.error}</div>`;
    }
  } catch (err) {
    container.innerHTML = `<div style="text-align:center; padding:20px; color:var(--danger);">Lỗi kết nối: ${err.message}</div>`;
  }
}

export async function deleteExtension(id) {
  const confirmDelete = await showConfirm({ message: `Bạn có chắc chắn muốn xóa tiện ích này? Tất cả profiles sẽ không tải tiện ích này nữa.` });
  if (!confirmDelete) return;

  try {
    const res = await api(`/extensions/${id}`, { method: 'DELETE' });
    if (res.success) {
      toast('Đã xóa extension thành công!', 'success');
      loadExtensions();
    } else {
      toast(res.error || 'Lỗi khi xóa extension.', 'error');
    }
  } catch (err) {
    toast('Lỗi kết nối xóa extension: ' + err.message, 'error');
  }
}

export function handleExtFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext !== 'zip' && ext !== 'crx') {
    toast('Chỉ chấp nhận tệp tin định dạng .zip hoặc .crx!', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = async function(e) {
    const base64 = e.target.result.split(',')[1];
    
    toast('Đang tải lên và giải nén tiện ích...', 'info');
    try {
      const res = await api('/extensions/upload', {
        method: 'POST',
        body: {
          filename: file.name,
          base64: base64
        }
      });

      if (res.success) {
        toast(`Tải lên và cài đặt tiện ích thành công!`, 'success');
        const extFileInput = document.getElementById('extFileInput');
        if (extFileInput) extFileInput.value = '';
        loadExtensions();
      } else {
        toast(res.error || 'Lỗi tải lên tiện ích.', 'error');
      }
    } catch (err) {
      toast('Lỗi kết nối tải lên: ' + err.message, 'error');
    }
  };
  reader.readAsDataURL(file);
}

export function setupExtensionsEventListeners() {
  const btnManageExtensions = document.getElementById('btnManageExtensions');
  const btnCloseExtensionsModal = document.getElementById('btnCloseExtensionsModal');
  const btnConfirmExtensions = document.getElementById('btnConfirmExtensions');
  const btnInstallStoreExt = document.getElementById('btnInstallStoreExt');
  const storeExtensionUrlInput = document.getElementById('storeExtensionUrl');
  const extUploadZone = document.getElementById('extUploadZone');
  const extFileInput = document.getElementById('extFileInput');

  if (btnManageExtensions) {
    btnManageExtensions.onclick = () => {
      openModal('extensionsModal');
      loadExtensions();
    };
  }

  if (btnCloseExtensionsModal) {
    btnCloseExtensionsModal.onclick = () => closeModal('extensionsModal');
  }

  if (btnConfirmExtensions) {
    btnConfirmExtensions.onclick = () => closeModal('extensionsModal');
  }

  if (btnInstallStoreExt) {
    btnInstallStoreExt.onclick = async () => {
      const input = storeExtensionUrlInput.value.trim();
      if (!input) {
        toast('Vui lòng nhập Link hoặc ID tiện ích.', 'error');
        return;
      }

      btnInstallStoreExt.disabled = true;
      btnInstallStoreExt.textContent = 'Đang cài...';
      
      try {
        const res = await api('/extensions/chrome-web-store', {
          method: 'POST',
          body: { urlOrId: input }
        });

        if (res.success) {
          toast(`Đã cài đặt extension "${res.data.name}" thành công!`, 'success');
          storeExtensionUrlInput.value = '';
          loadExtensions();
        } else {
          toast(res.error || 'Lỗi cài đặt tiện ích.', 'error');
        }
      } catch (err) {
        toast('Lỗi kết nối tới máy chủ: ' + err.message, 'error');
      } finally {
        btnInstallStoreExt.disabled = false;
        btnInstallStoreExt.textContent = 'Cài đặt';
      }
    };
  }

  if (extUploadZone && extFileInput) {
    extUploadZone.onclick = () => extFileInput.click();

    ['dragenter', 'dragover'].forEach(eventName => {
      extUploadZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        extUploadZone.classList.add('dragover');
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      extUploadZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        extUploadZone.classList.remove('dragover');
      }, false);
    });

    extUploadZone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files.length > 0) {
        handleExtFile(files[0]);
      }
    });

    extFileInput.onchange = (e) => {
      if (e.target.files.length > 0) {
        handleExtFile(e.target.files[0]);
      }
    };
  }

  // Register window deleteExtension function
  window.deleteExtension = deleteExtension;
}
