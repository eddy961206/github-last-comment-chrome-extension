# Contributing

## Scope

This repository maintains a single-purpose Chrome extension. Changes should support showing the latest ordinary GitHub comment in list views, including display, localization, caching, timing, troubleshooting, or privacy controls.

## Before submitting

1. Run `npm run validate`.
2. Load the extension unpacked and verify English default and Korean localization.
3. Verify a GitHub issue list, pull request list, preview, pause, retry, and settings.
4. Do not add remote executable code, analytics endpoints, broad host permissions, or new stored personal data without updating `docs/PRIVACY.md` and store disclosures first.

## Reports

Use the bug and feature templates in `.github/ISSUE_TEMPLATE`. Do not include private repository content, tokens, cookies, or comment text in public issues. Redacted diagnostics exports are preferred.
