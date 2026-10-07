# Security

Report security issues privately to the repository owner where possible. General support: https://github.com/eddy961206/github-last-comment-chrome-extension/issues. Never include tokens, confidential repository content or private comments in public reports.

The extension has no remote executable code, personal-token collection, developer telemetry or direct authentication-cookie reads. GitHub remains a narrow static host match. Gitea host access is optional and requested explicitly from settings; dynamic registration is followed by exact origin/port/base-path validation in the content script and same-origin transport. Removing permissions suspends Gitea content activity. HTTP connections are unencrypted.

HTML previews are copied through a bounded allowlist sanitizer; scripts, events, executable elements and unsafe image hosts are excluded. Gitea images are same-origin. Extension pages keep a strict self-only script policy and no outbound connections. Source documents are parsed inertly, not executed.

Navigation cache data lives in memory-only chrome.storage.session, mediated by the worker and isolated by tab, installation, observed account and rotating document lease. Cache limits prevent unbounded retention. Personal notes are explicit-save local data, not encrypted secrets. See [privacy](PRIVACY.md).

Only ordinary conversation comments are supported. Inline code reviews and GitHub Enterprise are excluded. The Gitea implementation targets standard server-rendered templates and fails visibly on unknown/incomplete structures. Fixture tests do not establish compatibility with all private/custom deployments; see [scope and verification](GITEA-NAVIGATION.md).
