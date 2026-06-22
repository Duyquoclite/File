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
  },
  messages: [
    "Chào bạn nhé! Chúc bạn một ngày tốt lành nha. 😊",
    "Hello bạn! Rất vui được làm quen với bạn. 👋",
    "Chào ngày mới vui vẻ nha bạn ơi! ☀️",
    "Hi! Chúc bạn ngày mới ngập tràn năng lượng tích cực! ✨",
    "Chào bạn nha! Có gì mới không nè? 😄",
    "Chào bạn, chúc bạn tuần mới làm việc thật hiệu quả nhé! 🍀"
  ],
  statuses: [
    "Cuộc sống không phải là mong chờ giông bão qua đi, mà là học cách nhảy múa dưới những cơn mưa. 🌧️💃",
    "Mỗi ngày mới là một cơ hội để bạn làm lại tốt hơn hôm qua. Cố lên nhé! 💪✨",
    "Hãy luôn mỉm cười, vì nụ cười của bạn là điều tuyệt vời nhất. 😊❤️",
    "Thành công không phải là chìa khóa mở cánh cửa hạnh phúc, mà hạnh phúc mới là chìa khóa dẫn tới thành công. 🔑🌟",
    "Làm việc chăm chỉ trong im lặng và để sự thành công của bạn lên tiếng. 🤫🚀",
    "Một ngày không có nụ cười là một ngày lãng phí. Chúc cả nhà ngày mới vui vẻ! ☀️🌸",
    "Không chuẩn bị nghĩa là bạn đang chuẩn bị cho sự thất bại. Lên kế hoạch cho tuần mới thôi! 📋🎯"
  ],
  targetPages: [
    "https://www.facebook.com/TinTe",
    "https://www.facebook.com/Kenh14",
    "https://www.facebook.com/welaxvietnam",
    "https://www.facebook.com/truyensot"
  ],
  birthdayWishes: [
    "Chúc mừng sinh nhật bạn nhé! Chúc tuổi mới tràn ngập niềm vui và thành công! 🎉🎂",
    "Chúc bạn sinh nhật vui vẻ, hạnh phúc bên gia đình và người thân nhé! 🥳✨",
    "Happy Birthday! Chúc bạn mọi điều tốt đẹp nhất trong tuổi mới! 🍀🎁",
    "Chúc bạn tuổi mới ngày càng xinh đẹp, khỏe mạnh và thành công nha! 🌸🍰"
  ]
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
    if (rawData.messages && rawData.messages.length > 0) {
      CONFIG.messages = rawData.messages;
    }
    if (rawData.statuses && rawData.statuses.length > 0) {
      CONFIG.statuses = rawData.statuses;
    }
    if (rawData.targetPages && rawData.targetPages.length > 0) {
      CONFIG.targetPages = rawData.targetPages;
    }
    if (rawData.birthdayWishes && rawData.birthdayWishes.length > 0) {
      CONFIG.birthdayWishes = rawData.birthdayWishes;
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
        if (text.includes('leave page') || text.includes('rời khỏi') || text.includes('leave') || text.includes('rời') || text.includes('quitter') || text.includes('tinggalkan')) {
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

// Helper function to find Like, Comment, or Share button in a post container (cross-language)
async function findPostButton(postElement, type) {
  return await postElement.evaluateHandle((el, buttonType) => {
    const labelsMap = {
      like: ['like', 'thích', 'suka', 'j’aime', 'j\'aime'],
      comment: ['comment', 'bình luận', 'komentari', 'commenter', 'viết bình luận'],
      share: ['share', 'chia sẻ', 'bagikan', 'partager', 'chia sẻ ngay', 'partager maintenant']
    };
    
    const targets = labelsMap[buttonType] || [];
    
    // Try data attribute first
    if (buttonType === 'like') {
      const adLike = el.querySelector('[data-ad-rendering-role="like_button"]');
      if (adLike) return adLike;
    } else if (buttonType === 'comment') {
      const adComment = el.querySelector('[data-ad-rendering-role="comment_button"]');
      if (adComment) return adComment;
    } else if (buttonType === 'share') {
      const adShare = el.querySelector('[data-ad-rendering-role="share_button"]');
      if (adShare) return adShare;
    }
    
    // Scan elements
    const candidates = Array.from(el.querySelectorAll('[role="button"], button, div[role="button"], span, a'));
    for (const cand of candidates) {
      const label = (cand.getAttribute('aria-label') || '').trim().toLowerCase();
      const text = (cand.textContent || '').trim().toLowerCase();
      
      if (targets.some(t => label === t || label.includes(t) || text === t || text.includes(t))) {
        const rect = cand.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          return cand;
        }
      }
    }
    return null;
  }, type);
}

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

  const posts = await page.$$('div[role="article"], div[aria-posinset], [data-testid="fbfeed_story"]');
  let targetPost = null;
  let targetPostInfo = null;
  let targetLikeIndicator = null;
  
  for (const post of posts) {
    try {
      const isProcessed = await page.evaluate(el => el.getAttribute('data-local-processed') === 'true', post);
      if (isProcessed) continue;
      
      const postInfo = await page.evaluate((postEl) => {
        const authorEl = postEl.querySelector('[data-ad-rendering-role="profile_name"]') ||
                         postEl.querySelector('h2 a[role="link"]') ||
                         postEl.querySelector('h3 a[role="link"]');
        const msgEl = postEl.querySelector('[data-ad-rendering-role="story_message"]') ||
                      postEl.querySelector('div[data-ad-preview="message"]');
        return {
          author: authorEl ? authorEl.textContent.trim() : 'Ẩn danh',
          message: msgEl ? msgEl.textContent.trim() : ''
        };
      }, post);
      
      const likeBtn = await findPostButton(post, 'like');
      if (likeBtn && likeBtn.asElement()) {
        targetPost = post;
        targetPostInfo = postInfo;
        targetLikeIndicator = likeBtn.asElement();
        break;
      }
    } catch (e) {}
  }
  
  if (!targetPost) {
    console.info("Không thấy bài viết mới trên màn hình. Đang cuộn xuống thêm...");
    const scrollHeight = Math.floor(Math.random() * 400) + 400;
    await page.evaluate((y) => window.scrollBy(0, y), scrollHeight);
    await delay(3000);
    return false;
  }
  
  await page.evaluate(el => el.setAttribute('data-local-processed', 'true'), targetPost);
  const postElement = targetPost;

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
    const commentBtn = await findPostButton(postElement, 'comment');
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
      
      const postComments = await postElement.evaluate((el, authorName) => {
        const spans = Array.from(el.querySelectorAll('span[dir="auto"]'));
        const list = [];
        const authorLower = authorName ? authorName.trim().toLowerCase() : '';
        const lowerWords = [
          'thích', 'bình luận', 'chia sẻ', 'phản hồi', 'trả lời', 'đang trả lời', 'xem thêm', 'xem bản dịch', 'viết',
          'like', 'comment', 'share', 'reply', 'view more', 'see translation', 'write',
          'suka', 'komentari', 'bagikan', 'balas', 'lihat selengkapnya', 'lihat terjemahan', 'tulis',
          'j’aime', 'jaime', 'commenter', 'partager', 'répondre', 'voir plus', 'voir la traduction', 'ecrire',
          'facebook', 'messenger'
        ];
        for (const span of spans) {
          const text = span.textContent ? span.textContent.trim() : '';
          if (!text || text.length < 3) continue;
          const clean = text.toLowerCase();
          
          if (/^\d+[a-z]?$/.test(clean)) continue;
          if (/^\d+\s*(s|m|h|d|w|y|s|ph|ngày|tuần|hari|minggu|j|jam|sem|an|ans|giờ|phút)$/.test(clean)) continue;
          if (authorLower && clean.includes(authorLower)) continue;
          if (/^[\p{Emoji}\p{Symbol}\p{Punctuation}\s]+$/u.test(clean)) continue;
          
          let isInterface = false;
          for (const word of lowerWords) {
            if (clean === word || clean.startsWith(word + ' ') || clean.endsWith(' ' + word) || clean.includes(' ' + word + ' ')) {
              isInterface = true;
              break;
            }
          }
          if (isInterface) continue;
          
          list.push(text);
        }
        return list;
      }, targetPostInfo ? targetPostInfo.author : '');
      
      if (postComments.length > 0) {
        const limitComments = postComments.slice(0, 3);
        console.info(`👁️ Đang đọc ${limitComments.length} bình luận...`);
        for (const commentText of limitComments) {
          console.log(`   👁️ Đọc comment: "${commentText}"`);
          await delay(Math.floor(Math.random() * 1200) + 800);
        }
      }
    }
  } catch (e) {}

  // 2. Thả cảm xúc
  if (Math.random() < CONFIG.reactProbability) {
    try {
      const likeBtn = await findPostButton(postElement, 'like');
      if (likeBtn && likeBtn.asElement()) {
        const btnEl = likeBtn.asElement();
        const isLiked = await page.evaluate((el) => {
          const label = (el.getAttribute('aria-label') || '').toLowerCase();
          const isPressed = el.getAttribute('aria-pressed') === 'true';
          return isPressed || label.includes('unlike') || label.includes('bỏ thích') || label.includes('remove') || label.includes('đã bày tỏ') || label.includes('batal menyukai') || label.includes('je n’aime plus') || label.includes('je n\'aime plus');
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
              if (chosenReaction === 'Love') reactionSelector = 'div[aria-label="Yêu thích"], div[aria-label="Love"], div[aria-label="Adore"], div[aria-label="Super"]';
              else if (chosenReaction === 'Haha') reactionSelector = 'div[aria-label="Haha"]';
              else if (chosenReaction === 'Care') reactionSelector = 'div[aria-label="Thương thương"], div[aria-label="Care"], div[aria-label="Solidaire"], div[aria-label="Peduli"]';
              else if (chosenReaction === 'Sad') reactionSelector = 'div[aria-label="Buồn"], div[aria-label="Sad"], div[aria-label="Triste"], div[aria-label="Sedih"]';
              
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
          if (label.includes('comment') || label.includes('bình luận') || label.includes('write') || label.includes('tulis') || label.includes('ecrire') || label.includes('komentar')) return item;
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
          const svgBtns = Array.from(el.querySelectorAll('[role="button"], div[aria-label]'));
          const sendLabels = ['bình luận', 'comment', 'gửi', 'send', 'kirim', 'publier'];
          for (const btn of svgBtns) {
            const label = (btn.getAttribute('aria-label') || '').toLowerCase();
            if (sendLabels.some(l => label === l || label.includes(l))) return btn;
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
      const shareBtn = await findPostButton(postElement, 'share');
      if (shareBtn && shareBtn.asElement()) {
        console.info("🔄 Click nút Chia sẻ bài viết...");
        await smartClick(page, shareBtn.asElement());
        await delay(2000);
        
        const shareNowBtn = await page.evaluateHandle(() => {
          const items = Array.from(document.querySelectorAll('[role="menuitem"], [role="button"], span'));
          const shareNowLabels = ['chia sẻ ngay', 'share now', 'chia sẻ lên bảng tin', 'bagikan bây giờ', 'partager maintenant'];
          for (const item of items) {
            const text = (item.textContent || '').toLowerCase();
            if (shareNowLabels.some(l => text.includes(l))) {
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

  const posts = await page.$$('div[role="article"], div[aria-posinset], [data-testid="fbfeed_story"]');
  let searchPostEl = null;
  let searchPostInfo = null;
  
  for (const post of posts) {
    try {
      const postInfo = await page.evaluate((postEl) => {
        const authorEl = postEl.querySelector('[data-ad-rendering-role="profile_name"]') ||
                         postEl.querySelector('h2 a[role="link"]') ||
                         postEl.querySelector('h3 a[role="link"]');
        const msgEl = postEl.querySelector('[data-ad-rendering-role="story_message"]') ||
                      postEl.querySelector('div[data-ad-preview="message"]');
        return {
          author: authorEl ? authorEl.textContent.trim() : 'Ẩn danh',
          message: msgEl ? msgEl.textContent.trim() : ''
        };
      }, post);
      
      const commentBtn = await findPostButton(post, 'comment');
      if (commentBtn && commentBtn.asElement()) {
        searchPostEl = post;
        searchPostInfo = postInfo;
        break;
      }
    } catch (e) {}
  }

  if (searchPostEl) {
    const commentBtn = await findPostButton(searchPostEl, 'comment');
    if (commentBtn && commentBtn.asElement()) {
      await page.evaluate((el) => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), commentBtn.asElement());
      await delay(1500);

      console.log("[Search] 💬 Đang nhấp mở danh mục bình luận bài viết...");
      await smartClick(page, commentBtn.asElement());
      await delay(3000);

      const comments = await searchPostEl.evaluate((el, authorName) => {
        const spans = Array.from(el.querySelectorAll('span[dir="auto"]'));
        const list = [];
        const authorLower = authorName ? authorName.trim().toLowerCase() : '';
        const lowerWords = [
          'thích', 'bình luận', 'chia sẻ', 'phản hồi', 'trả lời', 'đang trả lời', 'xem thêm', 'xem bản dịch', 'viết',
          'like', 'comment', 'share', 'reply', 'view more', 'see translation', 'write',
          'suka', 'komentari', 'bagikan', 'balas', 'lihat selengkapnya', 'lihat terjemahan', 'tulis',
          'j’aime', 'jaime', 'commenter', 'partager', 'répondre', 'voir plus', 'voir la traduction', 'ecrire',
          'facebook', 'messenger'
        ];
        for (const span of spans) {
          const text = span.textContent ? span.textContent.trim() : '';
          if (!text || text.length < 3) continue;
          const clean = text.toLowerCase();
          
          if (/^\d+[a-z]?$/.test(clean)) continue;
          if (/^\d+\s*(s|m|h|d|w|y|s|ph|ngày|tuần|hari|minggu|j|jam|sem|an|ans|giờ|phút)$/.test(clean)) continue;
          if (authorLower && clean.includes(authorLower)) continue;
          if (/^[\p{Emoji}\p{Symbol}\p{Punctuation}\s]+$/u.test(clean)) continue;
          
          let isInterface = false;
          for (const word of lowerWords) {
            if (clean === word || clean.startsWith(word + ' ') || clean.endsWith(' ' + word) || clean.includes(' ' + word + ' ')) {
              isInterface = true;
              break;
            }
          }
          if (isInterface) continue;
          
          list.push(text);
        }
        return list;
      }, searchPostInfo ? searchPostInfo.author : '');

      console.log(`[Search] 👁️ Đã đọc bình luận từ cộng đồng mạng:`);
      const limitComments = comments.slice(0, 3);
      limitComments.forEach((txt, idx) => {
        console.log(`   👉 Comment ${idx + 1}: "${txt}"`);
      });
      
      await delay(2000);
      await closeActiveOverlays(page);
      return true;
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

    const nextBtn = await page.evaluateHandle(() => {
      const targets = [
        'thẻ tiếp theo', 'next card', 'chuyển tiếp', 'tiếp', 'next', 'suivant', 'suivante', 'carte suivante', 'berikutnya', 'kartu berikutnya'
      ];
      const elements = Array.from(document.querySelectorAll('[role="button"], button, [aria-label]'));
      for (const el of elements) {
        const label = (el.getAttribute('aria-label') || '').toLowerCase();
        const text = (el.textContent || '').trim().toLowerCase();
        if (targets.some(t => label.includes(t) || text.includes(t))) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) return el;
        }
      }
      return null;
    });

    if (nextBtn && nextBtn.asElement()) {
      console.log("[Story] 👉 Click chuyển sang Story kế tiếp...");
      await smartClick(page, nextBtn.asElement());
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
    const targets = [
      'tham gia nhóm', 'join group', 'rejoindre le groupe', 'gabung grup',
      'tham gia', 'join', 'rejoindre', 'gabung'
    ];
    for (const btn of buttons) {
      const label = (btn.getAttribute('aria-label') || '').toLowerCase();
      const text = (btn.textContent || '').toLowerCase();
      if (targets.some(t => label.includes(t) || text.includes(t))) {
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
          const likeLabels = ['thích', 'like', 'suka', 'j’aime', 'j\'aime'];
          for (const btn of buttons) {
            const label = (btn.getAttribute('aria-label') || '').toLowerCase();
            if (likeLabels.includes(label)) return btn;
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

// HÀNH ĐỘNG H: Gửi kết bạn dạo (Add Friends from Suggestions)
async function doAddFriendSuggestions(page) {
  console.log("\n--- [Hành động] Đang vào danh sách gợi ý và gửi kết bạn dạo ---");
  await page.goto("https://www.facebook.com/friends/suggestions", { waitUntil: "networkidle2" });
  await delay(5000);

  // Cuộn trang nhẹ để tải thêm gợi ý
  await page.evaluate(() => window.scrollBy({ top: 300, behavior: 'smooth' }));
  await delay(2000);

  const addFriendBtn = await page.evaluateHandle(() => {
    const buttons = Array.from(document.querySelectorAll('[role="button"], button, div[role="button"]'));
    const targets = ['thêm bạn bè', 'add friend', 'ajouter en ami', 'ajouter', 'tambahkan teman', 'tambah teman'];
    for (const btn of buttons) {
      const text = (btn.textContent || '').trim().toLowerCase();
      const ariaLabel = (btn.getAttribute('aria-label') || '').trim().toLowerCase();
      
      if (targets.some(t => text === t || ariaLabel === t || text.includes(t) || ariaLabel.includes(t))) {
        return btn;
      }
    }
    return null;
  });

  if (addFriendBtn && addFriendBtn.asElement()) {
    console.log("[Add Friend] 👉 Phát hiện nút kết bạn dạo, tiến hành gửi kết bạn...");
    await smartClick(page, addFriendBtn.asElement());
    console.log("[Add Friend] ✅ Đã gửi yêu cầu kết bạn dạo thành công!");
    await delay(3000);
    return true;
  }
  
  console.log("[Add Friend] ⚠️ Không tìm thấy nút 'Thêm bạn bè' nào khả dụng.");
  return false;
}

// HÀNH ĐỘNG I: Tự động nhắn tin dạo (Auto Messaging - Hỗ trợ nhiều chiến lược ngẫu nhiên)
async function doAutoMessaging(page) {
  console.log("\n--- [Hành động] Đang thực hiện nhắn tin dạo ---");
  try {
    const strategyRoll = Math.random();
    let method = "";
    let chatOpened = false;

    if (strategyRoll < 0.35) {
      // Chiến lược 1: Nhắn tin cho người đăng bài viết trên Bảng tin (Newsfeed Author)
      method = "Gửi tin nhắn cho người đăng bài trên Bảng tin";
      console.log(`[Auto Message] 💡 Chiến lược chọn: ${method}`);
      
      await page.goto("https://www.facebook.com", { waitUntil: "networkidle2" });
      await delay(4000);

      // Cuộn trang nhẹ xuống để load thêm bài viết
      await page.evaluate(() => window.scrollBy(0, 400));
      await delay(2000);

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
        console.log("[Auto Message] 👉 Click vào tên tác giả bài viết để vào trang cá nhân...");
        await smartClick(page, authorLink.asElement());
        await delay(5000);

        const messageBtn = await page.evaluateHandle(() => {
          const elements = Array.from(document.querySelectorAll('[role="button"], a, div[role="button"]'));
          const msgWords = ['nhắn tin', 'message', 'gửi tin nhắn', 'envoyer un message', 'kirim pesan', 'pesan'];
          for (const el of elements) {
            const text = (el.textContent || '').trim().toLowerCase();
            const label = (el.getAttribute('aria-label') || '').toLowerCase();
            if (msgWords.some(word => text === word || text.includes(word) || label === word || label.includes(word))) {
              const rect = el.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0) {
                return el;
              }
            }
          }
          return null;
        });

        if (messageBtn && messageBtn.asElement()) {
          console.log("[Auto Message] 👉 Tìm thấy nút 'Nhắn tin', click mở khung chat...");
          await smartClick(page, messageBtn.asElement());
          await delay(4000);
          chatOpened = true;
        } else {
          console.warn("[Auto Message] ⚠️ Không tìm thấy nút 'Nhắn tin' trên profile người này.");
        }
      } else {
        console.warn("[Auto Message] ⚠️ Không tìm thấy link tác giả bài viết nào trên bảng tin.");
      }

    } else if (strategyRoll < 0.70) {
      // Chiến lược 2: Nhắn tin cho người mới trong mục gợi ý kết bạn (Suggested Friends)
      method = "Gửi tin nhắn cho người mới trong danh sách gợi ý";
      console.log(`[Auto Message] 💡 Chiến lược chọn: ${method}`);
      
      await page.goto("https://www.facebook.com/friends/suggestions", { waitUntil: "networkidle2" });
      await delay(5000);

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
        console.log("[Auto Message] 👉 Click vào profile người được gợi ý...");
        await smartClick(page, profileLink.asElement());
        await delay(5000);

        const messageBtn = await page.evaluateHandle(() => {
          const elements = Array.from(document.querySelectorAll('[role="button"], a, div[role="button"]'));
          const msgWords = ['nhắn tin', 'message', 'gửi tin nhắn', 'envoyer un message', 'kirim pesan', 'pesan'];
          for (const el of elements) {
            const text = (el.textContent || '').trim().toLowerCase();
            const label = (el.getAttribute('aria-label') || '').toLowerCase();
            if (msgWords.some(word => text === word || text.includes(word) || label === word || label.includes(word))) {
              const rect = el.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0) {
                return el;
              }
            }
          }
          return null;
        });

        if (messageBtn && messageBtn.asElement()) {
          console.log("[Auto Message] 👉 Tìm thấy nút 'Nhắn tin', click mở khung chat...");
          await smartClick(page, messageBtn.asElement());
          await delay(4000);
          chatOpened = true;
        } else {
          console.warn("[Auto Message] ⚠️ Không tìm thấy nút 'Nhắn tin' trên profile gợi ý.");
        }
      } else {
        console.warn("[Auto Message] ⚠️ Không tìm thấy link gợi ý kết bạn nào.");
      }

    } else {
      // Chiến lược 3: Nhắn tin cho các hội thoại sẵn có (Existing Chats)
      method = "Gửi tin nhắn cho cuộc hội thoại sẵn có trong hộp thư";
      console.log(`[Auto Message] 💡 Chiến lược chọn: ${method}`);
      
      await page.goto("https://www.facebook.com/messages/t/", { waitUntil: "networkidle2" });
      await delay(5000);

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
        console.log("[Auto Message] 👉 Click mở cuộc trò chuyện sẵn có...");
        await smartClick(page, chatLink.asElement());
        await delay(3000);
        chatOpened = true;
      } else {
        console.warn("[Auto Message] ⚠️ Không tìm thấy hội thoại nào sẵn có.");
      }
    }

    if (chatOpened) {
      const msgInput = await page.evaluateHandle(() => {
        let inp = document.querySelector('div[contenteditable="true"][role="textbox"]');
        if (inp) return inp;
        
        const boxes = Array.from(document.querySelectorAll('div[contenteditable="true"]'));
        for (const box of boxes) {
          const label = (box.getAttribute('aria-label') || '').toLowerCase();
          if (label.includes('tin nhắn') || label.includes('message') || label.includes('nhập') || label.includes('pesan') || label.includes('écrire')) {
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

        const msgPool = CONFIG.messages || [
          "Chào bạn nhé! Chúc bạn một ngày tốt lành nha. 😊",
          "Hello bạn! Rất vui được làm quen với bạn. 👋",
          "Chào ngày mới vui vẻ nha bạn ơi! ☀️",
          "Hi! Chúc bạn ngày mới ngập tràn năng lượng tích cực! ✨"
        ];
        const chosenMsg = msgPool[Math.floor(Math.random() * msgPool.length)];

        console.info(`[Auto Message] ✍️ Đang gõ tin nhắn: "${chosenMsg}"`);
        for (const char of chosenMsg) {
          await page.keyboard.sendCharacter(char);
          await delay(Math.floor(Math.random() * 80) + 30);
        }
        await delay(1500);

        console.info("[Auto Message] 🚀 Nhấn Enter để gửi...");
        await page.keyboard.press("Enter");
        await delay(3000);

        // Fallback: Nếu text chưa biến mất, thử click nút Gửi
        const isStillText = await page.evaluate((el) => el.textContent.length > 0, inputElement);
        if (isStillText) {
          console.info("[Auto Message] ✍️ Vẫn còn text trong ô soạn thảo, tìm nút Gửi (Send)...");
          await page.evaluate(() => {
            const sendBtns = Array.from(document.querySelectorAll('div[role="button"], span'));
            const sendWords = ['gửi', 'send', 'envoyer', 'kirim'];
            for (const btn of sendBtns) {
              const label = (btn.getAttribute('aria-label') || '').toLowerCase();
              if (sendWords.some(w => label.includes(w))) {
                btn.click();
                return;
              }
            }
          });
          await delay(2000);
        }

        console.log("[Auto Message] ✅ Đã gửi tin nhắn thành công!");
        
        await page.goto("https://www.facebook.com", { waitUntil: "networkidle2" });
        await delay(3000);
        return true;
      } else {
        console.warn("[Auto Message] ⚠️ Không tìm thấy ô soạn thảo tin nhắn.");
      }
    }
  } catch (err) {
    console.error("[Auto Message] ⚠️ Lỗi khi thực hiện nhắn tin dạo:", err.message);
  }

  try {
    await page.goto("https://www.facebook.com", { waitUntil: "networkidle2" });
    await delay(3000);
  } catch (e) {}
  return false;
}

// HÀNH ĐỘNG J: Tự động đăng status dạo (Auto Post Status)
async function doAutoPostStatus(page) {
  console.log("\n--- [Hành động] Đang tiến hành đăng bài viết dạo ---");
  try {
    await page.goto("https://www.facebook.com", { waitUntil: "networkidle2" });
    await delay(4000);

    const createPostBtn = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('[role="button"], div[role="button"]'));
      const textWords = [
        'bạn đang nghĩ gì', "what's on your mind", 'tạo bài viết', 'create a post',
        'que voulez-vous dire', 'créer un post', 'créer une publication',
        'apa yang bạn nghĩ', 'apa yang anda pikirkan', 'buat postingan', 'buat bài viết'
      ];
      for (const btn of buttons) {
        const text = (btn.textContent || '').trim().toLowerCase();
        if (textWords.some(w => text.includes(w))) {
          return btn;
        }
      }
      return null;
    });

    if (createPostBtn && createPostBtn.asElement()) {
      console.log("[Auto Post] 👉 Click mở hộp thoại đăng bài...");
      await smartClick(page, createPostBtn.asElement());
      await delay(4000);

      const editor = await page.evaluateHandle(() => {
        const editableDivs = Array.from(document.querySelectorAll('div[contenteditable="true"]'));
        for (const div of editableDivs) {
          const rect = div.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            return div;
          }
        }
        return null;
      });

      if (editor && editor.asElement()) {
        const editorEl = editor.asElement();
        await editorEl.focus();
        await smartClick(page, editorEl);
        await delay(1500);

        const statusPool = CONFIG.statuses || [
          "Cuộc sống không phải là mong chờ giông bão qua đi, mà là học cách nhảy múa dưới những cơn mưa. 🌧️💃",
          "Mỗi ngày mới là một cơ hội để bạn làm lại tốt hơn hôm qua. Cố lên nhé! 💪✨",
          "Hãy luôn mỉm cười, vì nụ cười của bạn là điều tuyệt vời nhất. 😊❤️",
          "Thành công không phải là chìa khóa mở cánh cửa hạnh phúc, mà hạnh phúc mới là chìa khóa dẫn tới thành công. 🔑🌟"
        ];
        const chosenStatus = statusPool[Math.floor(Math.random() * statusPool.length)];

        console.info(`[Auto Post] ✍️ Đang gõ status: "${chosenStatus}"`);
        for (const char of chosenStatus) {
          await page.keyboard.sendCharacter(char);
          await delay(Math.floor(Math.random() * 80) + 40);
        }
        await delay(2500);

        const postSubmitBtn = await page.evaluateHandle(() => {
          const buttons = Array.from(document.querySelectorAll('[role="button"], button'));
          for (const btn of buttons) {
            const text = (btn.textContent || '').trim().toLowerCase();
            if (text === 'đăng' || text === 'post' || text === 'publier' || text === 'posting') {
              return btn;
            }
          }
          return null;
        });

        if (postSubmitBtn && postSubmitBtn.asElement()) {
          console.info("[Auto Post] 🚀 Click nút Đăng bài...");
          await smartClick(page, postSubmitBtn.asElement());
          await delay(6000); // Chờ 6 giây để đăng hoàn tất
          console.log("[Auto Post] ✅ Đăng status thành công!");
          return true;
        } else {
          console.warn("[Auto Post] ⚠️ Không tìm thấy nút 'Đăng'.");
        }
      } else {
        console.warn("[Auto Post] ⚠️ Không tìm thấy ô soạn thảo.");
      }
    } else {
      console.warn("[Auto Post] ⚠️ Không tìm thấy nút tạo bài viết trên trang chủ.");
    }
  } catch (err) {
    console.error("[Auto Post] ⚠️ Lỗi khi đăng bài viết:", err.message);
  }

  // Nhấn ESC đề phòng bị kẹt hộp thoại
  try {
    await page.keyboard.press('Escape');
    await delay(1000);
    await closeActiveOverlays(page);
  } catch (e) {}
  return false;
}

// HÀNH ĐỘNG K: Tương tác Bảng tin Nhóm (Group Feed Interaction)
async function doGroupFeedInteraction(page) {
  console.log("\n--- [Hành động] Đang vào Bảng tin Nhóm để tương tác ---");
  try {
    await page.goto("https://www.facebook.com/groups/feed/", { waitUntil: "networkidle2" });
    await delay(5000);

    for (let i = 0; i < 2; i++) {
      console.log("[Group Feed] 📜 Cuộn bảng tin nhóm...");
      await page.evaluate(() => window.scrollBy({ top: 400, behavior: 'smooth' }));
      await delay(3000);
    }

    const posts = await page.$$('div[role="article"], div[aria-posinset], [data-testid="fbfeed_story"]');
    let likeBtn = null;
    for (const post of posts) {
      const btn = await findPostButton(post, 'like');
      if (btn && btn.asElement()) {
        likeBtn = btn.asElement();
        break;
      }
    }

    if (likeBtn) {
      console.log("[Group Feed] 👍 Phát hiện bài viết nhóm, tiến hành thả cảm xúc...");
      await page.evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), likeBtn);
      await delay(1500);
      await smartClick(page, likeBtn);
      await delay(3000);
      console.log("[Group Feed] ✅ Đã tương tác bài viết nhóm thành công!");
      return true;
    } else {
      console.log("[Group Feed] ⚠️ Không tìm thấy nút like nào trên Feed nhóm.");
    }
  } catch (err) {
    console.error("[Group Feed] ⚠️ Lỗi tương tác feed nhóm:", err.message);
  }

  try {
    await page.goto("https://www.facebook.com", { waitUntil: "networkidle2" });
    await delay(3000);
  } catch (e) {}
  return false;
}

// HÀNH ĐỘNG L: Tự động đồng ý kết bạn (Auto Accept Friend Requests)
async function doAutoAcceptFriends(page) {
  console.log("\n--- [Hành động] Đang vào trang lời mời kết bạn để phê duyệt dạo ---");
  try {
    await page.goto("https://www.facebook.com/friends/requests", { waitUntil: "networkidle2" });
    await delay(5000);

    const confirmBtn = await page.evaluateHandle(() => {
      // Tìm các nút Xác nhận / Confirm lời mời kết bạn
      const buttons = Array.from(document.querySelectorAll('[role="button"], button'));
      const confirmWords = ['xác nhận', 'confirm', 'đồng ý', 'confirmer', 'konfirmasi', 'setuju'];
      for (const btn of buttons) {
        const text = (btn.textContent || '').trim().toLowerCase();
        if (confirmWords.includes(text)) {
          return btn;
        }
      }
      return null;
    });

    if (confirmBtn && confirmBtn.asElement()) {
      console.log("[Accept Friends] 👉 Phát hiện lời mời kết bạn mới, tiến hành xác nhận...");
      await smartClick(page, confirmBtn.asElement());
      await delay(4000);
      console.log("[Accept Friends] ✅ Đã chấp nhận kết bạn thành công!");
      return true;
    } else {
      console.log("[Accept Friends] ⚠️ Không có lời mời kết bạn nào cần phê duyệt lúc này.");
    }
  } catch (err) {
    console.error("[Accept Friends] ⚠️ Lỗi phê duyệt kết bạn dạo:", err.message);
  }

  try {
    await page.goto("https://www.facebook.com", { waitUntil: "networkidle2" });
    await delay(3000);
  } catch (e) {}
  return false;
}

// HÀNH ĐỘNG M: Tự động lướt xem và tương tác Fanpage yêu thích (Auto Browse Favorite Pages)
async function doBrowseFavoritePages(page) {
  console.log("\n--- [Hành động] Đang truy cập Fanpage yêu thích để đọc tin ---");
  try {
    const pagePool = CONFIG.targetPages || [
      "https://www.facebook.com/TinTe",
      "https://www.facebook.com/Kenh14"
    ];
    const targetUrl = pagePool[Math.floor(Math.random() * pagePool.length)];
    
    console.log(`[Favorite Page] 👉 Đang đi đến trang: ${targetUrl}`);
    await page.goto(targetUrl, { waitUntil: "networkidle2" });
    await delay(5000);

    const scrollCount = Math.floor(Math.random() * 2) + 2; // Cuộn 2-3 lần
    for (let i = 0; i < scrollCount; i++) {
      console.log(`[Favorite Page] 📜 Cuộn trang fanpage (lần ${i + 1}/${scrollCount})...`);
      await page.evaluate(() => window.scrollBy({ top: 350, behavior: 'smooth' }));
      await delay(3000);
    }

    // Thả cảm xúc dạo ngẫu nhiên trên Fanpage (35% cơ hội)
    if (Math.random() < 0.35) {
      const posts = await page.$$('div[role="article"], div[aria-posinset], [data-testid="fbfeed_story"]');
      let likeBtn = null;
      for (const post of posts) {
        const btn = await findPostButton(post, 'like');
        if (btn && btn.asElement()) {
          likeBtn = btn.asElement();
          break;
        }
      }
      if (likeBtn) {
        console.log("[Favorite Page] 👍 Phát hiện bài viết trên Page, tiến hành tương tác...");
        await page.evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), likeBtn);
        await delay(1500);
        await smartClick(page, likeBtn);
        await delay(3000);
        console.log("[Favorite Page] ✅ Đã thả cảm xúc bài viết trên Fanpage thành công!");
      }
    }
    return true;
  } catch (err) {
    console.error("[Favorite Page] ⚠️ Lỗi tương tác trên Fanpage:", err.message);
  }

  try {
    await page.goto("https://www.facebook.com", { waitUntil: "networkidle2" });
    await delay(3000);
  } catch (e) {}
  return false;
}

// HÀNH ĐỘNG N: Tự động chúc mừng sinh nhật bạn bè (Auto Wish Happy Birthday)
async function doWishHappyBirthday(page) {
  console.log("\n--- [Hành động] Đang vào trang sự kiện sinh nhật để gửi lời chúc ---");
  try {
    await page.goto("https://www.facebook.com/events/birthdays", { waitUntil: "networkidle2" });
    await delay(5000);

    const birthdayInput = await page.evaluateHandle(() => {
      const inputs = Array.from(document.querySelectorAll('textarea, div[contenteditable="true"]'));
      const bdayWords = ['chúc mừng', 'sinh nhật', 'birthday', 'wish', 'anniversaire', 'ulang tahun'];
      for (const input of inputs) {
        const placeholder = (input.getAttribute('placeholder') || '').toLowerCase();
        if (bdayWords.some(w => placeholder.includes(w))) {
          return input;
        }
      }
      return null;
    });

    if (birthdayInput && birthdayInput.asElement()) {
      const el = birthdayInput.asElement();
      await el.focus();
      await smartClick(page, el);
      await delay(1000);

      const wishes = CONFIG.birthdayWishes || [
        "Chúc mừng sinh nhật bạn nhé! Chúc tuổi mới tràn ngập niềm vui và thành công! 🎉🎂",
        "Chúc bạn sinh nhật vui vẻ, hạnh phúc bên gia đình và người thân nhé! 🥳✨",
        "Happy Birthday! Chúc bạn mọi điều tốt đẹp nhất trong tuổi mới! 🍀🎁"
      ];
      const chosenWish = wishes[Math.floor(Math.random() * wishes.length)];

      console.log(`[Birthday] ✍️ Đang gõ lời chúc sinh nhật: "${chosenWish}"`);
      for (const char of chosenWish) {
        await page.keyboard.sendCharacter(char);
        await delay(Math.floor(Math.random() * 80) + 40);
      }
      await delay(2000);
      await page.keyboard.press("Enter");
      await delay(4000);
      console.log("[Birthday] ✅ Đã gửi lời chúc sinh nhật thành công!");
      return true;
    } else {
      console.log("[Birthday] ⚠️ Không tìm thấy người nào có sinh nhật hôm nay hoặc không mở tính năng viết chúc mừng.");
    }
  } catch (err) {
    console.error("[Birthday] ⚠️ Lỗi chúc mừng sinh nhật dạo:", err.message);
  }

  try {
    await page.goto("https://www.facebook.com", { waitUntil: "networkidle2" });
    await delay(3000);
  } catch (e) {}
  return false;
}

// HÀNH ĐỘNG O: Tương tác trực tiếp trên bài viết của Bạn bè cụ thể (Auto Friend Profile Interaction)
async function doFriendProfileInteraction(page) {
  console.log("\n--- [Hành động] Đang chọn một người bạn để tương tác cá nhân ---");
  try {
    await page.goto("https://www.facebook.com/friends", { waitUntil: "networkidle2" });
    await delay(5000);

    const friendLink = await page.evaluateHandle(() => {
      // Tìm các liên kết đến trang cá nhân của bạn bè
      const links = Array.from(document.querySelectorAll('a[href*="/user/"], a[href*="profile.php"]'));
      const visibleLinks = links.filter(l => {
        const rect = l.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && !l.href.includes('/friends');
      });
      if (visibleLinks.length === 0) return null;
      // Chọn ngẫu nhiên một người bạn
      const randomIndex = Math.floor(Math.random() * Math.min(visibleLinks.length, 10));
      return visibleLinks[randomIndex];
    });

    if (friendLink && friendLink.asElement()) {
      console.log("[Friend Interaction] 👉 Click vào trang cá nhân của bạn...");
      await smartClick(page, friendLink.asElement());
      await delay(5000);

      // Cuộn trang cá nhân của bạn
      for (let i = 0; i < 2; i++) {
        console.log("[Friend Interaction] 📜 Cuộn xem trang cá nhân...");
        await page.evaluate(() => window.scrollBy({ top: 300, behavior: 'smooth' }));
        await delay(3000);
      }

      // Thả Like bài viết trên tường nhà bạn
      const posts = await page.$$('div[role="article"], div[aria-posinset], [data-testid="fbfeed_story"]');
      let likeBtn = null;
      for (const post of posts) {
        const btn = await findPostButton(post, 'like');
        if (btn && btn.asElement()) {
          likeBtn = btn.asElement();
          break;
        }
      }
      if (likeBtn) {
        console.log("[Friend Interaction] 👍 Thả cảm xúc Like bài viết của bạn...");
        await page.evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), likeBtn);
        await delay(1500);
        await smartClick(page, likeBtn);
        await delay(3000);
        console.log("[Friend Interaction] ✅ Đã tương tác thành công!");
        return true;
      }
    } else {
      console.log("[Friend Interaction] ⚠️ Không tìm thấy người bạn nào trên màn hình.");
    }
  } catch (err) {
    console.error("[Friend Interaction] ⚠️ Lỗi tương tác trang cá nhân bạn bè:", err.message);
  }

  try {
    await page.goto("https://www.facebook.com", { waitUntil: "networkidle2" });
    await delay(3000);
  } catch (e) {}
  return false;
}

// HÀNH ĐỘNG P: Tương tác Marketplace (Auto Browse Marketplace)
async function doBrowseMarketplace(page) {
  console.log("\n--- [Hành động] Đang vào Marketplace để xem sản phẩm ---");
  try {
    await page.goto("https://www.facebook.com/marketplace/", { waitUntil: "networkidle2" });
    await delay(5000);

    // Cuộn xem sản phẩm
    for (let i = 0; i < 2; i++) {
      console.log("[Marketplace] 📜 Cuộn xem danh sách sản phẩm...");
      await page.evaluate(() => window.scrollBy({ top: 350, behavior: 'smooth' }));
      await delay(3000);
    }

    // Click xem chi tiết một sản phẩm ngẫu nhiên
    const productLink = await page.evaluateHandle(() => {
      const links = Array.from(document.querySelectorAll('a[href*="/marketplace/item/"]'));
      const visible = links.filter(l => {
        const rect = l.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
      if (visible.length === 0) return null;
      return visible[Math.floor(Math.random() * Math.min(visible.length, 6))];
    });

    if (productLink && productLink.asElement()) {
      console.log("[Marketplace] 👉 Click xem chi tiết sản phẩm...");
      await smartClick(page, productLink.asElement());
      await delay(5000); // Xem chi tiết 5 giây
      console.log("[Marketplace] ✅ Đã xem sản phẩm thành công!");
      return true;
    } else {
      console.log("[Marketplace] ⚠️ Không tìm thấy sản phẩm nào để click.");
    }
  } catch (err) {
    console.error("[Marketplace] ⚠️ Lỗi lướt Marketplace:", err.message);
  }

  try {
    await page.goto("https://www.facebook.com", { waitUntil: "networkidle2" });
    await delay(3000);
  } catch (e) {}
  return false;
}

// HÀNH ĐỘNG Q: Tìm kiếm Google / Web ngoài rồi quay lại (Referrer Simulation)
async function doReferrerSimulation(page) {
  console.log("\n--- [Hành động] Đang đi ra web ngoài để đọc báo (Referrer Simulation) ---");
  try {
    const newsSites = [
      "https://vnexpress.net/",
      "https://dantri.com.vn/",
      "https://news.google.com/"
    ];
    const chosenSite = newsSites[Math.floor(Math.random() * newsSites.length)];
    console.log(`[Referrer] 🌐 Đi tới trang báo ngoài: ${chosenSite}`);
    await page.goto(chosenSite, { waitUntil: "networkidle2" });
    await delay(5000);

    for (let i = 0; i < 3; i++) {
      console.log(`[Referrer] 📜 Đang cuộn đọc báo tại web ngoài (${i + 1}/3)...`);
      await page.evaluate(() => window.scrollBy({ top: 300, behavior: 'smooth' }));
      await delay(3000);
    }
    console.log("[Referrer] ✅ Đã hoàn thành đọc báo ngoài, quay về Facebook...");
    return true;
  } catch (err) {
    console.error("[Referrer] ⚠️ Lỗi khi lướt web ngoài:", err.message);
  }

  try {
    await page.goto("https://www.facebook.com", { waitUntil: "networkidle2" });
    await delay(3000);
  } catch (e) {}
  return false;
}

// ==================== BẮT ĐẦU CHẠY KỊCH BẢN CHÍNH ====================

console.log("🚀 Bắt đầu khởi động kịch bản tương tác dạo Facebook cao cấp...");

// 1. Kiểm tra URL hiện tại, nếu chưa ở Facebook thì chuyển hướng sang facebook.com
try {
  const currentUrl = page.url();
  if (!currentUrl.includes("facebook.com")) {
    console.info("Chưa truy cập Facebook. Đang tự động chuyển hướng...");
    await page.goto("https://www.facebook.com", { waitUntil: "networkidle2" });
    await delay(3000);
  }
} catch (err) {
  console.warn("⚠️ Cảnh báo chuyển hướng ban đầu thất bại (có thể do proxy chậm/yếu):", err.message);
}

// 2. Chờ load bảng tin
console.info("Đang kiểm tra bảng tin...");
try {
  await page.waitForSelector('div[role="article"], div[aria-posinset], [data-testid="fbfeed_story"]', { timeout: 10000 });
} catch (e) {
  console.warn("Đang đợi thêm nội dung bảng tin tải xuống...");
}

// 3. Tiến hành cuộn trang và tương tác ngẫu nhiên theo danh sách các hành động
let interactedCount = 0;
const maxInteractions = CONFIG.scrollSteps;

while (interactedCount < maxInteractions) {
  try {
    const roll = Math.random();
    let success = false;
    
    if (roll < 0.20) {
      // 20% cơ hội tương tác trực tiếp trên Bảng tin
      success = await doFeedInteraction(page);
    } else if (roll < 0.26) {
      // 6% cơ hội tìm kiếm từ khóa ngẫu nhiên và đọc comment
      success = await doSearchAndRead(page);
    } else if (roll < 0.32) {
      // 6% cơ hội xem stories/tin ngắn của bạn bè
      success = await doViewStories(page);
    } else if (roll < 0.38) {
      // 6% cơ hội khám phá và tham gia nhóm mới
      success = await doJoinGroup(page);
    } else if (roll < 0.44) {
      // 6% cơ hội kiểm tra thông báo
      success = await doCheckNotifications(page);
    } else if (roll < 0.50) {
      // 6% cơ hội lướt xem Reels
      success = await doScrollReels(page);
    } else if (roll < 0.56) {
      // 6% cơ hội gửi kết bạn dạo từ danh sách gợi ý
      success = await doAddFriendSuggestions(page);
    } else if (roll < 0.62) {
      // 6% cơ hội tự động nhắn tin dạo
      success = await doAutoMessaging(page);
    } else if (roll < 0.68) {
      // 6% cơ hội tương tác bảng tin nhóm
      success = await doGroupFeedInteraction(page);
    } else if (roll < 0.74) {
      // 6% cơ hội xem và lướt Fanpage yêu thích
      success = await doBrowseFavoritePages(page);
    } else if (roll < 0.80) {
      // 6% cơ hội phê duyệt đồng ý kết bạn
      success = await doAutoAcceptFriends(page);
    } else if (roll < 0.85) {
      // 5% cơ hội tương tác trực tiếp bạn bè
      success = await doFriendProfileInteraction(page);
    } else if (roll < 0.90) {
      // 5% cơ hội lướt Marketplace
      success = await doBrowseMarketplace(page);
    } else if (roll < 0.93) {
      // 3% cơ hội chúc mừng sinh nhật
      success = await doWishHappyBirthday(page);
    } else if (roll < 0.96) {
      // 3% cơ hội đăng status dạo
      success = await doAutoPostStatus(page);
    } else if (roll < 0.98) {
      // 2% cơ hội đọc báo web ngoài
      success = await doReferrerSimulation(page);
    } else {
      // 2% cơ hội đi dạo loanh quanh 5 phút
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
  } catch (loopErr) {
    console.error(`⚠️ Có lỗi xảy ra trong vòng lặp chính (có thể do kết nối proxy kém): ${loopErr.message}`);
    console.log("🔄 Đang tạm nghỉ 10 giây để chờ kết nối ổn định rồi tiếp tục hành động tiếp theo...");
    await delay(10000);
  }
}

console.log("🎉 Hoàn thành kịch bản tương tác dạo Facebook thành công!");
