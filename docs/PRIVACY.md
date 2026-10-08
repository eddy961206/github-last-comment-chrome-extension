# Privacy policy — Last Comment

Effective October 7, 2026 · Version 1.3.0

## Data processed

The extension reads list structure, issue/PR URLs, ordinary-comment authors, timestamps, avatar URLs and bodies on github.com and Gitea installations explicitly configured and authorized by the user. The displayed signed-in username distinguishes authors, mentions and cache identities. Existing same-origin browser sessions authenticate read-only page requests; authentication cookie and token values are not read directly.

## Storage and retention

Verified results and lookup failures are held in page memory and bounded, memory-only `chrome.storage.session`, to avoid repeated lookups after issue → Back navigation. Snapshots are separated by tab, exact installation and observed account. Limits: 80 recent entries per tab, 16 tab buckets, 1,000,000 serialized characters globally. New document lease tokens prevent late writes from superseded documents. Cache clearing, observed account/site changes, tab closure and browser or extension session resets discard cached data. Entries can also be evicted to honor limits. Returning to a list is not a new verification; the original checked timestamp is retained.

Preferences, explicitly configured Gitea base URLs, user-authored personal notes and optional aggregate counters use `chrome.storage.local`, not sync storage. Notes use hashed issue keys (including installation for Gitea), pinned state and opaque conflict revisions. Hashing is not encryption or anonymity. Notes persist until deleted or the extension is removed and are shared within this Chrome profile. They are not repository comments. Older-comment preview history remains bounded in page memory.

## Network and third parties

Comment requests go to the current GitHub or approved Gitea origin. GitHub preview images follow the existing image-host allowlist; Gitea avatars and preview images are same-origin only. HTTP Gitea connections are unencrypted. Those hosts receive ordinary network metadata such as IP addresses. The extension does not send repository content, user identities, credentials, browsing history or counters to the developer. It has no analytics SDK, tracking pixel, advertising or remotely executable code.

Chrome host permission is optional for Gitea and requested through an explicit Add site action. Permission patterns cover a hostname; runtime checks additionally restrict the exact origin/port and installation base path. Site removal revokes its permission when no remaining configuration shares it; reload affected open tabs afterward.

## User control and exports

Automatic refresh and local counters are off by default. Manual refresh remains available. Disabling counters deletes their aggregate counts. Counters contain no issue URLs, names, bodies, usernames or timestamps. Counter and redacted diagnostic exports occur only when explicitly requested; the user decides whether to share files. Notes and comment bodies are excluded from those exports.

Settings provide cache clearing (which pauses open list tabs), preference reset and site removal. Explicit notes have individual delete controls. Uninstalling removes extension storage. Notes rendered in repository pages are not a secure secrets vault.

## Use and support

Data is used only for this extension's user-facing functionality, never sold or used for advertising. Use of information received from Google APIs adheres to Chrome Web Store User Data Policy, including Limited Use. GitHub-hosted support issues and voluntary attachments are subject to GitHub's privacy policy; do not post confidential information publicly.

Maintainer: eddy961206. Support: https://github.com/eddy961206/github-last-comment-chrome-extension/issues. Update this policy before changing data practices. See [setup and tested scope](GITEA-NAVIGATION.md) and the bilingual static/dynamic `privacy.html` page.
