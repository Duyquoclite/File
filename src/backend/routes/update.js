const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { exec, spawn } = require('child_process');
const axios = require('axios');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const PROJECT_ROOT = path.join(__dirname, '..', '..');
const KEY_FILE = path.join(__dirname, '..', '..', 'key.txt');

// Get token from key.txt (returns empty string if not found)
function getUpdateKey() {
  if (!fs.existsSync(KEY_FILE)) {
    return '';
  }
  return fs.readFileSync(KEY_FILE, 'utf8').trim();
}

// Recursively get all project files excluding profile directories, data, node_modules, database files, and key.txt
function getAllFiles(dirPath, arrayOfFiles = {}) {
  const files = fs.readdirSync(dirPath);
  files.forEach(file => {
    const fullPath = path.join(dirPath, file);
    const relativePath = path.relative(PROJECT_ROOT, fullPath).replace(/\\/g, '/');

    // Exclude patterns
    if (
      file === 'node_modules' ||
      file === 'profiles' ||
      file === 'data' ||
      file === '.git' ||
      file === 'key.txt' ||
      file === 'shortcuts' ||
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
        console.warn(`[Update] Skipping unreadable file ${relativePath}:`, err.message);
      }
    }
  });
  return arrayOfFiles;
}

// Check local status (whether the developer key/token exists)
router.get('/status', (req, res) => {
  const token = getUpdateKey();
  return res.json({ success: true, hasKey: token.length > 0 });
});

// 1. Download & Apply GitHub Update (Client/All machines)
router.post('/github-apply', async (req, res) => {
  const { repo, branch } = req.body;
  if (!repo) {
    return res.status(400).json({ success: false, error: 'Thiếu thông tin repository (owner/repo).' });
  }

  const cleanRepo = repo.trim();
  const cleanBranch = (branch || 'main').trim();
  const cleanToken = getUpdateKey();

  const wss = req.app.get('wss');
  const broadcastProgress = (data) => {
    if (!wss) return;
    wss.clients.forEach(client => {
      if (client.readyState === 1) { // OPEN
        client.send(JSON.stringify({
          type: 'github-apply-progress',
          ...data
        }));
      }
    });
  };

  try {
    broadcastProgress({
      status: 'downloading',
      message: 'Đang tải danh sách tệp tin từ GitHub...'
    });

    const headers = {
      'User-Agent': 'chrome-profile-manager-updater',
      'Accept': 'application/vnd.github.v3+json'
    };
    if (cleanToken) {
      headers['Authorization'] = `token ${cleanToken}`;
    }

    const treeUrl = `https://api.github.com/repos/${cleanRepo}/git/trees/${cleanBranch}?recursive=1`;
    const treeRes = await axios.get(treeUrl, { headers });

    if (!treeRes.data || !treeRes.data.tree) {
      throw new Error('Không thể tải cấu trúc thư mục từ GitHub.');
    }

    // Filter to files inside "src/" folder
    const updateItems = treeRes.data.tree.filter(item => item.type === 'blob' && item.path.startsWith('src/'));

    if (updateItems.length === 0) {
      throw new Error('Không tìm thấy tệp tin nào trong thư mục "src" trên GitHub.');
    }

    const totalFiles = updateItems.length;
    let currentCount = 0;

    broadcastProgress({
      status: 'copying',
      percent: 0,
      message: `Bắt đầu tải và cài đặt ${totalFiles} tệp tin...`
    });

    for (const item of updateItems) {
      const relativePath = item.path.substring(4); // Remove "src/" -> "server.js" etc.
      const targetPath = path.join(PROJECT_ROOT, relativePath);

      let fileBuffer;
      try {
        const contentsUrl = `https://api.github.com/repos/${cleanRepo}/contents/${item.path}?ref=${cleanBranch}`;
        const rawHeaders = {
          'User-Agent': 'chrome-profile-manager-updater',
          'Accept': 'application/vnd.github.v3.raw'
        };
        if (cleanToken) {
          rawHeaders['Authorization'] = `token ${cleanToken}`;
        }
        const fileRes = await axios.get(contentsUrl, {
          headers: rawHeaders,
          responseType: 'arraybuffer'
        });
        fileBuffer = Buffer.from(fileRes.data);
      } catch (err) {
        // Fallback to raw github url
        const rawUrl = `https://raw.githubusercontent.com/${cleanRepo}/${cleanBranch}/${item.path}`;
        const fileRes = await axios.get(rawUrl, {
          responseType: 'arraybuffer'
        });
        fileBuffer = Buffer.from(fileRes.data);
      }

      // Write to project root
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.writeFileSync(targetPath, fileBuffer);

      currentCount++;
      const percent = Math.round((currentCount / totalFiles) * 100);

      broadcastProgress({
        status: 'copying',
        fileName: relativePath,
        current: currentCount,
        total: totalFiles,
        percent: percent,
        message: `Đang tải & cập nhật (${currentCount}/${totalFiles}): ${relativePath}...`
      });
    }

    broadcastProgress({
      status: 'success',
      message: 'Cập nhật từ GitHub thành công! Máy chủ sẽ khởi động lại sau 10 giây...'
    });

    res.json({ success: true, message: 'Cập nhật từ GitHub thành công! Máy chủ sẽ khởi động lại sau 10 giây...' });

    // Spawn restart and exit after response
    setTimeout(() => {
      try {
        const outLog = fs.openSync(path.join(DATA_DIR, 'out.log'), 'a');
        const errLog = fs.openSync(path.join(DATA_DIR, 'err.log'), 'a');
        const serverJs = path.join(PROJECT_ROOT, 'server.js');

        const child = spawn(process.argv[0], [serverJs], {
          detached: true,
          stdio: ['ignore', outLog, errLog]
        });
        child.unref();
        process.exit(1);
      } catch (restartErr) {
        console.error('[GitHub Update] Failed to restart server:', restartErr);
        process.exit(1);
      }
    }, 10000);

  } catch (error) {
    console.error('[GitHub Update] Request failed:', error.message);
    const msg = error.response?.status === 404
      ? 'Không tìm thấy repository hoặc token không có quyền truy cập.'
      : error.message;
    broadcastProgress({
      status: 'error',
      message: `Lỗi tải mã nguồn: ${msg}`
    });
    res.status(500).json({ success: false, error: 'Lỗi tải mã nguồn từ GitHub: ' + msg });
  }
});

// 2. Upload/Commit local codebase to GitHub (Developer only)
router.post('/github-push', async (req, res) => {
  const { repo, branch } = req.body;
  if (!repo) {
    return res.status(400).json({ success: false, error: 'Thiếu thông tin repository (owner/repo).' });
  }

  const token = getUpdateKey();
  if (!token) {
    return res.status(403).json({ success: false, error: 'Không tìm thấy token trong key.txt. Bạn không có quyền đẩy mã nguồn.' });
  }

  const cleanRepo = repo.trim();
  const cleanBranch = (branch || 'main').trim();

  const wss = req.app.get('wss');
  const broadcastProgress = (data) => {
    if (!wss) return;
    wss.clients.forEach(client => {
      if (client.readyState === 1) { // OPEN
        client.send(JSON.stringify({
          type: 'github-push-progress',
          ...data
        }));
      }
    });
  };

  try {
    // A. Gather files
    const localFiles = getAllFiles(PROJECT_ROOT);
    const totalFiles = Object.keys(localFiles).length;

    broadcastProgress({
      status: 'start',
      total: totalFiles,
      message: `Bắt đầu chuẩn bị tải lên ${totalFiles} tệp tin...`
    });

    const headers = {
      'User-Agent': 'chrome-profile-manager-updater',
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json'
    };

    // B. Fetch existing files in repo to obtain their current SHAs (to update existing files)
    let fileShaMap = {};
    try {
      broadcastProgress({
        status: 'fetching_tree',
        message: `Đang lấy danh sách file hiện tại từ GitHub...`
      });
      console.log(`[GitHub Push] Fetching file tree for branch: ${cleanBranch}...`);
      const treeUrl = `https://api.github.com/repos/${cleanRepo}/git/trees/${cleanBranch}?recursive=1`;
      const treeRes = await axios.get(treeUrl, { headers });
      if (treeRes.data && treeRes.data.tree) {
        treeRes.data.tree.forEach(item => {
          if (item.type === 'blob') {
            fileShaMap[item.path] = item.sha;
          }
        });
      }
    } catch (treeErr) {
      console.warn('[GitHub Push] Could not fetch tree (assumed empty repository):', treeErr.message);
    }

    // C. Upload each file one by one under 'src/' directory
    let currentCount = 0;
    const uploadedFiles = [];
    for (const [relativePath, fileBuffer] of Object.entries(localFiles)) {
      currentCount++;
      const percent = Math.round((currentCount / totalFiles) * 100);
      const githubPath = `src/${relativePath}`.replace(/\\/g, '/');
      const base64Content = fileBuffer.toString('base64');
      const existingSha = fileShaMap[githubPath];

      broadcastProgress({
        status: 'uploading',
        currentFile: relativePath,
        current: currentCount,
        total: totalFiles,
        percent: percent,
        message: `Đang tải lên (${currentCount}/${totalFiles}): ${relativePath}...`
      });

      console.log(`[GitHub Push] Uploading ${githubPath}...`);

      const payload = {
        message: `Sync ${relativePath}`,
        content: base64Content,
        branch: cleanBranch
      };

      if (existingSha) {
        payload.sha = existingSha;
      }

      try {
        await axios.put(
          `https://api.github.com/repos/${cleanRepo}/contents/${githubPath}`,
          payload,
          { headers }
        );

        uploadedFiles.push(relativePath);

        broadcastProgress({
          status: 'uploaded',
          currentFile: relativePath,
          current: currentCount,
          total: totalFiles,
          percent: percent,
          uploadedFiles: uploadedFiles,
          message: `Đã tải lên: ${relativePath}`
        });

      } catch (uploadErr) {
        console.error(`[GitHub Push] Failed to upload ${githubPath}:`, uploadErr.response?.data || uploadErr.message);
        const details = uploadErr.response?.data?.message || uploadErr.message;
        throw new Error(`Lỗi tải lên file "${relativePath}": ${details}`);
      }
    }

    broadcastProgress({
      status: 'success',
      total: totalFiles,
      uploadedFiles: uploadedFiles,
      message: `Đã đẩy ${totalFiles} tệp tin lên thư mục src của GitHub thành công!`
    });

    res.json({ success: true, message: 'Đã đẩy mã nguồn lên thư mục src của GitHub thành công!' });
  } catch (error) {
    console.error('[GitHub Push] Failed:', error.message);
    broadcastProgress({
      status: 'error',
      message: `Lỗi đẩy mã nguồn: ${error.message}`
    });
    res.status(500).json({ success: false, error: 'Lỗi đẩy mã nguồn lên GitHub: ' + error.message });
  }
});

function copyFolderRecursive(source, target) {
  const files = fs.readdirSync(source);
  files.forEach(file => {
    const curSource = path.join(source, file);
    const curTarget = path.join(target, file);

    // Exclude folders/files
    if (
      file === 'profiles' ||
      file === 'data' ||
      file === 'node_modules' ||
      file === 'key.txt' ||
      file === 'shortcuts' ||
      file.startsWith('db.sqlite')
    ) {
      return;
    }

    const stat = fs.statSync(curSource);
    if (stat.isDirectory()) {
      if (!fs.existsSync(curTarget)) {
        fs.mkdirSync(curTarget, { recursive: true });
      }
      copyFolderRecursive(curSource, curTarget);
    } else {
      fs.mkdirSync(path.dirname(curTarget), { recursive: true });
      fs.copyFileSync(curSource, curTarget);
    }
  });
}

module.exports = router;
