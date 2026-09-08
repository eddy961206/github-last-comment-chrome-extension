# Last Comment for GitHub

**Know who replied. Stay in the list.**

A standalone Manifest V3 Chrome extension that shows the latest ordinary GitHub issue and pull request comment directly in list views. English is the default; Korean is available in Settings. No Tampermonkey, separate user script, or personal access token is required.

## Highlights

- Latest comment author, timestamp, avatar, and sanitized Markdown preview beneath supported titles
- Badge-only hover, keyboard, and touch preview with light and dark theme support
- Shadow DOM badges that avoid page style conflicts
- Language control (English default, Korean available), time-zone control, avatars, zero-comment display, and result reuse
- Pause, per-item retry, and viewport-aware fetching with bounded pagination verification
- Uses the existing GitHub sign-in; no token exchange
- Privacy-first: no developer telemetry; optional local-only counters disabled by default
- Strict extension content security policy with no remote executable code

## Install locally

1. Download or clone this repository.
2. Run `npm run validate`, then `npm run package` to produce the store upload ZIP in `dist/`, or use the repository root directly.
3. Open `chrome://extensions`.
4. Enable Developer mode.
5. Select **Load unpacked** and choose the folder containing `manifest.json` (or the unpacked `dist/` output).
6. Disable the Tampermonkey Last Comment script, if installed, to prevent duplicate badges.
7. Refresh open GitHub tabs and open a repository Issues or Pull requests list.

## Use

1. Open a GitHub issue or pull request list while signed in.
2. Read the compact “Last comment” line under each title.
3. Hover over a badge or focus the author link with Tab to read the formatted comment.
4. Use the toolbar to refresh visible items, pause, or open Settings.
5. In Settings, change language, time zone, avatars, cache duration, and optional local counters.

General conversation comments are supported. Inline code review comments and GitHub Enterprise domains are not supported. If verification fails, the extension reports a lookup status instead of guessing.

## Privacy

Comment content is processed in page memory to provide the requested badges and previews. Preferences remain in `chrome.storage.local`. Optional usage counters contain aggregate counts only, are disabled by default, remain local, and can be exported or deleted in Settings. No comment content, repository names, URLs, usernames, cookies, tokens, or counters are transmitted to the developer.

See `docs/PRIVACY.md`, `privacy.html`, and `store/listing/privacy-disclosure.md`.

## Repository layout

- `manifest.json` — Manifest V3 metadata, English default locale, `storage` permission only, GitHub-only content script
- `src/` — `shared.js`, `notes.js`, `styles.js`, `recency.js`, `parser.js`, `render.js`, `transport.js`, `content.js`, `background.js`, `pages.js`
- `styles/` — Shadow DOM list styles and extension page styles
- `welcome.html`, `popup.html`, `options.html`, `help.html`, `privacy.html` — extension pages rendered by `src/pages.js`
- `_locales/en`, `_locales/ko` — store and extension metadata locales
- `icons/` — `mark.svg` source and `icon-*.png` runtime icons
- `store/listing/` — product copy, single purpose, permissions, privacy, reviewer notes, checklist
- `store/assets/` — English-guidance screenshots with illustrative data
- `docs/` — privacy and security notes
- `tests/`, `tools/` — validation and packaging
- `.github/` — issue templates and CI

## Development

```bash
npm install
npm run validate
npm run package
```

`npm run validate` checks manifest JSON, locale JSON, required files, and JavaScript syntax. `npm run package` creates `dist/last-comment-extension-<version>.zip` containing runtime files only.

## Store submission

1. Complete `store/listing/submission-checklist.md`.
2. Test the exact ZIP from `dist/`.
3. Upload it to Chrome Web Store.
4. Complete privacy disclosures with `store/listing/privacy-disclosure.md`.
5. Provide support and privacy policy URLs.

Screenshots in `store/assets` use English guidance and synthetic `octo-demo/atlas` data. No private repository or real user content is included.

## 한국어 안내

기본 언어는 영어이며 설정에서 한국어를 선택할 수 있습니다. 기존 GitHub 로그인 상태를 사용하며 별도 토큰이 필요하지 않습니다. 댓글 내용은 기기에서만 처리하고 개발자에게 전송하지 않습니다. 선택적 사용 횟수 기록은 기본적으로 꺼져 있으며, 사용 시 이 브라우저에만 저장되고 내보내기 또는 삭제할 수 있습니다. Tampermonkey 버전을 함께 사용하는 경우 중복 표시 방지를 위해 해당 스크립트를 비활성화해 주세요.

## Support

- Issues and feature requests: https://github.com/eddy961206/github-last-comment-chrome-extension/issues
- Security: see `docs/SECURITY.md`
- License: MIT, see `LICENSE`
- Independent extension. Not affiliated with or endorsed by GitHub or Google.

## v1.1.0: history and personal notes

Hover over the last-comment **badge**, not the surrounding row. The redundant
speech-bubble button is removed; keyboard users can focus the author link and
press Arrow Down or Space. Touching the author opens the preview.

Select **Previous comment** to inspect one earlier general comment at a time.
Next and Latest return through the same conversation. The author trail groups
consecutive replies by the same person. History is verified on demand, with a
bounded reusable batch; GitHub may require multiple timeline requests for that
first batch. It is not an unread-status or reply-needed indicator.

The note button saves a personal note (up to 4,000 characters) for that issue in
this Chrome profile. **Always show** pins it below the badge; otherwise hover over
the note button. Save is explicit. Revision conflicts require confirmation before
an older draft replaces another tab's edit. Notes are not posted to GitHub, synced,
or included in diagnostic/counter exports. Uninstalling removes extension storage.
This is not an encrypted secrets vault.

Build and verify: `npm run package && npm run validate`. The package is generated
without external archivers. The repository includes notes/history regression
checks in addition to timestamp-boundary tests. Browser fixture testing is distinct
from testing an installed extension against an authenticated GitHub session.
