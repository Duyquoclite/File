const fs = require('fs');
const path = require('path');

// ==================== CẤU HÌNH KỊCH BẢN TƯƠNG TÁC DẠO CAO CẤP ====================
let CONFIG = {
  minDelay: 2000,           // Delay tối thiểu giữa các hành động (ms)
  maxDelay: 5000,           // Delay tối đa giữa các hành động (ms)
  scrollSteps: Infinity,    // Thực hiện không giới hạn tương tác (chạy vô hạn)
  reactProbability: 0.85,    // Tỷ lệ thả cảm xúc (85%)
  commentProbability: 0.45,   // Tỷ lệ bình luận (45%)
  shareProbability: 0.15,     // Tỷ lệ chia sẻ bài viết (15%)
  
  // Danh sách từ khóa mặc định (fallback nếu không đọc được file ngoài)
  searchKeywords: [
    'tin tức công nghệ mới nhất', 'khoa học vũ trụ lý thú', 'mẹo vặt cuộc sống hằng ngày', 
    'công thức nấu ăn ngon dễ làm', 'bóng đá ngoại hạng anh đêm qua', 'địa điểm du lịch hè 2026'
  ],
  groupKeywords: [
    'cộng đồng lập trình viên Việt Nam', 'hội những người yêu mèo', 'món ngon mỗi ngày và công thức'
  ],
  comments: {
    sad: ["Xin chia buồn cùng gia đình ạ 😢"],
    happy: ["Chúc mừng bạn nha! 🎉"],
    funny: ["Haha cười xỉu luôn 😂"],
    neutral: ["Hay quá bạn ơi 😄 👍"]
  }
};

// Nạp tự động dữ liệu phong phú từ file ngoài keywords_data.json nếu tồn tại
const dataPath = path.join(process.cwd(), 'keywords_data.json');
if (fs.existsSync(dataPath)) {
  try {
    const rawData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    if (rawData.searchKeywords && rawData.searchKeywords.length > 0) {
      CONFIG.searchKeywords = rawData.searchKeywords;
    }
    if (rawData.groupKeywords && rawData.groupKeywords.length > 0) {
      CONFIG.groupKeywords = rawData.groupKeywords;
    }
    if (rawData.comments) {
      CONFIG.comments = rawData.comments;
    }
    console.info(`[Setup] Nạp thành công dữ liệu từ keywords_data.json! (${CONFIG.searchKeywords.length} từ khóa tìm kiếm, ${CONFIG.groupKeywords.length} từ khóa nhóm).`);
  } catch (err) {
    console.warn("[Setup] Lỗi khi đọc file keywords_data.json, sử dụng cấu hình mặc định:", err.message);
  }
}

// Hàm hỗ trợ delay ngẫu nhiên giả lập hành vi người dùng
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const randomDelay = () => delay(Math.floor(Math.random() * (CONFIG.maxDelay - CONFIG.minDelay)) + CONFIG.minDelay);

// Vị trí chuột ảo để giả lập di chuyển mượt mà (tránh bị AI check bot)
let currentMousePos = { x: 400, y: 300 };

// Hàm di chuyển chuột mượt mà theo đường đi tuyến tính có gia tốc nhẹ
async function moveMouseTo(page, targetX, targetY) {
  const steps = 8 + Math.floor(Math.random() * 5); // 8-12 bước trung gian
  const startX = currentMousePos.x;
  const startY = currentMousePos.y;
  
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    // Thêm chút nhiễu sóng ngẫu nhiên để giống tay người run nhẹ
    const x = startX + (targetX - startX) * t + Math.sin(t * Math.PI) * (Math.random() * 6 - 3);
    const y = startY + (targetY - startY) * t + Math.cos(t * Math.PI) * (Math.random() * 6 - 3);
    try {
      await page.mouse.move(x, y);
    } catch (e) {}
    await delay(Math.floor(Math.random() * 12) + 8);
  }
  try {
    await page.mouse.move(targetX, targetY);
  } catch (e) {}
  currentMousePos = { x: targetX, y: targetY };
}

// Phân tích cảm xúc nội dung bài viết bằng từ khóa chính (Vietnamese Keywords)
function analyzeSentiment(text) {
  if (!text) return 'neutral';
  
  const lowerText = text.toLowerCase();
  
  const sadKeywords = [
    'buồn', 'chia buồn', 'mất', 'khóc', 'tai nạn', 'qua đời', 'rip', 'tang', 'kính viếng', 
    'đau lòng', 'thương tiếc', 'chia ly', 'suy sụp', 'mất mát', 'phúng viếng', 'qua doi'
  ];
  const happyKeywords = [
    'chúc mừng', 'tuyệt vời', 'chúc mừng sinh nhật', 'cmsn', 'happy birthday', 'thành công', 
    'vui vẻ', 'may mắn', 'hạnh phúc', 'đẹp', 'xinh', 'celebrate', 'congratulations', 'tuyet voi'
  ];
  const funnyKeywords = [
    'haha', 'kaka', 'hài', 'cười', 'vui nhộn', 'chết cười', 'thư giãn', 'funny', 'tấu hài',
    'hai huoc', 'cuoi'
  ];
  
  let sadScore = sadKeywords.filter(kw => lowerText.includes(kw)).length;
  let happyScore = happyKeywords.filter(kw => lowerText.includes(kw)).length;
  let funnyScore = funnyKeywords.filter(kw => lowerText.includes(kw)).length;
  
  if (sadScore > 0 && sadScore >= happyScore && sadScore >= funnyScore) {
    return 'sad';
  }
  if (happyScore > 0 && happyScore >= sadScore && happyScore >= funnyScore) {
    return 'happy';
  }
  if (funnyScore > 0 && funnyScore >= sadScore && funnyScore >= happyScore) {
    return 'funny';
  }
  
  return 'neutral';
}

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

// Hàm đóng các modal/popup bài viết đang mở để tránh kẹt trang
async function closeActiveOverlays(page) {
  try {
    await page.keyboard.press('Escape');
    await delay(1000);
    const dialogClosed = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('[role="button"], button'));
      let clicked = false;
      for (const btn of buttons) {
        const text = (btn.textContent || '').trim().toLowerCase();
        if (text.includes('leave page') || text.includes('rời khỏi') || text.includes('leave') || text.includes('rời')) {
          btn.click();
          clicked = true;
          break;
        }
      }
      return clicked;
    });
    if (dialogClosed) {
      await delay(1000);
    } else {
      await page.keyboard.press('Escape');
      await delay(1000);
    }
  } catch (e) {}
}

// Lắng nghe và tự động xử lý các hộp thoại Chrome Native (như cảnh báo Rời trang trước khi lưu)
page.on('dialog', async dialog => {
  const type = dialog.type();
  console.info(`[DIALOG] Phát hiện dialog loại: ${type}, tin nhắn: "${dialog.message()}"`);
  if (type === 'beforeunload') {
    await dialog.accept();
    console.info("[DIALOG] Đã tự động chấp nhận Rời trang (beforeunload).");
  } else {
    await dialog.dismiss();
  }
});

// ==================== ĐỊNH NGHĨA CÁC HÀNH ĐỘNG TƯƠNG TÁC DẠO ====================

// HÀNH ĐỘNG A: Tương tác bài viết trên Bảng tin (Feed)
async function doFeedInteraction(page) {
  console.log("\n--- [Hành động] Đang lướt và tương tác Bảng tin ---");
  const currentUrl = page.url();
  if (!currentUrl.includes("facebook.com") || currentUrl.includes("/search/") || currentUrl.includes("/groups/")) {
    console.info("Chuyển hướng về Trang chủ Facebook...");
    await page.goto("https://www.facebook.com", { waitUntil: "networkidle2" });
    await delay(3000);
  }

  const likeIndicators = await page.$$('[data-ad-rendering-role="like_button"]');
  let targetLikeIndicator = null;
  let targetPostInfo = null;
  
  for (const indicator of likeIndicators) {
    try {
      const postInfo = await page.evaluate((likeEl) => {
        const postEl = likeEl.closest('div[aria-posinset]') || 
                       likeEl.closest('[data-testid="fbfeed_story"]') || 
                       likeEl.closest('div[role="article"]') ||
                       likeEl.parentElement.parentElement.parentElement.parentElement.parentElement;
        if (!postEl) return null;
        if (postEl.getAttribute('data-local-processed') === 'true') return null;
        
        const authorEl = postEl.querySelector('[data-ad-rendering-role="profile_name"]');
        const msgEl = postEl.querySelector('[data-ad-rendering-role="story_message"]');
        return {
          author: authorEl ? authorEl.textContent.trim() : 'Ẩn danh',
          message: msgEl ? msgEl.textContent.trim() : ''
        };
      }, indicator);
      
      if (!postInfo) continue;
      targetLikeIndicator = indicator;
      targetPostInfo = postInfo;
      break;
    } catch (e) {}
  }
  
  if (!targetLikeIndicator) {
    console.info("Không thấy bài viết mới trên màn hình. Đang cuộn xuống thêm...");
    const scrollHeight = Math.floor(Math.random() * 400) + 400;
    await page.evaluate((y) => window.scrollBy(0, y), scrollHeight);
    await delay(3000);
    return false;
  }
  
  const postContainer = await page.evaluateHandle((likeEl) => {
    const postEl = likeEl.closest('div[aria-posinset]') || 
                   likeEl.closest('[data-testid="fbfeed_story"]') || 
                   likeEl.closest('div[role="article"]') ||
                   likeEl.parentElement.parentElement.parentElement.parentElement.parentElement;
    if (postEl) {
      postEl.setAttribute('data-local-processed', 'true');
    }
    return postEl;
  }, targetLikeIndicator);
  
  const postElement = postContainer.asElement();
  if (!postElement) return false;

  console.log(`👤 Người đăng: ${targetPostInfo.author}`);
  if (targetPostInfo.message) {
    console.log(`📝 Nội dung: "${targetPostInfo.message.substring(0, 80)}${targetPostInfo.message.length > 80 ? '...' : ''}"`);
  }
  
  const sentiment = analyzeSentiment(targetPostInfo.message);
  console.log(`🧠 Phân tích cảm xúc: ${sentiment.toUpperCase()}`);
  
  await page.evaluate((el) => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), postElement);
  await delay(2000);

  let success = false;

  // 1. Giả lập đọc bình luận
  try {
    const commentIndicator = await postElement.$('[data-ad-rendering-role="comment_button"]');
    if (commentIndicator) {
      const commentBtn = await page.evaluateHandle(el => el.closest('[role="button"]'), commentIndicator);
      if (commentBtn && commentBtn.asElement()) {
        const btnEl = commentBtn.asElement();
        const isCommentsOpen = await postElement.evaluate((el) => {
          return !!el.querySelector('div[contenteditable="true"], div[role="textbox"], textarea');
        });
        
        if (!isCommentsOpen) {
          console.info("💬 Mở bình luận để xem...");
          await smartClick(page, btnEl);
          await delay(2000);
        }
        
        const postComments = await postElement.evaluate((el) => {
          const spans = Array.from(el.querySelectorAll('span[dir="auto"]'));
          const list = [];
          for (const span of spans) {
            const text = span.textContent ? span.textContent.trim() : '';
            if (text && text.length > 3 && !text.includes("Thích") && !text.includes("Bình luận") && !text.includes("Chia sẻ") && isNaN(text)) {
              list.push(text);
            }
          }
          return list.slice(0, 3);
        });
        
        if (postComments.length > 0) {
          console.info(`👁️ Đang đọc ${postComments.length} bình luận...`);
          for (const commentText of postComments) {
            console.log(`   👁️ Đọc comment: "${commentText}"`);
            await delay(Math.floor(Math.random() * 1200) + 800);
          }
        }
      }
    }
  } catch (e) {}

  // 2. Thả cảm xúc
  if (Math.random() < CONFIG.reactProbability) {
    try {
      const likeBtn = await page.evaluateHandle(el => el.closest('[role="button"]'), targetLikeIndicator);
      if (likeBtn && likeBtn.asElement()) {
        const btnEl = likeBtn.asElement();
        const isLiked = await page.evaluate((el) => {
          const label = (el.getAttribute('aria-label') || '').toLowerCase();
          const isPressed = el.getAttribute('aria-pressed') === 'true';
          return isPressed || label.includes('unlike') || label.includes('bỏ thích') || label.includes('remove') || label.includes('đã bày tỏ');
        }, btnEl);
        
        if (isLiked) {
          console.info("ℹ️ Bài viết đã được thích trước đó.");
          success = true;
        } else {
          const box = await btnEl.boundingBox();
          if (box) {
            const targetX = box.x + box.width / 2;
            const targetY = box.y + box.height / 2;
            await moveMouseTo(page, targetX, targetY);
            await delay(400);
            
            let chosenReaction = 'Like';
            const reactionRoll = Math.random();
            if (sentiment === 'sad') chosenReaction = reactionRoll < 0.7 ? 'Care' : 'Sad';
            else if (sentiment === 'happy') chosenReaction = reactionRoll < 0.6 ? 'Love' : 'Like';
            else if (sentiment === 'funny') chosenReaction = reactionRoll < 0.8 ? 'Haha' : 'Like';
            else chosenReaction = reactionRoll < 0.5 ? 'Like' : (reactionRoll < 0.85 ? 'Love' : 'Haha');
            
            if (chosenReaction === 'Like') {
              console.info("👍 Bấm Like bài viết!");
              await smartClick(page, btnEl);
              success = true;
            } else {
              console.info(` Bày tỏ cảm xúc đặc biệt: ${chosenReaction}`);
              await page.mouse.move(targetX, targetY);
              await delay(1800);
              
              let reactionSelector = '';
              if (chosenReaction === 'Love') reactionSelector = 'div[aria-label="Yêu thích"], div[aria-label="Love"]';
              else if (chosenReaction === 'Haha') reactionSelector = 'div[aria-label="Haha"]';
              else if (chosenReaction === 'Care') reactionSelector = 'div[aria-label="Thương thương"], div[aria-label="Care"]';
              else if (chosenReaction === 'Sad') reactionSelector = 'div[aria-label="Buồn"], div[aria-label="Sad"]';
              
              const reactBtn = await page.$(reactionSelector);
              if (reactBtn) {
                const reactBox = await reactBtn.boundingBox();
                if (reactBox) {
                  await moveMouseTo(page, reactBox.x + reactBox.width / 2, reactBox.y + reactBox.height / 2);
                  await delay(300);
                  await reactBtn.click();
                  success = true;
                }
              } else {
                await smartClick(page, btnEl);
                success = true;
              }
            }
          }
        }
      }
    } catch (e) {}
  }

  // 3. Bình luận bài viết
  if (Math.random() < CONFIG.commentProbability) {
    try {
      let commentInput = await page.evaluateHandle((postEl) => {
        let inp = postEl.querySelector('div[contenteditable="true"], div[role="textbox"]');
        if (inp) return inp;
        let ta = postEl.querySelector('textarea');
        if (ta) return ta;
        const elements = Array.from(postEl.querySelectorAll('[role="button"], [aria-label]'));
        for (const item of elements) {
          const label = (item.getAttribute('aria-label') || '').toLowerCase();
          if (label.includes('comment') || label.includes('bình luận') || label.includes('write')) return item;
        }
        return null;
      }, postElement);
      
      if (commentInput && commentInput.asElement()) {
        const inputElement = commentInput.asElement();
        const isPlaceholder = await page.evaluate(el => el.getAttribute('role') === 'button' && !el.querySelector('div[contenteditable="true"]'), inputElement);
        
        let targetInput = inputElement;
        if (isPlaceholder) {
          await smartClick(page, inputElement);
          await delay(1500);
          const realInput = await postElement.$('div[contenteditable="true"], div[role="textbox"], textarea');
          if (realInput) targetInput = realInput;
        }
        
        await targetInput.focus();
        await smartClick(page, targetInput);
        await delay(800);
        
        const commentPool = CONFIG.comments[sentiment] || CONFIG.comments.neutral;
        const chosenComment = commentPool[Math.floor(Math.random() * commentPool.length)];
        
        console.info(`✍️ Đang gõ bình luận: "${chosenComment}"`);
        for (const char of chosenComment) {
          await page.keyboard.sendCharacter(char);
          await delay(Math.floor(Math.random() * 100) + 40);
        }
        await delay(1200);
        
        const sendBtn = await postElement.evaluateHandle((el) => {
          const svgBtns = Array.from(el.querySelectorAll('[role="button"], div[aria-label="Bình luận"], div[aria-label="Comment"], div[aria-label="Gửi"]'));
          for (const btn of svgBtns) {
            const label = (btn.getAttribute('aria-label') || '').toLowerCase();
            if (label === 'bình luận' || label === 'comment' || label === 'gửi' || label === 'send') return btn;
          }
          return null;
        });

        if (sendBtn && sendBtn.asElement()) {
          console.info("🚀 Click nút Gửi bình luận...");
          await smartClick(page, sendBtn.asElement());
        } else {
          console.info("🚀 Nhấn Enter để gửi bình luận...");
          await page.keyboard.press("Enter");
        }
        await delay(3000);
        success = true;
      }
    } catch (e) {}
  }

  // 4. Chia sẻ bài tin
  if (Math.random() < CONFIG.shareProbability) {
    try {
      const shareBtn = await postElement.$('[aria-label="Chia sẻ"], [aria-label="Share"], [aria-label*="share"]');
      if (shareBtn) {
        console.info("🔄 Click nút Chia sẻ bài viết...");
        await smartClick(page, shareBtn);
        await delay(2000);
        
        const shareNowBtn = await page.evaluateHandle(() => {
          const items = Array.from(document.querySelectorAll('[role="menuitem"], [role="button"], span'));
          for (const item of items) {
            const text = (item.textContent || '').toLowerCase();
            if (text.includes("chia sẻ ngay") || text.includes("share now") || text.includes("chia sẻ lên bảng tin")) {
              return item;
            }
          }
          return null;
        });
        
        if (shareNowBtn && shareNowBtn.asElement()) {
          console.info("🚀 Click xác nhận chia sẻ ngay...");
          await smartClick(page, shareNowBtn.asElement());
          await delay(3000);
          success = true;
        } else {
          await page.keyboard.press('Escape');
          await delay(1000);
        }
      }
    } catch (e) {}
  }

  await closeActiveOverlays(page);
  return success;
}

// HÀNH ĐỘNG B: Tìm kiếm từ khóa và đọc bình luận bài viết ngoài
async function doSearchAndRead(page) {
  console.log("\n--- [Hành động] Đang thực hiện tìm kiếm bài viết & đọc bình luận ---");
  const keyword = CONFIG.searchKeywords[Math.floor(Math.random() * CONFIG.searchKeywords.length)];
  console.log(`[Search] Gõ tìm kiếm từ khóa: "${keyword}"...`);
  
  await page.goto(`https://www.facebook.com/search/posts/?q=${encodeURIComponent(keyword)}`, { waitUntil: "networkidle2" });
  await delay(5000);

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
      await page.evaluate((el) => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), searchLikeBtn);
      await delay(1500);

      const commentBtn = await searchPostEl.$('[data-ad-rendering-role="comment_button"]');
      if (commentBtn) {
        console.log("[Search] 💬 Đang nhấp mở danh mục bình luận bài viết...");
        await smartClick(page, commentBtn);
        await delay(3000);

        const comments = await searchPostEl.evaluate((el) => {
          const spans = Array.from(el.querySelectorAll('span[dir="auto"]'));
          const list = [];
          for (const span of spans) {
            const text = span.textContent ? span.textContent.trim() : '';
            if (text && text.length > 5 && !text.includes("Thích") && !text.includes("Bình luận") && !text.includes("Chia sẻ") && isNaN(text)) {
              list.push(text);
            }
          }
          return list.slice(0, 3);
        });

        console.log(`[Search] 👁️ Đã đọc bình luận từ cộng đồng mạng:`);
        comments.forEach((txt, idx) => {
          console.log(`   👉 Comment ${idx + 1}: "${txt}"`);
        });
        
        await delay(2000);
        await closeActiveOverlays(page);
        return true;
      }
    }
  }
  return false;
}

// HÀNH ĐỘNG C: Xem Stories (Tin ngắn)
async function doViewStories(page) {
  console.log("\n--- [Hành động] Đang nhấp xem Stories trên bảng tin ---");
  await page.goto("https://www.facebook.com", { waitUntil: "networkidle2" });
  await delay(4000);

  const storyCard = await page.$('[role="link"][href*="/stories/"]');
  if (storyCard) {
    console.log("[Story] 👉 Click để mở đầu câu chuyện (Story)...");
    await smartClick(page, storyCard);
    await delay(5000);

    const nextBtn = await page.$('[aria-label="Thẻ tiếp theo"], [aria-label="Next card"], [aria-label="Chuyển tiếp"]');
    if (nextBtn) {
      console.log("[Story] 👉 Click chuyển sang Story kế tiếp...");
      await smartClick(page, nextBtn);
      await delay(4000);
    }

    console.log("[Story] 🔙 Nhấn Escape đóng trình phát Story...");
    await page.keyboard.press('Escape');
    await delay(2000);
    return true;
  }
  console.log("[Story] ⚠️ Không phát hiện thẻ Story khả dụng.");
  return false;
}

// HÀNH ĐỘNG D: Khám phá nhóm gợi ý hoặc Tìm kiếm hội nhóm để Tham gia
async function doJoinGroup(page) {
  console.log("\n--- [Hành động] Khám phá & Gửi yêu cầu tham gia hội nhóm ---");
  const useSearch = Math.random() < 0.5;
  
  if (useSearch) {
    const groupKw = CONFIG.groupKeywords[Math.floor(Math.random() * CONFIG.groupKeywords.length)];
    console.log(`[Group] Tìm kiếm hội nhóm với từ khóa: "${groupKw}"...`);
    await page.goto(`https://www.facebook.com/search/groups/?q=${encodeURIComponent(groupKw)}`, { waitUntil: "networkidle2" });
  } else {
    console.log("[Group] Đang chuyển tới trang gợi ý nhóm discover...");
    await page.goto("https://www.facebook.com/groups/discover/", { waitUntil: "networkidle2" });
  }
  await delay(5000);

  // Tìm các nút tham gia nhóm trên trang hiện tại
  console.log("[Group] Tìm kiếm nút tham gia nhóm trên trang kết quả...");
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
    console.log("[Group] ✅ Đã nhấn nút Tham gia thành công!");
    await delay(3000);
    return true;
  }
  console.log("[Group] ⚠️ Không tìm thấy nút tham gia nhóm nào trên màn hình.");
  return false;
}

// HÀNH ĐỘNG E: Kiểm tra thông báo (Notifications)
async function doCheckNotifications(page) {
  console.log("\n--- [Hành động] Đang kiểm tra thông báo mới ---");
  await page.goto("https://www.facebook.com/notifications", { waitUntil: "networkidle2" });
  await delay(4000);

  console.log("[Notification] 👀 Cuộn xem danh sách thông báo...");
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => window.scrollBy({ top: 300, behavior: 'smooth' }));
    await delay(2000);
    // Di chuyển chuột nhẹ nhàng giả lập đọc
    const x = Math.floor(Math.random() * 400) + 200;
    const y = Math.floor(Math.random() * 400) + 200;
    await page.mouse.move(x, y);
    await delay(1000);
  }

  // Thử click vào thông báo đầu tiên để tăng tính tự nhiên
  try {
    const firstNotification = await page.evaluateHandle(() => {
      const rows = Array.from(document.querySelectorAll('[role="row"], [role="listitem"]'));
      for (const row of rows) {
        const link = row.querySelector('a[href*="/"]');
        if (link && !link.href.includes('/notifications')) return link;
      }
      return document.querySelector('a[href*="?notif_id="]') || document.querySelector('a[href*="&notif_t="]');
    });

    if (firstNotification && firstNotification.asElement()) {
      console.log("[Notification] 👉 Click xem chi tiết một thông báo...");
      await smartClick(page, firstNotification.asElement());
      await delay(6000); // Đợi xem trang đó 6 giây
      return true;
    }
  } catch (err) {
    console.warn("[Notification] Lỗi nhẹ khi nhấn xem thông báo:", err.message);
  }

  return true;
}

// HÀNH ĐỘNG F: Lướt xem Reels (Video ngắn)
async function doScrollReels(page) {
  console.log("\n--- [Hành động] Đang chuyển sang xem Reels (Video ngắn) ---");
  await page.goto("https://www.facebook.com/reels", { waitUntil: "networkidle2" });
  await delay(5000);

  const reelsToWatch = Math.floor(Math.random() * 3) + 3; // Xem 3-5 reels
  console.log(`[Reels] Bắt đầu lướt xem ${reelsToWatch} video ngắn...`);

  for (let i = 0; i < reelsToWatch; i++) {
    const watchTime = Math.floor(Math.random() * 10) + 10; // Xem từ 10 đến 20 giây mỗi video
    console.log(`[Reels]   🎥 Đang xem video thứ ${i + 1}/${reelsToWatch} trong ${watchTime} giây...`);
    
    // Đợi kết hợp di chuyển chuột nhẹ nhàng
    const intervals = Math.floor(watchTime / 2);
    for (let j = 0; j < intervals; j++) {
      await delay(2000);
      const x = Math.floor(Math.random() * 300) + 300;
      const y = Math.floor(Math.random() * 300) + 300;
      await page.mouse.move(x, y);
    }

    // 25% cơ hội bày tỏ cảm xúc (Like)
    if (Math.random() < 0.25) {
      try {
        const likeBtn = await page.evaluateHandle(() => {
          const buttons = Array.from(document.querySelectorAll('[role="button"], button'));
          for (const btn of buttons) {
            const label = (btn.getAttribute('aria-label') || '').toLowerCase();
            if (label === 'thích' || label === 'like') return btn;
          }
          return null;
        });

        if (likeBtn && likeBtn.asElement()) {
          console.log("[Reels]   👍 Thả tim/Thích video ngắn này!");
          await smartClick(page, likeBtn.asElement());
          await delay(1500);
        }
      } catch (err) {
        console.warn("[Reels] Lỗi nhẹ khi thả cảm xúc video ngắn:", err.message);
      }
    }

    // Chuyển sang reel tiếp theo
    console.log("[Reels]   ➡️ Nhấn phím xuống (ArrowDown) để chuyển video kế tiếp...");
    await page.keyboard.press('ArrowDown');
    await delay(3000);
  }

  return true;
}

// HÀNH ĐỘNG G: Đi dạo loanh quanh ngẫu nhiên khoảng 5 phút (Human Idle Walk)
async function doRandomBrowsing(page) {
  console.log("\n--- [Hành động] Bắt đầu đi dạo dạo loanh quanh (khoảng 5 phút) để tránh AI quét ---");
  const targetDurationMs = (5 * 60 + Math.floor(Math.random() * 60) - 30) * 1000; // 4.5 đến 5.5 phút
  const startTime = Date.now();

  // Chuyển về Home để bắt đầu dạo
  await page.goto("https://www.facebook.com", { waitUntil: "networkidle2" });
  await delay(4000);

  let step = 1;
  while (Date.now() - startTime < targetDurationMs) {
    const elapsedMins = ((Date.now() - startTime) / 60000).toFixed(1);
    console.log(`[Dạo chơi] Bước ${step} (Đã dạo được ${elapsedMins} phút)...`);
    
    const choice = Math.random();
    if (choice < 0.35) {
      // Cuộn trang xem tin tức
      const direction = Math.random() < 0.85 ? 'down' : 'up';
      const distance = Math.floor(Math.random() * 400) + 200;
      console.log(`[Dạo chơi]   📜 Cuộn trang ${direction === 'down' ? 'xuống' : 'lên'} ${distance}px...`);
      await page.evaluate((dir, dist) => {
        window.scrollBy({ top: dir === 'down' ? dist : -dist, behavior: 'smooth' });
      }, direction, distance);
    } 
    else if (choice < 0.55) {
      // Di chuột ngẫu nhiên quanh trang
      console.log("[Dạo chơi]   🖱️ Di chuyển chuột ngẫu nhiên...");
      for (let i = 0; i < 3; i++) {
        const x = Math.floor(Math.random() * 600) + 100;
        const y = Math.floor(Math.random() * 600) + 100;
        await page.mouse.move(x, y);
        await delay(1000);
      }
    } 
    else if (choice < 0.70) {
      // Đọc kĩ nội dung (Đứng yên xem)
      const idleTime = Math.floor(Math.random() * 15) + 10;
      console.log(`[Dạo chơi]   👁️ Đứng yên đọc tin trong ${idleTime} giây...`);
      await delay(idleTime * 1000);
    } 
    else if (choice < 0.85) {
      // Click vào một liên kết bất kỳ trên trang (ví dụ bài đăng của ai đó, nhóm, trang cá nhân)
      try {
        const randomLink = await page.evaluateHandle(() => {
          const links = Array.from(document.querySelectorAll('a[href*="/posts/"], a[href*="/groups/"], a[href*="/permalink.php"]'));
          if (links.length > 0) {
            return links[Math.floor(Math.random() * links.length)];
          }
          return null;
        });

        if (randomLink && randomLink.asElement()) {
          console.log("[Dạo chơi]   🔗 Click vào một bài đăng/nhóm ngẫu nhiên...");
          await smartClick(page, randomLink.asElement());
          await delay(10000); // Xem trang mới trong 10 giây
          console.log("[Dạo chơi]   🔙 Quay lại trang chủ...");
          await page.goto("https://www.facebook.com", { waitUntil: "networkidle2" });
          await delay(4000);
        }
      } catch (err) {
        // bỏ qua
      }
    } 
    else {
      // Đi tới trang mục đặc biệt như Watch hay Groups
      const sections = ["https://www.facebook.com/watch", "https://www.facebook.com/groups"];
      const randomSection = sections[Math.floor(Math.random() * sections.length)];
      console.log(`[Dạo chơi]   🌐 Rẽ qua trang: ${randomSection}...`);
      await page.goto(randomSection, { waitUntil: "networkidle2" });
      await delay(8000);
    }

    step++;
    // Delay giữa các bước dạo từ 10 - 20s
    await delay(Math.floor(Math.random() * 10000) + 10000);
  }

  console.log("[Dạo chơi] ✅ Đã hoàn thành 5 phút đi dạo thư giãn!");
  return true;
}

// ==================== BẮT ĐẦU CHẠY KỊCH BẢN CHÍNH ====================

console.log("🚀 Bắt đầu khởi động kịch bản tương tác dạo Facebook cao cấp...");

// 1. Kiểm tra URL hiện tại, nếu chưa ở Facebook thì chuyển hướng sang facebook.com
const currentUrl = page.url();
if (!currentUrl.includes("facebook.com")) {
  console.info("Chưa truy cập Facebook. Đang tự động chuyển hướng...");
  await page.goto("https://www.facebook.com", { waitUntil: "networkidle2" });
  await delay(3000);
}

// 2. Chờ load bảng tin
console.info("Đang kiểm tra bảng tin...");
try {
  await page.waitForSelector('[data-ad-rendering-role="like_button"]', { timeout: 10000 });
} catch (e) {
  console.warn("Đang đợi thêm nội dung bảng tin tải xuống...");
}

// 3. Tiến hành cuộn trang và tương tác ngẫu nhiên theo danh sách các hành động
let interactedCount = 0;
const maxInteractions = CONFIG.scrollSteps;

while (interactedCount < maxInteractions) {
  const roll = Math.random();
  let success = false;
  
  if (roll < 0.40) {
    // 40% cơ hội tương tác trực tiếp trên Bảng tin
    success = await doFeedInteraction(page);
  } else if (roll < 0.55) {
    // 15% cơ hội tìm kiếm từ khóa ngẫu nhiên và đọc comment
    success = await doSearchAndRead(page);
  } else if (roll < 0.65) {
    // 10% cơ hội xem stories/tin ngắn của bạn bè
    success = await doViewStories(page);
  } else if (roll < 0.75) {
    // 10% cơ hội khám phá và tham gia nhóm mới
    success = await doJoinGroup(page);
  } else if (roll < 0.85) {
    // 10% cơ hội kiểm tra thông báo
    success = await doCheckNotifications(page);
  } else if (roll < 0.95) {
    // 10% cơ hội lướt xem Reels
    success = await doScrollReels(page);
  } else {
    // 5% cơ hội đi dạo loanh quanh 5 phút
    success = await doRandomBrowsing(page);
  }
  
  if (success) {
    interactedCount++;
    console.log(`[TIẾN TRÌNH] Đã hoàn thành ${interactedCount} lượt tương tác.`);
    
    // Cứ sau mỗi 25 lượt tương tác, tự động tải lại trang chủ để giải phóng bộ nhớ đệm của Facebook, tránh lag/crash trình duyệt
    if (interactedCount % 25 === 0) {
      console.info("🔄 Đang tải lại trang để giải phóng bộ nhớ đệm (tránh lag/crash trình duyệt)...");
      try {
        await page.goto("https://www.facebook.com", { waitUntil: "networkidle2" });
        await delay(5000);
      } catch (reloadErr) {
        console.warn("Lỗi nhẹ khi tải lại trang:", reloadErr.message);
      }
    }
  }
  
  // Nghỉ giữa các hành động lớn
  await randomDelay();
}

console.log("🎉 Hoàn thành kịch bản tương tác dạo Facebook thành công!");
