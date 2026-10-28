# Architecture

ClipRadar is a standard Electron app with a main process and one sandboxed window.

## Main process (`src/main/`)

| File | Role |
| --- | --- |
| `main.js` | Creates the window and tray, registers IPC handlers, single-instance lock, login-item setting. |
| `preload.js` | Exposes a small `window.clipradar` API to the UI through `contextBridge`. |
| `poller.js` | Timer-driven checks (default every 15 min), filters, queue handling, Telegram retries. |
| `youtube.js` | Resolves channel links/handles, reads the public RSS feed, reads video length/live status from the watch page, detects Shorts. |
| `telegram.js` | Sends the test message and the photo + "Open video" alert through the Telegram Bot API. |
| `store.js` | Saves everything to `clipradar-data.json` in the user-data folder, with an atomic write and a `.bak` backup. |

## Renderer (`src/renderer/`)

Plain HTML/CSS/JS (no framework or bundler). `renderer.js` draws the Home, Channels, Posted and Settings pages and talks to the main process only through `window.clipradar`.

## Data flow

1. The poller fetches `https://www.youtube.com/feeds/videos.xml?channel_id=<id>` for each non-paused channel.
2. Unseen videos are looked up on the watch page for length / live status, then passed through the filters.
3. Accepted videos join the queue; a Telegram alert and/or desktop notification is sent.
4. The first time a channel is added, its back-catalogue is marked as seen silently (up to 3 videos from the last 7 days are queued without an alert).

## External services

- YouTube (public RSS feed and watch/shorts pages) – no key.
- Telegram Bot API (`api.telegram.org`) – the user's own bot token and chat ID.

## Security settings that are in place

`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`; a Content-Security-Policy in `index.html`; navigation of the app window is blocked; new windows are denied and only `https` YouTube links are opened in the browser; web permission requests are denied; `<webview>` is blocked; IPC inputs are checked in `main.js`. This is a review of settings, not a guarantee that the app is secure.

## Known limitations

- The Telegram bot token is stored unencrypted in the data file.
- YouTube page layouts can change; length/Shorts detection is best-effort.
- The developer-tools menu item is available in the packaged app.
