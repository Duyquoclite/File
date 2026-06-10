/**
 * AI Support Chat Widget
 */
(function() {
  // Inject CSS Styles
  const style = document.createElement('style');
  style.textContent = `
    .ai-chat-widget {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 99999;
      font-family: 'Inter', -apple-system, sans-serif;
    }
    .ai-chat-btn {
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: #fff;
      border: none;
      padding: 12px 20px;
      border-radius: 30px;
      font-weight: 600;
      font-size: 0.875rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 8px 24px rgba(99, 102, 241, 0.4);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .ai-chat-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 32px rgba(99, 102, 241, 0.6);
    }
    .ai-chat-btn:active {
      transform: translateY(0);
    }
    .ai-chat-pulse {
      width: 8px;
      height: 8px;
      background: #10b981;
      border-radius: 50%;
      box-shadow: 0 0 8px #10b981;
      animation: ai-chat-pulse-anim 2s infinite;
    }
    @keyframes ai-chat-pulse-anim {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
    
    .ai-chat-panel {
      position: fixed;
      bottom: 80px;
      right: 20px;
      width: 380px;
      height: 500px;
      background: rgba(18, 18, 42, 0.95);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 16px;
      box-shadow: 0 12px 48px rgba(0, 0, 0, 0.5);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transform: translateY(20px);
      opacity: 0;
      pointer-events: none;
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .ai-chat-panel.active {
      transform: translateY(0);
      opacity: 1;
      pointer-events: all;
    }
    .ai-chat-panel.expanded {
      bottom: 40px;
      right: 40px;
      width: calc(100vw - 80px);
      height: calc(100vh - 120px);
      max-width: 1200px;
      max-height: 800px;
    }
    .ai-chat-panel.expanded .ai-msg {
      max-width: 85%;
    }
    .ai-chat-back-btn {
      display: none;
      align-items: center;
      gap: 4px;
      background: none;
      border: none;
      color: #94a3b8;
      font-size: 0.85rem;
      font-weight: 500;
      cursor: pointer;
      padding: 4px 8px 4px 0;
      transition: color 0.2s;
    }
    .ai-chat-back-btn:hover {
      color: #fff;
    }
    .table-container {
      width: 100%;
      overflow-x: auto;
      margin: 12px 0;
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      background: rgba(0, 0, 0, 0.2);
    }
    .ai-chat-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.8rem;
      color: #e2e8f0;
    }
    .ai-chat-table th {
      background: rgba(255, 255, 255, 0.05);
      padding: 8px 12px;
      font-weight: 600;
      color: #fff;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    .ai-chat-table td {
      padding: 8px 12px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      line-height: 1.4;
      vertical-align: top;
    }
    .ai-chat-table tr:last-child td {
      border-bottom: none;
    }
    .ai-chat-table tr:hover {
      background: rgba(255, 255, 255, 0.02);
    }
    .ai-chat-header {
      padding: 16px;
      background: rgba(255, 255, 255, 0.03);
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .ai-chat-header h3 {
      margin: 0;
      font-size: 0.95rem;
      font-weight: 700;
      background: linear-gradient(135deg, #6366f1, #06b6d4);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .ai-chat-close {
      background: none;
      border: none;
      color: #94a3b8;
      font-size: 1.1rem;
      cursor: pointer;
      padding: 4px;
      transition: color 0.2s;
    }
    .ai-chat-close:hover {
      color: #fff;
    }
    .ai-chat-messages {
      flex: 1;
      padding: 16px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .ai-msg {
      max-width: 80%;
      padding: 10px 14px;
      border-radius: 14px;
      font-size: 0.85rem;
      line-height: 1.5;
      word-break: break-word;
    }
    .ai-msg.user {
      align-self: flex-end;
      background: #6366f1;
      color: #fff;
      border-bottom-right-radius: 2px;
    }
    .ai-msg.assistant {
      align-self: flex-start;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.05);
      color: #e2e8f0;
      border-bottom-left-radius: 2px;
    }
    .ai-msg.assistant pre {
      background: rgba(0, 0, 0, 0.3);
      padding: 8px;
      border-radius: 6px;
      overflow-x: auto;
      margin-top: 6px;
      font-family: monospace;
      font-size: 0.75rem;
    }
    .ai-msg.assistant code {
      background: rgba(0, 0, 0, 0.3);
      padding: 2px 4px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 0.75rem;
    }
    .ai-chat-footer {
      padding: 12px;
      background: rgba(255, 255, 255, 0.01);
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      gap: 8px;
    }
    .ai-chat-input {
      flex: 1;
      background: rgba(0, 0, 0, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      padding: 8px 12px;
      color: #fff;
      font-size: 0.85rem;
      outline: none;
      resize: none;
      height: 36px;
      font-family: inherit;
    }
    .ai-chat-input:focus {
      border-color: #6366f1;
    }
    .ai-chat-send {
      background: #6366f1;
      border: none;
      color: #fff;
      width: 36px;
      height: 36px;
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
    }
    .ai-chat-send:hover {
      background: #818cf8;
    }
    .ai-chat-send:disabled {
      background: rgba(255, 255, 255, 0.08);
      color: #64748b;
      cursor: not-allowed;
    }
    .ai-typing-indicator {
      display: flex;
      gap: 4px;
      padding: 8px 12px;
      background: rgba(255, 255, 255, 0.03);
      border-radius: 14px;
      align-self: flex-start;
      align-items: center;
    }
    .ai-typing-dot {
      width: 6px;
      height: 6px;
      background: #94a3b8;
      border-radius: 50%;
      animation: ai-typing-dot-anim 1.4s infinite;
    }
    .ai-typing-dot:nth-child(2) { animation-delay: 0.2s; }
    .ai-typing-dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes ai-typing-dot-anim {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-4px); }
    }
    @media (max-width: 1280px) {
      .ai-chat-panel.expanded {
        bottom: 20px;
        right: 20px;
        width: calc(100vw - 40px);
        height: calc(100vh - 100px);
      }
    }
    @media (max-width: 480px) {
      .ai-chat-panel {
        width: calc(100vw - 32px);
        height: 400px;
        bottom: 80px;
        right: 16px;
      }
    }
  `;
  document.head.appendChild(style);

  // Helper to set cookie
  function _setCookie(name, value, days = 365) {
    const d = new Date();
    d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = `${name}=${value};expires=${d.toUTCString()};path=/`;
  }

  // Generate Unique Session ID to save separate chats using cookie
  let sessionId = _getCookie('ai_support_session');
  if (!sessionId) {
    sessionId = 'session_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now();
    _setCookie('ai_support_session', sessionId);
  }

  // Create Widget Elements
  const container = document.createElement('div');
  container.className = 'ai-chat-widget';
  container.innerHTML = `
    <button class="ai-chat-btn" id="aiChatBtn">
      <span class="ai-chat-pulse"></span>
      💬 Hỗ trợ AI
    </button>
    <div class="ai-chat-panel" id="aiChatPanel">
      <div class="ai-chat-header">
        <div style="display: flex; align-items: center; gap: 8px;">
          <button class="ai-chat-back-btn" id="aiChatBackBtn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            <span>Trở về</span>
          </button>
          <h3 id="aiChatTitle">🤖 AI Trợ lý kỹ thuật</h3>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <button class="ai-chat-expand" id="aiChatExpand" title="Phóng to" style="background: none; border: none; color: #94a3b8; font-size: 1.1rem; cursor: pointer; padding: 4px; display: flex; align-items: center; transition: color 0.2s;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <g id="aiChatExpandIcon">
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
              </g>
            </svg>
          </button>
          <button class="ai-chat-close" id="aiChatClose">✕</button>
        </div>
      </div>
      <div class="ai-chat-messages" id="aiChatMessages">
        <div class="ai-msg assistant">
          Xin chào! Tôi là AI trợ lý kỹ thuật cho Chrome Profile Manager. Tôi có thể giúp giải đáp các thắc mắc về:
          <ul style="margin: 8px 0 0 16px; padding: 0; font-size: 0.825rem;">
            <li>Tạo, chỉnh sửa, xóa và nhân bản profiles</li>
            <li>Giả lập thông số vân tay trình duyệt (Fingerprint)</li>
            <li>Tự động load extension từ thư mục <code>/extensions</code></li>
            <li>Nhập/xuất cookie (JSON) thông qua CDP</li>
            <li>Cấu hình URL xoay IP proxy động và tự động tránh trùng IP</li>
            <li>Chạy kịch bản hàng loạt bằng Puppeteer script</li>
          </ul>
          Hãy gửi câu hỏi cho tôi nhé!
        </div>
      </div>
      <div class="ai-chat-footer">
        <input type="text" class="ai-chat-input" id="aiChatInput" placeholder="Nhập câu hỏi của bạn..." autocomplete="off">
        <button class="ai-chat-send" id="aiChatSend">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(container);

  // Cache elements
  const chatBtn = document.getElementById('aiChatBtn');
  const chatPanel = document.getElementById('aiChatPanel');
  const chatClose = document.getElementById('aiChatClose');
  const chatMessages = document.getElementById('aiChatMessages');
  const chatInput = document.getElementById('aiChatInput');
  const chatSend = document.getElementById('aiChatSend');
  const chatExpand = document.getElementById('aiChatExpand');
  const chatExpandIcon = document.getElementById('aiChatExpandIcon');
  const chatBackBtn = document.getElementById('aiChatBackBtn');

  let chatHistory = []; // Local history within this session view

  const expandSvg = `<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>`;
  const minimizeSvg = `<path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7"/>`;

  function toggleExpand() {
    chatPanel.classList.toggle('expanded');
    const isExpanded = chatPanel.classList.contains('expanded');
    if (isExpanded) {
      chatBackBtn.style.display = 'flex';
      chatExpand.title = 'Thu nhỏ';
      chatExpandIcon.innerHTML = minimizeSvg;
    } else {
      chatBackBtn.style.display = 'none';
      chatExpand.title = 'Phóng to';
      chatExpandIcon.innerHTML = expandSvg;
    }
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  // Toggle Panel
  chatBtn.onclick = () => {
    chatPanel.classList.toggle('active');
    if (chatPanel.classList.contains('active')) {
      chatInput.focus();
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  };
  chatClose.onclick = () => {
    chatPanel.classList.remove('active');
    chatPanel.classList.remove('expanded');
    chatBackBtn.style.display = 'none';
    chatExpand.title = 'Phóng to';
    chatExpandIcon.innerHTML = expandSvg;
  };
  chatExpand.onclick = toggleExpand;
  chatBackBtn.onclick = toggleExpand;

  // Escaping Helper
  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function parseInline(text) {
    let escaped = esc(text);
    // Bold: **text**
    escaped = escaped.replace(/\*\*([\s\S]*?)\*\*/g, '<strong style="color:#fff; font-weight:600;">$1</strong>');
    // Inline code: `code`
    escaped = escaped.replace(/`([^`]+)`/g, '<code style="background: rgba(255,255,255,0.08); padding: 2px 4px; border-radius: 4px; font-family: monospace; font-size: 0.8rem; color: #38bdf8;">$1</code>');
    return escaped;
  }

  function formatReply(text) {
    if (typeof text !== 'string') return '';
    let lines = text.split('\n');
    let inList = false;
    let inNumList = false;
    let htmlLines = [];
    let inCodeBlock = false;
    let codeBlockContent = [];

    let inTable = false;
    let tableHeaders = [];
    let tableRows = [];

    for (let line of lines) {
      // Handle Code Blocks
      if (line.trim().startsWith('```')) {
        if (inCodeBlock) {
          inCodeBlock = false;
          htmlLines.push('<pre><code>' + esc(codeBlockContent.join('\n')) + '</code></pre>');
          codeBlockContent = [];
        } else {
          inCodeBlock = true;
        }
        continue;
      }

      if (inCodeBlock) {
        codeBlockContent.push(line);
        continue;
      }

      let trimmed = line.trim();

      // Check for Table Row
      const isTableRow = trimmed.startsWith('|') && trimmed.endsWith('|');
      if (isTableRow) {
        if (inList) { htmlLines.push('</ul>'); inList = false; }
        if (inNumList) { htmlLines.push('</ol>'); inNumList = false; }

        const cells = trimmed.split('|').map(c => c.trim()).slice(1, -1);
        const isSeparator = cells.every(c => /^[:\-\s]+$/.test(c));

        if (isSeparator) {
          continue;
        }

        if (!inTable) {
          inTable = true;
          tableHeaders = cells;
        } else {
          tableRows.push(cells);
        }
        continue;
      } else {
        if (inTable) {
          let tableHtml = '<div class="table-container"><table class="ai-chat-table">';
          tableHtml += '<thead><tr>' + tableHeaders.map(h => `<th>${parseInline(h)}</th>`).join('') + '</tr></thead>';
          tableHtml += '<tbody>';
          tableRows.forEach(row => {
            tableHtml += '<tr>' + row.map(c => `<td>${parseInline(c)}</td>`).join('') + '</tr>';
          });
          tableHtml += '</tbody></table></div>';
          htmlLines.push(tableHtml);
          inTable = false;
          tableHeaders = [];
          tableRows = [];
        }
      }

      // Horizontal rules
      if (trimmed === '---' || trimmed === '***') {
        htmlLines.push('<hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.08); margin: 12px 0;">');
        continue;
      }

      // Headers (### Header)
      if (trimmed.startsWith('###')) {
        let content = trimmed.substring(3).trim();
        content = content.replace(/^\*\*([\s\S]*?)\*\*$/, '$1');
        htmlLines.push(`<h4 style="margin: 12px 0 6px 0; font-size: 0.95rem; font-weight: 600; color: #fff;">${parseInline(content)}</h4>`);
        continue;
      }
      if (trimmed.startsWith('##')) {
        let content = trimmed.substring(2).trim();
        content = content.replace(/^\*\*([\s\S]*?)\*\*$/, '$1');
        htmlLines.push(`<h3 style="margin: 14px 0 8px 0; font-size: 1.05rem; font-weight: 700; color: #fff;">${parseInline(content)}</h3>`);
        continue;
      }
      if (trimmed.startsWith('#')) {
        let content = trimmed.substring(1).trim();
        content = content.replace(/^\*\*([\s\S]*?)\*\*$/, '$1');
        htmlLines.push(`<h2 style="margin: 16px 0 10px 0; font-size: 1.15rem; font-weight: 800; color: #fff;">${parseInline(content)}</h2>`);
        continue;
      }

      // Blockquotes (> text)
      if (trimmed.startsWith('>')) {
        let content = trimmed.substring(1).trim();
        htmlLines.push(`<blockquote style="border-left: 3px solid #6366f1; padding-left: 10px; color: #94a3b8; margin: 8px 0; font-style: italic;">${parseInline(content)}</blockquote>`);
        continue;
      }

      // Unordered lists (- text or * text)
      if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
        let content = trimmed.substring(1).trim();
        if (!inList) {
          inList = true;
          htmlLines.push('<ul style="margin: 6px 0; padding-left: 20px; list-style-type: disc;">');
        }
        htmlLines.push(`<li style="margin-bottom: 4px;">${parseInline(content)}</li>`);
        continue;
      }

      // Numbered lists (1. text)
      const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
      if (numMatch) {
        if (inList) { htmlLines.push('</ul>'); inList = false; }
        let content = numMatch[2].trim();
        if (!inNumList) {
          inNumList = true;
          htmlLines.push('<ol style="margin: 6px 0; padding-left: 20px; list-style-type: decimal;">');
        }
        htmlLines.push(`<li style="margin-bottom: 4px;">${parseInline(content)}</li>`);
        continue;
      }

      // Close lists if we hit a normal line or empty line
      if (trimmed === '') {
        if (inList) { htmlLines.push('</ul>'); inList = false; }
        if (inNumList) { htmlLines.push('</ol>'); inNumList = false; }
        htmlLines.push('<br style="content: \'\'; display: block; margin: 4px 0;">');
      } else {
        if (inList) { htmlLines.push('</ul>'); inList = false; }
        if (inNumList) { htmlLines.push('</ol>'); inNumList = false; }
        htmlLines.push(`<p style="margin: 4px 0; line-height: 1.6;">${parseInline(line)}</p>`);
      }
    }

    if (inTable) {
      let tableHtml = '<div class="table-container"><table class="ai-chat-table">';
      tableHtml += '<thead><tr>' + tableHeaders.map(h => `<th>${parseInline(h)}</th>`).join('') + '</tr></thead>';
      tableHtml += '<tbody>';
      tableRows.forEach(row => {
        tableHtml += '<tr>' + row.map(c => `<td>${parseInline(c)}</td>`).join('') + '</tr>';
      });
      tableHtml += '</tbody></table></div>';
      htmlLines.push(tableHtml);
    }

    if (inList) htmlLines.push('</ul>');
    if (inNumList) htmlLines.push('</ol>');

    return htmlLines.join('\n');
  }

  // Append Message
  function appendMessage(role, content) {
    const msg = document.createElement('div');
    msg.className = `ai-msg ${role}`;
    if (role === 'assistant') {
      msg.innerHTML = formatReply(content);
    } else {
      msg.textContent = content;
    }
    chatMessages.appendChild(msg);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  // Show Typing Indicator
  function showTyping() {
    const ind = document.createElement('div');
    ind.className = 'ai-typing-indicator';
    ind.id = 'aiTypingIndicator';
    ind.innerHTML = `
      <div class="ai-typing-dot"></div>
      <div class="ai-typing-dot"></div>
      <div class="ai-typing-dot"></div>
    `;
    chatMessages.appendChild(ind);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  // Hide Typing Indicator
  function hideTyping() {
    const ind = document.getElementById('aiTypingIndicator');
    if (ind) ind.remove();
  }

  // Send Message
  async function sendMessage() {
    const text = chatInput.value.trim();
    if (!text) return;

    chatInput.value = '';
    appendMessage('user', text);
    showTyping();
    chatSend.disabled = true;

    try {
      const response = await fetch('/api/support/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: text,
          sessionId: sessionId,
          history: chatHistory
        })
      });

      const data = await response.json();
      hideTyping();

      if (data.success && data.reply) {
        appendMessage('assistant', data.reply);
        chatHistory.push({ role: 'user', content: text });
        chatHistory.push({ role: 'assistant', content: data.reply });
      } else {
        appendMessage('assistant', '⚠️ Lỗi: ' + (data.error || 'Không thể nhận phản hồi từ AI.'));
      }
    } catch (err) {
      hideTyping();
      appendMessage('assistant', '❌ Lỗi kết nối tới máy chủ hỗ trợ.');
    } finally {
      chatSend.disabled = false;
      chatInput.focus();
    }
  }

  // Helper to read cookie
  function _getCookie(name) {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? match[2] : null;
  }

  // Load chat history from server
  async function loadHistory() {
    try {
      const response = await fetch(`/api/support/history?sessionId=${sessionId}`);
      const data = await response.json();
      if (data.success && data.history && data.history.length > 0) {
        // Clear default welcome message if there is actual history
        chatMessages.innerHTML = '';
        
        chatHistory = data.history.map(item => ({
          role: item.role,
          content: item.content
        }));
        
        data.history.forEach(item => {
          appendMessage(item.role, item.content);
        });
      }
    } catch (err) {
      console.error('Lỗi khi tải lịch sử chat:', err);
    }
  }

  // Event Listeners
  chatSend.onclick = sendMessage;
  chatInput.onkeypress = (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  };

  // Load history on initialization
  loadHistory();
})();
