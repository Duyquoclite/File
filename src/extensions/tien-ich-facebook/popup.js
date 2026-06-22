document.addEventListener('DOMContentLoaded', () => {
  const cookieInput = document.getElementById('cookieInput');
  const btnGet = document.getElementById('btnGet');
  const btnSet = document.getElementById('btnSet');
  const status = document.getElementById('status');

  // 2FA Elements
  const twofaKeyInput = document.getElementById('twofaKeyInput');
  const btnGet2FA = document.getElementById('btnGet2FA');
  const twofaResultDiv = document.getElementById('twofaResultDiv');
  const twofaCodeOutput = document.getElementById('twofaCodeOutput');

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

  // Get Cookies
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

      // Format as key1=value1;key2=value2;
      let cookieString = cookies.map(c => `${c.name}=${c.value}`).join(';');
      cookieString += ';'; // Thêm ; ở cuối cho chuẩn format
      
      cookieInput.value = cookieString;
      showStatus('Đã lấy cookie thành công!');
    } catch (error) {
      showStatus('Lỗi khi lấy cookie.', true);
      console.error(error);
    }
  });

  // Set Cookies
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

      // Split the string by '|' to ignore the token part at the end (e.g. |EAAAA...)
      const cookieSegments = rawText.split('|');
      const cookiePart = cookieSegments[0]; 

      // Split by ';' and filter out empty segments
      const cookiePairs = cookiePart.split(';').map(s => s.trim()).filter(s => s.length > 0);
      
      let setCount = 0;
      for (const pair of cookiePairs) {
        const eqIndex = pair.indexOf('=');
        if (eqIndex > -1) {
          const name = pair.substring(0, eqIndex).trim();
          const value = pair.substring(eqIndex + 1).trim();
          
          if (name) {
            let cookieDetails = {
              url: tab.url,
              name: name,
              value: value,
              path: '/',
              secure: url.protocol === 'https:'
            };

            // Attempt to determine the correct domain to set
            let domain = url.hostname;
            if (domain.startsWith('www.')) {
                domain = domain.substring(3); // .domain.com
            } else if (!domain.includes('localhost') && domain.split('.').length > 1) {
                domain = '.' + domain;
            } else if (domain === 'localhost') {
                domain = 'localhost';
            }

            try {
              let cookie = await chrome.cookies.set({ ...cookieDetails, domain: domain });
              if (!cookie) {
                // If it fails with domain, fallback to no domain (host-only)
                await chrome.cookies.set(cookieDetails);
              }
              setCount++;
            } catch (err) {
              console.error(`Lỗi khi dán cookie ${name}:`, err);
            }
          }
        }
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
  
  // Decodes base32 string to Uint8Array
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

  // Generates TOTP code using 2fa.live API (with local fallback)
  async function getTOTP(secret) {
    const cleanSecret = secret.replace(/[\s-]/g, "");
    
    // 1. Try to fetch from 2fa.live API
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout
      
      const res = await fetch(`https://2fa.live/tok/${cleanSecret}`, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (res.ok) {
        const data = await res.json();
        if (data && data.token) {
          console.log("Lấy mã 2FA thành công qua API 2fa.live");
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

  // Get and copy 2FA Code
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

      // Automatically copy to clipboard
      try {
        await navigator.clipboard.writeText(code);
        showStatus('Đã lấy và tự động copy mã 2FA!');
      } catch (clipErr) {
        // Fallback copy method
        twofaCodeOutput.select();
        document.execCommand('copy');
        showStatus('Đã lấy và tự động copy mã 2FA!');
      }
    } catch (error) {
      showStatus(error.message || 'Lỗi khi tạo mã 2FA.', true);
      twofaResultDiv.style.display = 'none';
    }
  });
});
