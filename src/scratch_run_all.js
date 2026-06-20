const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const fs = require('fs');
const path = require('path');

const cookieStr = `YOUR_COOKIE_HERE`;

function findChromeExecutable() {
  const cftDir = path.join(__dirname, 'chrome');
  if (fs.existsSync(cftDir)) {
    try {
      const findExe = (dir) => {
        const items = fs.readdirSync(dir);
        for (const item of items) {
          const fullPath = path.join(dir, item);
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            const found = findExe(fullPath);
            if (found) return found;
          } else if (item.toLowerCase() === 'chrome.exe') {
            return fullPath;
          }
        }
        return null;
      };
      const cftPath = findExe(cftDir);
      if (cftPath) return cftPath;
    } catch (e) {}
  }

  const possiblePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

const cookies = cookieStr.split(';').map(pair => {
  const trimPair = pair.trim();
  if (!trimPair) return null;
  const idx = trimPair.indexOf('=');
  if (idx === -1) return null;
  const name = trimPair.substring(0, idx);
  const value = trimPair.substring(idx + 1);
  return {
    name,
    value,
    domain: '.facebook.com',
    path: '/',
    secure: true
  };
}).filter(Boolean);

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Hàm click thông minh tránh lỗi Node is not clickable
async function smartClick(page, element) {
  try {
    await page.evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), element);
    await delay(1000);
    await element.click();
  } catch (err) {
    // Nếu click thường lỗi, dùng click JavaScript để đảm bảo thành công 100%
    await page.evaluate(el => el.click(), element);
  }
}

(async () => {
  const chromePath = findChromeExecutable();
  console.log("[Setup] Trình duyệt Chrome:", chromePath);
  if (!chromePath) {
    console.error("Không tìm thấy Chrome!");
    process.exit(1);
  }

  console.log("[Setup] Đang mở Chrome (Chế độ hiển thị màn hình)...");
  const browser = await puppeteer.launch({
    headless: false, // Hiển thị để bạn dễ quan sát
    executablePath: chromePath,
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--window-size=1280,850',
      '--disable-blink-features=AutomationControlled'
    ],
    defaultViewport: null
  });
  
  const page = await browser.newPage();
  
  // Tự động xử lý các hộp thoại của Chrome
  page.on('dialog', async dialog => {
    console.log(`[DIALOG] Tự động chấp nhận dialog loại: ${dialog.type()} -> "${dialog.message()}"`);
    await dialog.accept();
  });

  console.log("[Setup] Đang nạp Cookie đăng nhập...");
  await page.setCookie(...cookies);
  
  // ==================== HÀNH ĐỘNG 1: TRANG CHỦ & TƯƠNG TÁC FEED ====================
  console.log("\n==================== HÀNH ĐỘNG 1: TƯƠNG TÁC BẢNG TIN ====================");
  console.log("[Feed] Đang truy cập Trang chủ Facebook...");
  await page.goto("https://www.facebook.com", { waitUntil: "networkidle2" });
  await delay(5000);

  console.log("[Feed] Tìm bài viết đầu tiên trên bảng tin...");
  const likeBtn = await page.$('[data-ad-rendering-role="like_button"]');
  if (likeBtn) {
    const postElement = await page.evaluateHandle((likeEl) => {
      return likeEl.closest('div[aria-posinset]') || 
             likeEl.closest('[data-testid="fbfeed_story"]') || 
             likeEl.closest('div[role="article"]') ||
             likeEl.parentElement.parentElement.parentElement.parentElement.parentElement;
    }, likeBtn);
    
    const postEl = postElement.asElement();
    if (postEl) {
      // Thả cảm xúc Like bằng click thông minh
      console.log("[Feed] 👍 Đang click LIKE bài viết...");
      await smartClick(page, likeBtn);
      await delay(2000);

      // Bình luận bài viết
      const commentIndicator = await postEl.$('[data-ad-rendering-role="comment_button"]');
      if (commentIndicator) {
        console.log("[Feed] 💬 Click mở rộng khung bình luận...");
        await smartClick(page, commentIndicator);
        await delay(2500);

        const commentInput = await postEl.$('div[contenteditable="true"], div[role="textbox"], textarea');
        if (commentInput) {
          console.log("[Feed] ✍️ Đang gõ bình luận mẫu...");
          await commentInput.focus();
          await page.keyboard.type("Chúc ngày mới tốt lành nha! 🌸");
          await delay(1500);

          // Tìm nút gửi bình luận
          const sendBtn = await page.evaluateHandle((el) => {
            const btns = Array.from(el.querySelectorAll('[role="button"], div[aria-label="Bình luận"], div[aria-label="Comment"], div[aria-label="Gửi"]'));
            for (const btn of btns) {
              const label = (btn.getAttribute('aria-label') || '').toLowerCase();
              if (label === 'bình luận' || label === 'comment' || label === 'gửi' || label === 'send') {
                return btn;
              }
            }
            return null;
          }, postEl);

          if (sendBtn && sendBtn.asElement()) {
            console.log("[Feed] 🚀 Click nút gửi bình luận...");
            await smartClick(page, sendBtn.asElement());
          } else {
            console.log("[Feed] 🚀 Nhấn Enter để gửi bình luận...");
            await page.keyboard.press("Enter");
          }
          await delay(3000);
        }
      }
      
      // Đóng modal/popup của bài viết này nếu có
      console.log("[Feed] Đóng modal nếu có bằng Escape...");
      await page.keyboard.press('Escape');
      await delay(500);
      await page.keyboard.press('Escape');
      await delay(1500);
    }
  } else {
    console.log("[Feed] ⚠️ Không tìm thấy bài viết nào trên bảng tin chính.");
  }

  // ==================== HÀNH ĐỘNG 2: TÌM KIẾM & ĐỌC BÌNH LUẬN BÊN NGOÀI ====================
  console.log("\n==================== HÀNH ĐỘNG 2: TÌM KIẾM & ĐỌC COMMENT ====================");
  const searchKeyword = "công nghệ";
  console.log(`[Search] Tìm kiếm từ khóa: "${searchKeyword}"...`);
  await page.goto(`https://www.facebook.com/search/posts/?q=${encodeURIComponent(searchKeyword)}`, { waitUntil: "networkidle2" });
  await delay(5000);

  console.log("[Search] Lấy bài viết đầu tiên trong kết quả tìm kiếm...");
  const searchLikeBtn = await page.$('[data-ad-rendering-role="like_button"]');
  if (searchLikeBtn) {
    const searchPostElement = await page.evaluateHandle((likeEl) => {
      return likeEl.closest('div[aria-posinset]') || 
             likeEl.closest('[data-testid="fbfeed_story"]') || 
             likeEl.closest('div[role="article"]') ||
             likeEl.parentElement.parentElement.parentElement.parentElement.parentElement;
    }, searchLikeBtn);
    
    const searchPostEl = searchPostElement.asElement();
    if (searchPostEl) {
      const commentBtn = await searchPostEl.$('[data-ad-rendering-role="comment_button"]');
      if (commentBtn) {
        console.log("[Search] 💬 Mở bình luận để đọc...");
        await smartClick(page, commentBtn);
        await delay(3000);

        // Đọc 3 bình luận của người dùng khác
        const comments = await searchPostEl.evaluate((el) => {
          const spans = Array.from(el.querySelectorAll('span[dir="auto"]'));
          const list = [];
          for (const span of spans) {
            const text = span.textContent ? span.textContent.trim() : '';
            if (
              text && 
              text.length > 5 && 
              !text.includes("Thích") && 
              !text.includes("Bình luận") && 
              !text.includes("Chia sẻ") &&
              isNaN(text)
            ) {
              list.push(text);
            }
          }
          return list.slice(0, 3);
        });

        console.log(`[Search] 👁️ Đã đọc được ${comments.length} bình luận:`);
        comments.forEach((txt, idx) => {
          console.log(`   👉 Bình luận ${idx + 1}: "${txt}"`);
        });
      }
    }
  } else {
    console.log("[Search] ⚠️ Không tìm thấy bài viết kết quả tìm kiếm nào.");
  }

  // ==================== HÀNH ĐỘNG 3: THAM GIA HỘI NHÓM ====================
  console.log("\n==================== HÀNH ĐỘNG 3: THAM GIA NHÓM ====================");
  console.log("[Group] Đang chuyển tới trang gợi ý nhóm...");
  await page.goto("https://www.facebook.com/groups/discover/", { waitUntil: "networkidle2" });
  await delay(5000);

  // Tìm các nút tham gia nhóm
  console.log("[Group] Tìm kiếm nút tham gia nhóm...");
  const joinButton = await page.evaluateHandle(() => {
    const buttons = Array.from(document.querySelectorAll('[role="button"], button'));
    for (const btn of buttons) {
      const label = (btn.getAttribute('aria-label') || '').toLowerCase();
      const text = (btn.textContent || '').toLowerCase();
      if (
        label.includes('tham gia nhóm') || 
        label.includes('join group') || 
        text.includes('tham gia nhóm') || 
        text === 'tham gia' || 
        text === 'join'
      ) {
        return btn;
      }
    }
    return null;
  });

  if (joinButton && joinButton.asElement()) {
    console.log("[Group] 👉 Phát hiện nút Tham gia nhóm, tiến hành click...");
    await smartClick(page, joinButton.asElement());
    console.log("[Group] ✅ Đã nhấn nút Tham gia nhóm!");
    await delay(3000);
  } else {
    console.log("[Group] ⚠️ Không tìm thấy nút tham gia nhóm nào đang hiển thị.");
  }

  // ==================== HÀNH ĐỘNG 4: XEM STORIES (TIN) ====================
  console.log("\n==================== HÀNH ĐỘNG 4: XEM STORIES ====================");
  console.log("[Story] Quay lại trang chủ...");
  await page.goto("https://www.facebook.com", { waitUntil: "networkidle2" });
  await delay(4000);

  console.log("[Story] Tìm thẻ Story đầu tiên...");
  const storyCard = await page.$('[role="link"][href*="/stories/"]');
  if (storyCard) {
    console.log("[Story] 👉 Click để mở xem Story...");
    await smartClick(page, storyCard);
    await delay(5000); // Xem trong 5 giây

    // Nhấp xem Story kế tiếp
    const nextBtn = await page.$('[aria-label="Thẻ tiếp theo"], [aria-label="Next card"], [aria-label="Chuyển tiếp"]');
    if (nextBtn) {
      console.log("[Story] 👉 Click xem Story tiếp theo...");
      await smartClick(page, nextBtn);
      await delay(4000);
    }

    console.log("[Story] 🔙 Bấm phím Escape để đóng Story và thoát ra...");
    await page.keyboard.press('Escape');
    await delay(2000);
  } else {
    console.log("[Story] ⚠️ Không tìm thấy khay tin Story nào trên trang chủ.");
  }

  console.log("\n==================== HOÀN THÀNH TẤT CẢ HÀNH ĐỘNG ====================");
  console.log("[Done] Đang chờ 5 giây trước khi tự động đóng trình duyệt...");
  await delay(5000);
  await browser.close();
  console.log("[Done] Trình duyệt đã đóng.");
})();
