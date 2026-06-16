/**
 * Chrome Service
 * Manages launching and closing Chrome instances via Puppeteer.
 * Each profile gets its own Chrome process with isolated user-data-dir,
 * unique fingerprint, and dedicated proxy.
 */

const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
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
 * Run a raw JS automation script on a running profile.
 * @param {string} profileId
 * @param {string} scriptCode - raw JavaScript code
 * @param {Function} onLog - callback for log messages
 * @returns {Object} { success, result, error }
 */
async function runScript(profileId, scriptCode, onLog = () => {}) {
  const entry = runningBrowsers.get(profileId);
  if (!entry) {
    return { success: false, error: 'Profile is not running. Open it first.' };
  }

  try {
    const pages = await entry.browser.pages();
    let page = pages[pages.length - 1]; // use the last active page

    if (!page) {
      page = await entry.browser.newPage();
    }

    // Intercept console messages
    const logHandler = (msg) => {
      onLog({ type: msg.type(), text: msg.text() });
    };
    page.on('console', logHandler);

    // Build an async function wrapper
    const wrappedCode = `
      (async () => {
        ${scriptCode}
      })()
    `;

    // Execute the script
    const result = await page.evaluate(wrappedCode);

    page.off('console', logHandler);

    return { success: true, result: result };
  } catch (error) {
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
  runScript,
  runPuppeteerScript,
  getRunningProfiles,
  isRunning,
  closeAll,
};
