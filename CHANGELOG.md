# Changelog

## 1.1.0 — 2026-09-08

- Limit comment-preview hover to the badge, not the label or unused row width
- Remove the redundant preview icon; keep keyboard and touch access
- Add previous/next/latest comment navigation with author groups and verified, bounded history batches
- Add explicit-save, device-local issue notes with pinned/hover-only display, draft preservation and revision conflict checks
- Preserve date/time recency colors, compact layout, EN/KO copy, and existing permissions
- Update privacy disclosures for user-authored notes; no note content is included in telemetry or diagnostic exports
- Combine the three final UI overlays into the runtime package
- Include notes in package/validation manifests; emit real ZIP archives on Linux as well as Windows

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
