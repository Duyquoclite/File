/**
 * Automation API Routes
 * Upload, save, and run raw JavaScript scripts on Chrome profiles.
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const chromeService = require('../services/chromeService');

// ==================== GET scripts for a profile ====================
router.get('/:profileId/scripts', (req, res) => {
  try {
    const owner = req.user.username;
    const profile = db.prepare('SELECT * FROM profiles WHERE id = ? AND owner = ?').get(req.params.profileId, owner);
    if (!profile) return res.status(404).json({ success: false, error: 'Profile not found' });

    const stmt = db.prepare('SELECT * FROM scripts WHERE profileId = ? ORDER BY createdAt DESC');
    const scripts = stmt.all(req.params.profileId);
    res.json({ success: true, data: scripts });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== SAVE a script ====================
router.post('/:profileId/scripts', (req, res) => {
  try {
    const { name, code } = req.body;
    const owner = req.user.username;
    const profile = db.prepare('SELECT * FROM profiles WHERE id = ? AND owner = ?').get(req.params.profileId, owner);
    if (!profile) return res.status(404).json({ success: false, error: 'Profile not found' });

    if (!name || !code) {
      return res.status(400).json({ success: false, error: 'name and code are required' });
    }

    const id = uuidv4();
    const stmt = db.prepare('INSERT INTO scripts (id, profileId, name, code) VALUES (?, ?, ?, ?)');
    stmt.run(id, req.params.profileId, name.trim(), code);

    res.json({ success: true, data: { id, name: name.trim() } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== UPDATE a script ====================
router.put('/scripts/:scriptId', (req, res) => {
  try {
    const { name, code } = req.body;
    const owner = req.user.username;
    const script = db.prepare(`
      SELECT s.* FROM scripts s
      JOIN profiles p ON s.profileId = p.id
      WHERE s.id = ? AND p.owner = ?
    `).get(req.params.scriptId, owner);
    if (!script) return res.status(404).json({ success: false, error: 'Script not found' });

    const stmt = db.prepare('UPDATE scripts SET name = COALESCE(?, name), code = COALESCE(?, code) WHERE id = ?');
    stmt.run(name, code, req.params.scriptId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== DELETE a script ====================
router.delete('/scripts/:scriptId', (req, res) => {
  try {
    const owner = req.user.username;
    const script = db.prepare(`
      SELECT s.* FROM scripts s
      JOIN profiles p ON s.profileId = p.id
      WHERE s.id = ? AND p.owner = ?
    `).get(req.params.scriptId, owner);
    if (!script) return res.status(404).json({ success: false, error: 'Script not found' });

    const stmt = db.prepare('DELETE FROM scripts WHERE id = ?');
    stmt.run(req.params.scriptId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== RUN script (Puppeteer-level) ====================
// This runs with access to `page` and `browser` objects
router.post('/:profileId/run', async (req, res) => {
  try {
    const { code, scriptId } = req.body;
    const owner = req.user.username;
    const profile = db.prepare('SELECT * FROM profiles WHERE id = ? AND owner = ?').get(req.params.profileId, owner);
    if (!profile) return res.status(404).json({ success: false, error: 'Profile not found' });

    let scriptCode = code;

    // If scriptId is provided, load from DB
    if (scriptId && !scriptCode) {
      const stmt = db.prepare('SELECT * FROM scripts WHERE id = ? AND profileId = ?');
      const script = stmt.get(scriptId, req.params.profileId);
      if (!script) {
        return res.status(404).json({ success: false, error: 'Script not found' });
      }
      scriptCode = script.code;
    }

    if (!scriptCode) {
      return res.status(400).json({ success: false, error: 'code or scriptId is required' });
    }

    const logs = [];
    const onLog = (log) => {
      logs.push({ ...log, timestamp: new Date().toISOString() });
    };

    const result = await chromeService.runPuppeteerScript(req.params.profileId, scriptCode, onLog);

    res.json({
      success: result.success,
      data: {
        result: result.result,
        logs: logs,
      },
      error: result.error,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
