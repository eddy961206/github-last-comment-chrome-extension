# Privacy policy — Last Comment for GitHub

Effective September 8, 2026 · Version 1.1.0

Last Comment for GitHub is designed to work without developer-operated analytics or data collection.

## What the extension processes

When a supported GitHub issue, pull request, or search list is open, the extension reads the list structure and requests matching GitHub issue pages with the existing browser session. This is necessary to determine the latest ordinary comment and show its author, timestamp, avatar, and preview.

The signed-in username is used locally to distinguish the user's replies and username mentions. The extension does not read authentication cookies or token values directly.

## What is stored

- Display preferences (enabled state, language, time zone, avatars, zero-comment display, cache duration) in `chrome.storage.local`. They are not synchronized.
- Recent lookup results briefly in the current GitHub tab's session memory to reduce repeated requests.
- Optional usage counters only when explicitly enabled. They contain aggregate counts (`lists`, `previews`, `lookups`, `failures`, `cache`) and no account IDs, repository names, URLs, comment text, or timestamps. They remain in `chrome.storage.local` until deleted, disabled, or uninstalled.

## What is not sent to the developer

No comment content, repository names, issue URLs, GitHub usernames, authentication tokens, cookies, browsing history, or usage counters are transmitted to the developer. There is no developer telemetry endpoint, analytics SDK, tracking pixel, remote script, or advertising.

Requests needed for comments go to GitHub. Avatars and permitted attachment or proxy images may be requested from GitHub services while shown. Those providers receive normal network metadata such as IP addresses.

## User control

- Counters are disabled by default. Disabling the option deletes saved counts.
- Counters and redacted diagnostics can be exported from Settings. Exports occur only when the user explicitly downloads a file.
- Cache clearing and preference reset are available in Settings.
- Uninstalling the extension removes locally stored preferences, counters, and personal notes.

## Data sale and advertising

The extension does not sell user data and does not use user data for advertising. Use of information received from Google APIs adheres to the Chrome Web Store User Data Policy, including Limited Use requirements.

## Third parties

The extension communicates with GitHub only as part of its user-facing function. Chrome Web Store and browser services are governed by their respective policies. Support tickets and voluntary attachments are handled by GitHub under GitHub's privacy policy. Do not include confidential information in public support issues.

## Contact

Maintainer: eddy961206. Contact through the repository support channel at https://github.com/eddy961206/github-last-comment-chrome-extension/issues. This policy must be updated before changing data practices.

## v1.1.0 — Personal notes

User-authored notes are stored in `chrome.storage.local` under a hashed issue key,
with their pinned/hover setting and an opaque revision used for edit conflicts.
They persist until explicitly deleted or the extension is uninstalled. They are
shared within the Chrome profile, not across devices. The hash is a lookup key,
not encryption or a guarantee of anonymity. Notes are not posted as GitHub
comments and are excluded from usage counters and diagnostics. Displayed notes
are page content, not a secure secrets vault. Fetched comment history remains
bounded and in page memory only. No permissions or telemetry endpoints are added.
