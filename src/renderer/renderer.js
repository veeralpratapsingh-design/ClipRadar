'use strict';

const api = window.clipradar;

// ---------------------------------------------------------------- state
const S = {
  page: 'home',
  data: null,
  filterChannel: null,
  chanSearch: '',
  postedSearch: '',
  modal: null,
  showToken: false,
  tgMsg: null
};

// ---------------------------------------------------------------- theme
const THEMES = [
  { name: 'Ocean', hex: '#2fb6ff' },
  { name: 'Sunset', hex: '#ff7a3d' },
  { name: 'Violet', hex: '#8b5cf6' },
  { name: 'Emerald', hex: '#22c55e' },
  { name: 'Rose', hex: '#ff4d8d' },
  { name: 'Gold', hex: '#f5b324' },
  { name: 'Crimson', hex: '#ef4444' }
];
const LOGO_HUE = 200; // hue of the supplied logo artwork
function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  let h = 0, s = 0;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return [h, s * 100, l * 100];
}
function applyTheme(hex) {
  if (!/^#[0-9a-f]{6}$/i.test(hex || '')) hex = THEMES[0].hex;
  const [r, g, b] = hexToRgb(hex);
  const [h, s0] = rgbToHsl(r, g, b);
  const s = Math.max(70, s0);
  const hsl = (hh, l) => `hsl(${(hh + 360) % 360} ${s}% ${l}%)`;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const st = document.documentElement.style;
  st.setProperty('--a1', hsl(h - 12, 52));
  st.setProperty('--a2', hsl(h, 60));
  st.setProperty('--a3', hsl(h + 18, 68));
  st.setProperty('--glow-rgb', `${r}, ${g}, ${b}`);
  st.setProperty('--tan-ink', lum > 0.55 ? '#14100a' : '#06121a');
  st.setProperty('--logo-hue', `${Math.round(h - LOGO_HUE)}deg`);
}

// ---------------------------------------------------------------- helpers
const $ = (sel) => document.querySelector(sel);
const esc = (s) =>
  String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const ic = (inner, fill) =>
  `<svg class="ic" viewBox="0 0 24 24" fill="${fill || 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
const ICON = {
  check: ic('<path d="M20 6 9 17l-5-5"/>'),
  play: ic('<polygon points="7 4 20 12 7 20 7 4"/>', 'currentColor'),
  x: ic('<path d="M18 6 6 18M6 6l12 12"/>'),
  star: ic('<polygon points="12 2 15.1 8.6 22 9.3 17 14.1 18.2 21 12 17.8 5.8 21 7 14.1 2 9.3 8.9 8.6 12 2"/>'),
  starFill: ic('<polygon points="12 2 15.1 8.6 22 9.3 17 14.1 18.2 21 12 17.8 5.8 21 7 14.1 2 9.3 8.9 8.6 12 2"/>', 'currentColor'),
  pause: ic('<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>'),
  resume: ic('<polygon points="7 4 20 12 7 20 7 4"/>'),
  trash: ic('<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>'),
  plus: ic('<path d="M12 5v14M5 12h14"/>'),
  refresh: ic('<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>'),
  search: ic('<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>'),
  ext: ic('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'),
  undo: ic('<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>'),
  send: ic('<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>'),
  edit: ic('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
  eye: ic('<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  filter: ic('<path d="M3 5h18l-7 8v6l-4 2v-8z"/>'),
  clock: ic('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  monitor: ic('<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>'),
  database: ic('<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>'),
  palette: ic('<path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-1 1.6-2.1-.5-1.3.2-2.4 1.6-2.4H17a4 4 0 0 0 4-4c0-5-4-9.5-9-9.5z"/><circle cx="7.5" cy="11" r="1" fill="currentColor"/><circle cx="10.5" cy="7" r="1" fill="currentColor"/><circle cx="15" cy="7.5" r="1" fill="currentColor"/>'),
  bell: ic('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10.3 21a2 2 0 0 0 3.4 0"/>'),
  folder: ic('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>')
};
// Telegram's paper-plane glyph (filled)
ICON.telegram = `<svg class="ic" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21.9 3.4 2.7 10.8c-1.3.5-1.3 1.3-.2 1.6l4.9 1.5 1.9 5.8c.2.6.1.8.7.8.5 0 .7-.2 1-.5l2.4-2.3 4.9 3.6c.9.5 1.5.2 1.7-.8l3.2-15.2c.3-1.3-.5-1.9-1.4-1.5zM9 13.6l9.4-5.9c.4-.3.8-.1.5.2l-7.8 7-.3 3.3z"/></svg>`;
const MARK = `<img class="brand-mark" src="logo.png" alt="">`;
const RADAR_BIG = `<svg class="radar" viewBox="0 0 84 84" aria-hidden="true"><circle cx="42" cy="42" r="38" fill="none" stroke="currentColor" stroke-opacity=".25" stroke-width="2"/><circle cx="42" cy="42" r="24" fill="none" stroke="currentColor" stroke-opacity=".5" stroke-width="2"/><path d="M42 42 66 18" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><circle cx="42" cy="42" r="5" fill="currentColor"/></svg>`;

const ago = (ts) => {
  if (!ts) return '—';
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};
const pad = (n) => String(n).padStart(2, '0');
const dur = (sec) => {
  if (sec == null) return '--:--';
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
};
const clock = (ms) => {
  const t = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(t / 60)}:${pad(t % 60)}`;
};
const hash = (str) => {
  let h = 0;
  for (const ch of String(str)) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return h;
};
const initials = (name) => {
  const words = String(name || '?').replace(/[^\p{L}\p{N}\s]/gu, '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  return (words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[1][0]).toUpperCase();
};
const avatar = (c, size) => {
  const img = c.avatar ? `<img src="${esc(c.avatar)}" alt="" loading="lazy">` : '';
  return `<span class="av" style="--s:${size}px;--h:${hash(c.name || c.id) % 360}"><span>${esc(initials(c.name))}</span>${img}</span>`;
};
const ringAvatar = (c, size) => {
  const img = c.avatar ? `<img src="${esc(c.avatar)}" alt="" loading="lazy">` : '';
  return `<span class="av" style="--h:${hash(c.name || c.id) % 360}"><span>${esc(initials(c.name))}</span>${img}</span>`;
};
const isMac = /mac/i.test(navigator.platform);
const MOD = isMac ? '⌘' : 'Ctrl+';

// Calls to the main process return {ok, data|error}.
async function call(promise) {
  const r = await promise;
  if (!r.ok) throw new Error(r.error || 'Something went wrong');
  return r.data;
}

// ---------------------------------------------------------------- derived data
function derive() {
  const d = S.data;
  const now = Date.now();
  const fresh = [], pending = [], posted = [];
  const newBy = {}, postedBy = {};
  for (const v of d.videos) {
    if (v.status === 'new') {
      newBy[v.channelId] = (newBy[v.channelId] || 0) + 1;
      fresh.push(v);
    } else if (v.status === 'posted') {
      postedBy[v.channelId] = (postedBy[v.channelId] || 0) + 1;
      posted.push(v);
    }
  }
  fresh.sort((a, b) => b.published - a.published);
  pending.sort((a, b) => a.published - b.published);
  posted.sort((a, b) => (b.postedAt || 0) - (a.postedAt || 0));
  const chMap = {};
  d.channels.forEach((c) => (chMap[c.id] = c));
  return { fresh, pending, posted, newBy, postedBy, chMap };
}

function telegramStatus() {
  const s = S.data.settings;
  if (!s.botToken || !s.chatId) return { cls: 'warn', text: 'Telegram not set up' };
  if (S.data.telegramOk === false) return { cls: 'err', text: 'Telegram error' };
  if (S.data.telegramOk === true) return { cls: 'ok', text: 'Telegram connected' };
  return { cls: 'ok', text: 'Telegram ready' };
}

// ---------------------------------------------------------------- top bar
function renderTopbar() {
  const d = S.data;
  const tg = telegramStatus();
  const tab = (id, label) => `<button class="${S.page === id ? 'active' : ''}" data-action="nav" data-page="${id}">${label}</button>`;
  $('#topbar').innerHTML = `
    <div class="topbar">
      <div class="brand">${MARK}<span class="brand-name">Clip<b>Radar</b></span></div>
      <nav class="nav">${tab('home', 'Home')}${tab('channels', 'Channels')}${tab('posted', 'Posted')}${tab('settings', 'Settings')}</nav>
      <div class="top-right">
        <button class="who" data-action="check-now" ${d.checking ? 'disabled' : ''} title="Last checked ${d.lastCheckedAt ? ago(d.lastCheckedAt) : 'never'}">
          <span class="orb"><span class="${d.checking ? 'spin' : ''}">${ICON.refresh}</span></span><span>${d.checking ? 'Checking…' : 'Check now'}</span>
        </button>
        <button class="who" data-action="nav" data-page="settings" title="Telegram settings">
          <span class="orb">${ICON.telegram}</span><span><i class="dot ${tg.cls}"></i>${tg.text}</span>
        </button>
      </div>
    </div>`;
}

// ---------------------------------------------------------------- HOME
function videoCard(v, opts) {
  opts = opts || {};
  const isNew = !opts.posted && Date.now() - v.detectedAt < 2 * 36e5;
  // These controls stay hidden until the card is hovered (see .vbar in styles.css).
  const actions = opts.posted
    ? `<button class="pill" data-action="open-video" data-id="${v.id}">${ICON.ext} Open</button>
       <button class="pill dim" data-action="unpost" data-id="${v.id}">${ICON.undo} Back to queue</button>`
    : `<button class="pill" data-action="mark-posted" data-id="${v.id}">${ICON.check} Mark as posted</button>
       <button class="pill round" title="Dismiss" data-action="dismiss" data-id="${v.id}">${ICON.x}</button>
       <button class="pill round" title="Preview on YouTube" data-action="open-video" data-id="${v.id}">${ICON.eye}</button>`;
  return `
    <article class="vcard">
      <img class="bg" src="${esc(v.thumb)}" alt="" loading="lazy"><div class="shade"></div>
      ${isNew ? '<span class="tag">NEW</span>' : ''}
      <span class="dur">${dur(v.duration)}</span>
      <button class="playbtn" title="Preview on YouTube" data-action="open-video" data-id="${v.id}">${ICON.play}</button>
      <div class="vinfo">
        <h3 class="vtitle" title="${esc(v.title)}">${esc(v.title)}</h3>
        <div class="vbar">${actions}</div>
      </div>
    </article>`;
}

function storageWarning(d) {
  const st = d.storage || {};
  if (!st.saveError && !st.loadError) return '';
  return `<div class="banner"><i class="dot err"></i><div><b>${st.saveError ? "Your changes can't be saved" : 'Saved data could not be read'}</b><span>${esc(st.saveError || st.loadError)} — see Settings → Data.</span></div><span class="sp"></span><button class="btn sm" data-action="nav" data-page="settings">Open Settings</button></div>`;
}

function pageHome() {
  const d = S.data;
  const D = derive();

  if (!d.channels.length) {
    return `<div class="home"><div class="home-main">${storageWarning(d)}
      <div class="empty">
        ${RADAR_BIG}
        <h3>Point the radar at some podcasts</h3>
        <p>Add the YouTube channels you want to watch. ClipRadar checks them every ${d.settings.intervalMin} minutes and pings your phone on Telegram the moment something new drops.</p>
        <button class="btn primary" data-action="open-add">${ICON.plus} Add your first channel</button>
      </div></div></div>`;
  }

  const channels = d.channels.slice().sort((a, b) =>
    (D.newBy[b.id] || 0) - (D.newBy[a.id] || 0) ||
    Number(!!b.priority) - Number(!!a.priority) ||
    (b.lastVideoAt || 0) - (a.lastVideoAt || 0));

  const stories = channels.map((c) => {
    const n = D.newBy[c.id] || 0;
    return `<button class="story ${n ? 'live' : ''} ${c.paused ? 'paused' : ''} ${S.filterChannel === c.id ? 'active' : ''}" data-action="filter-channel" data-id="${c.id}" title="${esc(c.name)}">
      <span class="ringav">${ringAvatar(c)}${n ? `<span class="badge-n">${n}</span>` : ''}</span>
      <span class="sname">${esc(c.name)}</span></button>`;
  }).join('') + `<button class="story" data-action="open-add" title="Add channel"><span class="ringav add">${ICON.plus}</span><span class="sname">Add</span></button>`;

  const list = S.filterChannel ? D.fresh.filter((v) => v.channelId === S.filterChannel) : D.fresh;
  const filterName = S.filterChannel && D.chMap[S.filterChannel] ? D.chMap[S.filterChannel].name : null;
  const cards = list.map((v) => videoCard(v)).join('');

  const tgBanner = (!d.settings.botToken || !d.settings.chatId)
    ? `<div class="banner"><i class="dot warn"></i><div><b>Phone alerts are off</b><span>Connect your Telegram bot to get a buzz the moment a video drops.</span></div><span class="sp"></span><button class="btn sm" data-action="nav" data-page="settings">Set up Telegram</button></div>`
    : '';

  return `
  <div class="home"><div class="home-main">
    ${storageWarning(d)}${tgBanner}
    <section class="sec">
      <div class="sec-head"><h2>Channels</h2><span class="muted">${d.channels.length} monitored</span></div>
      <div class="stories">${stories}</div>
    </section>
    <section class="sec">
      <div class="sec-head"><h2>New Videos</h2>
        <span class="muted">${D.fresh.length} waiting</span>
        ${filterName ? `<button class="chip tan" data-action="filter-channel" data-id="${S.filterChannel}" title="Clear filter">${esc(filterName)} ✕</button>` : ''}
        <span class="sp"></span><span class="muted" id="cd"></span></div>
      ${list.length
        ? `<div class="vgrid">${cards}</div>`
        : `<div class="empty">${RADAR_BIG}<h3>${filterName ? 'Nothing new from this channel' : 'All caught up'}</h3><p style="margin-bottom:0">${filterName ? 'Clear the filter to see everything.' : "New episodes show up here the moment they drop, and your phone buzzes."}</p></div>`}
    </section>
  </div></div>`;
}

// ---------------------------------------------------------------- CHANNELS
function channelRows() {
  const D = derive();
  const q = S.chanSearch.trim().toLowerCase();
  const chans = S.data.channels
    .filter((c) => !q || c.name.toLowerCase().includes(q) || String(c.handle || '').toLowerCase().includes(q))
    .sort((a, b) => (D.newBy[b.id] || 0) - (D.newBy[a.id] || 0) || Number(!!b.priority) - Number(!!a.priority) || a.name.localeCompare(b.name));
  if (!chans.length) {
    return `<div class="empty" style="grid-column:1/-1"><h3>${q ? 'No channels match your search' : 'No channels yet'}</h3></div>`;
  }
  const tiles = chans.map((c) => {
    const n = D.newBy[c.id] || 0;
    return `<button class="ctile story ${c.paused ? 'paused' : ''} ${n ? 'live' : ''}" data-action="channel-detail" data-id="${c.id}" title="${esc(c.name)}">
      <span class="ringav xl">${ringAvatar(c)}${n ? `<span class="badge-n">${n}</span>` : ''}${c.priority ? `<span class="badge-star">${ICON.starFill}</span>` : ''}</span>
      <span class="cname">${esc(c.name)}</span>
      <span class="csub ${c.lastError ? 'err' : ''}">${c.lastError ? 'Needs attention' : c.paused ? 'Paused' : c.lastVideoAt ? 'Last: ' + ago(c.lastVideoAt) : 'No videos yet'}</span>
    </button>`;
  }).join('');
  return tiles + (q ? '' : `<button class="ctile story" data-action="open-add" title="Add channel"><span class="ringav xl add">${ICON.plus}</span><span class="cname">Add channel</span></button>`);
}

function pageChannels() {
  const d = S.data;
  return `<div class="page">
    <div class="sec-head"><h2>Channels</h2><span class="muted">${d.channels.length} monitored · click a channel for details</span></div>
    <div class="toolbar">
      <label class="search">${ICON.search}<input id="chan-search" placeholder="Search channels…" value="${esc(S.chanSearch)}"></label>
      <span class="sp"></span>
      <button class="btn primary" data-action="open-add">${ICON.plus} Add channel</button>
    </div>
    <div class="cgrid" id="chan-list">${channelRows()}</div>
  </div>`;
}

// ---------------------------------------------------------------- POSTED
function postedRows() {
  const D = derive();
  const q = S.postedSearch.trim().toLowerCase();
  const rows = D.posted.filter((v) => !q || v.title.toLowerCase().includes(q) || v.channelName.toLowerCase().includes(q));
  if (!rows.length) {
    return `<div class="empty" style="grid-column:1/-1"><h3>${q ? 'Nothing matches your search' : 'No posted podcasts yet'}</h3>${q ? '' : '<p style="margin-bottom:0">When you press “Mark as posted” on Home, the video moves here.</p>'}</div>`;
  }
  return rows.map((v) => videoCard(v, { posted: true })).join('');
}

function pagePosted() {
  const D = derive();
  return `<div class="page">
    <div class="sec-head"><h2>Posted Podcasts</h2><span class="muted">${D.posted.length} posted</span></div>
    <div class="toolbar">
      <label class="search">${ICON.search}<input id="posted-search" placeholder="Search posted…" value="${esc(S.postedSearch)}"></label>
    </div>
    <div class="vgrid" id="posted-list">${postedRows()}</div>
  </div>`;
}

// ---------------------------------------------------------------- SETTINGS
function toggleRow(key, title, desc) {
  const on = !!S.data.settings[key];
  return `<div class="row-set"><div class="t"><b>${title}</b><span>${desc}</span></div>
    <button class="switch ${on ? 'on' : ''}" role="switch" aria-checked="${on}" data-action="toggle-setting" data-key="${key}"></button></div>`;
}

function pageSettings() {
  const s = S.data.settings;
  const tg = telegramStatus();
  const tgMsg = S.tgMsg || (S.data.telegramOk === false && S.data.telegramError ? { cls: 'bad', text: S.data.telegramError } : { cls: '', text: '' });
  const seg = (vals, cur) => `<div class="seg">${vals.map((v) => `<button class="${cur === v ? 'on' : ''}" data-action="set-interval" data-v="${v}">${v < 60 ? v + 'm' : '1h'}</button>`).join('')}</div>`;
  const intervals = [5, 15, 30, 60];
  const custom = intervals.includes(s.intervalMin) ? '' : `<span class="hint" style="margin-right:10px">Custom: ${s.intervalMin} min</span>`;
  const head = (icon, title, sub, soft) => `<div class="card-h"><span class="card-ic ${soft ? 'soft' : ''}">${icon}</span><div><h3>${title}</h3><p class="sub">${sub}</p></div></div>`;
  const cur = (s.accent || THEMES[0].hex).toLowerCase();
  const preset = THEMES.find((t) => t.hex === cur);
  const swatches = THEMES.map((t) => `<button class="swatch ${t.hex === cur ? 'on' : ''}" style="--sw:${t.hex}" title="${t.name}" data-action="set-accent" data-v="${t.hex}">${ICON.check}</button>`).join('')
    + `<label class="swatch custom ${preset ? '' : 'on'}" title="Pick any colour" style="--sw:${cur}"><input type="color" value="${cur}" data-action="pick-accent" aria-label="Custom colour"></label>`;
  return `<div class="page"><div class="page-inner set-wrap">
    <div class="sec-head"><h2>Settings</h2></div>
    <div class="set-grid">

    <section class="card wide">
      ${head(ICON.telegram, 'Telegram alerts', 'Get a message with the thumbnail and an “Open video” button on your phone.')}
      <div class="tg-cols">
        <ol class="steps">
          <li><span>In Telegram, open <b>@BotFather</b>, send <b>/newbot</b> and copy the <b>bot token</b>.</span></li>
          <li><span>Open your new bot and press <b>Start</b>.</span></li>
          <li><span>Message <b>@userinfobot</b> to get your <b>chat ID</b>, then paste both here.</span></li>
        </ol>
        <div>
          <div class="grid2">
            <div class="field"><label for="set-token">BOT TOKEN</label>
              <div class="pwrap"><input class="input" id="set-token" data-setting="botToken" type="${S.showToken ? 'text' : 'password'}" placeholder="123456789:AAH…" value="${esc(s.botToken)}" autocomplete="off" spellcheck="false">
              <button class="eye" data-action="toggle-token" title="Show / hide">${ICON.eye}</button></div></div>
            <div class="field"><label for="set-chat">CHAT ID</label>
              <input class="input" id="set-chat" data-setting="chatId" placeholder="e.g. 123456789" value="${esc(s.chatId)}" autocomplete="off" spellcheck="false"></div>
          </div>
          <div class="inline-actions">
            <button class="btn primary" data-action="send-test" id="btn-test">${ICON.telegram} Send test</button>
            <span class="hint"><span class="dot ${tg.cls}" style="display:inline-block;margin-right:6px"></span>${esc(tg.text)}</span>
          </div>
          <div class="result ${tgMsg.cls}" id="tg-result">${esc(tgMsg.text)}</div>
        </div>
      </div>
    </section>

    <section class="card wide">
      ${head(ICON.palette, 'Appearance', 'Pick an accent colour — it recolours the logo, rings, buttons and highlights.')}
      <div class="swatches">${swatches}</div>
      <p class="theme-name">Current theme: <b>${preset ? preset.name : 'Custom'}</b> <span class="mono">${cur}</span></p>
    </section>

    <section class="card">
      ${head(ICON.clock, 'Checking', 'How often to look for uploads, and what to ignore.', true)}
      <div class="row-set first"><div class="t"><b>Check every</b><span>Shorter means faster alerts.</span></div>${custom}${seg(intervals, s.intervalMin)}</div>
      ${toggleRow('ignoreShorts', 'Ignore YouTube Shorts', 'Only see long-form episodes.')}
      ${toggleRow('ignoreLive', 'Wait for live streams to finish', 'Alert once they become normal videos.')}
      <div class="row-set"><div class="t"><b>Minimum video length</b><span>Ignore shorter uploads. <span class="mono" id="minlen-val">${s.minLengthMin === 0 ? 'Any length' : s.minLengthMin + ' min'}</span></span></div>
        <input type="range" min="0" max="60" step="5" value="${s.minLengthMin}" data-setting="minLengthMin" id="minlen"></div>
    </section>

    <section class="card">
      ${head(ICON.monitor, 'App', 'Keep ClipRadar running quietly so you never miss a drop.', true)}
      ${toggleRow('runInTray', 'Keep running in the tray', 'Closing the window hides ClipRadar.').replace('class="row-set"', 'class="row-set first"')}
      ${toggleRow('desktopNotifications', 'Desktop notifications too', 'Show a system banner with the alert.')}
      ${toggleRow('startAtLogin', 'Start when I log in', S.data.packaged ? 'Launches hidden in the tray.' : 'Only works in the installed app.')}
    </section>

    <section class="card wide">
      ${head(ICON.database, 'Data', 'Your channels, queue and Telegram details live in one file on this computer.', true)}
      <div class="row-set first"><div class="t"><b>Saved file</b><span class="mono" style="word-break:break-all;user-select:text">${esc((S.data.storage || {}).file || '')}</span></div>
        <button class="btn sm" data-action="show-data">Show in folder</button></div>
      <div class="row-set"><div class="t"><b>About</b><span>ClipRadar v${esc(S.data.appVersion)} · Electron v${esc(S.data.electronVersion)}</span></div></div>
      <div class="row-set"><div class="t"><b>Status</b><span>${(S.data.storage || {}).saveError ? '⚠ Save failed: ' + esc(S.data.storage.saveError) : (S.data.storage || {}).loadError ? '⚠ ' + esc(S.data.storage.loadError) : 'Loaded from: ' + esc((S.data.storage || {}).source || '')}</span></div></div>
    </section>
    </div>
  </div></div>`;
}

// ---------------------------------------------------------------- modals
function renderModal() {
  const root = $('#modal-root');
  const m = S.modal;
  if (!m) { root.innerHTML = ''; return; }

  if (m.type === 'add') {
    const results = (m.results || []).map((r, i) => {
      if (r.status === 'loading') return `<div class="res"><span class="mini-spin"></span><div class="t"><b>${esc(r.input)}</b><span>Looking up…</span></div></div>`;
      if (r.status === 'error') return `<div class="res"><div class="t"><b>${esc(r.input)}</b><span class="bad">${esc(r.error)}</span></div></div>`;
      const c = r.info;
      if (r.status === 'dup') return `<div class="res">${avatar(c, 40)}<div class="t"><b>${esc(c.name)}</b><span>Already in your list</span></div></div>`;
      return `<div class="res">${avatar(c, 40)}<div class="t"><b>${esc(c.name)}</b><span>${esc(c.handle || c.id)}</span></div>
        <input type="checkbox" data-action="toggle-result" data-i="${i}" ${r.selected ? 'checked' : ''} aria-label="Add ${esc(c.name)}"></div>`;
    }).join('');
    const nSel = (m.results || []).filter((r) => r.status === 'ok' && r.selected).length;
    const busy = (m.results || []).some((r) => r.status === 'loading');
    root.innerHTML = `
      <div class="overlay" data-action="modal-bg"><div class="modal" role="dialog" aria-modal="true">
        <div class="modal-h"><div><h3>Add YouTube channels</h3><p>Paste as many channel links or @handles as you like — one per line.</p></div><span class="sp"></span>
          <button class="icon-btn" data-action="close-modal" title="Close">${ICON.x}</button></div>
        <div class="modal-b">
          <div class="field"><label for="add-input">Channel URL or handle</label>
            <textarea id="add-input" placeholder="@hardfork&#10;@LexFridman&#10;https://www.youtube.com/@hubermanlab&#10;(add as many as you want)" spellcheck="false">${esc(m.text || '')}</textarea></div>
          ${(m.results || []).filter((r) => r.status === 'ok').length > 1 ? `<div class="hint" style="display:flex;gap:1rem"><span>${nSel} of ${(m.results || []).filter((r) => r.status === 'ok').length} selected</span><a href="#" class="tan" data-action="select-all-results" data-v="1">Select all</a><a href="#" class="tan" data-action="select-all-results" data-v="0">Select none</a></div>` : ''}
          ${results}
        </div>
        <div class="modal-f">
          <button class="btn" data-action="close-modal">Cancel</button>
          <button class="btn" data-action="detect" ${busy || m.adding ? 'disabled' : ''} title="Check the channels first without adding them">${ICON.search} Look up only</button>
          ${nSel
            ? `<button class="btn primary" data-action="confirm-add" ${busy || m.adding ? 'disabled' : ''}>${m.adding ? 'Adding…' : `${ICON.plus} Add ${nSel} channel${nSel === 1 ? '' : 's'}`}</button>`
            : `<button class="btn primary" data-action="add-all" ${busy || m.adding ? 'disabled' : ''}>${busy || m.adding ? 'Working…' : `${ICON.plus} Add channels`}</button>`}
        </div>
      </div></div>`;
    return;
  }

  if (m.type === 'channel') {
    const c = S.data.channels.find((x) => x.id === m.id);
    if (!c) { S.modal = null; root.innerHTML = ''; return; }
    const D = derive();
    const n = D.newBy[c.id] || 0;
    root.innerHTML = `
      <div class="overlay" data-action="modal-bg"><div class="modal" role="dialog" aria-modal="true">
        <div class="modal-h"><div class="cd-head">
            <span class="ringav xl ${n ? 'live' : ''}" style="--d:5.5rem">${ringAvatar(c)}</span>
            <div><h3>${c.priority ? `<span class="tan" style="display:inline-flex;vertical-align:-2px">${ICON.starFill}</span> ` : ''}${esc(c.name)}</h3>
              <a href="#" data-action="open-channel" data-url="${esc(c.url)}">${esc(c.handle || 'Open on YouTube')}</a>${c.paused ? ' <span class="chip" style="margin-left:.4rem">Paused</span>' : ''}</div>
          </div><span class="sp"></span>
          <button class="icon-btn" data-action="close-modal" title="Close">${ICON.x}</button></div>
        <div class="modal-b">
          <div class="cd-stats">
            <div class="cd-stat"><b class="${n ? 'hot' : ''}">${n}</b><span>New</span></div>
            <div class="cd-stat"><b>${D.postedBy[c.id] || 0}</b><span>Posted</span></div>
            <div class="cd-stat"><b>${c.lastVideoAt ? ago(c.lastVideoAt).replace(' ago', '') : '—'}</b><span>Last upload</span></div>
          </div>
          <div class="cd-last"><small>${c.lastError ? 'Problem' : 'Latest video'}</small>
            ${c.lastError ? `<span class="err-text">⚠ ${esc(c.lastError)}</span>` : `<b>${esc(c.lastVideoTitle || 'No videos yet')}</b>`}
            ${c.keywords ? `<div style="margin-top:.5rem">Keyword filter: <span class="mono">${esc(c.keywords)}</span></div>` : ''}</div>
        </div>
        <div class="modal-f cd-actions" style="justify-content:flex-start;flex-wrap:wrap">
          <button class="btn ${c.priority ? 'on' : ''}" data-action="toggle-priority" data-id="${c.id}">${c.priority ? ICON.starFill : ICON.star} Priority</button>
          <button class="btn" data-action="edit-channel" data-id="${c.id}">${ICON.filter} Filter</button>
          <button class="btn" data-action="toggle-pause" data-id="${c.id}">${c.paused ? ICON.resume + ' Resume' : ICON.pause + ' Pause'}</button>
          <span class="sp" style="flex:1"></span>
          <button class="btn danger" data-action="remove-channel" data-id="${c.id}">${ICON.trash} Remove</button>
        </div>
      </div></div>`;
    return;
  }

  if (m.type === 'edit') {
    const c = S.data.channels.find((x) => x.id === m.id);
    if (!c) { S.modal = null; root.innerHTML = ''; return; }
    root.innerHTML = `
      <div class="overlay" data-action="modal-bg"><div class="modal" role="dialog" aria-modal="true">
        <div class="modal-h"><div><h3>${esc(c.name)}</h3><p>Only alert me for certain topics.</p></div><span class="sp"></span>
          <button class="icon-btn" data-action="close-modal" title="Close">${ICON.x}</button></div>
        <div class="modal-b">
          <div class="field"><label for="edit-kw">Keyword filter (optional)</label>
            <input class="input" id="edit-kw" placeholder="e.g. AI, startup, founders" value="${esc(c.keywords || '')}" autocomplete="off">
            <p class="hint" style="margin-top:7px">Comma-separated. A new video only alerts you if its title contains one of these. Leave empty to get everything.</p></div>
        </div>
        <div class="modal-f"><button class="btn" data-action="close-modal">Cancel</button><button class="btn primary" data-action="save-edit">Save</button></div>
      </div></div>`;
    const input = $('#edit-kw');
    if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
  }
}

function modalBodyKeepScroll(fn) {
  const body = document.querySelector('.modal-b');
  const top = body ? body.scrollTop : 0;
  fn();
  const nb = document.querySelector('.modal-b');
  if (nb) nb.scrollTop = top;
}

// ---------------------------------------------------------------- toast
let toastTimer = null;
function toast(msg, opts) {
  opts = opts || {};
  const root = $('#toast-root');
  root.innerHTML = `<div class="toast ${opts.error ? 'err' : ''}"><span>${esc(msg)}</span>${opts.undo ? '<button data-action="toast-undo">Undo</button>' : ''}</div>`;
  S.toastUndo = opts.undo || null;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { root.innerHTML = ''; S.toastUndo = null; }, opts.undo ? 6000 : 3500);
}

// ---------------------------------------------------------------- render
function renderPage() {
  const el = $('#page');
  const html = { home: pageHome, channels: pageChannels, posted: pagePosted, settings: pageSettings }[S.page]();
  const scrollers = el.querySelectorAll('.home-main, .home-side, .page');
  const tops = Array.from(scrollers).map((n) => n.scrollTop);
  el.innerHTML = html;
  el.querySelectorAll('.home-main, .home-side, .page').forEach((n, i) => { if (tops[i]) n.scrollTop = tops[i]; });
  tick();
}

function render(opts) {
  if (!S.data) return;
  applyTheme(S.data.settings.accent);
  renderTopbar();
  if (S.modal && S.modal.type === 'channel') renderModal();
  const a = document.activeElement;
  const typing = a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA') && $('#page').contains(a);
  // Don't wipe a field the user is typing in (settings / search boxes).
  if (!(typing && !(opts && opts.force))) renderPage();
}

function tick() {
  if (!S.data) return;
  const cd = $('#cd');
  if (cd) cd.textContent = S.data.checking ? 'Checking now…' : S.data.nextCheckAt ? `Auto-refresh in ${clock(S.data.nextCheckAt - Date.now())}` : '';
  const lc = $('#lc');
  if (lc) lc.textContent = S.data.lastCheckedAt ? ago(S.data.lastCheckedAt) : 'never';
}

async function refresh() {
  try {
    S.data = await call(api.getState());
    render();
  } catch (e) {
    console.error(e);
  }
}

// ---------------------------------------------------------------- actions
async function setStatus(id, status, message, undoStatus) {
  try {
    await call(api.setVideoStatus(id, status));
    toast(message, { undo: () => call(api.setVideoStatus(id, undoStatus)).catch((e) => toast(e.message, { error: true })) });
  } catch (e) { toast(e.message, { error: true }); }
}

async function runDetect(autoAdd) {
  const m = S.modal;
  if (!m || m.type !== 'add') return;
  const ta = $('#add-input');
  if (ta) m.text = ta.value;
  const inputs = Array.from(new Set(String(m.text || '').split(/[\s,;]+/).filter(Boolean))).slice(0, 100);
  if (!inputs.length) { toast('Paste at least one channel link or @handle.', { error: true }); return; }
  const existing = new Set(S.data.channels.map((c) => c.id));
  m.results = inputs.map((input) => ({ input, status: 'loading' }));
  renderModal();

  // Look several channels up at the same time (5 at once) so long lists don't take forever.
  let next = 0;
  const redraw = () => { if (S.modal === m) modalBodyKeepScroll(() => { const t = $('#add-input'); if (t) m.text = t.value; renderModal(); }); };
  const worker = async () => {
    while (next < inputs.length && S.modal === m) {
      const i = next++;
      try {
        const info = await call(api.resolveChannel(inputs[i]));
        m.results[i] = existing.has(info.id) ? { input: inputs[i], status: 'dup', info } : { input: inputs[i], status: 'ok', info, selected: true };
      } catch (e) {
        m.results[i] = { input: inputs[i], status: 'error', error: e.message };
      }
      redraw();
    }
  };
  await Promise.all(Array.from({ length: Math.min(5, inputs.length) }, worker));
  if (S.modal !== m) return; // modal closed meanwhile

  // The same channel pasted twice (e.g. a link and its @handle): keep the first.
  const got = new Set();
  m.results.forEach((r, i) => {
    if (r.status !== 'ok') return;
    if (got.has(r.info.id)) m.results[i] = { input: r.input, status: 'dup', info: r.info };
    else got.add(r.info.id);
  });
  redraw();
  if (autoAdd) await addSelected();
}

// Add every ticked channel from the lookup results. Lines that failed stay in the box to fix.
async function addSelected() {
  const m = S.modal;
  if (!m || m.type !== 'add') return;
  const infos = m.results.filter((r) => r.status === 'ok' && r.selected).map((r) => r.info);
  if (!infos.length) {
    toast(m.results.some((r) => r.status === 'dup') ? 'Those channels are already in your list.' : "Couldn't find any of those channels.", { error: true });
    return;
  }
  m.adding = true;
  const ta = $('#add-input'); if (ta) m.text = ta.value;
  modalBodyKeepScroll(renderModal);
  try {
    const n = await call(api.addChannels(infos));
    const failed = m.results.filter((r) => r.status === 'error');
    if (failed.length) {
      // Keep the modal open with just the lines that failed.
      m.adding = false;
      m.text = failed.map((r) => r.input).join('\n');
      m.results = failed;
      renderModal();
      toast(`Added ${n} channel${n === 1 ? '' : 's'} — ${failed.length} couldn't be found`, { error: true });
    } else {
      S.modal = null; renderModal();
      toast(`Added ${n} channel${n === 1 ? '' : 's'}`);
    }
  } catch (e) {
    m.adding = false; renderModal(); toast(e.message, { error: true });
  }
}

const handlers = {
  nav(el) { S.page = el.dataset.page; render({ force: true }); },
  'check-now'() { call(api.checkNow()).catch((e) => toast(e.message, { error: true })); },
  'show-data'() { call(api.showDataFolder()).catch((e) => toast(e.message, { error: true })); },
  'open-video'(el) { api.openExternal(`https://www.youtube.com/watch?v=${el.dataset.id}`); },
  'open-channel'(el, e) { e.preventDefault(); api.openExternal(el.dataset.url); },
  'mark-posted'(el) { setStatus(el.dataset.id, 'posted', 'Marked as posted ✓', 'new'); },
  dismiss(el) { setStatus(el.dataset.id, 'dismissed', 'Video dismissed', 'new'); },
  unpost(el) { setStatus(el.dataset.id, 'new', 'Moved back to the queue', 'posted'); },
  'toast-undo'() { const fn = S.toastUndo; $('#toast-root').innerHTML = ''; S.toastUndo = null; if (fn) fn(); },
  'filter-channel'(el) {
    S.filterChannel = S.filterChannel === el.dataset.id ? null : el.dataset.id;
    S.page = 'home';
    render({ force: true });
  },
  async 'test-alert'() {
    const s = S.data.settings;
    if (!s.botToken || !s.chatId) { S.page = 'settings'; render({ force: true }); toast('Add your bot token and chat ID first.'); return; }
    try { const r = await call(api.testTelegram(s.botToken, s.chatId)); toast(`Test sent via @${r.username} — check your phone`); }
    catch (e) { toast(e.message, { error: true }); }
  },

  // add / edit channels
  'open-add'() { S.modal = { type: 'add', text: '', results: [] }; renderModal(); const t = $('#add-input'); if (t) t.focus(); },
  'close-modal'() { S.modal = null; renderModal(); },
  'modal-bg'(el, e) { if (e.target === el) { S.modal = null; renderModal(); } },
  detect() { runDetect(false); },
  'add-all'() { runDetect(true); },
  'select-all-results'(el, e) { e.preventDefault(); const on = el.dataset.v === '1'; S.modal.results.forEach((r) => { if (r.status === 'ok') r.selected = on; }); modalBodyKeepScroll(renderModal); },
  'toggle-result'(el) { const r = S.modal.results[+el.dataset.i]; if (r) { r.selected = el.checked; modalBodyKeepScroll(renderModal); } },
  'confirm-add'() { addSelected(); },
  'channel-detail'(el) { S.modal = { type: 'channel', id: el.dataset.id }; renderModal(); },
  'edit-channel'(el) { S.modal = { type: 'edit', id: el.dataset.id }; renderModal(); },
  async 'save-edit'() {
    const kw = $('#edit-kw').value;
    const id = S.modal.id;
    S.modal = null; renderModal();
    try { await call(api.updateChannel(id, { keywords: kw })); toast('Filter saved'); } catch (e) { toast(e.message, { error: true }); }
  },
  async 'toggle-priority'(el) {
    const c = S.data.channels.find((x) => x.id === el.dataset.id);
    if (c) call(api.updateChannel(c.id, { priority: !c.priority })).catch((e) => toast(e.message, { error: true }));
  },
  async 'toggle-pause'(el) {
    const c = S.data.channels.find((x) => x.id === el.dataset.id);
    if (c) call(api.updateChannel(c.id, { paused: !c.paused })).catch((e) => toast(e.message, { error: true }));
  },
  async 'remove-channel'(el) {
    const c = S.data.channels.find((x) => x.id === el.dataset.id);
    if (!c) return;
    if (!window.confirm(`Remove “${c.name}”?\n\nIts waiting videos are cleared. Videos you already posted stay in history.`)) return;
    try { await call(api.removeChannel(c.id)); S.modal = null; renderModal(); if (S.filterChannel === c.id) S.filterChannel = null; toast('Channel removed'); }
    catch (e) { toast(e.message, { error: true }); }
  },

  // settings
  'toggle-setting'(el) {
    const key = el.dataset.key;
    call(api.saveSettings({ [key]: !S.data.settings[key] })).catch((e) => toast(e.message, { error: true }));
  },
  'set-interval'(el) { call(api.saveSettings({ intervalMin: +el.dataset.v })).catch((e) => toast(e.message, { error: true })); },
  'set-accent'(el) { applyTheme(el.dataset.v); call(api.saveSettings({ accent: el.dataset.v })).catch((e) => toast(e.message, { error: true })); },
  'toggle-token'() {
    S.showToken = !S.showToken;
    const i = $('#set-token'); if (i) i.type = S.showToken ? 'text' : 'password';
  },
  async 'send-test'() {
    const token = $('#set-token').value.trim();
    const chat = $('#set-chat').value.trim();
    // Saving triggers a re-render, so keep the message in state and repaint after each step.
    const say = (cls, text) => {
      S.tgMsg = { cls, text };
      const out = $('#tg-result');
      if (out) { out.className = 'result ' + cls; out.textContent = text; }
    };
    const busy = (on) => { const b = $('#btn-test'); if (b) b.disabled = on; };
    say('', 'Sending…'); busy(true);
    try {
      await call(api.saveSettings({ botToken: token, chatId: chat }));
      say('', 'Sending…'); busy(true);
      const r = await call(api.testTelegram(token, chat));
      say('ok', `✓ Sent! Connected as @${r.username}. Your phone should buzz now.`);
    } catch (e) {
      say('bad', e.message);
    }
    busy(false);
  }
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  // Checkbox clicks are handled by the change event below.
  if (el.type === 'checkbox') return;
  const fn = handlers[el.dataset.action];
  if (fn) fn(el, e);
});

const key_is_tg = (k) => k === 'botToken' || k === 'chatId';

document.addEventListener('change', async (e) => {
  const t = e.target;
  if (t.dataset && t.dataset.action === 'pick-accent') { call(api.saveSettings({ accent: t.value })).catch((err) => toast(err.message, { error: true })); return; }
  if (t.dataset && t.dataset.action === 'toggle-result') { handlers['toggle-result'](t, e); return; }
  if (t.dataset && t.dataset.setting) {
    if (key_is_tg(t.dataset.setting)) S.tgMsg = null;
    const key = t.dataset.setting;
    const val = t.type === 'range' ? +t.value : t.value;
    try { await call(api.saveSettings({ [key]: val })); toast('Saved'); } catch (err) { toast(err.message, { error: true }); }
  }
});

document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.dataset && t.dataset.action === 'pick-accent') { applyTheme(t.value); return; }
  if (t.id === 'chan-search') { S.chanSearch = t.value; $('#chan-list').innerHTML = channelRows(); }
  else if (t.id === 'posted-search') { S.postedSearch = t.value; $('#posted-list').innerHTML = postedRows(); }
  else if (t.id === 'minlen') { $('#minlen-val').textContent = +t.value === 0 ? 'Any length' : t.value + ' min'; }
  else if (t.id === 'add-input' && S.modal) { S.modal.text = t.value; }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && S.modal) { S.modal = null; renderModal(); }
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && S.modal && S.modal.type === 'add') runDetect(true);
  if (e.key === 'Enter' && S.modal && S.modal.type === 'edit' && e.target.id === 'edit-kw') handlers['save-edit']();
});

// Hide thumbnails/avatars that fail to load so the placeholder underneath shows.
document.addEventListener('error', (e) => {
  if (e.target && e.target.tagName === 'IMG') e.target.classList.add('broken');
}, true);

// ---------------------------------------------------------------- boot
api.onStateChanged(() => refresh());
setInterval(tick, 1000);
setInterval(() => { if (S.data) render(); }, 30000); // refresh "x min ago" labels
refresh();
