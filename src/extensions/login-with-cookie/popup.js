document.addEventListener('DOMContentLoaded', () => {
  const cookieInput = document.getElementById('cookieInput');
  const btnGet = document.getElementById('btnGet');
  const btnSet = document.getElementById('btnSet');
  const status = document.getElementById('status');

  function showStatus(message, isError = false) {
    status.textContent = message;
    status.style.color = isError ? '#d93025' : '#188038'; // Red for error, Green for success
    setTimeout(() => { status.textContent = ''; }, 3500);
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
});
