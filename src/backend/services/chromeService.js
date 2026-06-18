/**
 * Chrome Service
 * Manages launching and closing Chrome instances via Puppeteer.
 * Each profile gets its own Chrome process with isolated user-data-dir,
 * unique fingerprint, and dedicated proxy.
 */

const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { buildFingerprintScript } = require('./fingerprintService');

// Apply stealth plugin globally
puppeteer.use(StealthPlugin());

// In-memory map of running browsers: profileId -> { browser, pages }
const runningBrowsers = new Map();

// Base directory for Chrome user-data profiles
const PROFILES_DIR = path.join(__dirname, '..', '..', 'profiles');
const EXTENSIONS_DIR = path.join(__dirname, '..', '..', 'extensions');
if (!fs.existsSync(PROFILES_DIR)) fs.mkdirSync(PROFILES_DIR, { recursive: true });
if (!fs.existsSync(EXTENSIONS_DIR)) fs.mkdirSync(EXTENSIONS_DIR, { recursive: true });

function cleanupStaleProfileLock(userDataDir) {
  try {
    const stalePaths = [
      path.join(userDataDir, 'Default', 'LOCK'),
      path.join(userDataDir, 'Default', 'SingletonLock'),
      path.join(userDataDir, 'Default', 'SingletonSocket'),
      path.join(userDataDir, 'Default', 'SingletonCookie'),
      path.join(userDataDir, 'DevToolsActivePort'),
    ];
    for (const stalePath of stalePaths) {
      if (fs.existsSync(stalePath)) {
        fs.rmSync(stalePath, { recursive: true, force: true });
      }
    }
  } catch (e) {
    console.warn('Unable to clean stale profile lock files:', e.message);
  }
}



/**
 * Find Chrome executable on Windows
 */
function findChromeExecutable() {
  // 1. Prioritize Chrome for Testing installed in the project root
  const cftDir = path.join(__dirname, '..', '..', 'chrome');
  if (fs.existsSync(cftDir)) {
    try {
      const findExe = (dir) => {
        const items = fs.readdirSync(dir);
        for (const item of items) {
          const fullPath = path.join(dir, item);
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            const found = findExe(fullPath);
            if (found) return found;
          } else if (item.toLowerCase() === 'chrome.exe') {
            return fullPath;
          }
        }
        return null;
      };
      const cftPath = findExe(cftDir);
      if (cftPath) {
        console.log(`[Chrome] Using Chrome for Testing found in project: ${cftPath}`);
        return cftPath;
      }
    } catch (e) {
      console.warn('[Chrome] Failed to search Chrome for Testing directory:', e.message);
    }
  }

  // 2. Fallback to standard system paths
  const possiblePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  // Fallback: let puppeteer try to find it
  return undefined;
}




/**
 * Remove the obsolete bookmark from Chrome's Bookmarks file.
 * @param {string} userDataDir
 */
function removeProfileBookmarks(userDataDir) {
  try {
    const bookmarksPath = path.join(userDataDir, 'Default', 'Bookmarks');
    if (fs.existsSync(bookmarksPath)) {
      const content = fs.readFileSync(bookmarksPath, 'utf8');
      const bookmarks = JSON.parse(content);
      if (bookmarks.roots && bookmarks.roots.bookmark_bar && bookmarks.roots.bookmark_bar.children) {
        const initialLen = bookmarks.roots.bookmark_bar.children.length;
        bookmarks.roots.bookmark_bar.children = bookmarks.roots.bookmark_bar.children.filter(
          child => child.name !== "🏠 Thông tin Profile"
        );
        if (bookmarks.roots.bookmark_bar.children.length !== initialLen) {
          fs.writeFileSync(bookmarksPath, JSON.stringify(bookmarks, null, 2), 'utf8');
        }
      }
    }
  } catch (e) {
    // Ignore
  }
}

/**
 * Create a profile-specific Chrome extension that opens the profile info page.
 * @param {string} userDataDir
 * @param {string} profileId
 * @returns {string} Path to the created extension directory
 */
function createProfileInfoExtension(userDataDir, profileId) {
  try {
    const extDir = path.join(userDataDir, 'profile-info-extension');
    if (!fs.existsSync(extDir)) {
      fs.mkdirSync(extDir, { recursive: true });
    }

    const manifest = {
      manifest_version: 3,
      name: "Thông tin Profile",
      version: "1.0",
      description: "Hiển thị thông tin cấu hình, proxy và vân tay của profile này.",
      key: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAz8R/CXzdGNtXzZPX4YClooPcU1/I5FRqCQi0usmHGznk6vtnXvLSCoSYAdXu2u7y4HLDaN657J3L91mjp3gGP+A7e7aPJgEgmIg+rI9TFlGb6IuaGMi6ogir8Ewd/4SD/RFaoi11JE8ect44SKRVKX6v00WNnA+RdxSf+ISSY2coycXFrAkGMjWVQp3VXxNjwyM3BBgSBvg/CIKzUFw4NiOB11Ore6NmkeudQh/APdnf0s0itMALFoXFSlLMc7N4qi4wUSezHdXFFsxHcoOqa+8HmPK46Ia42uFr3374TksozX+89E4YXcK3H4H9IVZvBj3EvJ25GMndYribUqUxIQIDAQAB",
      action: {
        default_title: "Xem thông tin Profile"
      },
      background: {
        service_worker: "background.js"
      },
      permissions: ["tabs"]
    };

    fs.writeFileSync(path.join(extDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

    const backgroundJs = `chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.create({
    url: "http://localhost:3000/profile-info/${profileId}"
  });
});`;

    fs.writeFileSync(path.join(extDir, 'background.js'), backgroundJs, 'utf8');

    return extDir;
  } catch (err) {
    console.error('[Chrome] Error creating profile info extension:', err.message);
    return null;
  }
}

/**
 * Update the profile display name in Chrome's Preferences and Local State files.
 * @param {string} userDataDir - Path to profile user data directory
 * @param {string} profileName - Display name of the profile
 */
function updateProfileNameInPrefs(userDataDir, profileName) {
  if (!profileName) return;

  const localStatePath = path.join(userDataDir, 'Local State');
  const preferencesPath = path.join(userDataDir, 'Default', 'Preferences');

  // 1. Update Local State (caches the profile names for the profile manager UI)
  try {
    let localState = {};
    if (fs.existsSync(localStatePath)) {
      const content = fs.readFileSync(localStatePath, 'utf8');
      try {
        localState = JSON.parse(content);
      } catch (e) {
        console.warn('[Chrome] Failed to parse existing Local State, rewriting:', e.message);
      }
    }

    if (!localState.profile) localState.profile = {};
    if (!localState.profile.info_cache) localState.profile.info_cache = {};
    if (!localState.profile.info_cache.Default) localState.profile.info_cache.Default = {};

    localState.profile.info_cache.Default.name = profileName;
    localState.profile.info_cache.Default.is_using_default_name = false;

    fs.writeFileSync(localStatePath, JSON.stringify(localState, null, 2), 'utf8');
  } catch (err) {
    console.error('[Chrome] Error updating Local State:', err.message);
  }

  // 2. Update Default/Preferences (stores profile-specific preferences)
  try {
    const defaultDir = path.join(userDataDir, 'Default');
    if (!fs.existsSync(defaultDir)) {
      fs.mkdirSync(defaultDir, { recursive: true });
    }

    let preferences = {};
    if (fs.existsSync(preferencesPath)) {
      const content = fs.readFileSync(preferencesPath, 'utf8');
      try {
        preferences = JSON.parse(content);
      } catch (e) {
        console.warn('[Chrome] Failed to parse existing Preferences, rewriting:', e.message);
      }
    }

    if (!preferences.profile) preferences.profile = {};
    preferences.profile.name = profileName;

    // Remove obsolete Home button & Bookmark bar preferences
    if (preferences.browser) {
      delete preferences.browser.show_home_button;
    }
    delete preferences.homepage;
    delete preferences.homepage_is_newtabpage;
    if (preferences.bookmark_bar) {
      delete preferences.bookmark_bar.show_on_all_tabs;
    }

    // Pin the profile-info extension to the toolbar
    if (!preferences.extensions) preferences.extensions = {};
    if (!Array.isArray(preferences.extensions.pinned_extensions)) {
      preferences.extensions.pinned_extensions = [];
    }
    const extId = "hddocagbfcdibehfcnafddbehcfhmegn";
    if (!preferences.extensions.pinned_extensions.includes(extId)) {
      preferences.extensions.pinned_extensions.push(extId);
    }

    fs.writeFileSync(preferencesPath, JSON.stringify(preferences, null, 2), 'utf8');

    // Clean up obsolete bookmark if exists
    removeProfileBookmarks(userDataDir);
  } catch (err) {
    console.error('[Chrome] Error updating Preferences:', err.message);
  }
}




/**
 * Launch a Chrome browser for a given profile.
 * @param {Object} profile - profile object from DB
 * @returns {Object} { success, error }
 */
async function launchProfile(profile) {
  if (runningBrowsers.has(profile.id)) {
    return { success: false, error: 'Profile is already running' };
  }

  const userDataDir = path.join(PROFILES_DIR, profile.id);
  if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir, { recursive: true });

  cleanupStaleProfileLock(userDataDir);
  updateProfileNameInPrefs(userDataDir, profile.name);
  const fingerprint = JSON.parse(profile.fingerprint || '{}');

  // Parse proxy info first
  let proxyUrl = null;
  let anonymizedProxyUrl = null;

  if (profile.proxy && profile.proxy.trim()) {
    let proxyStr = profile.proxy.trim();
    
    // Strip protocol prefix if present to normalize
    let cleanProxy = proxyStr;
    let scheme = profile.proxyType || 'http';
    if (proxyStr.includes('://')) {
      const parts = proxyStr.split('://');
      scheme = parts[0];
      cleanProxy = parts[1];
    }
    
    let parts = cleanProxy.split(':');
    
    if (parts.length === 4) {
      // IP:PORT:USER:PASS format
      const [host, port, user, pass] = parts;
      proxyUrl = `${scheme}://${user}:${pass}@${host}:${port}`;
    } else if (parts.length === 2) {
      // IP:PORT format (no auth)
      const [host, port] = parts;
      proxyUrl = `${scheme}://${host}:${port}`;
    } else {
      proxyUrl = `${scheme}://${cleanProxy}`;
    }
  }

  // Build Chrome launch arguments
  const args = [
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-sync',
    '--disable-translate',
    '--metrics-recording-only',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-blink-features=AutomationControlled',
    '--disable-session-crashed-bubble',
    '--restore-last-session',
    `--window-size=${fingerprint.screen?.width || 1920},${fingerprint.screen?.height || 1080}`,
  ];

  // Add proxy server flag
  if (proxyUrl) {
    if (proxyUrl.includes('@')) {
       // Requires authentication, anonymize it
       try {
         const proxyChain = await import('proxy-chain');
         anonymizedProxyUrl = await proxyChain.anonymizeProxy(proxyUrl);
         args.push(`--proxy-server=${anonymizedProxyUrl}`);
       } catch (err) {
         console.error('Failed to anonymize proxy:', err);
         return { success: false, error: 'Failed to authenticate proxy: ' + err.message };
       }
    } else {
       args.push(`--proxy-server=${proxyUrl}`);
    }
  }

  // WebRTC IP leak prevention
  if (fingerprint.webrtc?.mode === 'disable_non_proxied_udp') {
    args.push('--force-webrtc-ip-handling-policy=disable_non_proxied_udp');
  }

  // Timezone
  if (fingerprint.timezone) {
    args.push(`--timezone=${fingerprint.timezone}`);
  }

  // Language
  if (fingerprint.languages && fingerprint.languages.length > 0) {
    args.push(`--lang=${fingerprint.languages[0]}`);
  }

  // Load unpacked extensions if present in extensions directory
  const extPaths = [];
  if (fs.existsSync(EXTENSIONS_DIR)) {
    try {
      const items = fs.readdirSync(EXTENSIONS_DIR);
      for (const item of items) {
        const itemPath = path.join(EXTENSIONS_DIR, item);
        if (fs.statSync(itemPath).isDirectory()) {
          extPaths.push(itemPath);
        }
      }
    } catch (e) {
      console.warn('Failed to read extensions directory:', e.message);
    }
  }

  // Load the profile-specific profile-info extension
  const profileInfoExtPath = createProfileInfoExtension(userDataDir, profile.id);
  if (profileInfoExtPath) {
    extPaths.push(profileInfoExtPath);
  }

  if (extPaths.length > 0) {
    const formattedPaths = extPaths.map(p => path.resolve(p).replace(/\\/g, '/'));
    args.push(`--load-extension=${formattedPaths.join(',')}`);
    args.push(`--disable-extensions-except=${formattedPaths.join(',')}`);
  }

  const chromePath = findChromeExecutable();
  if (!chromePath) {
    return { success: false, error: 'Chrome executable not found on this system' };
  }

  try {
    console.log(`[Chrome] Launching profile ${profile.name} (${profile.id})`);
    if (proxyUrl) {
      console.log(`[Chrome] Proxy: ${proxyUrl} ${anonymizedProxyUrl ? '(anonymized)' : ''}`);
    }
    console.log('[Chrome] Args:', args);
    console.log(`[Chrome] User Data Dir: ${userDataDir}`);

    const launchOptions = {
      headless: false,
      executablePath: chromePath,
      userDataDir,
      args,
      ignoreDefaultArgs: [
        '--enable-automation',
        '--disable-extensions',
        '--disable-component-extensions-with-background-pages'
      ],
    };

    const browser = await puppeteer.launch(launchOptions);

    // Helper to setup a page (fingerprint)
    async function setupPage(page) {
      try {
        if (fingerprint.userAgent) {
          await page.setUserAgent(fingerprint.userAgent);
          await page.setExtraHTTPHeaders({ 'Accept-Language': fingerprint.languages.join(', ') });
          await page.evaluateOnNewDocument(buildFingerprintScript(fingerprint));
        }



      } catch (e) {
        // Page might have been closed already
      }
    }

    // Apply to all new pages/tabs opened by user
    browser.on('targetcreated', async (target) => {
      if (target.type() === 'page') {
        try {
          const page = await target.page();
          if (page) await setupPage(page);
        } catch (e) {
          // ignore
        }
      }
    });

    // Wait briefly for Chrome to restore previous session tabs
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Apply fingerprint to existing pages and close the extra blank tab
    const pages = await browser.pages();
    let closedBlank = false;
    
    for (const page of pages) {
      try {
        const url = page.url();
        if (pages.length > 1 && !closedBlank && (url === 'about:blank' || url === 'chrome://newtab/')) {
          // Close the initial blank tab Puppeteer creates (only if restored tabs exist)
          await page.close().catch(() => {});
          closedBlank = true;
        } else {
          await setupPage(page);
          if (url === 'about:blank' || url === 'chrome://newtab/') {
            // Redirect the initial blank page to google.com
            await page.goto('https://google.com').catch(() => {});
          }
        }
      } catch (e) {
        // Ignore
      }
    }


    // Track the browser
    runningBrowsers.set(profile.id, {
      browser,
      anonymizedProxyUrl,
      startedAt: new Date().toISOString(),
    });

    // Listen for browser disconnect
    browser.on('disconnected', () => {
      runningBrowsers.delete(profile.id);
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Close a browser entry and related proxy resources.
 */
async function closeBrowserEntry(entry) {
  try {
    if (entry.anonymizedProxyUrl) {
      const proxyChain = await import('proxy-chain');
      await proxyChain.closeAnonymizedProxy(entry.anonymizedProxyUrl, true).catch(() => {});
    }
    if (entry.browser) {
      await entry.browser.close();
    }
  } catch (error) {
    // ignore individual close failures
  }
}

/**
 * Close a running Chrome browser for a profile.
 * @param {string} profileId
 * @returns {Object} { success, error }
 */
async function closeProfile(profileId) {
  const entry = runningBrowsers.get(profileId);
  if (!entry) {
    return { success: false, error: 'Profile is not running' };
  }

  try {
    await closeBrowserEntry(entry);
    runningBrowsers.delete(profileId);
    return { success: true };
  } catch (error) {
    runningBrowsers.delete(profileId);
    return { success: false, error: error.message };
  }
}


/**
 * Run a Puppeteer-level automation script (has access to page object).
 * @param {string} profileId
 * @param {string} scriptCode
 * @param {Function} onLog
 * @returns {Object}
 */
async function runPuppeteerScript(profileId, scriptCode, onLog = () => {}) {
  const entry = runningBrowsers.get(profileId);
  if (!entry) {
    return { success: false, error: 'Profile is not running. Open it first.' };
  }

  try {
    const pages = await entry.browser.pages();
    let page = pages[pages.length - 1];
    if (!page) {
      page = await entry.browser.newPage();
    }

    const browser = entry.browser;

    // Intercept console messages
    const logHandler = (msg) => {
      onLog({ type: 'console', text: msg.text() });
    };
    page.on('console', logHandler);

    // Create a custom console for the script
    const scriptConsole = {
      log: (...args) => onLog({ type: 'log', text: args.map(String).join(' ') }),
      error: (...args) => onLog({ type: 'error', text: args.map(String).join(' ') }),
      warn: (...args) => onLog({ type: 'warn', text: args.map(String).join(' ') }),
      info: (...args) => onLog({ type: 'info', text: args.map(String).join(' ') }),
    };

    // Build function with page and browser context
    const asyncFn = new Function('page', 'browser', 'console', `
      return (async () => {
        ${scriptCode}
      })();
    `);

    const result = await asyncFn(page, browser, scriptConsole);
    page.off('console', logHandler);

    return { success: true, result: result !== undefined ? String(result) : null };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get status of all running profiles.
 * @returns {Object} map of profileId -> { startedAt }
 */
function getRunningProfiles() {
  const result = {};
  for (const [id, entry] of runningBrowsers) {
    result[id] = { startedAt: entry.startedAt };
  }
  return result;
}

/**
 * Check if a profile is currently running.
 * @param {string} profileId
 * @returns {boolean}
 */
function isRunning(profileId) {
  return runningBrowsers.has(profileId);
}

/**
 * Close all running browsers (cleanup on server shutdown).
 */
async function closeAll() {
  const promises = [];
  for (const entry of runningBrowsers.values()) {
    promises.push(closeBrowserEntry(entry));
  }
  await Promise.allSettled(promises);
  runningBrowsers.clear();
}

module.exports = {
  launchProfile,
  closeProfile,
  runPuppeteerScript,
  getRunningProfiles,
  isRunning,
  closeAll,
};
