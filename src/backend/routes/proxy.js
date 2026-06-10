const express = require('express');
const router = express.Router();
const axios = require('axios');

// ==================== CHECK PROXY ====================
router.post('/check', async (req, res) => {
  try {
    const { proxy, proxyType } = req.body;

    if (!proxy || proxyType === 'none') {
      return res.status(400).json({ success: false, error: 'Proxy is required' });
    }

    let proxyUrl = proxy;
    
    // Convert IP:PORT:USER:PASS to USER:PASS@IP:PORT
    const parts = proxyUrl.split(':');
    if (parts.length === 4 && !proxyUrl.includes('://')) {
      const [host, port, user, pass] = parts;
      proxyUrl = `${user}:${pass}@${host}:${port}`;
    }

    if (!proxyUrl.includes('://')) {
      proxyUrl = `${proxyType}://${proxyUrl}`;
    }

    let agent;
    if (proxyType === 'socks5') {
      const { SocksProxyAgent } = await import('socks-proxy-agent');
      agent = new SocksProxyAgent(proxyUrl);
    } else {
      const { HttpsProxyAgent } = await import('https-proxy-agent');
      agent = new HttpsProxyAgent(proxyUrl);
    }

    // Call ipwho.is to get detailed IP info (IP, Country, Timezone, etc.)
    const start = Date.now();
    const response = await axios.get('https://ipwho.is/', {
      httpsAgent: agent,
      timeout: 10000,
    });
    const time = Date.now() - start;

    if (!response.data.success) {
      throw new Error(response.data.message || 'Failed to get IP info');
    }

    res.json({
      success: true,
      data: {
        ip: response.data.ip,
        country: response.data.country || response.data.country_code || 'Unknown',
        countryName: response.data.country || response.data.country_name || response.data.country_code || 'Unknown',
        timezone: response.data.timezone?.id || 'Unknown',
        isp: response.data.connection?.isp || 'Unknown',
        timeMs: time
      }
    });
  } catch (error) {
    res.json({
      success: false,
      error: error.message || 'Proxy connection failed'
    });
  }
});

module.exports = router;
