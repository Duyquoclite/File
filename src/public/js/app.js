import { state } from './modules/state.js';
import { api, connectWS } from './modules/api.js';
import {
  toast,
  loadProfiles,
  renderProfiles,
  applyLayoutMode,
  initUI
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
  } catch (err) {
    console.error('Error bootstrapping application:', err);
    toast('Gặp lỗi khi khởi động ứng dụng!', 'error');
  }
}

document.addEventListener('DOMContentLoaded', bootstrap);
export { bootstrap };
