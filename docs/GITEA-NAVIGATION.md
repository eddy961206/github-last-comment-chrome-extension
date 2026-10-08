# Gitea and navigation cache (1.3.1)

## Setup

Load the unpacked extension, open its **All settings / 전체 설정**, and find **Gitea sites / Gitea 사이트**. Enter the installation base URL (not an issue URL), choose Add site, approve Chrome’s host permission, then reload the Gitea list. Examples: `https://git.example.com`, `https://example.com/gitea`, `http://git.example:3000`. HTTP is unencrypted. Chrome grants host access without port scoping; the extension additionally checks the exact origin (including port) and installation path before running or requesting data. GitHub remains enabled without an extra registration. Do not run the old Tampermonkey script simultaneously.

Only explicitly added Gitea installations are injected dynamically. The broad optional host patterns in the manifest do not grant all-site access at installation. Removing a site revokes its host permission when no other configured installation uses that host; reload existing Gitea tabs afterward.

## Back navigation

List → issue → Back reuses the last verified result and its original checked timestamp. Auto-refresh remains off by default. Use Refresh visible / 보이는 항목 갱신 or the individual badge refresh to see replies written since the cached result. Opted-in auto-refresh waits a full selected interval on return. Cache misses, eviction, a different account, browser restart, or explicit clearing require a new lookup.

Successful results and failures are bounded to 80 recent items per tab, 16 tab buckets, and 1,000,000 serialized characters globally. The worker stores these in memory-only `chrome.storage.session`, not site localStorage, `chrome.storage.local`, or sync storage. A new document rotates a lease token so late writes cannot repopulate the current document’s cache. Tabs, installations and observed account identities are isolated. Tab closure and Clear caches delete corresponding session data. Cache clearing pauses open list tabs. Disabling/reloading/updating the extension or restarting Chrome also clears session storage. Personal notes are separate explicitly saved local data; existing GitHub note keys are unchanged, and Gitea note keys include installation identity.

## Supported scope and limits

Gitea ordinary server-rendered conversation comments, including standard `/pulls/N` routes. The subject is bound to the issue’s own edit-content metadata; issue bodies, nested quoted comments, timeline events and inline code review threads are not selected as the last ordinary reply. Unknown page shapes or pagination fail closed instead of displaying a guessed result. The reader recognizes the original 1.24-style selectors and the observed standard Gitea 28.0.0 layout. Imported GitHub authors are read from Gitea's original-author span. Custom/future layouts remain unverified. GitHub’s existing verified paginated parser remains in use.

## Review verification (2026-10-08, 1.3.1)

Read-only inspection of an authenticated Gitea 28.0.0 deployment confirmed the standard footer (no generator meta), `#issue-list > .item` rows, `.issue-content-left > .comment-list`, `.issue-content-comment` body marker, account menu, and issue/PR content-update metadata. The production `sites.js`, `parser.js` and `gitea.js` reader was run locally on captured real issue DOM. It selected the actual latest ordinary comment with its original author and Markdown body, and returned all three preceding ordinary comments. Private HTML was kept outside this repository and deleted after inspection.

The structures were also compared with Gitea's official [issue template](https://github.com/go-gitea/gitea/blob/main/templates/repo/issue/view_content.tmpl) and [ordinary-comment template](https://github.com/go-gitea/gitea/blob/main/templates/repo/issue/view_content/comments.tmpl).

Permission cleanup and revocation changes were reviewed in source. JavaScript syntax and ZIP contents were checked. No test code was created or test suite executed for this revision. Full installed-Chrome permission prompts, revocation and Back-navigation behavior on the live deployment remain unverified. The earlier synthetic runtime results below describe the original PR, not this corrected revision.

## Verification (2026-10-07)

`npm run validate`: 76 tests passed, manifest and JavaScript syntax checks passed.
Real Chrome 145 extension runtime + Playwright 1.58.2, with intercepted GitHub JSON and Gitea template-derived HTML fixtures (not a live customer server): each platform had three rows. Initial comment HTML requests: 3. After three issue → Back cycles: still 3. After manual Refresh visible: 6. No page JavaScript errors. Gitea fixture contains 70 ordinary comments and a no-comment issue. Settings input rendering and dynamic content-script registration were exercised. Browser permission prompt UI was pre-granted only in the disposable test copy; production keeps optional permissions. Screenshots captured at 1280×900 and Gitea at 390×844. No Browser plugin was available; Playwright was used.

Unit coverage includes exact origin/port/subpath routing, unsafe URLs, per-tab/account/site isolation, old document token rejection, eviction, clearing, and note-key compatibility.
