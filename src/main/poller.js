'use strict';
const { EventEmitter } = require('events');
const yt = require('./youtube');
const tg = require('./telegram');

const DAY = 864e5;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function mapLimit(items, limit, fn) {
  const queue = items.slice();
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) await fn(queue.shift());
  });
  await Promise.all(workers);
}

class Poller extends EventEmitter {
  constructor(store) {
    super();
    this.store = store;
    this.timer = null;
    this.checking = false;
    this.nextCheckAt = null;
    // How many times we could not read a video's length (so we can retry before giving up).
    this.lengthTries = new Map();
  }

  // Do the current settings need to know how long a video is?
  needsLength(s) {
    return s.minLengthMin > 0 || !!s.ignoreShorts;
  }

  // Dismiss queued videos that are shorter than the minimum length (used when you raise the
  // minimum in Settings, and once at start-up, so old queue entries obey the filter too).
  applyQueueFilters() {
    const s = this.store.data.settings;
    if (!(s.minLengthMin > 0)) return 0;
    let n = 0;
    for (const v of this.store.data.videos) {
      if (v.status === 'new' && v.duration != null && v.duration < s.minLengthMin * 60) {
        v.status = 'dismissed';
        v.dismissedAt = Date.now();
        n++;
      }
    }
    if (n) {
      this.store.save();
      this.emit('changed');
    }
    return n;
  }

  start() {
    this.schedule(3000);
  }

  schedule(delayMs) {
    clearTimeout(this.timer);
    const d = delayMs != null ? delayMs : this.store.data.settings.intervalMin * 60000;
    this.nextCheckAt = Date.now() + d;
    this.timer = setTimeout(() => this.run(), d);
    this.emit('changed');
  }

  async run() {
    if (this.checking) return;
    clearTimeout(this.timer);
    this.checking = true;
    this.emit('changed');
    try {
      await this.checkAll();
    } catch (e) {
      console.error('[poller] check failed:', e);
    } finally {
      this.checking = false;
      this.store.data.lastCheckedAt = Date.now();
      this.store.save();
      this.schedule();
    }
  }

  async checkAll() {
    const channels = this.store.data.channels.filter((c) => !c.paused);
    await mapLimit(channels, 4, async (c) => {
      try {
        await this.checkChannel(c);
      } catch (e) {
        c.lastError = yt.friendlyError(e);
        c.errorCount = (c.errorCount || 0) + 1;
        console.warn(`[poller] ${c.name}: ${c.lastError}`);
      }
    });
    await this.retryUnnotified();
    this.store.save();
  }

  async passesFilters(c, v, meta, s) {
    const kw = String(c.keywords || '')
      .split(',')
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean);
    if (kw.length) {
      const t = v.title.toLowerCase();
      if (!kw.some((k) => t.includes(k))) return false;
    }
    if (meta && meta.duration != null) {
      if (s.minLengthMin > 0 && meta.duration < s.minLengthMin * 60) return false;
      if (s.ignoreShorts && meta.duration <= 185 && (await yt.isShort(v.id))) return false;
    }
    return true;
  }

  addVideo(c, v, meta, published, notified) {
    if (this.store.data.videos.some((x) => x.id === v.id)) return null;
    const video = {
      id: v.id,
      channelId: c.id,
      channelName: c.name,
      title: v.title,
      thumb: v.thumb || `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
      published,
      duration: meta && meta.duration != null ? meta.duration : null,
      status: 'new',
      detectedAt: Date.now(),
      postedAt: null,
      notified
    };
    this.store.data.videos.unshift(video);
    return video;
  }

  async checkChannel(c) {
    const feed = await yt.fetchFeed(c.id);
    c.lastError = null;
    c.errorCount = 0;
    const s = this.store.data.settings;
    const seen = this.store.data.seen;
    const now = Date.now();
    const vids = feed.videos; // newest first

    if (vids.length) {
      c.lastVideoAt = Date.parse(vids[0].published) || c.lastVideoAt || null;
      c.lastVideoTitle = vids[0].title;
    }

    // First time we see a channel: baseline everything silently so you are not
    // spammed with its back-catalogue. Keep up to 3 videos from the last 7 days
    // in the queue (no phone alert) so Home is not empty.
    if (!c.initialized) {
      let imported = 0;
      for (const v of vids) {
        const pub = Date.parse(v.published) || now;
        if (now - pub < 7 * DAY && imported < 3) {
          const meta = await yt.videoMeta(v.id);
          // Not finished live stream, or length unknown: leave it unseen so the normal
          // checks (which retry) deal with it later.
          if (meta && meta.live && s.ignoreLive) continue;
          if (this.needsLength(s) && (!meta || meta.duration == null)) continue;
          seen[v.id] = now;
          // The same filters apply to the first import (previously they were skipped).
          if (!(await this.passesFilters(c, v, meta, s))) continue;
          if (this.addVideo(c, v, meta, pub, true)) imported++;
        } else {
          seen[v.id] = now;
        }
      }
      c.initialized = true;
      this.store.save();
      this.emit('changed');
      return;
    }

    const fresh = vids.filter((v) => !seen[v.id]).reverse(); // oldest first
    const added = [];
    for (const v of fresh) {
      const pub = Date.parse(v.published) || now;
      const meta = await yt.videoMeta(v.id);
      // Live / premiere not finished yet: look again next poll.
      if (meta && meta.live && s.ignoreLive) continue;
      // Length filters need the length. If YouTube didn't tell us, look again on the next
      // checks (up to 3 times) instead of letting an unchecked video through.
      if (this.needsLength(s) && (!meta || meta.duration == null)) {
        const tries = (this.lengthTries.get(v.id) || 0) + 1;
        this.lengthTries.set(v.id, tries);
        if (tries < 4) continue;
      }
      this.lengthTries.delete(v.id);
      seen[v.id] = now;
      if (!(await this.passesFilters(c, v, meta, s))) continue;
      const video = this.addVideo(c, v, meta, pub, false);
      if (video) added.push(video);
    }
    this.store.save();
    this.emit('changed');

    for (const video of added) {
      await this.notify(video, c);
      await sleep(400);
    }
  }

  async notify(video, c) {
    const s = this.store.data.settings;
    if (s.botToken && s.chatId) {
      try {
        await tg.sendVideoAlert(s, video, c);
        video.notified = true;
        this.store.data.telegramOk = true;
        this.store.data.telegramError = null;
      } catch (e) {
        video.notified = false;
        this.store.data.telegramOk = false;
        this.store.data.telegramError = e.message;
        console.warn('[telegram]', e.message);
      }
    }
    if (s.desktopNotifications) {
      this.emit('desktop', { title: `New: ${video.channelName}`, body: video.title, videoId: video.id });
    }
    this.store.save();
    this.emit('changed');
  }

  // If Telegram was down / misconfigured when a video dropped, try again (recent ones only).
  async retryUnnotified() {
    const s = this.store.data.settings;
    if (!s.botToken || !s.chatId) return;
    const cutoff = Date.now() - 6 * 36e5;
    const pending = this.store.data.videos.filter((v) => v.status === 'new' && v.notified === false && v.detectedAt > cutoff);
    for (const v of pending) {
      const c = this.store.data.channels.find((x) => x.id === v.channelId);
      try {
        await tg.sendVideoAlert(s, v, c);
        v.notified = true;
        this.store.data.telegramOk = true;
        this.store.data.telegramError = null;
        await sleep(400);
      } catch (e) {
        this.store.data.telegramOk = false;
        this.store.data.telegramError = e.message;
        break;
      }
    }
  }
}

module.exports = { Poller, mapLimit };
