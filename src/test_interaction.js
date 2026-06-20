// ==================== FACEBOOK AUTOMATION TEST SCRIPT ====================
// Script này chạy trực tiếp trong môi trường Profile đã có sẵn session.
// Bạn không cần import puppeteer vì 'page' và 'browser' đã được hệ thống cung cấp sẵn.

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Hàm hỗ trợ click bằng tọa độ chuột thực tế để tránh anti-bot
async function humanClick(page, element) {
  const box = await element.boundingBox();
  if (box) {
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y, { steps: 10 });
    await delay(300);
    await page.mouse.down();
    await delay(50);
    await page.mouse.up();
    return true;
  }
  return false;
}

async function runTestAutomation() {
  console.log("🎬 BẮT ĐẦU CHẠY THỬ NGHIỆM AUTOMATION NÂNG CAO...");

  // Bước 1: Điều hướng tới Trang chủ Facebook
  console.log("Step 1: Điều hướng tới Facebook...");
  await page.goto("https://www.facebook.com", { waitUntil: "networkidle2" });
  await delay(3000);

  // Kiểm tra đăng nhập
  const isLoggedIn = await page.evaluate(() => {
    return !!document.querySelector('[aria-label="Trang cá nhân của bạn"]') || 
           !!document.querySelector('[aria-label="Your profile"]');
  });

  if (!isLoggedIn) {
    console.log("❌ Chưa đăng nhập Facebook. Đang cố gắng nạp cookie...");
    // Đoạn code nạp cookie mẫu (nếu cần thiết)
    const rawCookie = "YOUR_COOKIE_HERE"; // Không nên lưu trực tiếp cookie thật vào code
    // Bạn có thể import cookie thông qua trang quản lý profile của ứng dụng.
  } else {
    console.log("✅ Đã phát hiện trạng thái Đăng nhập thành công!");
  }

  // Bước 2: Tìm kiếm một từ khóa và đọc bình luận
  const searchKeyword = "công nghệ";
  console.log(`Step 2: Tìm kiếm từ khóa "${searchKeyword}"...`);
  const searchUrl = `https://www.facebook.com/search/posts/?q=${encodeURIComponent(searchKeyword)}`;
  await page.goto(searchUrl, { waitUntil: "networkidle2" });
  await delay(4000);

  console.log("Tìm các bài viết từ kết quả tìm kiếm...");
  const posts = await page.$$('div[aria-posinset], [data-testid="fbfeed_story"]');
  console.log(`Tìm thấy ${posts.length} bài viết từ kết quả tìm kiếm.`);

  if (posts.length > 0) {
    const firstPost = posts[0];
    // Cuộn bài viết đầu tiên vào tầm nhìn
    await page.evaluate((el) => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), firstPost);
    await delay(2000);

    // Tìm nút Bình luận trong bài viết này
    const commentBtn = await firstPost.$('[data-ad-rendering-role="comment_button"], [aria-label*="bình luận"], [aria-label*="Comment"]');
    if (commentBtn) {
      console.log("👉 Click mở bình luận bài viết đầu tiên...");
      await commentBtn.click();
      await delay(3000);

      // Đọc các bình luận đang hiển thị
      const comments = await page.evaluate(() => {
        const commentElements = Array.from(document.querySelectorAll('span[dir="auto"]'));
        return commentElements
          .map(el => (el.textContent || '').trim())
          .filter(text => text.length > 5 && !text.includes('Thích') && !text.includes('Bình luận'))
          .slice(0, 5);
      });

      console.log("👁️ Các bình luận đọc được:");
      comments.forEach((c, idx) => console.log(`   [Comment ${idx + 1}]: "${c}"`));

      // Thử viết bình luận mẫu
      const input = await page.$('div[contenteditable="true"], div[role="textbox"]');
      if (input) {
        console.log("✍️ Đang thử gõ bình luận mẫu...");
        await input.focus();
        await page.keyboard.type("Bài viết chia sẻ rất hữu ích ạ! 👍");
        await delay(1000);
        console.log("🚀 Nhấn Escape để hủy bình luận (Tránh spam nick)...");
        await page.keyboard.press('Escape');
        await delay(500);
        await page.keyboard.press('Escape');
        await delay(1000);
      }
    }
  }

  // Bước 3: Tìm kiếm nhóm và mô phỏng Tham gia nhóm
  console.log("Step 3: Điều hướng tới mục nhóm...");
  const groupSearchUrl = "https://www.facebook.com/groups/feed/";
  await page.goto(groupSearchUrl, { waitUntil: "networkidle2" });
  await delay(4000);

  // Tìm các nhóm gợi ý hoặc nút tham gia nhóm
  const joinButtons = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('[role="button"], button'));
    // Tìm các nút có chữ Tham gia / Join
    return btns
      .map(btn => ({
        text: (btn.textContent || '').trim(),
        hasJoin: (btn.textContent || '').toLowerCase().includes('tham gia nhóm') || 
                 (btn.textContent || '').toLowerCase().includes('join group')
      }))
      .filter(item => item.hasJoin);
  });

  console.log(`Tìm thấy ${joinButtons.length} nút bấm tham gia nhóm trên trang gợi ý.`);
  // Để an toàn, chúng tôi chỉ log ra thay vì thực sự click để tránh checkpoint tài khoản
  if (joinButtons.length > 0) {
    console.log(`👉 Phát hiện nút tham gia nhóm: "${joinButtons[0].text}" (Chỉ mô phỏng, bỏ qua bấm thật để an toàn).`);
  }

  // Bước 4: Lướt tin (Stories/Reels)
  console.log("Step 4: Lướt tin ngắn (Stories)...");
  await page.goto("https://www.facebook.com/?sk=h_chr", { waitUntil: "networkidle2" }); // Link feed mới nhất
  await delay(3000);

  // Tìm khay Story
  const storyCards = await page.$$('[role="link"][href*="/stories/"]');
  console.log(`Tìm thấy ${storyCards.length} thẻ Story trên trang chủ.`);
  if (storyCards.length > 0) {
    console.log("👉 Đang click xem Story đầu tiên...");
    await storyCards[0].click();
    await delay(4000); // Xem story trong 4 giây

    // Click chuyển sang story tiếp theo
    const nextStoryBtn = await page.$('[aria-label="Thẻ tiếp theo"], [aria-label="Next card"], [aria-label="Chuyển tiếp"]');
    if (nextStoryBtn) {
      console.log("👉 Click chuyển tiếp Story tiếp theo...");
      await nextStoryBtn.click();
      await delay(3000);
    }

    console.log("👉 Bấm Escape để thoát giao diện Story...");
    await page.keyboard.press('Escape');
    await delay(2000);
  }

  console.log("🎉 HOÀN THÀNH TOÀN BỘ KỊCH BẢN THỬ NGHIỆM TƯƠNG TÁC!");
}

await runTestAutomation();
