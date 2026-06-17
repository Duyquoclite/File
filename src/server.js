/**
 * Main Server Entry Point
 * Express server + WebSocket for real-time automation logs
 */

const express = require('express');
const cors = require('cors');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');
const chromeService = require('./backend/services/chromeService');
const proxyCheckerService = require('./backend/services/proxyCheckerService');
const db = require('./backend/db');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// ====== Middleware ======
app.use(cors());
app.use(express.json({ limit: '1000mb' }));
app.use(express.urlencoded({ limit: '1000mb', extended: true }));

// Serve static frontend
app.use(express.static(path.join(__dirname, 'public')));

// ====== API Routes ======
app.use('/api/profiles', require('./backend/routes/profiles'));
app.use('/api/automation', require('./backend/routes/automation'));
app.use('/api/proxy', require('./backend/routes/proxy'));
app.use('/api/support', require('./backend/routes/support'));
app.use('/api/update', require('./backend/routes/update'));

// ====== WebSocket for real-time logs ======
const wss = new WebSocketServer({ server, path: '/ws' });
app.set('wss', wss);

wss.on('connection', (ws) => {
  console.log('[WS] Client connected');

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);

      if (data.action === 'register') {
        ws.clientId = data.clientId;
        return;
      }

      if (data.action === 'run-script') {
        const { profileId, code } = data;
        if (!profileId || !code) {
          ws.send(JSON.stringify({ type: 'error', text: 'profileId and code are required' }));
          return;
        }

        ws.send(JSON.stringify({ type: 'info', text: `▶ Running script on profile ${profileId}...` }));

        const onLog = (log) => {
          ws.send(JSON.stringify({ type: 'log', ...log }));
        };

        const result = await chromeService.runPuppeteerScript(profileId, code, onLog);

        ws.send(JSON.stringify({
          type: 'result',
          success: result.success,
          result: result.result,
          error: result.error,
        }));
      }
    } catch (err) {
      ws.send(JSON.stringify({ type: 'error', text: err.message }));
    }
  });

  ws.on('close', () => {
    console.log('[WS] Client disconnected');
  });
});

// ====== Profile Info Page (Home page for Chrome profiles) ======
app.get('/profile-info/:id', (req, res) => {
  const profileId = req.params.id;
  try {
    const profile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(profileId);
    if (!profile) {
      return res.status(404).send('<h1>Không tìm thấy Profile</h1>');
    }
    const fp = JSON.parse(profile.fingerprint || '{}');
    
    // Convert status to readable text
    const statusText = profile.status === 'running' ? 'Đang chạy' : 'Đã đóng';
    
    // Generate a beautiful glassmorphism-styled HTML page in Vietnamese showing all profile info
    const html = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>Thông tin Profile: ${profile.name}</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0b0f19;
      --card-bg: rgba(17, 24, 39, 0.7);
      --border: rgba(255, 255, 255, 0.08);
      --text: #f3f4f6;
      --text-muted: #9ca3af;
      --primary: #6366f1;
      --primary-hover: #4f46e5;
      --success: #10b981;
      --warning: #f59e0b;
      --danger: #ef4444;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: 'Outfit', sans-serif;
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      background-image: radial-gradient(circle at 10% 20%, rgba(99, 102, 241, 0.15) 0%, transparent 40%),
                        radial-gradient(circle at 90% 80%, rgba(16, 185, 129, 0.1) 0%, transparent 40%);
      padding: 20px;
    }
    .container {
      width: 100%;
      max-width: 800px;
      background: var(--card-bg);
      backdrop-filter: blur(16px);
      border: 1px solid var(--border);
      border-radius: 24px;
      padding: 40px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
      border-bottom: 1px solid var(--border);
      padding-bottom: 20px;
    }
    .header h1 {
      font-size: 2.5rem;
      font-weight: 700;
      background: linear-gradient(135deg, #a5b4fc 0%, #6366f1 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 5px;
    }
    .header p {
      color: var(--text-muted);
      font-size: 1rem;
    }
    .section-title {
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--primary);
      margin: 25px 0 15px 0;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
    }
    @media (max-width: 600px) {
      .grid { grid-template-columns: 1fr; }
    }
    .info-card {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    .info-card .label {
      font-size: 0.85rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .info-card .value {
      font-size: 1.1rem;
      font-weight: 500;
      color: var(--text);
      word-break: break-all;
    }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 8px;
      font-size: 0.85rem;
      font-weight: 600;
    }
    .badge-static { background: rgba(16, 185, 129, 0.15); color: #34d399; }
    .badge-dynamic { background: rgba(245, 158, 11, 0.15); color: #fbbf24; }
    .badge-undetermined { background: rgba(156, 163, 175, 0.15); color: #d1d5db; }
    .footer {
      text-align: center;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid var(--border);
      color: var(--text-muted);
      font-size: 0.85rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${profile.name}</h1>
      <p>ID: ${profile.id}</p>
    </div>

    <div class="section-title">🛡️ THÔNG TIN CƠ BẢN</div>
    <div class="grid">
      <div class="info-card">
        <span class="label">Tên Profile</span>
        <span class="value">${profile.name}</span>
      </div>
      <div class="info-card">
        <span class="label">Số lần đã mở</span>
        <span class="value">🚀 ${profile.openCount || 0} lần</span>
      </div>
      <div class="info-card" style="grid-column: span 2;">
        <span class="label">Ghi chú</span>
        <span class="value">${profile.notes || '<i>Không có ghi chú</i>'}</span>
      </div>
    </div>

    <div class="section-title">🌐 KẾT NỐI PROXY</div>
    <div class="grid">
      <div class="info-card">
        <span class="label">Địa chỉ Proxy</span>
        <span class="value">${profile.proxy ? profile.proxy : 'Không sử dụng'}</span>
      </div>
      <div class="info-card">
        <span class="label">Loại Proxy</span>
        <span class="value">${profile.proxyType ? profile.proxyType.toUpperCase() : 'Không'}</span>
      </div>
      <div class="info-card">
        <span class="label">IP cuối ghi nhận</span>
        <span class="value">${profile.proxyIp || 'Chưa kiểm tra'}</span>
      </div>
      <div class="info-card">
        <span class="label">Loại đường truyền</span>
        <span class="value">
          ${
            profile.proxyCategory === 'static'
              ? '<span class="badge badge-static">Tĩnh (Static)</span>'
              : profile.proxyCategory === 'dynamic'
              ? '<span class="badge badge-dynamic">Động (Dynamic)</span>'
              : '<span class="badge badge-undetermined">Chưa xác định</span>'
          }
        </span>
      </div>
      <div class="info-card">
        <span class="label">Quốc gia</span>
        <span class="value">${profile.proxyCountry || 'Chưa rõ'}</span>
      </div>
      <div class="info-card">
        <span class="label">Múi giờ</span>
        <span class="value">${profile.proxyTimezone || 'Chưa rõ'}</span>
      </div>
    </div>

    <div class="section-title">💻 VÂN TAY TRÌNH DUYỆT (FINGERPRINT)</div>
    <div class="grid">
      <div class="info-card" style="grid-column: span 2;">
        <span class="label">User-Agent</span>
        <span class="value" style="font-size: 0.95rem; font-family: monospace;">${fp.userAgent || 'Mặc định'}</span>
      </div>
      <div class="info-card">
        <span class="label">Hệ điều hành (Platform)</span>
        <span class="value">${fp.platform || 'Win32'}</span>
      </div>
      <div class="info-card">
        <span class="label">Độ phân giải màn hình</span>
        <span class="value">${fp.screen ? fp.screen.width + 'x' + fp.screen.height : '1920x1080'}</span>
      </div>
      <div class="info-card">
        <span class="label">Bộ nhớ RAM (Device Memory)</span>
        <span class="value">${fp.deviceMemory ? fp.deviceMemory + ' GB' : 'Mặc định (8)'}</span>
      </div>
      <div class="info-card">
        <span class="label">Số lõi CPU (Hardware Concurrency)</span>
        <span class="value">${fp.hardwareConcurrency ? fp.hardwareConcurrency + ' Cores' : 'Mặc định (8)'}</span>
      </div>
      <div class="info-card" style="grid-column: span 2;">
        <span class="label">WebGL Vendor & Renderer</span>
        <span class="value" style="font-size: 0.9rem;">
          <b>Vendor:</b> ${fp.webgl?.vendor || 'Google Inc. (NVIDIA)'}<br>
          <b>Renderer:</b> ${fp.webgl?.renderer || 'ANGLE (NVIDIA GeForce GTX 1660 SUPER)'}
        </span>
      </div>
    </div>

    <div class="footer">
      Thời gian tạo: ${profile.createdAt} | Cập nhật cuối: ${profile.updatedAt}
    </div>
  </div>
</body>
</html>
    `;
    res.send(html);
  } catch (err) {
    res.status(500).send('<h1>Lỗi hệ thống</h1><p>' + err.message + '</p>');
  }
});

// ====== SPA fallback ======
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ====== Start server ======
server.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════════════╗
  ║   Chrome Profile Manager                         ║
  ║   Server running at http://localhost:${PORT}        ║
  ║   WebSocket at ws://localhost:${PORT}/ws            ║
  ╚══════════════════════════════════════════════════╝
  `);
  proxyCheckerService.start();
});

async function shutdown(signal, exitCode = 0) {
  try {
    console.log(`\n[Server] Received ${signal}. Closing all browsers...`);
    await chromeService.closeAll();
  } catch (err) {
    console.error('[Server] Error during shutdown:', err);
  } finally {
    server.close(() => process.exit(exitCode));
    setTimeout(() => process.exit(exitCode), 5000);
  }
}

// ====== Graceful shutdown ======
process.on('SIGINT', () => shutdown('SIGINT', 0));
process.on('SIGTERM', () => shutdown('SIGTERM', 0));
process.on('SIGBREAK', () => shutdown('SIGBREAK', 0));
process.on('SIGHUP', () => shutdown('SIGHUP', 0));

process.on('beforeExit', async (code) => {
  console.log(`[Server] beforeExit event with code: ${code}`);
  await shutdown('beforeExit', code);
});

process.on('exit', (code) => {
  console.log(`[Server] exit event with code: ${code}`);
});

process.on('uncaughtException', async (error) => {
  console.error('[Server] Uncaught exception:', error);
  await shutdown('uncaughtException', 1);
});

process.on('unhandledRejection', async (reason) => {
  console.error('[Server] Unhandled rejection:', reason);
  await shutdown('unhandledRejection', 1);
});
