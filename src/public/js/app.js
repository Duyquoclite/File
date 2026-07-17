import { state } from './modules/state.js';
import { api, connectWS } from './modules/api.js';
import {
  toast,
  loadProfiles,
  renderProfiles,
  applyLayoutMode,
  initUI,
  parseProxyHost
} from './modules/ui.js';
import {
  openProfile,
  closeProfile,
  duplicateProfile,
  showDetail,
  regenFingerprint,
  deleteProfile,
  toggleSelect,
  toggleGroupSelect,
  checkFbGroupStatus,
  setupModalEventListeners
} from './modules/modals.js';
import {
  openScriptEditor,
  setupAutomationEventListeners
} from './modules/automation.js';
import {
  setupExtensionsEventListeners
} from './modules/extensions.js';

// Global window mappings for dynamically generated template HTML strings
window.openProfile = openProfile;
window.closeProfile = closeProfile;
window.duplicateProfile = duplicateProfile;
window.showDetail = showDetail;
window.openScriptEditor = openScriptEditor;
window.regenFingerprint = regenFingerprint;
window.deleteProfile = deleteProfile;
window.toggleSelect = toggleSelect;
window.toggleGroupSelect = toggleGroupSelect;
window.checkFbGroupStatus = checkFbGroupStatus;

const components = [
  'create_modal.html',
  'bulk_create_modal.html',
  'confirm_modal.html',
  'message_modal.html',
  'script_modal.html',
  'detail_modal.html',
  'groups_modal.html',
  'bulk_script_modal.html',
  'update_modal.html',
  'extensions_modal.html',
  'mail_checker_modal.html'
];

async function loadComponents() {
  const container = document.getElementById('modalContainer');
  if (!container) return;
  const responses = await Promise.all(
    components.map(name => fetch(`/components/${name}`).then(r => r.text()))
  );
  container.innerHTML = responses.join('\n');
}

let isAutoResolving = false;
async function autoResolveDuplicateDynamicIPs() {
  if (isAutoResolving) return;
  isAutoResolving = true;
  try {
    const groups = {};
    for (const p of state.profiles) {
      if (!p.proxy || p.proxyType === 'none') continue;
      const proxyKey = p.proxy.trim();
      if (!groups[proxyKey]) groups[proxyKey] = [];
      groups[proxyKey].push(p);
    }

    let updatedAny = false;

    // Ensure all profiles in groups of size > 1 have initial IPs
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

    // Identify and filter dynamic proxy groups
    const dynamicGroups = [];
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

        groupDataList.push({
          proxyKey,
          groupProfiles,
          proxyHost,
          keepers,
          redundants
        });
      }
    }

    // Process dynamic groups for IP rotation
    const changedProfiles = [];

    for (const { proxyKey, groupProfiles, proxyHost, keepers, redundants } of groupDataList) {
      if (redundants.length === 0) {
        continue;
      }

      const sampleProfile = groupProfiles[0];
      const res = await api('/proxy/check', {
        method: 'POST',
        body: { proxy: sampleProfile.proxy, proxyType: sampleProfile.proxyType }
      });

      if (res.success && res.data.ip) {
        const newIp = res.data.ip.replace(/[\[\]]/g, '').trim();

        const isNewIpUnique = keepers.every(k => {
          const keeperIp = (k.proxyIp || '').replace(/[\[\]]/g, '').trim();
          return keeperIp !== newIp;
        });

        if (isNewIpUnique) {
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

// Bootstrapping
async function bootstrap() {
  try {
    // 1. Load HTML templates dynamically
    await loadComponents();
    
    // 2. Initialize UI layout modes and schedules
    applyLayoutMode();
    initUI();
    
    // 3. Connect real-time channels
    connectWS();
    
    // 4. Setup modal form events
    setupModalEventListeners();
    
    // 5. Setup scripting editor events
    setupAutomationEventListeners();
    
    // 6. Setup extensions management upload zone events
    setupExtensionsEventListeners();
    
    // 7. Load profiles and begin IP rotation check interval
    await loadProfiles();
    
    setInterval(() => {
      const searchInput = document.getElementById('searchInput');
      const searchVal = searchInput ? searchInput.value : '';
      loadProfiles(searchVal);
    }, 5000);
    
    setInterval(autoResolveDuplicateDynamicIPs, 60000);
  } catch (err) {
    console.error('Error bootstrapping application:', err);
    toast('Gặp lỗi khi khởi động ứng dụng!', 'error');
  }
}

document.addEventListener('DOMContentLoaded', bootstrap);
export { bootstrap };
