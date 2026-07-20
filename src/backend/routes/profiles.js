/**
 * Profile API Routes
 * CRUD operations + bulk open/close for Chrome profiles.
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { generateFingerprint } = require('../services/fingerprintService');
const chromeService = require('../services/chromeService');
const path = require('path');
const fs = require('fs');

// ==================== GET all profiles (with search) ====================
router.get('/', (req, res) => {
  try {
    // Automatically sync profiles folder with database to restore any deleted folders
    if (typeof db.syncProfiles === 'function') {
      db.syncProfiles();
    }
    const { search, limit = 10000, offset = 0 } = req.query;
    let stmt;
    let profiles;

    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      stmt = db.prepare(`
        SELECT * FROM profiles
        WHERE name LIKE ? OR id LIKE ? OR notes LIKE ? OR tags LIKE ?
        ORDER BY createdAt DESC
        LIMIT ? OFFSET ?
      `);
      profiles = stmt.all(q, q, q, q, Number(limit), Number(offset));
    } else {
      stmt = db.prepare('SELECT * FROM profiles ORDER BY createdAt DESC LIMIT ? OFFSET ?');
      profiles = stmt.all(Number(limit), Number(offset));
    }

    // Add running status and check for custom icon
    profiles = profiles.map(p => {
      const profileDir = path.join(__dirname, '..', '..', 'profiles', p.id);
      const hasCustomIcon = fs.existsSync(path.join(profileDir, 'icon.ico'));
      return {
        ...p,
        fingerprint: JSON.parse(p.fingerprint || '{}'),
        isRunning: chromeService.isRunning(p.id),
        hasCustomIcon,
      };
    });

    const countStmt = db.prepare('SELECT COUNT(*) as total FROM profiles');
    const { total } = countStmt.get();

    res.json({ success: true, data: { profiles, total } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});



// ==================== FINGERPRINT SAMPLE for manual selection ====
router.get('/fingerprint-sample', (req, res) => {
  try {
    const fingerprint = generateFingerprint();
    res.json({ success: true, data: fingerprint });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== GET single profile ====================
router.get('/:id', (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM profiles WHERE id = ?');
    const profile = stmt.get(req.params.id);
    if (!profile) {
      return res.status(404).json({ success: false, error: 'Profile not found' });
    }
    profile.fingerprint = JSON.parse(profile.fingerprint || '{}');
    profile.isRunning = chromeService.isRunning(profile.id);
    const profileDir = path.join(__dirname, '..', '..', 'profiles', profile.id);
    profile.hasCustomIcon = fs.existsSync(path.join(profileDir, 'icon.ico'));
    res.json({ success: true, data: profile });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== CREATE profile ====================
router.post('/', (req, res) => {
  try {
    const { name, notes, proxy, proxyType, fingerprint: customFingerprint, iconBase64, tags, proxyLat, proxyLon } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Name is required' });
    }

    const id = uuidv4();
    const fingerprint = customFingerprint && typeof customFingerprint === 'object' && Object.keys(customFingerprint).length > 0
      ? customFingerprint
      : generateFingerprint();

    const proxyCategory = (proxy && proxyType !== 'none') ? 'undetermined' : '';
    const proxyLastIp = req.body.proxyIp || '';
    const finalTags = Array.isArray(tags) ? tags.join(',') : (tags ? String(tags).trim() : '');

    const stmt = db.prepare(`
      INSERT INTO profiles (id, name, notes, proxy, proxyType, proxyIp, proxyCountry, proxyTimezone, fingerprint, rotationUrl, proxyCategory, proxyLastIp, proxyUnchangedChecks, tags, proxyLat, proxyLon)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      name.trim(),
      notes || '',
      proxy || '',
      proxyType || 'none',
      req.body.proxyIp || '',
      req.body.proxyCountry || '',
      req.body.proxyTimezone || '',
      JSON.stringify(fingerprint),
      '',
      proxyCategory,
      proxyLastIp,
      0,
      finalTags,
      proxyLat || '',
      proxyLon || ''
    );

    // Create the user-data directory
    const profileDir = path.join(__dirname, '..', '..', 'profiles', id);
    fs.mkdirSync(profileDir, { recursive: true });

    if (iconBase64) {
      const iconPath = path.join(profileDir, 'icon.ico');
      fs.writeFileSync(iconPath, Buffer.from(iconBase64, 'base64'));
    }

    res.json({ success: true, data: { id, name: name.trim(), fingerprint } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== CREATE multiple profiles ====================
router.post('/bulk-create', (req, res) => {
  try {
    const { count = 1, namePrefix = 'Profile', startIndex = 1, proxy, proxyType, tags, proxyLat, proxyLon } = req.body;
    const start = Number(startIndex);
    const created = [];

    const proxyCategory = (proxy && proxyType !== 'none') ? 'undetermined' : '';
    const proxyLastIp = req.body.proxyIp || '';
    const finalTags = Array.isArray(tags) ? tags.join(',') : (tags ? String(tags).trim() : '');

    const stmt = db.prepare(`
      INSERT INTO profiles (id, name, notes, proxy, proxyType, proxyIp, proxyCountry, proxyTimezone, fingerprint, proxyCategory, proxyLastIp, proxyUnchangedChecks, tags, proxyLat, proxyLon)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((count) => {
      // Determine padding width based on the highest index
      const maxIndex = start + count - 1;
      const padWidth = String(maxIndex).length;
      for (let i = 0; i < count; i++) {
        const id = uuidv4();
        const index = i + start;
        const paddedIndex = String(index).padStart(padWidth, '0');
        const name = `${namePrefix} ${paddedIndex}`;
        const fingerprint = generateFingerprint();

        stmt.run(
          id,
          name,
          '',
          proxy || '',
          proxyType || 'none',
          req.body.proxyIp || '',
          req.body.proxyCountry || '',
          req.body.proxyTimezone || '',
          JSON.stringify(fingerprint),
          proxyCategory,
          proxyLastIp,
          0,
          finalTags,
          proxyLat || '',
          proxyLon || ''
        );
        fs.mkdirSync(path.join(__dirname, '..', '..', 'profiles', id), { recursive: true });
        created.push({ id, name });
      }
    });

    insertMany(Number(count));
    res.json({ success: true, data: { created, count: created.length } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== UPDATE profile ====================
router.put('/:id', (req, res) => {
  try {
    const { name, notes, proxy, proxyType, fingerprint } = req.body;
    const stmt = db.prepare('SELECT * FROM profiles WHERE id = ?');
    const profile = stmt.get(req.params.id);
    if (!profile) {
      return res.status(404).json({ success: false, error: 'Profile not found' });
    }

    const finalProxy = proxy !== undefined ? proxy : profile.proxy;
    const finalProxyType = proxyType !== undefined ? proxyType : profile.proxyType;

    let proxyCategory = profile.proxyCategory;
    let proxyLastIp = profile.proxyLastIp;
    let proxyUnchangedChecks = profile.proxyUnchangedChecks;

    if (finalProxy !== profile.proxy || finalProxyType !== profile.proxyType) {
      proxyCategory = (finalProxy && finalProxyType !== 'none') ? 'undetermined' : '';
      proxyLastIp = '';
      proxyUnchangedChecks = 0;
    }

    const proxyIpParam = Object.prototype.hasOwnProperty.call(req.body, 'proxyIp') ? req.body.proxyIp : null;
    const proxyCountryParam = Object.prototype.hasOwnProperty.call(req.body, 'proxyCountry') ? req.body.proxyCountry : null;
    const proxyTimezoneParam = Object.prototype.hasOwnProperty.call(req.body, 'proxyTimezone') ? req.body.proxyTimezone : null;
    const fingerprintParam = fingerprint !== undefined ? JSON.stringify(fingerprint) : null;

    if (proxyIpParam !== null) {
      proxyLastIp = proxyIpParam;
    }

    const finalTags = req.body.tags !== undefined
      ? (Array.isArray(req.body.tags) ? req.body.tags.join(',') : String(req.body.tags).trim())
      : null;
    const proxyLatParam = req.body.proxyLat !== undefined ? req.body.proxyLat : null;
    const proxyLonParam = req.body.proxyLon !== undefined ? req.body.proxyLon : null;

    const updateStmt = db.prepare(`
      UPDATE profiles SET
        name = COALESCE(?, name),
        notes = COALESCE(?, notes),
        proxy = COALESCE(?, proxy),
        proxyType = COALESCE(?, proxyType),
        proxyIp = CASE WHEN ? IS NULL THEN proxyIp ELSE ? END,
        proxyCountry = CASE WHEN ? IS NULL THEN proxyCountry ELSE ? END,
        proxyTimezone = CASE WHEN ? IS NULL THEN proxyTimezone ELSE ? END,
        rotationUrl = COALESCE(?, rotationUrl),
        proxyCategory = ?,
        proxyLastIp = ?,
        proxyUnchangedChecks = ?,
        fingerprint = CASE WHEN ? IS NULL THEN fingerprint ELSE ? END,
        tags = CASE WHEN ? IS NULL THEN tags ELSE ? END,
        proxyLat = CASE WHEN ? IS NULL THEN proxyLat ELSE ? END,
        proxyLon = CASE WHEN ? IS NULL THEN proxyLon ELSE ? END,
        updatedAt = datetime('now')
      WHERE id = ?
    `);

    updateStmt.run(name, notes, proxy, proxyType,
      proxyIpParam, proxyIpParam,
      proxyCountryParam, proxyCountryParam,
      proxyTimezoneParam, proxyTimezoneParam,
      null,
      proxyCategory,
      proxyLastIp,
      proxyUnchangedChecks,
      fingerprintParam, fingerprintParam,
      finalTags, finalTags,
      proxyLatParam, proxyLatParam,
      proxyLonParam, proxyLonParam,
      req.params.id);

    res.json({ success: true, data: { id: req.params.id } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== REGENERATE fingerprint ====================
router.post('/:id/regenerate-fingerprint', (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM profiles WHERE id = ?');
    const profile = stmt.get(req.params.id);
    if (!profile) {
      return res.status(404).json({ success: false, error: 'Profile not found' });
    }

    if (chromeService.isRunning(req.params.id)) {
      return res.status(400).json({ success: false, error: 'Cannot regenerate fingerprint while profile is running' });
    }

    const fingerprint = generateFingerprint();
    const updateStmt = db.prepare('UPDATE profiles SET fingerprint = ?, updatedAt = datetime(\'now\') WHERE id = ?');
    updateStmt.run(JSON.stringify(fingerprint), req.params.id);

    res.json({ success: true, data: { fingerprint } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== DUPLICATE profile ====================
router.post('/:id/duplicate', async (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM profiles WHERE id = ?');
    const sourceProfile = stmt.get(req.params.id);
    if (!sourceProfile) {
      return res.status(404).json({ success: false, error: 'Profile not found' });
    }

    const newId = uuidv4();
    const newName = `${sourceProfile.name} - Copy`;
    
    // Copy the user-data directory to clone cookies and sessions
    const sourceDir = path.join(__dirname, '..', '..', 'profiles', req.params.id);
    const destDir = path.join(__dirname, '..', '..', 'profiles', newId);
    
    if (fs.existsSync(sourceDir)) {
      // Use fs.cpSync for recursive copy
      fs.cpSync(sourceDir, destDir, { recursive: true });
    } else {
      fs.mkdirSync(destDir, { recursive: true });
    }

    const insertStmt = db.prepare(`
      INSERT INTO profiles (id, name, notes, proxy, proxyType, proxyIp, proxyCountry, proxyTimezone, fingerprint, proxyCategory, proxyLastIp, proxyUnchangedChecks, tags, proxyLat, proxyLon)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    insertStmt.run(
      newId,
      newName,
      sourceProfile.notes,
      sourceProfile.proxy,
      sourceProfile.proxyType,
      sourceProfile.proxyIp || '',
      sourceProfile.proxyCountry || '',
      sourceProfile.proxyTimezone || '',
      sourceProfile.fingerprint,
      sourceProfile.proxyCategory || '',
      sourceProfile.proxyLastIp || '',
      sourceProfile.proxyUnchangedChecks || 0,
      sourceProfile.tags || '',
      sourceProfile.proxyLat || '',
      sourceProfile.proxyLon || ''
    );

    res.json({ success: true, data: { id: newId, name: newName } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== DELETE profile ====================
router.delete('/:id', async (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM profiles WHERE id = ?');
    const profile = stmt.get(req.params.id);
    if (!profile) {
      return res.status(404).json({ success: false, error: 'Profile not found' });
    }

    // Close if running
    if (chromeService.isRunning(req.params.id)) {
      await chromeService.closeProfile(req.params.id);
    }

    const delStmt = db.prepare('DELETE FROM profiles WHERE id = ?');
    delStmt.run(req.params.id);

    // Delete scripts
    const scriptStmt = db.prepare('DELETE FROM scripts WHERE profileId = ?');
    scriptStmt.run(req.params.id);

    // Delete user-data directory
    const profileDir = path.join(__dirname, '..', '..', 'profiles', req.params.id);
    if (fs.existsSync(profileDir)) {
      fs.rmSync(profileDir, { recursive: true, force: true });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== OPEN profile (launch Chrome) ====================
router.post('/:id/open', async (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM profiles WHERE id = ?');
    const profile = stmt.get(req.params.id);
    if (!profile) {
      return res.status(404).json({ success: false, error: 'Profile not found' });
    }

    const result = await chromeService.launchProfile(profile);
    if (result.success) {
      db.prepare('UPDATE profiles SET status = ?, openCount = COALESCE(openCount, 0) + 1 WHERE id = ?').run('running', req.params.id);
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== CLOSE profile ====================
router.post('/:id/close', async (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM profiles WHERE id = ?');
    const profile = stmt.get(req.params.id);
    if (!profile) {
      return res.status(404).json({ success: false, error: 'Profile not found' });
    }

    const result = await chromeService.closeProfile(req.params.id);
    if (result.success) {
      db.prepare('UPDATE profiles SET status = ? WHERE id = ?').run('closed', req.params.id);
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== BULK OPEN ====================
router.post('/bulk-open', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ success: false, error: 'ids array is required' });
    }

    const results = {};
    const stmt = db.prepare('SELECT * FROM profiles WHERE id = ?');

    for (const id of ids) {
      const profile = stmt.get(id);
      if (!profile) {
        results[id] = { success: false, error: 'Not found' };
        continue;
      }
      results[id] = await chromeService.launchProfile(profile);
      if (results[id].success) {
        db.prepare('UPDATE profiles SET status = ?, openCount = COALESCE(openCount, 0) + 1 WHERE id = ?').run('running', id);
      }
    }

    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== BULK CLOSE ====================
router.post('/bulk-close', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ success: false, error: 'ids array is required' });
    }

    const results = {};
    const stmt = db.prepare('SELECT * FROM profiles WHERE id = ?');

    for (const id of ids) {
      const profile = stmt.get(id);
      if (!profile) {
        results[id] = { success: false, error: 'Not found' };
        continue;
      }
      results[id] = await chromeService.closeProfile(id);
      if (results[id].success) {
        db.prepare('UPDATE profiles SET status = ? WHERE id = ?').run('closed', id);
      }
    }

    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== BULK DELETE ====================
router.post('/bulk-delete', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ success: false, error: 'ids array is required' });
    }

    const stmt = db.prepare('SELECT * FROM profiles WHERE id = ?');

    for (const id of ids) {
      const profile = stmt.get(id);
      if (!profile) continue;

      if (chromeService.isRunning(id)) {
        await chromeService.closeProfile(id);
      }
      db.prepare('DELETE FROM profiles WHERE id = ?').run(id);
      db.prepare('DELETE FROM scripts WHERE profileId = ?').run(id);
      const profileDir = path.join(__dirname, '..', '..', 'profiles', id);
      if (fs.existsSync(profileDir)) {
        fs.rmSync(profileDir, { recursive: true, force: true });
      }
    }

    res.json({ success: true, data: { deleted: ids.length } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});



router.get('/status/running', (req, res) => {
  const running = chromeService.getRunningProfiles();
  const runningIds = Object.keys(running);
  res.json({ success: true, data: runningIds });
});

const cookieService = require('../services/cookieService');

// ==================== GET Profile Cookies ====================
router.get('/:id/cookies', (req, res) => {
  const profileId = req.params.id;
  const { domain } = req.query;
  
  try {
    const stmt = db.prepare('SELECT id FROM profiles WHERE id = ?');
    const profile = stmt.get(profileId);
    if (!profile) {
      return res.status(404).json({ success: false, error: 'Profile not found' });
    }

    if (domain) {
      const data = cookieService.getCookiesForDomain(profileId, domain);
      res.json({ success: true, data });
    } else {
      const data = cookieService.getCookiesList(profileId);
      res.json({ success: true, data });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== PUT/SAVE Profile Cookies ====================
router.put('/:id/cookies', (req, res) => {
  const profileId = req.params.id;
  const { domain, format, content } = req.body;
  
  if (!domain || !format || content === undefined) {
    return res.status(400).json({ success: false, error: 'domain, format and content are required' });
  }

  try {
    const stmt = db.prepare('SELECT id FROM profiles WHERE id = ?');
    const profile = stmt.get(profileId);
    if (!profile) {
      return res.status(404).json({ success: false, error: 'Profile not found' });
    }

    // Safety check: is profile running?
    if (chromeService.isRunning(profileId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Trình duyệt đang chạy. Vui lòng đóng trình duyệt trước khi cập nhật cookie.' 
      });
    }

    let parsedCookies = [];
    if (format === 'json') {
      try {
        const rawList = JSON.parse(content);
        if (!Array.isArray(rawList)) {
          return res.status(400).json({ success: false, error: 'JSON format must be a list of cookie objects' });
        }
        
        parsedCookies = rawList.map(c => {
          if (!c.name || c.value === undefined) {
            throw new Error('Mỗi cookie trong JSON phải có "name" và "value"');
          }
          // Translate keys if standard EditThisCookie or similar is used
          const sameSiteMap = {
            'no_restriction': 0,
            'lax': 1,
            'strict': 2,
            'unspecified': -1
          };
          let sameSiteVal = 1;
          if (c.sameSite !== undefined) {
            if (typeof c.sameSite === 'string') {
              sameSiteVal = sameSiteMap[c.sameSite.toLowerCase()] !== undefined ? sameSiteMap[c.sameSite.toLowerCase()] : 1;
            } else {
              sameSiteVal = c.sameSite;
            }
          }

          return {
            name: c.name,
            value: c.value,
            domain: c.domain || c.host || domain,
            path: c.path || '/',
            secure: c.secure !== undefined ? c.secure : true,
            httpOnly: c.httpOnly !== undefined ? c.httpOnly : false,
            sameSite: sameSiteVal,
            expires: c.expirationDate || c.expires || c.expires_utc
          };
        });
      } catch (err) {
        return res.status(400).json({ success: false, error: 'Lỗi cú pháp JSON: ' + err.message });
      }
    } else if (format === 'raw') {
      // Parse raw name=value string
      const pairs = content.split(';');
      for (let pair of pairs) {
        pair = pair.trim();
        if (!pair) continue;
        const eqIdx = pair.indexOf('=');
        if (eqIdx === -1) continue;
        const name = pair.slice(0, eqIdx).trim();
        const value = pair.slice(eqIdx + 1).trim();
        if (name) {
          parsedCookies.push({
            name,
            value,
            domain,
            path: '/',
            secure: true,
            httpOnly: false,
            sameSite: 1,
            expires: Math.floor(Date.now() / 1000) + 365 * 24 * 3600
          });
        }
      }
    } else {
      return res.status(400).json({ success: false, error: 'Invalid format type. Expected "json" or "raw"' });
    }

    cookieService.saveCookiesForDomain(profileId, domain, parsedCookies);
    res.json({ success: true, message: 'Đã cập nhật cookie thành công!' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

function getProxyUrl(proxy, proxyType) {
  let proxyStr = proxy.trim();
  let scheme = proxyType || 'http';
  
  if (proxyStr.includes('://')) {
    const parts = proxyStr.split('://');
    scheme = parts[0];
    proxyStr = parts[1];
  }
  
  const parts = proxyStr.split(':');
  if (parts.length === 4) {
    const [host, port, user, pass] = parts;
    proxyStr = `${user}:${pass}@${host}:${port}`;
  }
  
  return `${scheme}://${proxyStr}`;
}

// ==================== POST Check FB status for a single profile ====================
router.post('/:id/check-fb-status', async (req, res) => {
  const { id } = req.params;
  try {
    const stmt = db.prepare('SELECT * FROM profiles WHERE id = ?');
    const profile = stmt.get(id);
    if (!profile) {
      return res.status(404).json({ success: false, error: 'Profile không tồn tại trong CSDL' });
    }

    const axios = require('axios');
    const fbId = cookieService.getFacebookUserId(id);
    if (!fbId) {
      return res.json({
        success: true,
        data: {
          id,
          name: profile.name,
          hasCookie: false,
          isLive: false,
          reason: 'Không có cookie c_user (Chưa đăng nhập FB)'
        }
      });
    }

    // Check status using Axios (Direct connection without using profile proxy)
    const url = `https://m.facebook.com/profile.php?id=${fbId}`;
    const axiosOptions = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      maxRedirects: 5,
      validateStatus: () => true,
      timeout: 5000 // Direct connection should load extremely fast
    };

    try {
      const response = await axios.get(url, axiosOptions);
      const html = response.data;
      
      const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : '';

      const isLive = title !== '' && title.toLowerCase() !== 'facebook' && title.toLowerCase() !== 'error';
      res.json({
        success: true,
        data: {
          id,
          name: profile.name,
          hasCookie: true,
          fbId,
          isLive,
          title: isLive ? title : 'N/A',
          reason: isLive ? 'Sống' : 'Tài khoản bị Khóa/Die hoặc link không tồn tại'
        }
      });
    } catch (err) {
      let errReason = err.message;
      if (err.code === 'ECONNABORTED' || err.message.includes('timeout')) {
        errReason = 'Lỗi kết nối (Timeout 5s)';
      }
      res.json({
        success: true,
        data: {
          id,
          name: profile.name,
          hasCookie: true,
          fbId,
          isLive: false,
          reason: errReason
        }
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Helper to safely parse JSON from a Response object (handles non-JSON errors, e.g. HTML or blank response)
async function safeJson(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch (err) {
    return { error: { message: text.substring(0, 300) || 'Phản hồi trống hoặc không hợp lệ từ máy chủ Microsoft' } };
  }
}

// ==================== POST Mail Checker: List Emails ====================
router.post('/mail-checker/list', async (req, res) => {
  const { token, clientId, folder = 'inbox' } = req.body;
  if (!token) {
    return res.status(400).json({ success: false, error: 'Token is required' });
  }

  try {
    let accessToken = token;
    const activeClientId = (clientId && clientId.trim()) ? clientId.trim() : '9e5f94bc-e8a4-4e73-b8be-63364c29d753';

    // Auto-detect: If token starts with 'ey' and contains dots, it is a JWT access_token.
    // Otherwise, treat it as a refresh_token and exchange it.
    const isAccessToken = token.startsWith('ey') && token.includes('.');
    
    if (!isAccessToken) {
      const payload = new URLSearchParams({
        client_id: activeClientId,
        refresh_token: token,
        grant_type: 'refresh_token'
      });

      const tokenResponse = await fetch('https://login.live.com/oauth20_token.srf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: payload
      });

      const tokenData = await safeJson(tokenResponse);
      if (!tokenResponse.ok) {
        return res.json({ success: false, error: 'Không thể giải mã Refresh Token hoặc Client ID không đúng: ' + JSON.stringify(tokenData) });
      }
      accessToken = tokenData.access_token;
    }

    let emails = [];
    let apiUsed = 'graph';
    let graphSuccess = false;

    // Fetch both inbox and junkemail if folder is 'inbox'
    if (folder === 'inbox') {
      try {
        const [inboxRes, junkRes] = await Promise.all([
          fetch(`https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$select=id,subject,from,receivedDateTime&$top=15`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          }),
          fetch(`https://graph.microsoft.com/v1.0/me/mailFolders/junkemail/messages?$select=id,subject,from,receivedDateTime&$top=15`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          }).catch(err => {
            console.error('[MailChecker] Graph API Junk fetch failed:', err);
            return null;
          })
        ]);

        if (inboxRes && inboxRes.ok) {
          graphSuccess = true;
          const inboxData = await safeJson(inboxRes);
          const inboxEmails = (inboxData.value || []).map(email => ({ ...email, folder: 'inbox' }));
          emails.push(...inboxEmails);

          if (junkRes && junkRes.ok) {
            const junkData = await safeJson(junkRes);
            const junkEmails = (junkData.value || []).map(email => ({ ...email, folder: 'junk' }));
            emails.push(...junkEmails);
          }
        }
      } catch (err) {
        console.error('[MailChecker] Graph API error:', err);
      }
    } else {
      try {
        const mailResponse = await fetch(`https://graph.microsoft.com/v1.0/me/mailFolders/${folder}/messages?$select=id,subject,from,receivedDateTime&$top=15`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });
        if (mailResponse.ok) {
          graphSuccess = true;
          const mailData = await safeJson(mailResponse);
          emails = (mailData.value || []).map(email => ({ ...email, folder }));
        }
      } catch (err) {
        console.error('[MailChecker] Graph API specific folder error:', err);
      }
    }

    if (graphSuccess) {
      emails.sort((a, b) => new Date(b.receivedDateTime) - new Date(a.receivedDateTime));
      return res.json({
        success: true,
        apiUsed: 'graph',
        accessToken,
        emails
      });
    }

    // Fallback to Outlook REST API v2.0 if Graph fails
    console.log('[MailChecker] Graph API failed or skipped, falling back to Outlook REST API v2.0...');
    let outlookSuccess = false;
    let outlookEmails = [];

    if (folder === 'inbox') {
      try {
        const [outlookInboxRes, outlookJunkRes] = await Promise.all([
          fetch(`https://outlook.office.com/api/v2.0/me/MailFolders/Inbox/messages?$select=Id,Subject,From,ReceivedDateTime&$top=15`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          }),
          fetch(`https://outlook.office.com/api/v2.0/me/MailFolders/JunkEmail/messages?$select=Id,Subject,From,ReceivedDateTime&$top=15`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          }).catch(err => {
            console.error('[MailChecker] Outlook API Junk fetch failed:', err);
            return null;
          })
        ]);

        if (outlookInboxRes && outlookInboxRes.ok) {
          outlookSuccess = true;
          const inboxData = await safeJson(outlookInboxRes);
          const inboxMails = (inboxData.value || []).map(email => ({ ...email, folder: 'inbox' }));
          outlookEmails.push(...inboxMails);

          if (outlookJunkRes && outlookJunkRes.ok) {
            const junkData = await safeJson(outlookJunkRes);
            const junkMails = (junkData.value || []).map(email => ({ ...email, folder: 'junk' }));
            outlookEmails.push(...junkMails);
          }
        }
      } catch (err) {
        console.error('[MailChecker] Outlook API error:', err);
      }
    } else {
      try {
        const outlookResponse = await fetch(`https://outlook.office.com/api/v2.0/me/MailFolders/${folder}/messages?$select=Id,Subject,From,ReceivedDateTime&$top=15`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });
        if (outlookResponse.ok) {
          outlookSuccess = true;
          const outlookData = await safeJson(outlookResponse);
          outlookEmails = (outlookData.value || []).map(email => ({ ...email, folder }));
        }
      } catch (err) {
        console.error('[MailChecker] Outlook API specific folder error:', err);
      }
    }

    if (outlookSuccess) {
      const normalizedEmails = outlookEmails.map(email => ({
        id: email.Id || email.id,
        subject: email.Subject || email.subject,
        receivedDateTime: email.ReceivedDateTime || email.receivedDateTime,
        folder: email.folder,
        from: email.From ? {
          emailAddress: {
            address: email.From.EmailAddress?.Address || email.From.emailAddress?.address || ''
          }
        } : (email.from || null)
      }));

      normalizedEmails.sort((a, b) => new Date(b.receivedDateTime) - new Date(a.receivedDateTime));

      return res.json({
        success: true,
        apiUsed: 'outlook_v2',
        accessToken,
        emails: normalizedEmails
      });
    }

    res.json({ success: false, error: 'Lỗi lấy danh sách thư từ cả Graph API và Outlook REST API.' });

  } catch (error) {
    res.status(500).json({ success: false, error: 'Lỗi liên kết máy chủ: ' + error.message });
  }
});

// ==================== POST Mail Checker: Get Email Detail ====================
router.post('/mail-checker/detail', async (req, res) => {
  const { accessToken, messageId, apiUsed = 'graph' } = req.body;
  if (!accessToken || !messageId) {
    return res.status(400).json({ success: false, error: 'accessToken and messageId are required' });
  }

  try {
    // If list API succeeded using Outlook v2, try Outlook v2 for details first
    if (apiUsed === 'outlook_v2') {
      const outlookEndpoint = `https://outlook.office.com/api/v2.0/me/messages/${messageId}?$select=Subject,Body`;
      const response = await fetch(outlookEndpoint, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await safeJson(response);
      if (response.ok) {
        return res.json({
          success: true,
          subject: data.Subject || '',
          body: data.Body?.Content || ''
        });
      }
    }

    // Try Graph API
    const graphEndpoint = `https://graph.microsoft.com/v1.0/me/messages/${messageId}?$select=subject,body`;
    const response = await fetch(graphEndpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await safeJson(response);
    if (response.ok) {
      return res.json({
        success: true,
        subject: data.subject || '',
        body: data.body?.content || ''
      });
    }

    // Graph failed, try Outlook v2 fallback
    const outlookEndpoint = `https://outlook.office.com/api/v2.0/me/messages/${messageId}?$select=Subject,Body`;
    const fallbackResponse = await fetch(outlookEndpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    const fallbackData = await safeJson(fallbackResponse);
    if (fallbackResponse.ok) {
      return res.json({
        success: true,
        subject: fallbackData.Subject || '',
        body: fallbackData.Body?.Content || ''
      });
    }

    res.json({ success: false, error: 'Lỗi tải chi tiết thư: ' + (fallbackData.error?.message || JSON.stringify(fallbackData)) });

  } catch (error) {
    res.status(500).json({ success: false, error: 'Lỗi kết nối: ' + error.message });
  }
});

module.exports = router;

