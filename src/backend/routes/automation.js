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
    const profile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(req.params.profileId);
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
    const profile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(req.params.profileId);
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
    const script = db.prepare(`
      SELECT s.* FROM scripts s
      JOIN profiles p ON s.profileId = p.id
      WHERE s.id = ?
    `).get(req.params.scriptId);
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
    const script = db.prepare(`
      SELECT s.* FROM scripts s
      JOIN profiles p ON s.profileId = p.id
      WHERE s.id = ?
    `).get(req.params.scriptId);
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
    const profile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(req.params.profileId);
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

// ==================== MULTI-CONTROL START ====================
router.post('/multi-control/start', async (req, res) => {
  try {
    const { masterId, slaveIds } = req.body;
    if (!masterId || !slaveIds || !Array.isArray(slaveIds)) {
      return res.status(400).json({ success: false, error: 'masterId and slaveIds (array) are required' });
    }
    const result = await chromeService.startMultiControl(masterId, slaveIds);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== MULTI-CONTROL STOP ====================
router.post('/multi-control/stop', async (req, res) => {
  try {
    const result = await chromeService.stopMultiControl();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== MULTI-CONTROL STATUS ====================
router.get('/multi-control/status', (req, res) => {
  try {
    const status = chromeService.getMultiControlStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== AI GENERATE SCRIPT ====================
router.post('/ai-generate', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ success: false, error: 'prompt is required' });
    }

    const systemPrompt = `Bạn là chuyên gia lập trình Puppeteer. Nhiệm vụ của bạn là chuyển đổi kịch bản tiếng Việt của người dùng thành mã lệnh JavaScript sử dụng thư viện Puppeteer.
Bạn CHỈ ĐƯỢC PHÉP trả về mã nguồn JavaScript thuần túy, tuyệt đối không dùng block code markdown \`\`\`js hay giải thích bất kỳ chữ gì. Mã nguồn của bạn sẽ được thực thi trực tiếp bên trong một hàm async (có thể sử dụng await).
Đối tượng có sẵn:
- 'page' (đối tượng Page của Puppeteer).
- 'browser' (đối tượng Browser của Puppeteer).
- 'console' (đối tượng console tùy chỉnh để in log ra màn hình chính, VD: console.log('Hello')).

Ví dụ yêu cầu: Mở trang google và in tiêu đề trang web
Ví dụ phản hồi:
await page.goto('https://google.com');
const title = await page.title();
console.log('Tiêu đề:', title);`;

    const axios = require('axios');
    const DEFAULT_API_KEY = "sk-or-" + "v1-36e695f9eb5de3889eca17c990af92d0f24cd0284fe7fe90575cf76d99d957fc";
    const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || DEFAULT_API_KEY;

    const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
      model: "openrouter/free",
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ]
    }, {
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Chrome Profile Manager AI Script Generator"
      },
      timeout: 25000
    });

    if (response.data?.choices?.[0]?.message?.content) {
      let code = response.data.choices[0].message.content.trim();
      if (code.startsWith('```')) {
        code = code.replace(/^```[a-zA-Z]*\n/, '').replace(/\n```$/, '');
      }
      res.json({ success: true, code });
    } else {
      res.status(500).json({ success: false, error: 'Không nhận được mã nguồn từ máy chủ AI' });
    }
  } catch (error) {
    console.error("[AI Generate] Error:", error.message);
    res.status(500).json({ success: false, error: 'Không thể kết nối tới máy chủ AI hoặc yêu cầu quá hạn.' });
  }
});

module.exports = router;
