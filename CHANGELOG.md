# Changelog

## 1.1.0
- Fixed: the minimum video length (and Shorts / live filters) were not applied to the first videos imported when a channel was added, so short videos could still appear.
- Fixed: a video whose length YouTube didn't report slipped past the length filter. It is now re-checked up to three times first.
- Raising the minimum length now also removes shorter videos already in the queue (and the queue is re-checked at start-up).
- Better length detection (extra fallbacks when the page layout differs).
- Add many channels at once: one click adds every pasted channel, lookups run in parallel (up to 100 lines), duplicates are skipped and failed lines stay in the box. Added "Select all / none" in the preview.

## 1.0.0
- First release.
