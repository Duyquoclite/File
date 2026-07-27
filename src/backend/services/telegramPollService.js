const axios = require('axios');

const BOT_TOKEN = '8949912440:AAF7twhhLH1YZJ2WC6RDO3cTrup90LmC91g';
const POLL_INTERVAL = 3000; // Check every 3 seconds

let isPolling = false;
let offset = 0; // Keep offset in-memory for simpler execution since we are just printing to terminal

async function pollUpdates() {
  if (isPolling) return;
  isPolling = true;

  try {
    const response = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates`, {
      params: {
        offset: offset,
        timeout: 10
      },
      timeout: 15000
    });

    if (response.data && response.data.ok) {
      const updates = response.data.result;
      for (const update of updates) {
        offset = update.update_id + 1;
        console.log(update);
      }
    }
  } catch (error) {
    console.error('[TG POLL ERROR]:', error.message);
  } finally {
    isPolling = false;
    setTimeout(pollUpdates, POLL_INTERVAL);
  }
}

function startPolling() {
  console.log('[TG POLL] Starting Telegram terminal logger...');
  pollUpdates();
}

module.exports = { startPolling };
