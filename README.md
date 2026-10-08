# Last Comment for GitHub and Gitea

**Know who replied. Stay in the list.**

A standalone Manifest V3 Chrome extension that shows the latest ordinary issue and pull request comment in list views. English is the default; Korean is available in Settings. No Tampermonkey, separate user script, or personal access token is required.

## Version 1.3.1

Gitea installations can now be added explicitly in settings, including the observed standard Gitea 28.0.0 interface and imported GitHub comment authors. Opening an issue and going Back reuses recent verified results rather than fetching every row again. Site-add failures clean up newly granted unused permissions; revoking one host leaves other approved hosts active. See [Gitea setup, navigation cache and verification](docs/GITEA-NAVIGATION.md).

## Highlights

- Latest ordinary comment author, timestamp, avatar and sanitized Markdown preview beneath supported titles.
- Badge-only hover, keyboard and touch previews, light/dark themes and Shadow DOM style isolation.
- Previous/next/latest comment navigation with verified, bounded history batches and grouped author trails.
- Explicit-save personal notes, up to 4,000 characters, with pinned or hover-only display and conflict handling.
- Language, time zone, avatar and zero-comment display settings.
- Manual refresh by default; optional automatic refresh every 2, 5 or 10 minutes while visible.
- Original successful-check time remains visible when cached results are restored.
- Viewport-aware, rate-limited, read-only requests with bounded verification and no developer telemetry.

This is not an unread-status or reply-needed indicator. Blue represents another author, gray represents you or a bot, and amber indicates your username appears in a comment. Date recency colors are independent of author colors.

## Install or update locally

1. Download or clone the requested branch. Use the directory containing `manifest.json` directly, or run `npm run validate && npm run package` and extract the runtime ZIP from `dist/`.
2. Open `chrome://extensions` and enable Developer mode.
3. Choose **Load unpacked** and select the extension directory. To update an existing unpacked installation, replace the contents of its existing directory and press its reload button.
4. Disable the old Tampermonkey Last Comment script to prevent duplicate badges.
5. Reload existing GitHub/Gitea tabs after installing or updating.

### Gitea

Open the extension popup → **All settings / 전체 설정** → **Gitea sites / Gitea 사이트**. Enter the installation base URL, choose Add site, approve Chrome's host permission and reload the Gitea issue list.

Examples: `https://git.example.com`, `https://example.com/gitea`, `http://git.example:3000`. Do not enter a repository or issue URL. HTTP traffic is unencrypted. Only configured installations are activated; the runtime additionally checks the exact port and base path. Removing a configured site stops its use and removes its host permission when no other configured installation uses that permission.

## Use

Open a supported list, then hover over the author badge or focus it with Tab to read the preview. Arrow Down or Space enters the preview; Escape closes it. Touching the author opens the preview. Previous comment loads earlier ordinary replies on demand; code-line reviews are excluded.

Use **Refresh visible / 보이는 항목 갱신** or an individual badge's refresh control to request newer data. Issue → Back does not automatically check for new replies. Auto-refresh is off by default; enabling it starts a full interval rather than refreshing immediately on return. First-time or evicted items still require a lookup. See [refresh policy](docs/REFRESH.md).

Personal notes are stored only in this Chrome profile and are never posted to the repository. **Always show** pins a note below the badge. Save is explicit; conflicting edits from another tab require an explicit second save. Notes are not an encrypted secrets vault.

## Privacy and access

GitHub uses a static `https://github.com/*` content-script match. Gitea uses optional host permissions requested only when adding a site, plus the `scripting` permission for dynamic registration. Broad optional patterns are not an all-sites permission grant at installation.

Fetched results stay in page memory and bounded, memory-only `chrome.storage.session` snapshots for navigation reuse. The worker separates them by tab, installation and observed account. Defaults: 80 recent results per tab, 16 tab buckets and 1,000,000 serialized characters globally. Tab closure, explicit clearing, observed account/site changes and browser/extension session resets discard cached data. Preferences, configured site addresses, explicit personal notes and optional aggregate counters use `chrome.storage.local`, never sync storage.

No repository content, credentials, browsing history or counters are sent to the developer. Existing same-origin browser sessions are used without reading authentication cookie or token values. See [privacy policy](docs/PRIVACY.md), the readable [privacy page](privacy.html), and [security scope](docs/SECURITY.md).

## Development and verification

```bash
npm run validate
npm run package
```

No runtime npm dependencies or external archivers are needed. Packaging produces `dist/last-comment-extension-1.3.1.zip` with runtime files only. Validation checks manifests, locales, referenced paths, JavaScript syntax and regression tests.

The 1.3.0 suite has 76 passing tests. Real-extension browser testing with synthetic GitHub JSON and Gitea 1.24.6-template-derived HTML verified three rows per platform: 3 initial comment requests, still 3 after three issue/Back cycles, and 6 after manual refresh. The Gitea fixture includes 70 ordinary comments. These fixtures do not constitute testing your authenticated private Gitea deployment or every custom theme. Full details and remaining limits are in [GITEA-NAVIGATION.md](docs/GITEA-NAVIGATION.md).

For 1.3.1, live Gitea 28.0.0 issue/PR DOM was inspected and the production reader processed captured real issue comments locally. No test suite was run for this review. Installing this revision in Chrome and exercising its permission prompts, revocation and Back-navigation behavior remains unverified.

## Repository layout

- `manifest.json`: runtime metadata, permissions and script order.
- `src/sites.js`, `gitea.js`, `site-settings.js`: provider detection, Gitea parsing and explicit host approval.
- `src/navigation-cache.js`, `background.js`: bounded session snapshots, sender checks and dynamic registration.
- Other `src/` modules: shared preferences, list UI, verified GitHub parser, transport, previews, notes and recency styling.
- `styles/`, `icons/`, `_locales/`: runtime presentation and locales.
- `tests/`, `tools/`: validation, privacy fallback generation and deterministic ZIP packaging.
- `docs/`: setup, verification, privacy, refresh and security documentation.
- `store/`: existing store copy and synthetic screenshots; review and update any older GitHub-only disclosures before a new store submission.

## 한국어 안내

설정에서 한국어를 선택할 수 있어. Gitea는 전체 설정에서 기본 주소를 추가하고 Chrome 권한을 허용한 뒤 목록을 새로고침해. 이슈에 들어갔다가 뒤로가면 기존 결과를 유지하며 최신 댓글은 보이는 항목 갱신으로 확인해. 오래된 Tampermonkey 스크립트는 함께 켜지 마. 캐시와 개인 메모의 저장 방식은 서로 다르며, 댓글이나 메모를 개발자에게 전송하지 않아.

## Support

Issues: https://github.com/eddy961206/github-last-comment-chrome-extension/issues

MIT license; see `LICENSE`. Independent extension, not affiliated with or endorsed by GitHub, Gitea or Google. General conversation comments are supported; inline code reviews and GitHub Enterprise are not. Unknown page shapes fail visibly rather than guessing a reply.
