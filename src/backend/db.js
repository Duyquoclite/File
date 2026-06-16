const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'profiles.db'));

// Enable WAL mode for better concurrent performance
db.pragma('journal_mode = WAL');

// Drop users table if it exists (auth cleanup)
try {
  db.exec('DROP TABLE IF EXISTS users');
} catch (e) {
  // Ignore
}

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

// Migration to add owner column if not exists (kept for structural compatibility)
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

// Sync profiles function
db.syncProfiles = function() {
  try {
    const profilesDir = path.join(__dirname, '..', 'profiles');
    if (!fs.existsSync(profilesDir)) return;

    const folders = fs.readdirSync(profilesDir).filter(f => fs.statSync(path.join(profilesDir, f)).isDirectory());
    const { generateFingerprint } = require('./services/fingerprintService');
    
    const stmtCheck = db.prepare('SELECT id FROM profiles WHERE id = ?');
    const stmtInsert = db.prepare(`
      INSERT INTO profiles (id, name, notes, proxy, proxyType, proxyIp, proxyCountry, proxyTimezone, fingerprint, proxyCategory, proxyLastIp, proxyUnchangedChecks)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const folder of folders) {
      const exists = stmtCheck.get(folder);
      if (!exists) {
        console.log(`[Sync] Found unregistered profile folder: ${folder}. Restoring into DB.`);
        
        const name = folder; // Use the folder name directly as the profile name
        const fingerprint = generateFingerprint();
        stmtInsert.run(
          folder,
          name,
          'Auto-restored from directory',
          '', // proxy
          'none', // proxyType
          '', // proxyIp
          '', // proxyCountry
          '', // proxyTimezone
          JSON.stringify(fingerprint),
          '', // proxyCategory
          '', // proxyLastIp
          0
        );
        console.log(`[Sync] Successfully registered profile ${folder} as "${name}"`);
      }
    }
  } catch (syncError) {
    console.error('[Sync] Error syncing profiles directory:', syncError);
  }
};

// Run sync once on load
try {
  db.syncProfiles();
} catch (e) {
  console.error('[Sync] Initial sync failed:', e);
}

module.exports = db;
