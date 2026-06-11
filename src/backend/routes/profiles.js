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
    const { search, limit = 100, offset = 0 } = req.query;
    let stmt;
    let profiles;

    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      stmt = db.prepare(`
        SELECT * FROM profiles
        WHERE name LIKE ? OR id LIKE ? OR notes LIKE ?
        ORDER BY createdAt DESC
        LIMIT ? OFFSET ?
      `);
      profiles = stmt.all(q, q, q, Number(limit), Number(offset));
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
    const { name, notes, proxy, proxyType, fingerprint: customFingerprint, iconBase64 } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Name is required' });
    }

    const id = uuidv4();
    const fingerprint = customFingerprint && typeof customFingerprint === 'object' && Object.keys(customFingerprint).length > 0
      ? customFingerprint
      : generateFingerprint();

    const proxyCategory = (proxy && proxyType !== 'none') ? 'undetermined' : '';
    const proxyLastIp = req.body.proxyIp || '';

    const stmt = db.prepare(`
      INSERT INTO profiles (id, name, notes, proxy, proxyType, proxyIp, proxyCountry, proxyTimezone, fingerprint, rotationUrl, proxyCategory, proxyLastIp, proxyUnchangedChecks)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      0
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

// ==================== FINGERPRINT SAMPLE for manual selection ====
router.get('/fingerprint-sample', (req, res) => {
  try {
    const fingerprint = generateFingerprint();
    res.json({ success: true, data: fingerprint });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== CREATE multiple profiles ====================
router.post('/bulk-create', (req, res) => {
  try {
    const { count = 1, namePrefix = 'Profile', startIndex = 1, proxy, proxyType } = req.body;
    const start = Number(startIndex);
    const created = [];

    const proxyCategory = (proxy && proxyType !== 'none') ? 'undetermined' : '';
    const proxyLastIp = req.body.proxyIp || '';

    const stmt = db.prepare(`
      INSERT INTO profiles (id, name, notes, proxy, proxyType, proxyIp, proxyCountry, proxyTimezone, fingerprint, proxyCategory, proxyLastIp, proxyUnchangedChecks)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          0
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
      INSERT INTO profiles (id, name, notes, proxy, proxyType, proxyIp, proxyCountry, proxyTimezone, fingerprint, proxyCategory, proxyLastIp, proxyUnchangedChecks)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      sourceProfile.proxyUnchangedChecks || 0
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

module.exports = router;

