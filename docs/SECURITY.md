# Security

Please report security issues privately to the repository owner rather than posting exploit details publicly. Use https://github.com/eddy961206/github-last-comment-chrome-extension/issues for general issues and avoid including confidential repository content, tokens, or private comments in public reports.

The extension intentionally avoids:

- remote executable code
- personal access token collection
- developer telemetry
- broad browsing permissions
- reading authentication cookies or tokens directly

Comment HTML is sanitized before preview rendering. Executable elements, event attributes, inline styles, and untrusted image hosts are removed or replaced. Extension pages use a strict content security policy with no remote connections.

Supported scope is general conversation comments on `https://github.com/*`. Inline code review comments and GitHub Enterprise domains are not supported. If verification fails, the extension reports a lookup status instead of guessing.
