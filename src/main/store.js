'use strict';
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const DEFAULTS = {
  settings: {
    botToken: '',
    chatId: '',
    intervalMin: 15,
    minLengthMin: 0,
    ignoreShorts: true,
    ignoreLive: true,
    desktopNotifications: true,
    runInTray: true,
    startAtLogin: false,
    accent: '#2fb6ff'
  },
  channels: [],
  videos: [],
  seen: {},
  lastCheckedAt: null,
  telegramOk: null,
  telegramError: null
};

const clone = (o) => JSON.parse(JSON.stringify(o));

class Store {
  constructor() {
    this.file = path.join(app.getPath('userData'), 'clipradar-data.json');
    this.loadInfo = { source: 'fresh', error: null };
    this.saveError = null;
    this.data = this.load();
    console.log(`[store] data file: ${this.file} (${this.loadInfo.source})`);
  }

  parse(file) {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    const d = clone(DEFAULTS);
    Object.assign(d, raw);
    d.settings = Object.assign({}, DEFAULTS.settings, raw.settings || {});
    return d;
  }

  load() {
    // Try the main file, then the automatic backup of the last good save.
    const candidates = [[this.file, 'main'], [this.file + '.bak', 'backup']];
    for (const [file, label] of candidates) {
      try {
        const d = this.parse(file);
        this.loadInfo = { source: label, error: null };
        return d;
      } catch (e) {
        if (e.code === 'ENOENT') continue;
        this.loadInfo.error = `${path.basename(file)}: ${e.message}`;
        console.warn('[store] could not read', file, e.message);
        // Keep a copy of the unreadable file so nothing is silently lost.
        try { fs.copyFileSync(file, file + '.corrupt-' + Date.now()); } catch (_) {}
      }
    }
    this.loadInfo.source = 'fresh';
    return clone(DEFAULTS);
  }

  save() {
    this.prune();
    const json = JSON.stringify(this.data, null, 2);
    try { fs.mkdirSync(path.dirname(this.file), { recursive: true }); } catch (_) {}
    const tmp = this.file + '.tmp';
    try {
      fs.writeFileSync(tmp, json);
      fs.renameSync(tmp, this.file);
    } catch (e) {
      // On Windows, rename can fail if antivirus/indexer briefly holds the file. Write directly instead.
      console.warn('[store] atomic save failed, writing directly:', e.message);
      try {
        fs.writeFileSync(this.file, json);
      } catch (e2) {
        this.saveError = e2.message;
        console.error('[store] save failed:', e2);
        return;
      }
    }
    this.saveError = null;
    try { fs.copyFileSync(this.file, this.file + '.bak'); } catch (_) {}
  }

  prune() {
    const d = this.data;
    const keys = Object.keys(d.seen);
    if (keys.length > 6000) {
      keys.sort((a, b) => d.seen[a] - d.seen[b]);
      for (const k of keys.slice(0, keys.length - 5000)) delete d.seen[k];
    }
    // Dismissed videos only need to stay around briefly (for the Undo toast).
    const cutoff = Date.now() - 7 * 864e5;
    d.videos = d.videos.filter((v) => !(v.status === 'dismissed' && (v.dismissedAt || 0) < cutoff));
  }
}

module.exports = { Store };
