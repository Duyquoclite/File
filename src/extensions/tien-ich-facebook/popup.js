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

      const isFacebookDomain = tab.url.includes('facebook.com') || tab.url.includes('messenger.com');
      const targetUrl = isFacebookDomain ? tab.url : 'https://www.facebook.com/';
      const url = new URL(targetUrl);
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
                domain: c.domain || c.host || (isFacebookDomain ? url.hostname : '.facebook.com'),
                path: c.path || '/',
                secure: c.secure !== undefined ? c.secure : true,
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
        let domain = isFacebookDomain ? url.hostname : '.facebook.com';
        if (isFacebookDomain) {
          if (domain.startsWith('www.')) domain = domain.substring(3);
          else if (!domain.includes('localhost') && domain.split('.').length > 1) domain = '.' + domain;
        }
        parsedCookies = parseCookiesText(rawText, domain);
      }

      if (parsedCookies.length === 0) {
        showStatus('Không tìm thấy cookie hợp lệ để dán.', true);
        return;
      }

      let setCount = 0;
      for (const c of parsedCookies) {
        const ok = await setCookieHelper(targetUrl, c.name, c.value, c.domain, c.path);
        if (ok) setCount++;
      }

      if (setCount > 0) {
        if (isFacebookDomain) {
          showStatus(`Đã dán ${setCount} cookie! Đang tải lại trang...`);
          setTimeout(() => {
            chrome.tabs.reload(tab.id);
          }, 1500);
        } else {
          showStatus(`Đã dán ${setCount} cookie! Đang chuyển hướng tới Facebook...`);
          setTimeout(() => {
            chrome.tabs.update(tab.id, { url: 'https://www.facebook.com/' });
          }, 1500);
        }
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

      try {
        await navigator.clipboard.writeText(code);
      } catch (clipErr) {
        const tempInput = document.createElement('input');
        tempInput.value = code;
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand('copy');
        document.body.removeChild(tempInput);
      }

      showStatus('Đã lấy và tự động copy mã 2FA!');
      alert(`Mã 2FA của bạn (đã tự động copy): ${code}`);
    } catch (error) {
      showStatus(error.message || 'Lỗi khi tạo mã 2FA.', true);
    }
  });

  // --- Check Mail Outlook ---
  const btnCheckMail = document.getElementById('btnCheckMail');
  const mailTokenInput = document.getElementById('mailTokenInput');
  const mailModal = document.getElementById('mailModal');
  const mailModalTitle = document.getElementById('mailModalTitle');
  const btnMailModalClose = document.getElementById('btnMailModalClose');
  const mailListContainer = document.getElementById('mailListContainer');
  const mailDetailContainer = document.getElementById('mailDetailContainer');
  const btnBackToMailList = document.getElementById('btnBackToMailList');
  const mailDetailSubject = document.getElementById('mailDetailSubject');
  const mailDetailIframe = document.getElementById('mailDetailIframe');

  // Đóng modal
  btnMailModalClose.addEventListener('click', () => {
    mailModal.style.display = 'none';
  });

  // Quay lại danh sách thư
  btnBackToMailList.addEventListener('click', () => {
    mailDetailContainer.style.display = 'none';
    mailListContainer.style.display = 'block';
    mailModalTitle.textContent = 'Danh sách thư';
  });

  btnCheckMail.addEventListener('click', async () => {
    const rawInput = mailTokenInput.value.trim();
    if (!rawInput) {
      showStatus('Vui lòng dán token mail (M.C...).', true);
      return;
    }

    // Tự động trích xuất token bắt đầu bằng M.C và Client ID (nếu có)
    let token = rawInput;
    let clientId = '9e5f94bc-e8a4-4e73-b8be-63364c29d753'; // Default client ID

    const matchToken = rawInput.match(/(M\.C[^\s|]+)/);
    if (matchToken) {
      token = matchToken[1];
    }

    if (!token.startsWith('M.C')) {
      showStatus('Token mail không đúng định dạng (phải bắt đầu bằng M.C).', true);
      return;
    }

    // Trích xuất client ID dạng GUID
    const guidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
    const matchGuid = rawInput.match(guidRegex);
    if (matchGuid) {
      clientId = matchGuid[0];
    }

    showStatus('Đang lấy danh sách thư...');
    mailListContainer.innerHTML = '<div style="text-align: center; padding: 20px; font-size: 11px; color: #606770;">Đang tải danh sách thư, vui lòng đợi...</div>';
    mailDetailContainer.style.display = 'none';
    mailListContainer.style.display = 'block';
    mailModalTitle.textContent = 'Danh sách thư';
    mailModal.style.display = 'block';

    try {
      const response = await fetch('http://localhost:3000/api/profiles/mail-checker/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, clientId })
      });

      const result = await response.json();
      if (!result.success) {
        mailListContainer.innerHTML = `<div style="padding: 15px; color: #d93025; font-size: 11px; font-weight: 500;">Lỗi: ${result.error}</div>`;
        return;
      }

      const emails = result.emails || [];
      const accessToken = result.accessToken;
      const apiUsed = result.apiUsed;

      if (emails.length === 0) {
        mailListContainer.innerHTML = '<div style="text-align: center; padding: 20px; font-size: 11px; color: #606770;">Hộp thư trống.</div>';
        return;
      }

      mailListContainer.innerHTML = '';
      emails.forEach(email => {
        const item = document.createElement('div');
        item.style.padding = '8px';
        item.style.borderBottom = '1px solid #ccd0d5';
        item.style.cursor = 'pointer';
        item.style.transition = 'background-color 0.2s';
        item.style.fontSize = '11px';

        item.addEventListener('mouseenter', () => {
          item.style.backgroundColor = '#f0f2f5';
        });
        item.addEventListener('mouseleave', () => {
          item.style.backgroundColor = 'transparent';
        });

        // Folder badge
        const folderText = email.folder === 'junk' ? 'Thư rác' : 'Hộp thư đến';
        const folderBg = email.folder === 'junk' ? '#ffebe9' : '#e6f4ea';
        const folderColor = email.folder === 'junk' ? '#d93025' : '#137333';

        // Sender info
        const sender = email.from?.emailAddress?.address || email.from?.emailAddress?.name || 'Không rõ';
        const subject = email.subject || '(Không có chủ đề)';
        
        // Format time
        const dateStr = email.receivedDateTime ? new Date(email.receivedDateTime).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '';

        item.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
            <strong style="color: #1c1e21; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${sender}</strong>
            <span style="font-size: 9px; color: #606770;">${dateStr}</span>
          </div>
          <div style="color: #606770; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-bottom: 4px; font-size: 11px;">${subject}</div>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="padding: 1px 6px; border-radius: 4px; font-size: 8px; font-weight: bold; background: ${folderBg}; color: ${folderColor};">${folderText}</span>
            <span style="color: #1877f2; font-weight: bold; font-size: 10px;">Xem thư →</span>
          </div>
        `;

        item.addEventListener('click', async () => {
          showStatus('Đang tải nội dung thư...');
          mailDetailSubject.textContent = 'Đang tải...';
          mailDetailIframe.srcdoc = '<div style="font-family: sans-serif; font-size: 11px; color: #606770; text-align: center; padding-top: 50px;">Đang tải nội dung...</div>';
          
          mailListContainer.style.display = 'none';
          mailDetailContainer.style.display = 'block';
          mailModalTitle.textContent = 'Chi tiết thư';

          try {
            const detailRes = await fetch('http://localhost:3000/api/profiles/mail-checker/detail', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ accessToken, messageId: email.id, apiUsed })
            });
            const detailData = await detailRes.json();
            if (detailData.success) {
              mailDetailSubject.textContent = detailData.subject || '(Không có chủ đề)';
              mailDetailIframe.srcdoc = detailData.body || '<div style="font-family: sans-serif; font-size: 11px; color: #606770; padding: 20px;">Nội dung thư trống.</div>';
              showStatus('Đã tải thư thành công!');
            } else {
              mailDetailSubject.textContent = 'Lỗi tải thư';
              mailDetailIframe.srcdoc = `<div style="font-family: sans-serif; font-size: 11px; color: #d93025; padding: 20px;">Lỗi: ${detailData.error}</div>`;
            }
          } catch (detailErr) {
            mailDetailSubject.textContent = 'Lỗi tải thư';
            mailDetailIframe.srcdoc = `<div style="font-family: sans-serif; font-size: 11px; color: #d93025; padding: 20px;">Lỗi: ${detailErr.message}</div>`;
          }
        });

        mailListContainer.appendChild(item);
      });

      showStatus('Đã tải danh sách thư!');
    } catch (err) {
      mailListContainer.innerHTML = `<div style="padding: 15px; color: #d93025; font-size: 11px; font-weight: 500;">Lỗi kết nối API: ${err.message}</div>`;
      showStatus('Lỗi khi tải danh sách thư', true);
    }
  });

  // --- Quick Redirect & Custom Links ---
  const API_URL = 'http://localhost:3000/api/quick-links';
  const trigger = document.getElementById('linkSelectTrigger');
  const menu = document.getElementById('linkSelectMenu');
  const selectedLinkText = document.getElementById('selectedLinkText');
  const addBtn = document.getElementById('addBtn');

  // Trigger dropdown menu toggle
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
  });

  // Close menu when clicking outside
  document.addEventListener('click', () => {
    menu.style.display = 'none';
  });

  // Default empty links (can be populated if needed)
  const defaultLinks = [];

  // Đồng bộ với Server backend dùng chung cho tất cả các profile
  async function getCustomLinks() {
    try {
      const res = await fetch(API_URL);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          // Lưu vào storage local làm fallback dự phòng
          chrome.storage.local.set({ customLinks: json.data });
          return json.data;
        }
      }
    } catch (err) {
      console.warn("Backend API offline, sử dụng bộ nhớ local dự phòng:", err.message);
    }
    return new Promise((resolve) => {
      chrome.storage.local.get(['customLinks'], (result) => {
        resolve(result.customLinks || []);
      });
    });
  }

  async function saveCustomLinks(links) {
    // 1. Lưu vào storage local dự phòng
    chrome.storage.local.set({ customLinks: links });

    // 2. Đồng bộ lên Server dùng chung
    try {
      await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ links })
      });
    } catch (err) {
      console.warn("Backend API offline khi lưu liên kết:", err.message);
    }
  }

  // Helper function to get current profile's Facebook UID (c_user)
  async function getFacebookUID() {
    try {
      const cookie = await chrome.cookies.get({ url: 'https://www.facebook.com', name: 'c_user' });
      if (cookie && cookie.value) {
        return cookie.value;
      }
    } catch (e) {
      console.error("Lỗi khi đọc cookie c_user:", e);
    }
    return null;
  }

  async function loadLinks() {
    const customLinks = await getCustomLinks();
    menu.innerHTML = '';

    // Mặc định option đầu tiên
    const placeholder = document.createElement('div');
    placeholder.className = 'custom-select-item';
    placeholder.innerHTML = `<span class="item-text" style="color: #606770;">-- Chọn liên kết nhanh --</span>`;
    placeholder.addEventListener('click', (e) => {
      e.stopPropagation();
      selectedLinkText.textContent = '-- Chọn liên kết nhanh --';
      menu.style.display = 'none';
    });
    menu.appendChild(placeholder);

    const allLinks = [...defaultLinks, ...customLinks];
    allLinks.forEach((link, index) => {
      const item = document.createElement('div');
      item.className = 'custom-select-item';

      const textSpan = document.createElement('span');
      textSpan.className = 'item-text';
      textSpan.textContent = link.name;
      textSpan.title = link.url;
      item.appendChild(textSpan);

      // Nút xóa hiển thị trực tiếp trong phần tử dropdown
      if (index >= defaultLinks.length) {
        const delBtn = document.createElement('button');
        delBtn.className = 'item-delete';
        delBtn.textContent = 'Xóa';
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation(); // Ngăn chặn sự kiện click lan truyền đến dòng item
          const customIndex = index - defaultLinks.length;
          deleteLink(customIndex);
        });
        item.appendChild(delBtn);
      }

      // Helper function to get current profile's Facebook UID (c_user)
      async function getFacebookUID() {
        try {
          const cookie = await chrome.cookies.get({ url: 'https://www.facebook.com', name: 'c_user' });
          if (cookie && cookie.value) {
            return cookie.value;
          }
        } catch (e) {
          console.error("Lỗi khi đọc cookie c_user:", e);
        }
        return null;
      }

      // Điều hướng khi nhấp vào dòng (ngoại trừ nút xóa)
      item.addEventListener('click', async (e) => {
        if (e.target.classList.contains('item-delete')) return;

        let targetUrl = link.url;
        if (targetUrl.includes(':id:')) {
          const uid = await getFacebookUID();
          if (uid) {
            targetUrl = targetUrl.replace(/:id:/g, uid);
          } else {
            showStatus('Chưa đăng nhập Facebook (không thấy cookie c_user)!', true);
            return;
          }
        }

        menu.style.display = 'none';
        selectedLinkText.textContent = link.name;

        // Cập nhật URL cho tab hiện tại đang hoạt động
        chrome.tabs.update({ url: targetUrl }, (tab) => {
          if (chrome.runtime.lastError) {
            // Fallback nếu không có tab nào đang hoạt động
            chrome.tabs.create({ url: targetUrl });
          }
        });
      });

      menu.appendChild(item);
    });
  }

  async function deleteLink(index) {
    const customLinks = await getCustomLinks();
    customLinks.splice(index, 1);
    await saveCustomLinks(customLinks);
    selectedLinkText.textContent = '-- Chọn liên kết nhanh --';
    loadLinks();
    showStatus('Đã xóa liên kết!');
  }

  // Thêm liên kết mới thông qua hộp thoại Prompt
  addBtn.addEventListener('click', async () => {
    const name = prompt("Nhập tên hiển thị của liên kết (VD: Đổi mật khẩu):");
    if (name === null) return; // Nhấn Cancel
    const trimmedName = name.trim();
    if (!trimmedName) {
      showStatus('Tên hiển thị không được để trống!', true);
      return;
    }

    const url = prompt("Nhập đường dẫn URL (VD: accountscenter.facebook.com...):");
    if (url === null) return; // Nhấn Cancel
    let trimmedUrl = url.trim();
    if (!trimmedUrl) {
      showStatus('Đường dẫn URL không được để trống!', true);
      return;
    }

    if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
      trimmedUrl = 'https://' + trimmedUrl;
    }

    const customLinks = await getCustomLinks();
    customLinks.push({ name: trimmedName, url: trimmedUrl });
    await saveCustomLinks(customLinks);
    loadLinks();
    showStatus('Đã thêm liên kết nhanh thành công!');
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


  loadLinks();
});
