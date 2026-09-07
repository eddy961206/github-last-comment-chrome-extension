# Changelog

## 1.0.2 — 2026-09-07

- Highlight the calendar date in orange when the last comment was posted today.
- For comments posted within the past hour (including exactly 60 minutes), show the date in orange and the clock time in red. This rule also applies across midnight.
- Determine today using the selected display time zone; preserve English and Korean timestamp formats.
- Refresh timestamp colors locally at most every 30 seconds and immediately on tab return/focus. No extra GitHub requests or stored data; updates continue while fetching is paused.
- Keep author, bot, mention, and stale-result styling independent of timestamp colors. Use separate light/dark colors and high-contrast fallbacks.
- Add timestamp boundary tests to validation and include the new module in runtime packaging.

## 1.0.0 — 2026-09-06

- Standalone Manifest V3 extension with no Tampermonkey dependency
- English default interface with Korean available in Settings
- Last-comment badges with author, timestamp, avatars, and sanitized Markdown preview
- Shadow DOM rendering with light and dark theme support
- Viewport-aware fetching, bounded pagination verification, pause, retry, and result reuse
- Time-zone control, zero-comment display control, and enable toggle
- `welcome.html`, popup, settings, help, and privacy pages
- Opt-in local-only usage counters with export and delete controls; no developer telemetry
- Store listing copy, English-guidance screenshots, permission rationale, privacy disclosure, reviewer notes, and submission checklist
