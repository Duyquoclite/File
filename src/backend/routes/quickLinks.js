const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const LINKS_FILE = path.join(DATA_DIR, 'custom_links.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// GET /api/quick-links - Retrieve synchronized custom links
router.get('/', (req, res) => {
  try {
    if (fs.existsSync(LINKS_FILE)) {
      const data = fs.readFileSync(LINKS_FILE, 'utf8');
      return res.json({ success: true, data: JSON.parse(data) });
    }
    return res.json({ success: true, data: [] });
  } catch (err) {
    console.error('[QuickLinks] Error reading links:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/quick-links - Save synchronized custom links
router.post('/', (req, res) => {
  try {
    const { links } = req.body;
    if (!Array.isArray(links)) {
      return res.status(400).json({ success: false, message: 'links must be an array' });
    }

    fs.writeFileSync(LINKS_FILE, JSON.stringify(links, null, 2), 'utf8');
    return res.json({ success: true, data: links });
  } catch (err) {
    console.error('[QuickLinks] Error saving links:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
