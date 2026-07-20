const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const axios = require('axios');
const crypto = require('crypto');

const PROJECT_ROOT = path.join(__dirname, '..', '..');
const KEY_FILE = path.join(PROJECT_ROOT, 'key.txt');
const REPO = 'Duyquoclite/File';
const BRANCH = 'main';

function getUpdateKey() {
  if (!fs.existsSync(KEY_FILE)) {
    return '';
  }
  return fs.readFileSync(KEY_FILE, 'utf8').trim();
}

function gitBlobSha(buffer) {
  const header = `blob ${buffer.length}\0`;
  const store = Buffer.concat([Buffer.from(header), buffer]);
  return crypto.createHash('sha1').update(store).digest('hex');
}

function getAllFiles(dirPath, arrayOfFiles = {}) {
  const files = fs.readdirSync(dirPath);
  files.forEach(file => {
    const fullPath = path.join(dirPath, file);
    const relativePath = path.relative(PROJECT_ROOT, fullPath).replace(/\\/g, '/');

    if (
      file === 'node_modules' ||
      file === 'profiles' ||
      file === 'data' ||
      file === '.git' ||
      file === 'key.txt' ||
      file === 'docs' ||
      file === 'chrome' ||
      file.startsWith('db.sqlite')
    ) {
      return;
    }

    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      getAllFiles(fullPath, arrayOfFiles);
    } else {
      try {
        const content = fs.readFileSync(fullPath);
        arrayOfFiles[relativePath] = content;
      } catch (err) {
        // Ignore unreadable
      }
    }
  });
  return arrayOfFiles;
}

async function checkForUpdates() {
  const token = getUpdateKey();
  if (token) {
    console.log('[AutoUpdater] Developer key found in key.txt. Skipping update check.');
    return;
  }

  console.log('[AutoUpdater] Checking for updates from GitHub...');
  try {
    const headers = {
      'User-Agent': 'chrome-profile-manager-updater',
      'Accept': 'application/vnd.github.v3+json'
    };

    const treeUrl = `https://api.github.com/repos/${REPO}/git/trees/${BRANCH}?recursive=1`;
    const treeRes = await axios.get(treeUrl, { headers });

    if (!treeRes.data || !treeRes.data.tree) {
      console.warn('[AutoUpdater] Failed to get file tree from GitHub.');
      return;
    }

    const remoteFiles = treeRes.data.tree.filter(item => item.type === 'blob' && item.path.startsWith('src/'));
    if (remoteFiles.length === 0) {
      console.log('[AutoUpdater] No source files found on GitHub.');
      return;
    }

    const localFiles = getAllFiles(PROJECT_ROOT);
    const updatesToDownload = [];
    const filesToDelete = [];

    // Check for new or changed files
    for (const item of remoteFiles) {
      const relativePath = item.path.substring(4); // Remove "src/"
      const localContent = localFiles[relativePath];

      if (!localContent) {
        console.log(`[AutoUpdater] New file detected: ${relativePath}`);
        updatesToDownload.push(item);
      } else {
        const localSha = gitBlobSha(localContent);
        if (localSha !== item.sha) {
          console.log(`[AutoUpdater] File difference detected: ${relativePath} (Local SHA: ${localSha}, Remote SHA: ${item.sha})`);
          updatesToDownload.push(item);
        }
      }
    }

    // Check for obsolete local files that should be deleted
    const remotePaths = new Set(remoteFiles.map(item => item.path.substring(4)));
    for (const localRelPath of Object.keys(localFiles)) {
      if (!remotePaths.has(localRelPath)) {
        console.log(`[AutoUpdater] Obsolete local file: ${localRelPath}`);
        filesToDelete.push(localRelPath);
      }
    }

    if (updatesToDownload.length === 0 && filesToDelete.length === 0) {
      console.log('[AutoUpdater] Codebase is up to date.');
      return;
    }

    console.log(`[AutoUpdater] Found ${updatesToDownload.length} files to update/create, ${filesToDelete.length} files to delete.`);

    // Delete obsolete files
    for (const fileToDelete of filesToDelete) {
      const targetPath = path.join(PROJECT_ROOT, fileToDelete);
      try {
        if (fs.existsSync(targetPath)) {
          fs.unlinkSync(targetPath);
          console.log(`[AutoUpdater] Deleted obsolete local file: ${fileToDelete}`);
        }
      } catch (err) {
        console.error(`[AutoUpdater] Failed to delete file ${fileToDelete}:`, err.message);
      }
    }

    // Download and write new/changed files
    for (const item of updatesToDownload) {
      const relativePath = item.path.substring(4);
      const targetPath = path.join(PROJECT_ROOT, relativePath);

      console.log(`[AutoUpdater] Downloading: ${relativePath}...`);
      let fileBuffer;
      try {
        const contentsUrl = `https://api.github.com/repos/${REPO}/contents/${item.path}?ref=${BRANCH}`;
        const rawHeaders = {
          'User-Agent': 'chrome-profile-manager-updater',
          'Accept': 'application/vnd.github.v3.raw'
        };
        const fileRes = await axios.get(contentsUrl, {
          headers: rawHeaders,
          responseType: 'arraybuffer'
        });
        fileBuffer = Buffer.from(fileRes.data);
      } catch (err) {
        const rawUrl = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${item.path}`;
        const fileRes = await axios.get(rawUrl, {
          responseType: 'arraybuffer'
        });
        fileBuffer = Buffer.from(fileRes.data);
      }

      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.writeFileSync(targetPath, fileBuffer);
    }

    console.log('[AutoUpdater] Updates applied successfully. Restarting server...');

    // Restart server
    const serverJs = path.join(PROJECT_ROOT, 'server.js');
    const child = spawn(process.argv[0], [serverJs], {
      detached: true,
      stdio: 'inherit'
    });
    child.unref();
    process.exit(0);

  } catch (error) {
    console.error('[AutoUpdater] Update check failed:', error.message);
  }
}

module.exports = { checkForUpdates };
