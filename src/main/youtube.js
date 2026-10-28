'use strict';
// YouTube helpers. No API key needed: we use the public per-channel RSS feed,
// which is the same data YouTube's own "subscribe" feature uses.

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const HEADERS = {
  'User-Agent': UA,
  'Accept-Language': 'en-US,en;q=0.9',
  // Skips the EU cookie-consent interstitial that otherwise hides the real page.
  Cookie: 'CONSENT=YES+1; SOCS=CAI'
};
const ID_RE = /^UC[\w-]{22}$/;

async function get(url, { timeout = 15000, redirect = 'follow' } = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeout);
  try {
    return await fetch(url, { headers: HEADERS, signal: ctl.signal, redirect });
  } finally {
    clearTimeout(t);
  }
}

function friendlyError(e) {
  if (!e) return 'Unknown error';
  if (e.name === 'AbortError') return 'YouTube took too long to respond.';
  const code = e.cause && e.cause.code;
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN' || code === 'ECONNREFUSED' || code === 'ECONNRESET' || e.message === 'fetch failed') {
    return 'No internet connection (or YouTube is unreachable).';
  }
  return e.message || String(e);
}

function decode(s) {
  return String(s || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&amp;/g, '&');
}

// Turn whatever the user pasted into a page we can fetch.
function toTarget(input) {
  let s = String(input || '').trim();
  if (!s) return null;
  if (ID_RE.test(s)) return { url: `https://www.youtube.com/channel/${s}`, id: s, kind: 'channel' };
  if (/^@[^\s/]+$/.test(s)) return { url: `https://www.youtube.com/${s}`, kind: 'channel', handle: s };
  if (!/^https?:\/\//i.test(s)) {
    if (/^(www\.|m\.)?(youtube\.com|youtu\.be)\//i.test(s)) s = 'https://' + s;
    else if (/^[\w.-]+$/.test(s)) return { url: `https://www.youtube.com/@${s}`, kind: 'channel', handle: '@' + s };
    else return null;
  }
  let u;
  try { u = new URL(s); } catch (_) { return null; }
  const host = u.hostname.replace(/^(www\.|m\.)/, '');
  if (host === 'youtu.be') {
    const vid = u.pathname.slice(1);
    return vid ? { url: `https://www.youtube.com/watch?v=${vid}`, kind: 'video' } : null;
  }
  if (host !== 'youtube.com') return null;
  const p = u.pathname;
  if (p === '/watch' && u.searchParams.get('v')) {
    return { url: `https://www.youtube.com/watch?v=${u.searchParams.get('v')}`, kind: 'video' };
  }
  const sh = p.match(/^\/(?:shorts|live)\/([\w-]+)/);
  if (sh) return { url: `https://www.youtube.com/watch?v=${sh[1]}`, kind: 'video' };
  const ch = p.match(/^\/channel\/(UC[\w-]{22})/);
  if (ch) return { url: `https://www.youtube.com/channel/${ch[1]}`, id: ch[1], kind: 'channel' };
  const other = p.match(/^\/(@[^/]+|c\/[^/]+|user\/[^/]+)/);
  if (other) {
    let seg = other[1];
    try { seg = decodeURIComponent(seg); } catch (_) {}
    return { url: `https://www.youtube.com/${seg}`, kind: 'channel', handle: seg.startsWith('@') ? seg : null };
  }
  return null;
}

function pick(text, regexes) {
  for (const re of regexes) {
    const m = text.match(re);
    if (m) return m[1];
  }
  return null;
}

function parseFeed(xml) {
  const firstEntry = xml.indexOf('<entry>');
  const head = firstEntry === -1 ? xml : xml.slice(0, firstEntry);
  const nameMatch = head.match(/<title>([\s\S]*?)<\/title>/);
  const videos = [];
  const parts = xml.split('<entry>').slice(1);
  for (const part of parts) {
    const id = (part.match(/<yt:videoId>([\w-]+)<\/yt:videoId>/) || [])[1];
    if (!id) continue;
    const title = decode((part.match(/<title>([\s\S]*?)<\/title>/) || [])[1]);
    const published = (part.match(/<published>([^<]+)<\/published>/) || [])[1];
    const thumb = (part.match(/<media:thumbnail[^>]*\surl="([^"]+)"/) || [])[1];
    videos.push({ id, title, published, thumb: thumb ? decode(thumb) : null });
  }
  return { name: nameMatch ? decode(nameMatch[1]).trim() : null, videos };
}

async function fetchFeed(channelId) {
  const res = await get(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`);
  if (res.status === 404) throw new Error('YouTube has no feed for this channel ID.');
  if (!res.ok) throw new Error(`YouTube feed error (HTTP ${res.status}).`);
  return parseFeed(await res.text());
}

async function resolveChannel(input) {
  const t = toTarget(input);
  if (!t) throw new Error("That doesn't look like a YouTube channel link or @handle.");

  let id = t.id || null;
  let html = '';
  try {
    const res = await get(t.url);
    if (res.ok) html = await res.text();
    else if (!id) throw new Error(res.status === 404 ? 'Channel not found. Check the link or handle.' : `YouTube returned HTTP ${res.status}.`);
  } catch (e) {
    if (!id) throw new Error(friendlyError(e));
  }

  if (!id) {
    id = pick(html, [
      /<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})"/,
      /<meta itemprop="(?:channelId|identifier)" content="(UC[\w-]{22})"/,
      /"channelId":"(UC[\w-]{22})"/,
      /"externalId":"(UC[\w-]{22})"/
    ]);
  }
  if (!id) throw new Error("Couldn't find a channel at that link.");

  let handle = t.handle || null;
  if (!handle) {
    const h = pick(html, [/"canonicalBaseUrl":"\/(@[^"]+)"/]);
    if (h) { try { handle = decodeURIComponent(h); } catch (_) { handle = h; } }
  }
  let avatar = null;
  if (t.kind === 'channel') {
    const a = pick(html, [/<meta property="og:image" content="([^"]+)"/]);
    if (a) avatar = decode(a);
  }

  const feed = await fetchFeed(id);
  return {
    id,
    name: feed.name || (handle || id),
    handle,
    avatar,
    url: `https://www.youtube.com/channel/${id}`,
    latestTitle: feed.videos[0] ? feed.videos[0].title : null
  };
}

// Duration + live status. Best-effort: returns null if YouTube won't tell us.
async function videoMeta(id) {
  try {
    const res = await get(`https://www.youtube.com/watch?v=${id}`);
    if (!res.ok) return null;
    const html = await res.text();
    let duration = null;
    const len = html.match(/"lengthSeconds":"(\d+)"/);
    if (len) duration = parseInt(len[1], 10);
    if (duration == null) {
      const ms = html.match(/"approxDurationMs":"(\d+)"/);
      if (ms) duration = Math.round(parseInt(ms[1], 10) / 1000);
    }
    if (duration == null) {
      const iso = html.match(/itemprop="duration" content="PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?"/);
      if (iso) duration = (+iso[1] || 0) * 3600 + (+iso[2] || 0) * 60 + (+iso[3] || 0);
    }
    const live = /"liveBroadcastDetails":\{"isLiveNow":true/.test(html) || /"isUpcoming":true/.test(html);
    return { duration, live };
  } catch (_) {
    return null;
  }
}

// A /shorts/ URL only stays on /shorts/ (HTTP 200) when the video really is a Short.
async function isShort(id) {
  try {
    const res = await get(`https://www.youtube.com/shorts/${id}`, { redirect: 'manual', timeout: 10000 });
    return res.status === 200;
  } catch (_) {
    return false;
  }
}

module.exports = { toTarget, parseFeed, fetchFeed, resolveChannel, videoMeta, isShort, friendlyError };
