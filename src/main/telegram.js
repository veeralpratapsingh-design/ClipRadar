'use strict';
// Telegram Bot API: photo + caption + "Open video" button.

const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const trunc = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

function fmtDur(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const p = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${p(m)}:${p(s)}` : `${m}:${p(s)}`;
}

function agoText(ts) {
  const m = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
}

async function call(token, method, body) {
  let res;
  try {
    res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    });
  } catch (e) {
    throw new Error('Could not reach Telegram. Check your internet connection.');
  }
  const json = await res.json().catch(() => ({}));
  if (!json.ok) {
    const d = json.description || `HTTP ${res.status}`;
    if (res.status === 401 || res.status === 404) throw new Error('Bot token is invalid. Copy it again from @BotFather.');
    if (/chat not found/i.test(d)) throw new Error('Chat not found. Open your bot in Telegram and press Start first, then double-check the chat ID.');
    if (/blocked/i.test(d)) throw new Error('The bot is blocked. Unblock it in Telegram and press Start.');
    throw new Error(d);
  }
  return json.result;
}

async function sendTest(token, chatId) {
  if (!token) throw new Error('Paste your bot token first.');
  if (!chatId) throw new Error('Paste your chat ID first.');
  const me = await call(token, 'getMe');
  await call(token, 'sendMessage', {
    chat_id: chatId,
    text: '✅ <b>ClipRadar is connected.</b>\nYou will get a message like this whenever a tracked channel posts a new video.',
    parse_mode: 'HTML'
  });
  return { username: me.username };
}

async function sendVideoAlert(settings, video, channel) {
  const { botToken, chatId } = settings;
  const url = `https://www.youtube.com/watch?v=${video.id}`;
  const star = channel && channel.priority ? '⭐ ' : '';
  const lines = [
    `🚨 <b>NEW DROP</b> · ${star}${esc(video.channelName)}`,
    '',
    `<b>${esc(trunc(video.title, 300))}</b>`,
    ''
  ];
  const meta = [];
  if (video.duration != null) meta.push('⏱ ' + fmtDur(video.duration));
  meta.push('Uploaded ' + agoText(video.published));
  lines.push(meta.join('  ·  '));
  const caption = lines.join('\n');
  const reply_markup = { inline_keyboard: [[{ text: '▶ Open video', url }]] };

  const photos = [
    `https://i.ytimg.com/vi/${video.id}/maxresdefault.jpg`,
    video.thumb,
    `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`
  ].filter(Boolean);

  for (const photo of photos) {
    try {
      await call(botToken, 'sendPhoto', { chat_id: chatId, photo, caption, parse_mode: 'HTML', reply_markup });
      return;
    } catch (e) {
      // Token/chat problems fail the same way for every thumbnail; stop early.
      if (/token|chat|blocked|connection/i.test(e.message)) throw e;
    }
  }
  // Last resort: plain text with the link.
  await call(botToken, 'sendMessage', { chat_id: chatId, text: caption, parse_mode: 'HTML', reply_markup });
}

module.exports = { sendTest, sendVideoAlert };
