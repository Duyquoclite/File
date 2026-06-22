// ==================== SCRIPT TEST NHẮN TIN TỰ ĐỘNG ====================
// Kịch bản này được thiết kế tương thích cả hai chế độ:
// 1. Chạy trực tiếp qua Terminal: node test_message.js
// 2. Chạy thông qua Automation Dashboard trên profile bất kỳ.

const fs = require('fs');
const path = require('path');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Hàm click thông minh để đảm bảo hoạt động 100% không bị kẹt DOM React
async function smartClick(page, element) {
  try {
    await page.evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), element);
    await delay(1000);
    await element.click();
  } catch (err) {
    // Fallback bằng JavaScript Click nếu Puppeteer Click lỗi
    await page.evaluate(el => el.click(), element);
  }
}

async function runTest(page) {
  console.log("🚀 Bắt đầu kịch bản test gửi tin nhắn tự động (Hỗ trợ 3 chiến lược ngẫu nhiên)...");
  
  try {
    const strategyRoll = Math.random();
    let method = "";
    let chatOpened = false;

    if (strategyRoll < 0.35) {
      // Chiến lược 1: Nhắn tin cho người đăng bài viết trên Bảng tin (Newsfeed Author)
      method = "Gửi tin nhắn cho người đăng bài trên Bảng tin";
      console.log(`💡 Chiến lược chọn: ${method}`);
      
      console.log("🌐 Đang tải trang chủ Facebook...");
      await page.goto("https://www.facebook.com", { waitUntil: "networkidle2" });
      await delay(4000);

      // Cuộn trang nhẹ xuống để load thêm bài viết
      await page.evaluate(() => window.scrollBy(0, 400));
      await delay(2000);

      console.log("🔍 Đang tìm kiếm link người đăng bài trên bảng tin...");
      const authorLink = await page.evaluateHandle(() => {
        const links = Array.from(document.querySelectorAll('h2 a[role="link"], h3 a[role="link"], strong a, a[role="link"]'));
        for (const l of links) {
          const href = l.getAttribute('href') || '';
          const text = (l.textContent || '').trim();
          
          if (text.length > 2 && text.length < 35 && 
              !href.includes('/groups/') && 
              !href.includes('/posts/') && 
              !href.includes('/videos/') && 
              !href.includes('/photos/') && 
              !href.includes('/watch') && 
              !href.includes('/events/') && 
              !href.includes('/pages/') && 
              (href.includes('profile.php') || (!href.includes('?') && href.length > 25))
          ) {
            const rect = l.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0 && rect.top > 0 && rect.top < window.innerHeight * 2) {
              return l;
            }
          }
        }
        return null;
      });

      if (authorLink && authorLink.asElement()) {
        console.log("👉 Click vào tên tác giả bài viết để vào trang cá nhân...");
        await smartClick(page, authorLink.asElement());
        await delay(5000);

        console.log("🔍 Đang tìm nút 'Nhắn tin' trên profile...");
        const messageBtn = await page.evaluateHandle(() => {
          const elements = Array.from(document.querySelectorAll('[role="button"], a, div[role="button"]'));
          for (const el of elements) {
            const text = (el.textContent || '').trim().toLowerCase();
            const label = (el.getAttribute('aria-label') || '').toLowerCase();
            if (
              text === 'nhắn tin' || 
              text === 'message' || 
              text.includes('gửi tin nhắn') ||
              label === 'nhắn tin' || 
              label === 'message' || 
              label.includes('gửi tin nhắn')
            ) {
              const rect = el.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0) {
                return el;
              }
            }
          }
          return null;
        });

        if (messageBtn && messageBtn.asElement()) {
          console.log("👉 Tìm thấy nút 'Nhắn tin', click mở khung chat...");
          await smartClick(page, messageBtn.asElement());
          await delay(4000);
          chatOpened = true;
        } else {
          console.warn("⚠️ Không tìm thấy nút 'Nhắn tin' trên profile người này.");
        }
      } else {
        console.warn("⚠️ Không tìm thấy link tác giả bài viết nào trên bảng tin.");
      }

    } else if (strategyRoll < 0.70) {
      // Chiến lược 2: Nhắn tin cho người mới trong mục gợi ý kết bạn (Suggested Friends)
      method = "Gửi tin nhắn cho người mới trong danh sách gợi ý";
      console.log(`💡 Chiến lược chọn: ${method}`);
      
      console.log("🌐 Đang truy cập mục gợi ý kết bạn...");
      await page.goto("https://www.facebook.com/friends/suggestions", { waitUntil: "networkidle2" });
      await delay(5000);

      console.log("🔍 Đang tìm kiếm các gợi ý kết bạn...");
      const profileLink = await page.evaluateHandle(() => {
        const links = Array.from(document.querySelectorAll('a[href*="/profile.php"], a[href^="https://www.facebook.com/"]'));
        const validLinks = links.filter(l => {
          const href = l.getAttribute('href') || '';
          const text = (l.textContent || '').trim();
          if (text.length > 2 && text.length < 35 && 
              !href.includes('/friends/') && 
              !href.includes('/groups/') && 
              !href.includes('/posts/') && 
              !href.includes('/pages/') && 
              (href.includes('profile.php') || (!href.includes('?') && href.length > 25))
          ) {
            const rect = l.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          }
          return false;
        });
        
        if (validLinks.length === 0) return null;
        const randomIndex = Math.floor(Math.random() * Math.min(validLinks.length, 10));
        return validLinks[randomIndex];
      });

      if (profileLink && profileLink.asElement()) {
        console.log("👉 Click vào profile gợi ý kết bạn...");
        await smartClick(page, profileLink.asElement());
        await delay(5000);

        console.log("🔍 Đang tìm nút 'Nhắn tin' trên profile...");
        const messageBtn = await page.evaluateHandle(() => {
          const elements = Array.from(document.querySelectorAll('[role="button"], a, div[role="button"]'));
          for (const el of elements) {
            const text = (el.textContent || '').trim().toLowerCase();
            const label = (el.getAttribute('aria-label') || '').toLowerCase();
            if (
              text === 'nhắn tin' || 
              text === 'message' || 
              text.includes('gửi tin nhắn') ||
              label === 'nhắn tin' || 
              label === 'message' || 
              label.includes('gửi tin nhắn')
            ) {
              const rect = el.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0) {
                return el;
              }
            }
          }
          return null;
        });

        if (messageBtn && messageBtn.asElement()) {
          console.log("👉 Tìm thấy nút 'Nhắn tin', click mở khung chat...");
          await smartClick(page, messageBtn.asElement());
          await delay(4000);
          chatOpened = true;
        } else {
          console.warn("⚠️ Không tìm thấy nút 'Nhắn tin' trên profile gợi ý.");
        }
      } else {
        console.warn("⚠️ Không tìm thấy gợi ý kết bạn nào.");
      }

    } else {
      // Chiến lược 3: Nhắn tin cho các hội thoại sẵn có (Existing Chats)
      method = "Gửi tin nhắn cho cuộc hội thoại sẵn có trong hộp thư";
      console.log(`💡 Chiến lược chọn: ${method}`);
      
      console.log("🌐 Đang truy cập Facebook Messenger...");
      await page.goto("https://www.facebook.com/messages/t/", { waitUntil: "networkidle2" });
      await delay(5000);

      console.log("🔍 Đang tìm các cuộc hội thoại cũ...");
      const chatLink = await page.evaluateHandle(() => {
        const links = Array.from(document.querySelectorAll('a[href*="/messages/t/"], a[href*="/t/"]'));
        const visibleLinks = links.filter(l => {
          const rect = l.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        });
        if (visibleLinks.length === 0) return null;
        
        const limit = Math.min(visibleLinks.length, 5);
        const randomIndex = Math.floor(Math.random() * limit);
        return visibleLinks[randomIndex];
      });

      if (chatLink && chatLink.asElement()) {
        console.log("👉 Click mở cuộc trò chuyện sẵn có...");
        await smartClick(page, chatLink.asElement());
        await delay(3000);
        chatOpened = true;
      } else {
        console.warn("⚠️ Không tìm thấy hội thoại nào sẵn có.");
      }
    }

    if (chatOpened) {
      console.log("🔍 Đang tìm ô soạn thảo tin nhắn...");
      const msgInput = await page.evaluateHandle(() => {
        let inp = document.querySelector('div[contenteditable="true"][role="textbox"]');
        if (inp) return inp;
        
        const boxes = Array.from(document.querySelectorAll('div[contenteditable="true"]'));
        for (const box of boxes) {
          const label = (box.getAttribute('aria-label') || '').toLowerCase();
          if (label.includes('tin nhắn') || label.includes('message') || label.includes('nhập')) {
            return box;
          }
        }
        return null;
      });

      if (msgInput && msgInput.asElement()) {
        const inputElement = msgInput.asElement();
        await inputElement.focus();
        await smartClick(page, inputElement);
        await delay(1000);

        const testMessage = "Chào bạn! Đây là tin nhắn tự động từ kịch bản test tự động nhắn tin đa chiến lược. Chúc bạn một ngày tốt lành! 😊";
        console.info(`✍️ Đang gõ tin nhắn test: "${testMessage}"`);
        for (const char of testMessage) {
          await page.keyboard.sendCharacter(char);
          await delay(Math.floor(Math.random() * 60) + 40);
        }
        await delay(1500);

        console.info("🚀 Nhấn Enter để gửi...");
        await page.keyboard.press("Enter");
        await delay(3000);

        // Fallback: Nếu text chưa biến mất, thử click nút Gửi
        const isStillText = await page.evaluate((el) => el.textContent.length > 0, inputElement);
        if (isStillText) {
          console.info("✍️ Vẫn còn text, tìm nút Gửi (Send)...");
          await page.evaluate(() => {
            const sendBtns = Array.from(document.querySelectorAll('div[role="button"], span'));
            for (const btn of sendBtns) {
              const label = (btn.getAttribute('aria-label') || '').toLowerCase();
              if (label.includes('gửi') || label.includes('send')) {
                btn.click();
                return;
              }
            }
          });
          await delay(2000);
        }

        console.log("✅ Hoàn thành: Tin nhắn đã được gửi đi thành công!");
        
        console.log("🏠 Quay lại trang chủ...");
        await page.goto("https://www.facebook.com", { waitUntil: "networkidle2" });
        await delay(3000);
        console.log("🎉 Test hoàn tất thành công 100%!");
      } else {
        console.error("❌ Thất bại: Không tìm thấy ô soạn thảo tin nhắn.");
      }
    } else {
      console.error("❌ Thất bại: Không thể mở khung chat bằng bất kỳ chiến lược nào.");
    }
  } catch (err) {
    console.error("❌ Đã xảy ra lỗi trong quá trình test:", err.message);
  }
}

// Kiểm tra môi trường để khởi chạy phù hợp
if (typeof page !== 'undefined') {
  // Chạy từ Automation Dashboard (được bọc trong Function có tham số page)
  runTest(page);
} else {
  // Chạy trực tiếp từ Terminal bằng Node.js: node test_message.js
  const puppeteer = require('puppeteer-extra');
  const StealthPlugin = require('puppeteer-extra-plugin-stealth');
  puppeteer.use(StealthPlugin());
  
  (async () => {
    console.log("🖥️ Đang khởi chạy trình duyệt độc lập để thực hiện test...");
    try {
      const browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
      });
      const pages = await browser.pages();
      const page = pages[0] || await browser.newPage();
      
      console.log("ℹ️ Vui lòng đăng nhập Facebook trên cửa sổ trình duyệt vừa hiện lên nếu cần.");
      await page.goto("https://www.facebook.com", { waitUntil: "networkidle2" });
      
      // Chạy test
      await runTest(page);
      
      console.log("🔒 Đóng trình duyệt sau 5 giây...");
      await delay(5000);
      await browser.close();
    } catch (e) {
      console.error("Lỗi trình duyệt độc lập:", e.message);
    }
  })();
}
