const axios = require('axios');
const db = require('../db');

function getProxyUrl(proxy, proxyType) {
  let proxyUrl = proxy;
  const parts = proxyUrl.split(':');
  if (parts.length === 4 && !proxyUrl.includes('://')) {
    const [host, port, user, pass] = parts;
    proxyUrl = `${user}:${pass}@${host}:${port}`;
  }
  if (!proxyUrl.includes('://')) {
    proxyUrl = `${proxyType}://${proxyUrl}`;
  }
  return proxyUrl;
}

async function fetchRawIp(proxy, proxyType) {
  const proxyUrl = getProxyUrl(proxy, proxyType);
  let agent;
  if (proxyType === 'socks5') {
    const { SocksProxyAgent } = await import('socks-proxy-agent');
    agent = new SocksProxyAgent(proxyUrl);
  } else {
    const { HttpsProxyAgent } = await import('https-proxy-agent');
    agent = new HttpsProxyAgent(proxyUrl);
  }

  const endpoints = [
    'https://api.ipify.org',
    'https://icanhazip.com',
    'https://ifconfig.me/ip',
    'https://ipinfo.io/ip'
  ];

  for (const url of endpoints) {
    try {
      const response = await axios.get(url, {
        httpsAgent: agent,
        httpAgent: agent,
        timeout: 8000,
        responseType: 'text'
      });
      const ip = response.data.trim();
      if (/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(ip) || ip.includes(':')) {
        return ip;
      }
    } catch (e) {
      // Continue to next endpoint
    }
  }
  throw new Error('Failed to fetch IP from all endpoints');
}

async function fetchFullMetadata(ip, proxy, proxyType) {
  const proxyUrl = getProxyUrl(proxy, proxyType);
  let agent;
  if (proxyType === 'socks5') {
    const { SocksProxyAgent } = await import('socks-proxy-agent');
    agent = new SocksProxyAgent(proxyUrl);
  } else {
    const { HttpsProxyAgent } = await import('https-proxy-agent');
    agent = new HttpsProxyAgent(proxyUrl);
  }
  
  try {
    const response = await axios.get('https://ipwho.is/', {
      httpsAgent: agent,
      httpAgent: agent,
      timeout: 10000
    });
    if (response.data && response.data.success) {
      return {
        country: response.data.country || response.data.country_code || 'Unknown',
        timezone: response.data.timezone?.id || 'Unknown'
      };
    }
  } catch (e) {
    try {
      const response = await axios.get('http://ip-api.com/json/', {
        httpsAgent: agent,
        httpAgent: agent,
        timeout: 10000
      });
      if (response.data && response.data.status === 'success') {
        return {
          country: response.data.country || 'Unknown',
          timezone: response.data.timezone || 'Unknown'
        };
      }
    } catch (e2) {}
  }
  return null;
}

async function checkProxiesJob() {
  try {
    const profilesToCheck = db.prepare(`
      SELECT id, name, proxy, proxyType, proxyCategory, proxyLastIp, proxyUnchangedChecks 
      FROM profiles 
      WHERE proxy != '' AND proxyType != 'none' AND proxyCategory IN ('undetermined', 'static')
    `).all();

    for (const profile of profilesToCheck) {
      try {
        const currentIp = await fetchRawIp(profile.proxy, profile.proxyType);
        
        let category = profile.proxyCategory || 'undetermined';
        let unchangedChecks = profile.proxyUnchangedChecks || 0;
        let lastIp = profile.proxyLastIp || '';
        let needMetadata = false;

        if (!lastIp) {
          lastIp = currentIp;
          unchangedChecks = 1;
          needMetadata = true;
        } else if (currentIp !== lastIp) {
          category = 'dynamic';
          lastIp = currentIp;
          unchangedChecks = 0;
          needMetadata = true;
          console.log(`[ProxyChecker] Profile "${profile.name}" IP changed from "${profile.proxyLastIp}" to "${currentIp}". Classified as DYNAMIC.`);
        } else {
          unchangedChecks += 1;
          if (category === 'undetermined' && unchangedChecks >= 60) {
            category = 'static';
            console.log(`[ProxyChecker] Profile "${profile.name}" IP unchanged for 60 checks (1 hour). Classified as STATIC.`);
          }
        }

        if (needMetadata) {
          const meta = await fetchFullMetadata(currentIp, profile.proxy, profile.proxyType);
          if (meta) {
            db.prepare(`
              UPDATE profiles SET 
                proxyCategory = ?, 
                proxyLastIp = ?, 
                proxyUnchangedChecks = ?,
                proxyIp = ?,
                proxyCountry = ?,
                proxyTimezone = ?,
                updatedAt = datetime('now')
              WHERE id = ?
            `).run(category, lastIp, unchangedChecks, lastIp, meta.country, meta.timezone, profile.id);
            continue;
          }
        }

        db.prepare(`
          UPDATE profiles SET 
            proxyCategory = ?, 
            proxyLastIp = ?, 
            proxyUnchangedChecks = ?,
            proxyIp = ?,
            updatedAt = datetime('now')
          WHERE id = ?
        `).run(category, lastIp, unchangedChecks, lastIp, profile.id);

      } catch (err) {
        // Ignored, proxy could be temporarily offline
      }
    }
  } catch (error) {
    console.error('[ProxyChecker] Job Error:', error);
  }
}

function start() {
  // Run once immediately on start after 5 seconds
  setTimeout(() => {
    checkProxiesJob();
  }, 5);

  // Then check every 1 minute
  setInterval(() => {
    checkProxiesJob();
  }, 60000);
}

module.exports = {
  start,
  checkProxiesJob
};
