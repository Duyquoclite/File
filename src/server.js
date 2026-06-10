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
