const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'profiles.db'));

// Enable WAL mode for better concurrent performance
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    notes TEXT DEFAULT '',
    proxy TEXT DEFAULT '',
    proxyType TEXT DEFAULT 'none',
    proxyIp TEXT DEFAULT '',
    proxyCountry TEXT DEFAULT '',
    proxyTimezone TEXT DEFAULT '',
    fingerprint TEXT DEFAULT '{}',
    status TEXT DEFAULT 'closed',
    owner TEXT DEFAULT 'admin',
    openCount INTEGER DEFAULT 0,
    proxyCategory TEXT DEFAULT 'undetermined',
    proxyLastIp TEXT DEFAULT '',
    proxyUnchangedChecks INTEGER DEFAULT 0,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    createdAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS scripts (
    id TEXT PRIMARY KEY,
    profileId TEXT NOT NULL,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    createdAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (profileId) REFERENCES profiles(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

// Migration to add owner column if not exists
try {
  db.exec(`ALTER TABLE profiles ADD COLUMN owner TEXT DEFAULT 'admin'`);
} catch (e) {
  // Already exists
}

// Migration to add proxy metadata columns if not exists
try {
  db.exec(`ALTER TABLE profiles ADD COLUMN proxyIp TEXT DEFAULT ''`);
} catch (e) {
  // Already exists
}
try {
  db.exec(`ALTER TABLE profiles ADD COLUMN proxyCountry TEXT DEFAULT ''`);
} catch (e) {
  // Already exists
}
try {
  db.exec(`ALTER TABLE profiles ADD COLUMN proxyTimezone TEXT DEFAULT ''`);
} catch (e) {
  // Already exists
}

try {
  db.exec(`ALTER TABLE profiles ADD COLUMN rotationUrl TEXT DEFAULT ''`);
} catch (e) {
  // Already exists
}

try {
  db.exec(`ALTER TABLE profiles ADD COLUMN openCount INTEGER DEFAULT 0`);
} catch (e) {
  // Already exists
}

try {
  db.exec(`ALTER TABLE profiles ADD COLUMN proxyCategory TEXT DEFAULT 'undetermined'`);
} catch (e) {
  // Already exists
}

try {
  db.exec(`ALTER TABLE profiles ADD COLUMN proxyLastIp TEXT DEFAULT ''`);
} catch (e) {
  // Already exists
}

try {
  db.exec(`ALTER TABLE profiles ADD COLUMN proxyUnchangedChecks INTEGER DEFAULT 0`);
} catch (e) {
  // Already exists
}

try {
  db.exec(`UPDATE profiles SET owner = 'admin' WHERE owner IS NULL OR owner != 'admin'`);
} catch (e) {
  // Already done or error
}

module.exports = db;
