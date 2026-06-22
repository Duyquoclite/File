import { state } from './state.js';
import { api, connectWS } from './api.js';
import { toast, esc } from './ui.js';
import { openModal, closeModal, showConfirm, openProfile } from './modals.js';

export function openScriptEditor(id) {
  state.currentScriptProfileId = id;
  const scriptName = document.getElementById('scriptName');
  const scriptCode = document.getElementById('scriptCode');
  const scriptLogs = document.getElementById('scriptLogs');
  const logOutput = document.getElementById('logOutput');

  if (scriptName) scriptName.value = '';
  if (scriptCode) scriptCode.value = '';
  if (scriptLogs) scriptLogs.style.display = 'none';
  if (logOutput) logOutput.innerHTML = '';
  openModal('scriptModal');
}

export function setupAutomationEventListeners() {
  const btnCloseScript = document.getElementById('btnCloseScript');
  if (btnCloseScript) btnCloseScript.onclick = () => closeModal('scriptModal');

  const btnCopyLogs = document.getElementById('btnCopyLogs');
  if (btnCopyLogs) {
    btnCopyLogs.onclick = () => {
      const logText = document.getElementById('logOutput').innerText;
      navigator.clipboard.writeText(logText).then(() => {
        toast('Đã copy logs vào clipboard!', 'success');
      }).catch(() => {
        toast('Lỗi copy logs!', 'error');
      });
    };
  }

  const btnSaveScript = document.getElementById('btnSaveScript');
  if (btnSaveScript) {
    btnSaveScript.onclick = async () => {
      const name = document.getElementById('scriptName').value.trim() || 'Untitled';
      const code = document.getElementById('scriptCode').value;
      if (!code) {
        toast('Vui lòng nhập code', 'error');
        return;
      }

      const res = await api(`/automation/${state.currentScriptProfileId}/scripts`, {
        method: 'POST',
        body: { name, code }
      });
      if (res.success) toast('Script đã lưu!', 'success');
      else toast(res.error || 'Lỗi', 'error');
    };
  }

  const btnRunScript = document.getElementById('btnRunScript');
  if (btnRunScript) {
    btnRunScript.onclick = async () => {
      const code = document.getElementById('scriptCode').value;
      if (!code) {
        toast('Vui lòng nhập code', 'error');
        return;
      }

      const logDiv = document.getElementById('scriptLogs');
      const logOut = document.getElementById('logOutput');
      if (logDiv) logDiv.style.display = 'block';
      if (logOut) logOut.innerHTML = '<div class="log-line info">▶ Đang chạy script...</div>';

      connectWS();
      if (state.ws && state.ws.readyState === WebSocket.OPEN) {
        state.ws.send(JSON.stringify({ action: 'run-script', profileId: state.currentScriptProfileId, code }));
      } else {
        // Fallback to HTTP
        const res = await api(`/automation/${state.currentScriptProfileId}/run`, {
          method: 'POST',
          body: { code }
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
  }

  // Bulk Script Runner
  const btnBulkRunScript = document.getElementById('btnBulkRunScript');
  const btnCloseBulkScript = document.getElementById('btnCloseBulkScript');
  const btnCancelBulkScript = document.getElementById('btnCancelBulkScript');
  const btnRunBulkScript = document.getElementById('btnRunBulkScript');
  const bulkScriptCode = document.getElementById('bulkScriptCode');
  const bulkLogOutput = document.getElementById('bulkLogOutput');
  const bulkScriptLogs = document.getElementById('bulkScriptLogs');

  if (btnBulkRunScript) {
    btnBulkRunScript.onclick = () => {
      const selectedCount = state.selectedIds.size;
      if (selectedCount === 0) {
        toast('Vui lòng chọn ít nhất một profile', 'error');
        return;
      }
      document.getElementById('bulkScriptSelectedCount').textContent = selectedCount;
      if (bulkScriptLogs) bulkScriptLogs.style.display = 'none';
      if (bulkLogOutput) bulkLogOutput.innerHTML = '';
      if (bulkScriptCode) bulkScriptCode.value = '';
      openModal('bulkScriptModal');
    };
  }

  if (btnCloseBulkScript) btnCloseBulkScript.onclick = () => closeModal('bulkScriptModal');
  if (btnCancelBulkScript) btnCancelBulkScript.onclick = () => closeModal('bulkScriptModal');

  const btnCopyBulkLogs = document.getElementById('btnCopyBulkLogs');
  if (btnCopyBulkLogs) {
    btnCopyBulkLogs.onclick = () => {
      const logText = document.getElementById('bulkLogOutput').innerText;
      navigator.clipboard.writeText(logText).then(() => {
        toast('Đã copy logs vào clipboard!', 'success');
      }).catch(() => {
        toast('Lỗi copy logs!', 'error');
      });
    };
  }

  if (btnRunBulkScript) {
    btnRunBulkScript.onclick = async () => {
      const code = bulkScriptCode.value.trim();
      if (!code) {
        toast('Vui lòng nhập code script', 'error');
        return;
      }

      if (bulkScriptLogs) bulkScriptLogs.style.display = 'block';
      if (bulkLogOutput) bulkLogOutput.innerHTML = '';
      btnRunBulkScript.disabled = true;
      if (btnCancelBulkScript) btnCancelBulkScript.disabled = true;

      const ids = Array.from(state.selectedIds);
      
      // Create log panels for all selected profiles first
      ids.forEach(id => {
        const p = state.profiles.find(item => item.id === id);
        const name = p ? p.name : id;
        
        const panel = document.createElement('div');
        panel.className = 'profile-log-panel';
        panel.id = `log-panel-${id}`;
        panel.innerHTML = `
          <div class="profile-log-header">
            <span class="name">${esc(name)}</span>
            <span class="status" id="log-status-${id}">Đang chờ...</span>
          </div>
          <div class="profile-log-body" id="log-body-${id}"></div>
        `;
        bulkLogOutput.appendChild(panel);
      });

      const appendLog = (profileId, type, text) => {
        const bodyEl = document.getElementById(`log-body-${profileId}`);
        if (bodyEl) {
          bodyEl.innerHTML += `<div class="log-line ${type}">${esc(text)}</div>`;
          bodyEl.scrollTop = bodyEl.scrollHeight;
        }
      };

      const updateStatus = (profileId, text, className) => {
        const statusEl = document.getElementById(`log-status-${profileId}`);
        if (statusEl) {
          statusEl.textContent = text;
          statusEl.className = `status ${className}`;
        }
      };

      // Run concurrently
      const runPromises = ids.map(async (id) => {
        const p = state.profiles.find(item => item.id === id);
        let wasRunning = p ? p.isRunning : false;
        
        if (!wasRunning) {
          updateStatus(id, 'Khởi động...', 'running');
          appendLog(id, 'info', '🤖 Đang khởi động trình duyệt...');
          try {
            const openRes = await api(`/profiles/${id}/open`, { method: 'POST' });
            if (!openRes.success) {
              appendLog(id, 'error', `❌ Lỗi khởi động: ${openRes.error}`);
              updateStatus(id, 'Lỗi', 'error');
              return;
            }
            await new Promise(r => setTimeout(r, 3000));
          } catch (e) {
            appendLog(id, 'error', `❌ Lỗi kết nối khởi động: ${e.message}`);
            updateStatus(id, 'Lỗi', 'error');
            return;
          }
        }

        connectWS();
        if (state.ws && state.ws.readyState === WebSocket.OPEN) {
          appendLog(id, 'info', '▶ Đang chạy script (qua WS)...');
          updateStatus(id, 'Đang chạy', 'running');
          
          try {
            const runRes = await new Promise((resolve, reject) => {
              const timeout = setTimeout(() => {
                state.wsResolvers.delete(id);
                reject(new Error('Timeout thực thi script (10 phút)'));
              }, 600000);
              
              state.wsResolvers.set(id, (res) => {
                clearTimeout(timeout);
                resolve(res);
              });
              state.ws.send(JSON.stringify({ action: 'run-script', profileId: id, code }));
            });

            if (runRes.success) {
              appendLog(id, 'success', `✅ Hoàn thành script${runRes.result ? ': ' + runRes.result : ''}`);
              updateStatus(id, 'Hoàn thành', 'success');
            } else {
              appendLog(id, 'error', `❌ Lỗi thực thi: ${runRes.error}`);
              updateStatus(id, 'Lỗi', 'error');
            }
          } catch (err) {
            appendLog(id, 'error', `❌ Lỗi: ${err.message}`);
            updateStatus(id, 'Lỗi', 'error');
          }
        } else {
          // Fallback to HTTP POST
          appendLog(id, 'info', '▶ Đang chạy script (HTTP fallback)...');
          updateStatus(id, 'Đang chạy', 'running');
          try {
            const runRes = await api(`/automation/${id}/run`, {
              method: 'POST',
              body: { code }
            });
            if (runRes.success) {
              (runRes.data.logs || []).forEach(l => {
                appendLog(id, l.type || 'log', `[LOG] ${l.text}`);
              });
              appendLog(id, 'success', `✅ Hoàn thành script${runRes.data?.result ? ': ' + runRes.data.result : ''}`);
              updateStatus(id, 'Hoàn thành', 'success');
            } else {
              appendLog(id, 'error', `❌ Lỗi thực thi: ${runRes.error}`);
              updateStatus(id, 'Lỗi', 'error');
            }
          } catch (err) {
            appendLog(id, 'error', `❌ Lỗi kết nối chạy script: ${err.message}`);
            updateStatus(id, 'Lỗi', 'error');
          }
        }
      });

      await Promise.allSettled(runPromises);

      btnRunBulkScript.disabled = false;
      if (btnCancelBulkScript) btnCancelBulkScript.disabled = false;
      toast('Hoàn thành chạy script hàng loạt!', 'success');
    };
  }
}
