import { state } from './state.js';
import { toast, setProgressOverlay, hideProgressOverlay, esc } from './ui.js';

export async function api(url, opts = {}) {
  opts.headers = {
    'Content-Type': 'application/json',
    ...(opts.headers || {})
  };
  if (opts.body && typeof opts.body === 'object') {
    opts.body = JSON.stringify(opts.body);
  }
  const r = await fetch(state.API + url, opts);
  const data = await r.json();
  return data;
}

export function connectWS() {
  if (state.ws && (state.ws.readyState === WebSocket.OPEN || state.ws.readyState === WebSocket.CONNECTING)) {
    return;
  }
  try {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    state.ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    
    state.ws.onopen = () => {
      console.log('[WS] Connection established successfully');
      state.ws.send(JSON.stringify({ action: 'register', clientId: state.clientId }));
    };
    
    state.ws.onerror = (err) => {
      console.error('[WS] Connection error:', err);
    };
    
    state.ws.onclose = (event) => {
      console.warn('[WS] Connection closed:', event);
      setTimeout(connectWS, 2000);
    };
    
    state.ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      console.log('[WS] Message received:', data);
      
      // Route logs to bulk run logs if applicable
      if (data.profileId) {
        const bulkBody = document.getElementById(`log-body-${data.profileId}`);
        if (bulkBody) {
          let logClass = 'log';
          let prefix = '[LOG] ';
          if (data.type === 'error') {
            logClass = 'error';
            prefix = '[ERROR] ';
          } else if (data.type === 'info') {
            logClass = 'info';
            prefix = '';
          } else if (data.type === 'warn') {
            logClass = 'warn';
            prefix = '[WARN] ';
          }

          bulkBody.innerHTML += `<div class="log-line ${logClass}">${prefix}${esc(data.text || data.error || '')}</div>`;
          bulkBody.scrollTop = bulkBody.scrollHeight;
        }

        if (data.type === 'result') {
          const resolver = state.wsResolvers.get(data.profileId);
          if (resolver) {
            resolver({ success: data.success, result: data.result, error: data.error });
            state.wsResolvers.delete(data.profileId);
          }
        }
      }

      // Route to single script runner if it matches currentScriptProfileId or if no profileId is specified
      if (data.profileId === state.currentScriptProfileId || !data.profileId) {
        const logOut = document.getElementById('logOutput');
        if (logOut) {
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
        }
      } else if (data.type === 'share-progress') {
        setProgressOverlay('Đang đóng gói profile...', data.message, data.percent);
      } else if (data.type === 'import-progress') {
        setProgressOverlay('Đang tải và cài đặt profile...', data.message, data.percent);
      } else if (data.type === 'github-push-progress') {
        const progressSection = document.getElementById('uploadProgressSection');
        const progressBar = document.getElementById('uploadProgressBar');
        const progressText = document.getElementById('uploadProgressText');
        const progressStatus = document.getElementById('uploadProgressStatus');
        const progressLog = document.getElementById('uploadProgressLog');

        if (progressSection) progressSection.style.display = 'block';

        if (data.status === 'start' || data.status === 'fetching_tree') {
          if (progressBar) progressBar.style.width = '0%';
          if (progressText) progressText.textContent = '0%';
          if (progressStatus) progressStatus.textContent = data.message;
          if (progressLog) progressLog.innerHTML = '';
        } else if (data.status === 'uploading' || data.status === 'skipped') {
          if (progressBar) progressBar.style.width = `${data.percent}%`;
          if (progressText) progressText.textContent = `${data.percent}%`;
          if (progressStatus) progressStatus.textContent = data.message;
          if (data.status === 'skipped' && progressLog) {
            progressLog.innerHTML += `<div style="color:var(--text-muted); opacity: 0.7;">✓ [Bỏ qua] ${esc(data.currentFile)}</div>`;
            progressLog.scrollTop = progressLog.scrollHeight;
          }
        } else if (data.status === 'uploaded') {
          if (progressBar) progressBar.style.width = `${data.percent}%`;
          if (progressText) progressText.textContent = `${data.percent}%`;
          if (progressStatus) progressStatus.textContent = data.message;
          if (progressLog) {
            progressLog.innerHTML += `<div style="color:var(--success);">✓ Đã tải lên: ${esc(data.currentFile)}</div>`;
            progressLog.scrollTop = progressLog.scrollHeight;
          }
        } else if (data.status === 'success') {
          if (progressBar) progressBar.style.width = '100%';
          if (progressText) progressText.textContent = '100%';
          if (progressStatus) progressStatus.innerHTML = `<span style="color:var(--success); font-weight:bold;">✅ ${esc(data.message)}</span>`;
        } else if (data.status === 'error') {
          if (progressStatus) progressStatus.innerHTML = `<span style="color:var(--error); font-weight:bold;">❌ ${esc(data.message)}</span>`;
        }
      } else if (data.type === 'github-apply-progress') {
        const progressSection = document.getElementById('applyProgressSection');
        const progressBar = document.getElementById('applyProgressBar');
        const progressText = document.getElementById('applyProgressText');
        const progressStatus = document.getElementById('applyProgressStatus');
        const progressLog = document.getElementById('applyProgressLog');

        if (progressSection) progressSection.style.display = 'block';

        if (data.status === 'downloading' || data.status === 'extracting') {
          if (progressBar) progressBar.style.width = '0%';
          if (progressText) progressText.textContent = '0%';
          if (progressStatus) progressStatus.textContent = data.message;
          if (progressLog) progressLog.innerHTML = '';
        } else if (data.status === 'copying') {
          if (progressBar) progressBar.style.width = `${data.percent}%`;
          if (progressText) progressText.textContent = `${data.percent}%`;
          if (progressStatus) progressStatus.textContent = data.message;
          if (progressLog) {
            progressLog.innerHTML += `<div style="color:var(--success);">✓ Đã ghi đè: ${esc(data.fileName)}</div>`;
            progressLog.scrollTop = progressLog.scrollHeight;
          }
        } else if (data.status === 'success') {
          if (progressBar) progressBar.style.width = '100%';
          if (progressText) progressText.textContent = '100%';
          if (progressStatus) progressStatus.innerHTML = `<span style="color:var(--success); font-weight:bold;">✅ ${esc(data.message)}</span>`;
        } else if (data.status === 'error') {
          if (progressStatus) progressStatus.innerHTML = `<span style="color:var(--error); font-weight:bold;">❌ ${esc(data.message)}</span>`;
        }
      }
      const logOut = document.getElementById('logOutput');
      if (logOut) logOut.scrollTop = logOut.scrollHeight;
    };
  } catch (e) {
    /* WS unavailable, use HTTP fallback */
  }
}
