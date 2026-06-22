const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const AdmZip = require('adm-zip');

const EXTENSIONS_DIR = path.join(__dirname, '..', '..', 'extensions');
if (!fs.existsSync(EXTENSIONS_DIR)) {
  fs.mkdirSync(EXTENSIONS_DIR, { recursive: true });
}

/**
 * Extract zip payload from CRX file if necessary
 * @param {Buffer} buf
 * @returns {Buffer}
 */
function crxToZip(buf) {
  if (buf.length < 16) return buf;
  if (buf.readUInt32BE(0) !== 0x43723234) { // 'Cr24'
    return buf; // Already a standard ZIP
  }
  try {
    const version = buf.readUInt32LE(4);
    if (version === 2) {
      const publicKeyLength = buf.readUInt32LE(8);
      const signatureLength = buf.readUInt32LE(12);
      const offset = 16 + publicKeyLength + signatureLength;
      if (buf.length > offset) {
        return buf.slice(offset);
      }
    } else if (version === 3) {
      const headerLength = buf.readUInt32LE(8);
      const offset = 12 + headerLength;
      if (buf.length > offset) {
        return buf.slice(offset);
      }
    }
  } catch (e) {
    console.error('[Extensions] Error stripping CRX header:', e.message);
  }
  return buf;
}

// GET /api/extensions - List all installed extensions
router.get('/', (req, res) => {
  try {
    if (!fs.existsSync(EXTENSIONS_DIR)) {
      return res.json({ success: true, data: [] });
    }

    const items = fs.readdirSync(EXTENSIONS_DIR);
    const list = [];

    for (const item of items) {
      const itemPath = path.join(EXTENSIONS_DIR, item);
      const stat = fs.statSync(itemPath);
      if (stat.isDirectory()) {
        const manifestPath = path.join(itemPath, 'manifest.json');
        if (fs.existsSync(manifestPath)) {
          try {
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            list.push({
              id: item,
              name: manifest.name || item,
              version: manifest.version || '1.0',
              description: manifest.description || 'Không có mô tả.',
            });
          } catch (e) {
            list.push({
              id: item,
              name: item,
              version: '?',
              description: 'Lỗi đọc manifest.json: ' + e.message,
            });
          }
        } else {
          list.push({
            id: item,
            name: item,
            version: 'N/A',
            description: 'Thư mục extension trống (không có manifest.json).',
          });
        }
      }
    }

    res.json({ success: true, data: list });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/extensions/chrome-web-store - Download extension from Store
router.post('/chrome-web-store', async (req, res) => {
  try {
    const { urlOrId } = req.body;
    if (!urlOrId || !urlOrId.trim()) {
      return res.status(400).json({ success: false, error: 'Thiếu link hoặc ID tiện ích.' });
    }

    // Extract 32-char ID
    const match = urlOrId.trim().match(/([a-z]{32})/i);
    if (!match) {
      return res.status(400).json({ success: false, error: 'ID tiện ích không hợp lệ (phải là chuỗi 32 ký tự chữ).' });
    }
    const extensionId = match[1].toLowerCase();
    const targetDir = path.join(EXTENSIONS_DIR, extensionId);

    const downloadUrl = `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=110.0.0.0&acceptformat=crx2,crx3&x=id%3D${extensionId}%26uc`;

    console.log(`[Extensions] Downloading ${extensionId} from Chrome Web Store...`);
    const response = await axios.get(downloadUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    const zipBuffer = crxToZip(Buffer.from(response.data));
    const zip = new AdmZip(zipBuffer);

    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
    fs.mkdirSync(targetDir, { recursive: true });

    zip.extractAllTo(targetDir, true);

    // Verify manifest.json exists
    let extName = extensionId;
    const manifestPath = path.join(targetDir, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        extName = manifest.name || extName;
      } catch (e) {}
    }

    res.json({ success: true, data: { id: extensionId, name: extName } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Lỗi tải/giải nén tiện ích: ' + error.message });
  }
});

// POST /api/extensions/upload - Upload base64 zip/crx extension
router.post('/upload', async (req, res) => {
  try {
    const { filename, base64 } = req.body;
    if (!filename || !base64) {
      return res.status(400).json({ success: false, error: 'Thiếu thông tin tệp tin tải lên.' });
    }

    const cleanName = filename.replace(/\.(zip|crx)$/i, '').replace(/[^a-zA-Z0-9_\-]/g, '_');
    const targetDir = path.join(EXTENSIONS_DIR, cleanName);

    const fileBuffer = Buffer.from(base64, 'base64');
    const zipBuffer = crxToZip(fileBuffer);
    const zip = new AdmZip(zipBuffer);

    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
    fs.mkdirSync(targetDir, { recursive: true });

    zip.extractAllTo(targetDir, true);

    res.json({ success: true, data: { name: cleanName } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Lỗi giải nén tệp tải lên: ' + error.message });
  }
});

// DELETE /api/extensions/:id - Delete an extension
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const targetDir = path.join(EXTENSIONS_DIR, id);

    if (!fs.existsSync(targetDir)) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy tiện ích.' });
    }

    fs.rmSync(targetDir, { recursive: true, force: true });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
