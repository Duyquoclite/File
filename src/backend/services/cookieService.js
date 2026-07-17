const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');
const Database = require('better-sqlite3');

const PROFILES_DIR = path.join(__dirname, '..', '..', 'profiles');
const keyCache = new Map(); // profileId -> aesKey (Buffer)

/**
 * Retrieve and decrypt the cookie encryption master key for a profile.
 */
function getCookieMasterKey(profileId) {
  if (keyCache.has(profileId)) {
    return keyCache.get(profileId);
  }

  const localStatePath = path.join(PROFILES_DIR, profileId, 'Local State');
  if (!fs.existsSync(localStatePath)) {
    throw new Error('Local State file not found. Make sure the profile has run at least once.');
  }

  let localState;
  try {
    localState = JSON.parse(fs.readFileSync(localStatePath, 'utf8'));
  } catch (err) {
    throw new Error('Failed to parse Local State: ' + err.message);
  }

  const encryptedKeyB64 = localState?.os_crypt?.encrypted_key;
  if (!encryptedKeyB64) {
    throw new Error('Master key not found in Local State (os_crypt.encrypted_key is missing).');
  }

  const encryptedKeyBuffer = Buffer.from(encryptedKeyB64, 'base64');
  // Chrome Windows key has signature "DPAPI" at the beginning
  const signature = encryptedKeyBuffer.slice(0, 5).toString('ascii');
  if (signature !== 'DPAPI') {
    throw new Error('Invalid master key signature: expected DPAPI, got ' + signature);
  }

  const dpapiBlob = encryptedKeyBuffer.slice(5);
  const dpapiBlobB64 = dpapiBlob.toString('base64');

  // Invoke PowerShell to decrypt DPAPI data in user context
  const psCommand = `[System.Reflection.Assembly]::LoadWithPartialName('System.Security') > $null; ` +
    `$bytes = [System.Convert]::FromBase64String('${dpapiBlobB64}'); ` +
    `$dec = [System.Security.Cryptography.ProtectedData]::Unprotect($bytes, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser); ` +
    `[System.Convert]::ToBase64String($dec)`;

  try {
    const result = execSync(`powershell -NoProfile -Command "${psCommand}"`, { encoding: 'utf8' }).trim();
    const aesKey = Buffer.from(result, 'base64');
    if (aesKey.length !== 32) {
      throw new Error(`Invalid decrypted key length: expected 32 bytes, got ${aesKey.length}`);
    }
    keyCache.set(profileId, aesKey);
    return aesKey;
  } catch (err) {
    throw new Error('DPAPI decryption via PowerShell failed: ' + err.message);
  }
}

/**
 * Find the location of the SQLite Cookies database for a profile.
 */
function getCookiesDatabasePath(profileId) {
  const profileDir = path.join(PROFILES_DIR, profileId);
  const paths = [
    path.join(profileDir, 'Default', 'Network', 'Cookies'),
    path.join(profileDir, 'Default', 'Cookies')
  ];

  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/**
 * Get all domains that have cookies for a profile, alongside their cookie counts.
 */
function getCookiesList(profileId) {
  const dbPath = getCookiesDatabasePath(profileId);
  if (!dbPath) {
    return [];
  }

  // Copy to temp file to avoid locking issues (especially if browser is running)
  const tempPath = path.join(PROFILES_DIR, profileId, 'Cookies_list_temp');
  try {
    fs.copyFileSync(dbPath, tempPath);
    const db = new Database(tempPath, { readonly: true });
    
    // Group cookies by domain (host_key)
    const rows = db.prepare(`
      SELECT host_key, COUNT(*) as count 
      FROM cookies 
      GROUP BY host_key 
      ORDER BY count DESC
    `).all();
    
    db.close();
    return rows.map(r => ({
      domain: r.host_key,
      count: r.count
    }));
  } catch (err) {
    console.error(`[CookieService] Error getting cookies list for ${profileId}:`, err);
    throw err;
  } finally {
    if (fs.existsSync(tempPath)) {
      try { fs.unlinkSync(tempPath); } catch (_) {}
    }
  }
}

/**
 * Get all decrypted cookies for a specific domain.
 */
function getCookiesForDomain(profileId, domain) {
  const dbPath = getCookiesDatabasePath(profileId);
  if (!dbPath) {
    return { cookies: [], raw: '' };
  }

  const tempPath = path.join(PROFILES_DIR, profileId, 'Cookies_domain_temp');
  try {
    fs.copyFileSync(dbPath, tempPath);
    const db = new Database(tempPath, { readonly: true });
    
    const rows = db.prepare('SELECT * FROM cookies WHERE host_key = ? ORDER BY name ASC').all(domain);
    db.close();

    let aesKey;
    try {
      aesKey = getCookieMasterKey(profileId);
    } catch (e) {
      console.warn('[CookieService] Failed to decrypt master key. Returning encrypted/raw cookies: ', e.message);
    }

    const decryptedCookies = rows.map(row => {
      let decryptedValue = '';
      const encVal = row.encrypted_value;

      if (aesKey && encVal && encVal.length > 0) {
        const prefix = encVal.slice(0, 3).toString('ascii');
        if (prefix === 'v10' || prefix === 'v11') {
          try {
            const iv = encVal.slice(3, 15);
            const ciphertext = encVal.slice(15, encVal.length - 16);
            const tag = encVal.slice(encVal.length - 16);
            
            const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey, iv);
            decipher.setAuthTag(tag);
            let decBuf = decipher.update(ciphertext);
            decBuf = Buffer.concat([decBuf, decipher.final()]);

            // Strip 32-byte SHA-256 hash of domain if it is present
            if (decBuf.length > 32) {
              const sha256 = crypto.createHash('sha256').update(row.host_key).digest();
              if (decBuf.slice(0, 32).equals(sha256)) {
                decryptedValue = decBuf.slice(32).toString('utf8');
              } else {
                decryptedValue = decBuf.toString('utf8');
              }
            } else {
              decryptedValue = decBuf.toString('utf8');
            }
          } catch (decErr) {
            console.error('[CookieService] GCM Decryption failed for cookie:', row.name, decErr.message);
            decryptedValue = row.value || '';
          }
        } else {
          decryptedValue = row.value || '';
        }
      } else {
        decryptedValue = row.value || '';
      }

      return {
        name: row.name,
        value: decryptedValue,
        domain: row.host_key,
        path: row.path,
        expires: row.expires_utc,
        secure: row.is_secure === 1,
        httpOnly: row.is_httponly === 1,
        sameSite: row.samesite,
        priority: row.priority,
        creationUtc: row.creation_utc
      };
    });

    // Generate raw string representation: name=value; name2=value2
    const rawString = decryptedCookies.map(c => `${c.name}=${c.value}`).join('; ');

    return {
      cookies: decryptedCookies,
      raw: rawString
    };
  } catch (err) {
    console.error(`[CookieService] Error getting cookies for domain ${domain} in ${profileId}:`, err);
    throw err;
  } finally {
    if (fs.existsSync(tempPath)) {
      try { fs.unlinkSync(tempPath); } catch (_) {}
    }
  }
}

/**
 * Save cookies for a specific domain.
 * Deletes all existing cookies for this domain and inserts the new cookies.
 */
function saveCookiesForDomain(profileId, domain, cookies) {
  const dbPath = getCookiesDatabasePath(profileId);
  if (!dbPath) {
    // If Cookies file doesn't exist, we can't write. Normally it should exist if browser ran.
    throw new Error('Cookies database file not found. Make sure the profile has run at least once.');
  }

  const aesKey = getCookieMasterKey(profileId);
  if (!aesKey) {
    throw new Error('Cannot save cookies: DPAPI master key decryption failed.');
  }

  const db = new Database(dbPath);
  
  try {
    // Enable write-ahead logging
    db.pragma('journal_mode = WAL');

    const deleteStmt = db.prepare('DELETE FROM cookies WHERE host_key = ?');
    const insertStmt = db.prepare(`
      INSERT INTO cookies (
        creation_utc, host_key, top_frame_site_key, name, value, encrypted_value, path,
        expires_utc, is_secure, is_httponly, last_access_utc, has_expires, is_persistent,
        priority, samesite, source_scheme, source_port, last_update_utc, source_type, has_cross_site_ancestor
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Perform transaction
    const executeSave = db.transaction((cookiesToInsert) => {
      // 1. Delete all old cookies for this domain
      deleteStmt.run(domain);

      // 2. Insert new cookies
      for (const c of cookiesToInsert) {
        const cDomain = c.domain || domain;
        const cPath = c.path || '/';
        const cSecure = c.secure ? 1 : 0;
        const cHttpOnly = c.httpOnly ? 1 : 0;
        const cPriority = c.priority !== undefined ? c.priority : 1; // Default Medium
        const cSameSite = c.sameSite !== undefined ? c.sameSite : 1; // Default Lax
        
        // Expiration
        let expiresUtc = 0;
        if (c.expires) {
          if (c.expires > 10000000000000) {
            expiresUtc = c.expires;
          } else {
            const ms = c.expires > 99999999999 ? c.expires : c.expires * 1000;
            expiresUtc = (ms * 1000) + 11644473600000000;
          }
        } else {
          // 1 year from now
          expiresUtc = ((Date.now() + 365 * 24 * 3600 * 1000) * 1000) + 11644473600000000;
        }

        const nowUtc = (Date.now() * 1000) + 11644473600000000;
        const hasExpires = expiresUtc > 0 ? 1 : 0;
        const isPersistent = expiresUtc > 0 ? 1 : 0;

        // Encrypt the value
        // Prepend SHA-256 of the domain to follow Chrome 130+ requirements
        const sha256 = crypto.createHash('sha256').update(cDomain).digest();
        const plaintext = Buffer.concat([sha256, Buffer.from(c.value, 'utf8')]);

        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, iv);
        const enc1 = cipher.update(plaintext);
        const enc2 = cipher.final();
        const ciphertext = Buffer.concat([enc1, enc2]);
        const tag = cipher.getAuthTag();

        const encryptedValue = Buffer.concat([
          Buffer.from('v10', 'ascii'),
          iv,
          ciphertext,
          tag
        ]);

        const sourceScheme = cSecure ? 2 : 1; // 2 = HTTPS, 1 = HTTP
        const sourcePort = cSecure ? 443 : 80;

        insertStmt.run(
          nowUtc,
          cDomain,
          '', // top_frame_site_key
          c.name,
          '', // value
          encryptedValue,
          cPath,
          expiresUtc,
          cSecure,
          cHttpOnly,
          nowUtc,
          hasExpires,
          isPersistent,
          cPriority,
          cSameSite,
          sourceScheme,
          sourcePort,
          nowUtc,
          1, // source_type
          1  // has_cross_site_ancestor
        );
      }
    });

    executeSave(cookies);
  } catch (err) {
    console.error(`[CookieService] Error writing cookies for domain ${domain} in ${profileId}:`, err);
    throw err;
  } finally {
    db.close();
  }
}

/**
 * Extract and decrypt the Facebook User ID (c_user cookie) for a profile.
 */
function getFacebookUserId(profileId) {
  const dbPath = getCookiesDatabasePath(profileId);
  if (!dbPath) {
    return null;
  }

  const tempPath = path.join(PROFILES_DIR, profileId, 'Cookies_fb_temp');
  let db;
  try {
    fs.copyFileSync(dbPath, tempPath);
    db = new Database(tempPath, { readonly: true });
    
    // Find the c_user cookie.
    const row = db.prepare("SELECT * FROM cookies WHERE name = 'c_user' LIMIT 1").get();
    db.close();
    db = null;

    if (!row) {
      return null;
    }

    let aesKey;
    try {
      aesKey = getCookieMasterKey(profileId);
    } catch (e) {
      console.warn('[CookieService] Failed to decrypt master key for FB check:', e.message);
      return row.value || null;
    }

    const encVal = row.encrypted_value;
    if (aesKey && encVal && encVal.length > 0) {
      const prefix = encVal.slice(0, 3).toString('ascii');
      if (prefix === 'v10' || prefix === 'v11') {
        try {
          const iv = encVal.slice(3, 15);
          const ciphertext = encVal.slice(15, encVal.length - 16);
          const tag = encVal.slice(encVal.length - 16);
          
          const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey, iv);
          decipher.setAuthTag(tag);
          let decBuf = decipher.update(ciphertext);
          decBuf = Buffer.concat([decBuf, decipher.final()]);

          // Strip 32-byte SHA-256 hash of domain if it is present
          if (decBuf.length > 32) {
            const sha256 = crypto.createHash('sha256').update(row.host_key).digest();
            if (decBuf.slice(0, 32).equals(sha256)) {
              return decBuf.slice(32).toString('utf8');
            }
          }
          return decBuf.toString('utf8');
        } catch (decErr) {
          console.error('[CookieService] Decryption failed for c_user:', decErr.message);
          return row.value || null;
        }
      } else {
        return row.value || null;
      }
    } else {
      return row.value || null;
    }
  } catch (err) {
    console.error(`[CookieService] Error getting FB ID for profile ${profileId}:`, err.message);
    return null;
  } finally {
    if (db) {
      try { db.close(); } catch (_) {}
    }
    if (fs.existsSync(tempPath)) {
      try { fs.unlinkSync(tempPath); } catch (_) {}
    }
  }
}

module.exports = {
  getCookiesList,
  getCookiesForDomain,
  saveCookiesForDomain,
  getFacebookUserId
};

