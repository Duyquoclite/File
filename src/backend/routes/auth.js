const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = 'chrome-profile-manager-secret'; // Hardcoded for simplicity in local app
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

// Helper to parse cookies from request header
function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(';').forEach(cookie => {
    const [name, ...rest] = cookie.trim().split('=');
    if (name) cookies[name] = rest.join('=');
  });
  return cookies;
}

// Helper to set auth cookie on response
function setAuthCookie(res, token) {
  res.cookie('authToken', token, {
    httpOnly: false, // Need JS access for SPA
    maxAge: COOKIE_MAX_AGE,
    path: '/',
    sameSite: 'lax',
  });
}

// Helper to get auth details
function getAuth() {
  const userRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('username');
  const passRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('password');
  if (userRow && passRow) {
    return { username: userRow.value, password: passRow.value };
  }
  return null;
}

// Check status (always setup is done, because anybody can register now)
router.get('/status', (req, res) => {
  res.json({ success: true, isSetup: true });
});

// Verify existing token (used by login page to skip re-login)
router.get('/verify', (req, res) => {
  let token = req.headers['authorization'];
  if (token) {
    token = token.replace('Bearer ', '');
  } else {
    const cookies = parseCookies(req.headers.cookie);
    token = cookies.authToken;
  }
  if (!token) return res.json({ success: false });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ success: true, username: decoded.username });
  } catch (err) {
    res.json({ success: false });
  }
});

// Register account
router.post('/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ success: false, error: 'Vui lòng điền tài khoản và mật khẩu' });

  try {
    db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run(username, password);
    const token = jwt.sign({ auth: true, username }, JWT_SECRET, { expiresIn: '7d' });
    setAuthCookie(res, token);
    res.json({ success: true, token });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(400).json({ success: false, error: 'Tài khoản đã tồn tại' });
    }
    res.status(500).json({ success: false, error: 'Lỗi hệ thống khi đăng ký' });
  }
});

// Login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ success: false, error: 'Vui lòng điền tài khoản và mật khẩu' });

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || user.password !== password) {
    return res.status(401).json({ success: false, error: 'Sai tài khoản hoặc mật khẩu' });
  }

  const token = jwt.sign({ auth: true, username }, JWT_SECRET, { expiresIn: '7d' });
  setAuthCookie(res, token);
  res.json({ success: true, token });
});

// Middleware to verify token (checks Authorization header first, then cookie)
const requireAuth = (req, res, next) => {
  let token = req.headers['authorization'];
  if (token) {
    token = token.replace('Bearer ', '');
  } else {
    // Fallback: read from cookie
    const cookies = parseCookies(req.headers.cookie);
    token = cookies.authToken;
  }

  if (!token) return res.status(401).json({ success: false, error: 'Unauthorized', code: 'NO_TOKEN' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ success: false, error: 'Invalid token', code: 'INVALID_TOKEN' });
  }
};

// Logout
router.post('/logout', (req, res) => {
  // Clear the auth cookie
  res.clearCookie('authToken', { path: '/' });
  res.json({ success: true, message: 'Logged out' });
});

module.exports = { router, requireAuth, JWT_SECRET };
