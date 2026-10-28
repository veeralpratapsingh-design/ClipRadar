'use strict';
const path = require('path');
const {
  app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, shell, Notification, powerMonitor, session
} = require('electron');
const { Store } = require('./store');
const { Poller, mapLimit } = require('./poller');
const yt = require('./youtube');
const tg = require('./telegram');

const ASSETS = path.join(__dirname, '..', '..', 'assets');
const startHidden = process.argv.includes('--hidden');

let win = null;
let tray = null;
let store = null;
let poller = null;
app.isQuitting = false;

function showWindow() {
  if (!win || win.isDestroyed()) createWindow();
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function broadcast() {
  if (win && !win.isDestroyed()) win.webContents.send('state:changed');
  updateTray();
}

function pendingCount() {
  return store.data.videos.filter((v) => v.status === 'new').length;
}

function buildState() {
  const d = store.data;
  return {
    settings: d.settings,
    channels: d.channels,
    videos: d.videos.filter((v) => v.status === 'new' || v.status === 'posted'),
    lastCheckedAt: d.lastCheckedAt,
    nextCheckAt: poller.nextCheckAt,
    checking: poller.checking,
    telegramOk: d.telegramOk,
    telegramError: d.telegramError,
    appVersion: app.getVersion(),
    electronVersion: process.versions.electron,
    platform: process.platform,
    packaged: app.isPackaged,
    storage: { file: store.file, source: store.loadInfo.source, loadError: store.loadInfo.error, saveError: store.saveError }
  };
}

function createWindow() {
  win = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 1080,
    minHeight: 680,
    show: false,
    backgroundColor: '#0a0a0d',
    title: 'ClipRadar',
    icon: path.join(ASSETS, 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  win.once('ready-to-show', () => {
    if (!startHidden) win.show();
  });

  // Never navigate the app window away, and open links in the real browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    openExternalSafe(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e) => e.preventDefault());

  win.on('close', (e) => {
    if (!app.isQuitting && store.data.settings.runInTray && tray) {
      e.preventDefault();
      win.hide();
    }
  });
  win.on('closed', () => { win = null; });
}

function openExternalSafe(url) {
  try {
    const u = new URL(url);
    if (u.protocol === 'https:' && /(^|\.)(youtube\.com|youtu\.be)$/.test(u.hostname)) {
      shell.openExternal(u.toString());
    }
  } catch (_) {}
}

function createTray() {
  try {
    const img = nativeImage.createFromPath(path.join(ASSETS, 'tray.png'));
    tray = new Tray(img);
    tray.setToolTip('ClipRadar');
    tray.on('click', showWindow);
    updateTray();
  } catch (e) {
    console.warn('[tray] unavailable:', e.message);
    tray = null;
  }
}

function updateTray() {
  const n = pendingCount();
  try { app.setBadgeCount(n); } catch (_) {}
  if (!tray) return;
  tray.setToolTip(n ? `ClipRadar — ${n} video${n === 1 ? '' : 's'} waiting` : 'ClipRadar — all caught up');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: n ? `${n} waiting` : 'All caught up', enabled: false },
      { type: 'separator' },
      { label: 'Open ClipRadar', click: showWindow },
      { label: 'Check now', click: () => poller.run() },
      { type: 'separator' },
      { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } }
    ])
  );
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { label: 'Check now', accelerator: 'CmdOrCtrl+R', click: () => poller.run() },
        { role: 'toggleDevTools' },
        { role: 'togglefullscreen' }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function applyLoginItem() {
  // Only meaningful for the packaged app; in dev it would register the bare Electron binary.
  if (!app.isPackaged) return;
  try {
    app.setLoginItemSettings({ openAtLogin: !!store.data.settings.startAtLogin, args: ['--hidden'] });
  } catch (_) {}
}

// ---- IPC -------------------------------------------------------------

function handle(name, fn) {
  ipcMain.handle(name, async (_e, ...args) => {
    try {
      return { ok: true, data: await fn(...args) };
    } catch (e) {
      return { ok: false, error: yt.friendlyError(e) };
    }
  });
}

function registerIpc() {
  handle('state:get', () => buildState());

  handle('channels:resolve', (input) => yt.resolveChannel(input));

  handle('channels:add', async (list) => {
    const added = [];
    for (const info of Array.isArray(list) ? list : []) {
      if (!info || !/^UC[\w-]{22}$/.test(info.id)) continue;
      if (store.data.channels.some((c) => c.id === info.id)) continue;
      const c = {
        id: info.id,
        name: String(info.name || info.id),
        handle: info.handle || null,
        avatar: info.avatar || null,
        url: `https://www.youtube.com/channel/${info.id}`,
        paused: false,
        priority: false,
        keywords: '',
        addedAt: Date.now(),
        initialized: false,
        lastVideoAt: null,
        lastVideoTitle: null,
        lastError: null
      };
      store.data.channels.push(c);
      added.push(c);
    }
    store.save();
    broadcast();
    // Baseline the new channels a few at a time so adding many at once stays fast.
    await mapLimit(added, 4, async (c) => {
      try { await poller.checkChannel(c); } catch (e) { c.lastError = yt.friendlyError(e); }
    });
    store.save();
    broadcast();
    return added.length;
  });

  handle('channels:update', (id, patch) => {
    const c = store.data.channels.find((x) => x.id === id);
    if (!c) throw new Error('Channel not found.');
    if ('paused' in patch) c.paused = !!patch.paused;
    if ('priority' in patch) c.priority = !!patch.priority;
    if ('keywords' in patch) c.keywords = String(patch.keywords || '').slice(0, 300);
    store.save();
    broadcast();
  });

  handle('channels:remove', (id) => {
    store.data.channels = store.data.channels.filter((c) => c.id !== id);
    // Drop its queue, keep its posted history.
    store.data.videos = store.data.videos.filter((v) => v.channelId !== id || v.status === 'posted');
    store.save();
    broadcast();
  });

  handle('videos:status', (id, status) => {
    if (!['new', 'posted', 'dismissed'].includes(status)) throw new Error('Bad status.');
    const v = store.data.videos.find((x) => x.id === id);
    if (!v) throw new Error('Video not found.');
    v.status = status;
    v.postedAt = status === 'posted' ? Date.now() : null;
    v.dismissedAt = status === 'dismissed' ? Date.now() : null;
    store.save();
    broadcast();
  });

  handle('settings:save', (p) => {
    const s = store.data.settings;
    const before = { t: s.botToken, c: s.chatId, i: s.intervalMin, m: s.minLengthMin };
    if ('botToken' in p) s.botToken = String(p.botToken || '').trim();
    if ('chatId' in p) s.chatId = String(p.chatId || '').trim();
    if ('intervalMin' in p) {
      const n = Math.round(Number(p.intervalMin));
      if (n >= 1 && n <= 1440) s.intervalMin = n;
    }
    if ('minLengthMin' in p) {
      const n = Math.round(Number(p.minLengthMin));
      if (n >= 0 && n <= 180) s.minLengthMin = n;
    }
    if ('accent' in p && /^#[0-9a-f]{6}$/i.test(String(p.accent))) s.accent = String(p.accent).toLowerCase();
    for (const k of ['ignoreShorts', 'ignoreLive', 'desktopNotifications', 'runInTray', 'startAtLogin']) {
      if (k in p) s[k] = !!p[k];
    }
    if (s.botToken !== before.t || s.chatId !== before.c) {
      store.data.telegramOk = null;
      store.data.telegramError = null;
    }
    store.save();
    applyLoginItem();
    if (s.minLengthMin > before.m) poller.applyQueueFilters();
    if (s.intervalMin !== before.i && !poller.checking) poller.schedule();
    broadcast();
  });

  handle('telegram:test', async (token, chatId) => {
    try {
      const r = await tg.sendTest(String(token || '').trim(), String(chatId || '').trim());
      store.data.telegramOk = true;
      store.data.telegramError = null;
      store.save();
      broadcast();
      return r;
    } catch (e) {
      store.data.telegramOk = false;
      store.data.telegramError = e.message;
      store.save();
      broadcast();
      throw e;
    }
  });

  handle('check:now', () => { poller.run(); });

  handle('open:external', (url) => openExternalSafe(url));

  handle('app:show-data', () => {
    const fs = require('fs');
    if (fs.existsSync(store.file)) shell.showItemInFolder(store.file);
    else shell.openPath(path.dirname(store.file));
  });
}

// ---- App lifecycle -----------------------------------------------------

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showWindow);

  // The app is fully local and needs no web permissions (camera, location, ...) and no <webview>.
  app.on('web-contents-created', (_e, contents) => {
    contents.on('will-attach-webview', (e) => e.preventDefault());
  });

  app.whenReady().then(() => {
    session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
    store = new Store();
    poller = new Poller(store);
    poller.on('changed', broadcast);
    poller.on('desktop', ({ title, body }) => {
      if (!Notification.isSupported()) return;
      const n = new Notification({ title, body });
      n.on('click', showWindow);
      n.show();
    });

    registerIpc();
    buildMenu();
    createTray();
    createWindow();
    applyLoginItem();
    poller.applyQueueFilters();
    poller.start();

    // After sleep, check shortly after wake-up instead of waiting out the timer.
    powerMonitor.on('resume', () => setTimeout(() => poller.run(), 5000));
    app.on('activate', showWindow);
  });

  app.on('before-quit', () => {
    app.isQuitting = true;
    if (store) store.save();
  });
}
