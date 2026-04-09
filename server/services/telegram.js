// ═══════════════════════════════════════
//  TELEGRAM NOTIFICATION SERVICE
// ═══════════════════════════════════════

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

/**
 * Send a notification message to a Telegram chat via Bot API.
 * Fails gracefully — logs errors but never throws.
 */
async function sendTelegramNotification(message) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    // Telegram not configured — silently skip
    return;
  }

  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const body = JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    });

    const https = require('https');
    const urlObj = new URL(url);

    await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: urlObj.hostname,
        path: urlObj.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            reject(new Error(`Telegram API returned ${res.statusCode}: ${data}`));
          }
        });
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  } catch (e) {
    console.warn('[TELEGRAM] Notification failed:', e.message);
  }
}

module.exports = { sendTelegramNotification };
