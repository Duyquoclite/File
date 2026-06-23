document.addEventListener('DOMContentLoaded', () => {
  // Original Cookie Elements
  const cookieInput = document.getElementById('cookieInput');
  const btnGet = document.getElementById('btnGet');
  const btnSet = document.getElementById('btnSet');
  const cookieFormatSelect = document.getElementById('cookieFormatSelect');
  const status = document.getElementById('status');

  // Original 2FA Elements
  const twofaKeyInput = document.getElementById('twofaKeyInput');
  const btnGet2FA = document.getElementById('btnGet2FA');
  const twofaResultDiv = document.getElementById('twofaResultDiv');
  const twofaCodeOutput = document.getElementById('twofaCodeOutput');

  // New Quick Login Elements
  const quickLoginInput = document.getElementById('quickLoginInput');
  const btnQuickLogin = document.getElementById('btnQuickLogin');

  const btnClearCookies = document.getElementById('btnClearCookies');

  let statusTimeout = null;
  function showStatus(message, isError = false) {
    if (statusTimeout) clearTimeout(statusTimeout);
    status.textContent = message;
    status.style.color = isError ? '#d93025' : '#188038'; // Red for error, Green for success
    statusTimeout = setTimeout(() => { status.textContent = ''; }, 3500);
  }

  // Helper function to get current tab
  async function getCurrentTab() {
    let queryOptions = { active: true, currentWindow: true };
    let [tab] = await chrome.tabs.query(queryOptions);
    return tab;
  }

  // Decodes base32 string to Uint8Array (for local 2FA)
  function base32ToBytes(base32) {
    const base32chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    const cleanBase32 = base32.replace(/[\s-]/g, "").replace(/=/g, "").toUpperCase();
    const bytes = [];
    let buffer = 0;
    let bitsLeft = 0;

    for (let i = 0; i < cleanBase32.length; i++) {
      const val = base32chars.indexOf(cleanBase32.charAt(i));
      if (val === -1) continue;
      buffer = (buffer << 5) | val;
      bitsLeft += 5;
      if (bitsLeft >= 8) {
        bytes.push((buffer >> (bitsLeft - 8)) & 0xff);
        bitsLeft -= 8;
      }
    }
    return new Uint8Array(bytes);
  }

  // Generates TOTP code local/remote
  async function getTOTP(secret) {
    const cleanSecret = secret.replace(/[\s-]/g, "");
    
    // 1. Try to fetch from 2fa.live API
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout
      
      const res = await fetch(`https://2fa.live/tok/${cleanSecret}`, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (res.ok) {
        const data = await res.json();
        if (data && data.token) {
          return data.token;
        }
      }
    } catch (apiErr) {
      console.warn("Lỗi khi kết nối API 2fa.live, chuyển sang tự tính toán local:", apiErr.message);
    }

    // 2. Local Fallback logic
    try {
      const keyBytes = base32ToBytes(secret);
      if (keyBytes.length === 0) {
        throw new Error("Khóa 2FA rỗng hoặc không hợp lệ.");
      }
      
      const epoch = Math.floor(Date.now() / 1000);
      const time = Math.floor(epoch / 30);
      
      const timeBytes = new Uint8Array(8);
      let temp = time;
      for (let i = 7; i >= 0; i--) {
        timeBytes[i] = temp & 0xff;
        temp = temp >> 8;
      }

      const key = await crypto.subtle.importKey(
        "raw",
        keyBytes,
        { name: "HMAC", hash: { name: "SHA-1" } },
        false,
        ["sign"]
      );

      const signature = await crypto.subtle.sign("HMAC", key, timeBytes);
      const hmacBytes = new Uint8Array(signature);

      const offset = hmacBytes[hmacBytes.length - 1] & 0xf;
      const code =
        ((hmacBytes[offset] & 0x7f) << 24) |
        ((hmacBytes[offset + 1] & 0xff) << 16) |
        ((hmacBytes[offset + 2] & 0xff) << 8) |
        (hmacBytes[offset + 3] & 0xff);

      const otp = code % 1000000;
      return String(otp).padStart(6, "0");
    } catch (err) {
      console.error(err);
      throw new Error("Mã 2FA không hợp lệ hoặc lỗi tính toán.");
    }
  }

  // Set specific cookie helper
  async function setCookieHelper(tabUrl, name, value, domain, path = '/') {
    const url = new URL(tabUrl);
    let cookieDetails = {
      url: tabUrl,
      name: name,
      value: value,
      path: path,
      secure: url.protocol === 'https:'
    };
    
    let targetDomain = domain;
    if (targetDomain && !targetDomain.startsWith('.') && !targetDomain.includes('localhost') && !/^[0-9.]+$/.test(targetDomain)) {
      if (!url.hostname.endsWith(targetDomain)) {
        targetDomain = url.hostname;
      }
      if (targetDomain !== url.hostname && !targetDomain.startsWith('.')) {
        targetDomain = '.' + targetDomain;
      }
    }
    
    try {
      if (targetDomain) {
        await chrome.cookies.set({ ...cookieDetails, domain: targetDomain });
      } else {
        await chrome.cookies.set(cookieDetails);
      }
      return true;
    } catch (e) {
      console.error(`Lỗi set cookie ${name}:`, e);
      return false;
    }
  }

  // Parse raw text to cookies array helper
  function parseCookiesText(rawText, defaultDomain) {
    const cookiePairs = rawText.split(';').map(s => s.trim()).filter(s => s.length > 0);
    return cookiePairs.map(pair => {
      const eqIndex = pair.indexOf('=');
      if (eqIndex > -1) {
        const name = pair.substring(0, eqIndex).trim();
        const value = pair.substring(eqIndex + 1).trim();
        if (name) {
          return { name, value, domain: defaultDomain };
        }
      }
      return null;
    }).filter(Boolean);
  }

  // Parse Account String UID|Pass|2FA|Cookie
  function parseAccountString(accountStr) {
    const parts = accountStr.split('|').map(s => s.trim());
    let uid = '';
    let pass = '';
    let twoFA = '';
    let cookie = '';

    // Check if it's only cookie first
    if (accountStr.includes('c_user=') || accountStr.startsWith('[')) {
      return { uid: '', pass: '', twoFA: '', cookie: accountStr };
    }

    // UID is typically a numeric string of length >= 8
    if (parts.length > 0 && /^\d+$/.test(parts[0])) {
      uid = parts[0];
    }
    if (parts.length > 1) {
      pass = parts[1];
    }
    
    // Check remaining parts for 2FA key and cookies
    for (let i = 2; i < parts.length; i++) {
      const part = parts[i];
      if (part.includes('c_user=')) {
        cookie = part;
      } else if (/^[a-zA-Z2-7\s]{16,36}$/.test(part.replace(/\s/g, ''))) {
        twoFA = part.replace(/\s/g, '');
      }
    }

    return { uid, pass, twoFA, cookie };
  }

  // --- Get Cookies ---
  btnGet.addEventListener('click', async () => {
    try {
      const tab = await getCurrentTab();
      if (!tab || !tab.url) {
        showStatus('Không thể lấy URL của tab hiện tại.', true);
        return;
      }
      
      const cookies = await chrome.cookies.getAll({ url: tab.url });
      
      if (cookies.length === 0) {
        cookieInput.value = '';
        showStatus('Không tìm thấy cookie nào cho trang này.', true);
        return;
      }

      if (cookieFormatSelect.value === 'json') {
        const cleanList = cookies.map(c => ({
          name: c.name,
          value: c.value,
          domain: c.domain,
          path: c.path,
          secure: c.secure,
          httpOnly: c.httpOnly,
          sameSite: c.sameSite,
          expirationDate: c.expirationDate
        }));
        cookieInput.value = JSON.stringify(cleanList, null, 2);
      } else {
        let cookieString = cookies.map(c => `${c.name}=${c.value}`).join(';');
        cookieString += ';';
        cookieInput.value = cookieString;
      }
      
      try {
        await navigator.clipboard.writeText(cookieInput.value);
        showStatus('Đã lấy và tự động copy cookie!');
      } catch (clipErr) {
        cookieInput.select();
        document.execCommand('copy');
        showStatus('Đã lấy và tự động copy cookie!');
      }
    } catch (error) {
      showStatus('Lỗi khi lấy cookie.', true);
      console.error(error);
    }
  });

  // --- Set Cookies ---
  btnSet.addEventListener('click', async () => {
    try {
      const tab = await getCurrentTab();
      if (!tab || !tab.url) {
        showStatus('Không thể truy cập URL của tab hiện tại.', true);
        return;
      }

      const url = new URL(tab.url);
      const rawText = cookieInput.value.trim();
      if (!rawText) {
        showStatus('Vui lòng dán cookie vào ô trống trước.', true);
        return;
      }

      let parsedCookies = [];
      let isJson = false;

      if (rawText.startsWith('[') || cookieFormatSelect.value === 'json') {
        try {
          const list = JSON.parse(rawText);
          if (Array.isArray(list)) {
            parsedCookies = list.map(c => {
              if (!c.name || c.value === undefined) {
                throw new Error('Mỗi cookie trong JSON phải có "name" và "value"');
              }
              return {
                name: c.name,
                value: c.value,
                domain: c.domain || c.host || url.hostname,
                path: c.path || '/',
                secure: c.secure !== undefined ? c.secure : (url.protocol === 'https:'),
                httpOnly: c.httpOnly !== undefined ? c.httpOnly : false,
                sameSite: c.sameSite,
                expirationDate: c.expirationDate
              };
            });
            isJson = true;
          }
        } catch (jsonErr) {
          if (cookieFormatSelect.value === 'json') {
            showStatus('Lỗi cú pháp JSON: ' + jsonErr.message, true);
            return;
          }
        }
      }

      if (!isJson) {
        let domain = url.hostname;
        if (domain.startsWith('www.')) domain = domain.substring(3);
        else if (!domain.includes('localhost') && domain.split('.').length > 1) domain = '.' + domain;
        
        parsedCookies = parseCookiesText(rawText, domain);
      }

      if (parsedCookies.length === 0) {
        showStatus('Không tìm thấy cookie hợp lệ để dán.', true);
        return;
      }

      let setCount = 0;
      for (const c of parsedCookies) {
        const ok = await setCookieHelper(tab.url, c.name, c.value, c.domain, c.path);
        if (ok) setCount++;
      }

      if (setCount > 0) {
        showStatus(`Đã dán ${setCount} cookie! Đang tải lại trang...`);
        setTimeout(() => {
          chrome.tabs.reload(tab.id);
        }, 1500);
      } else {
        showStatus('Không tìm thấy cookie hợp lệ để dán.', true);
      }
    } catch (error) {
      showStatus('Lỗi trong quá trình dán cookie.', true);
      console.error(error);
    }
  });

  // --- 2FA Functions ---
  btnGet2FA.addEventListener('click', async () => {
    const rawKey = twofaKeyInput.value.trim();
    if (!rawKey) {
      showStatus('Vui lòng nhập khóa bảo mật 2FA.', true);
      return;
    }

    try {
      const code = await getTOTP(rawKey);
      twofaCodeOutput.value = code;
      twofaResultDiv.style.display = 'flex';

      try {
        await navigator.clipboard.writeText(code);
        showStatus('Đã lấy và tự động copy mã 2FA!');
      } catch (clipErr) {
        twofaCodeOutput.select();
        document.execCommand('copy');
        showStatus('Đã lấy và tự động copy mã 2FA!');
      }
    } catch (error) {
      showStatus(error.message || 'Lỗi khi tạo mã 2FA.', true);
      twofaResultDiv.style.display = 'none';
    }
  });

  // --- Auto-Fill & Login ---
  btnQuickLogin.addEventListener('click', async () => {
    const inputVal = quickLoginInput.value.trim();
    if (!inputVal) {
      showStatus('Vui lòng nhập chuỗi tài khoản.', true);
      return;
    }

    const { uid, pass, twoFA, cookie } = parseAccountString(inputVal);

    try {
      let tab = await getCurrentTab();
      if (!tab) {
        showStatus('Không thể lấy tab hiện tại.', true);
        return;
      }

      // Check URL and redirect to facebook.com if needed
      const isFB = tab.url && (tab.url.includes('facebook.com') || tab.url.includes('messenger.com'));
      const targetUrl = isFB ? tab.url : 'https://www.facebook.com/';

      // Set cookie first if present
      if (cookie) {
        showStatus('Đang nạp cookie...');
        let parsedCookies = [];
        if (cookie.startsWith('[')) {
          try {
            parsedCookies = JSON.parse(cookie);
          } catch(e){}
        } else {
          parsedCookies = parseCookiesText(cookie, '.facebook.com');
        }

        for (const c of parsedCookies) {
          await setCookieHelper(targetUrl, c.name, c.value, c.domain || '.facebook.com', c.path || '/');
        }
        showStatus('Đã nạp cookie. Đang chuyển hướng...');
      }

      // Fill credentials or load page
      if (!isFB || cookie) {
        await chrome.tabs.update(tab.id, { url: targetUrl });
        // Wait a bit for navigation
        await new Promise(r => setTimeout(r, 2000));
        tab = await getCurrentTab();
      }

      // If credentials exist, fill them
      if (uid && pass) {
        showStatus('Đang điền tài khoản & mật khẩu...');
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (u, p) => {
            const emailInput = document.querySelector('input#email') || document.querySelector('input[name="email"]');
            const passInput = document.querySelector('input#pass') || document.querySelector('input[name="pass"]');
            const loginBtn = document.querySelector('button[name="login"]') || document.querySelector('button[type="submit"]') || document.querySelector('input[type="submit"]');
            if (emailInput) {
              emailInput.value = u;
              emailInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
            if (passInput) {
              passInput.value = p;
              passInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
            if (loginBtn) {
              setTimeout(() => loginBtn.click(), 600);
            }
          },
          args: [uid, pass]
        });
      }

      // If 2FA key exists, generate TOTP code and copy/setup helper
      if (twoFA) {
        twofaKeyInput.value = twoFA;
        const code = await getTOTP(twoFA);
        twofaCodeOutput.value = code;
        twofaResultDiv.style.display = 'flex';
        
        try {
          await navigator.clipboard.writeText(code);
        } catch(e){}

        // Polling to auto-fill code if approval page is detected
        showStatus('Đăng nhập và tự động điền 2FA...');
        let checkCount = 0;
        const checkInterval = setInterval(async () => {
          checkCount++;
          if (checkCount > 15) {
            clearInterval(checkInterval);
            return;
          }
          const activeTab = await getCurrentTab();
          if (activeTab && activeTab.url && activeTab.url.includes('facebook.com')) {
            chrome.scripting.executeScript({
              target: { tabId: activeTab.id },
              func: (c) => {
                const codeInput = document.querySelector('input#approvals_code') || document.querySelector('input[name="approvals_code"]');
                const submitBtn = document.querySelector('button#checkpointSubmitButton') || document.querySelector('button[type="submit"]');
                if (codeInput && !codeInput.value) {
                  codeInput.value = c;
                  codeInput.dispatchEvent(new Event('input', { bubbles: true }));
                  if (submitBtn) {
                    setTimeout(() => submitBtn.click(), 500);
                  }
                }
              },
              args: [code]
            });
          }
        }, 1500);
      } else {
        showStatus('Đăng nhập thành công!');
      }

    } catch (err) {
      showStatus('Gặp lỗi khi đăng nhập: ' + err.message, true);
      console.error(err);
    }
  });




  // --- Clear Facebook Cache & Cookies ---
  btnClearCookies.addEventListener('click', async () => {
    if (!confirm('Bạn có chắc muốn xóa toàn bộ cookie của Facebook trên profile này?')) return;

    try {
      const fbCookies = await chrome.cookies.getAll({ domain: 'facebook.com' });
      const msgrCookies = await chrome.cookies.getAll({ domain: 'messenger.com' });
      const allFBCookies = [...fbCookies, ...msgrCookies];

      if (allFBCookies.length === 0) {
        showStatus('Không tìm thấy cookie Facebook nào.');
        return;
      }

      let deleteCount = 0;
      for (const c of allFBCookies) {
        const protocol = c.secure ? 'https:' : 'http:';
        const url = `${protocol}//${c.domain.startsWith('.') ? c.domain.substring(1) : c.domain}${c.path}`;
        await chrome.cookies.remove({ url, name: c.name });
        deleteCount++;
      }

      showStatus(`Đã xóa ${deleteCount} cookie Facebook. Đang tải lại...`);
      const tab = await getCurrentTab();
      if (tab && tab.url && (tab.url.includes('facebook.com') || tab.url.includes('messenger.com'))) {
        chrome.tabs.reload(tab.id);
      }
    } catch (e) {
      showStatus('Lỗi khi xóa cookie Facebook: ' + e.message, true);
    }
  });
});
