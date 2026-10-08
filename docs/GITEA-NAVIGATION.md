# Gitea and navigation cache (1.3.3)

## Setup

Load the unpacked extension, open its **All settings / 전체 설정**, and find **Gitea sites / Gitea 사이트**. Enter the installation base URL (not an issue URL), choose Add site, approve Chrome’s host permission, then reload the Gitea list. Examples: `https://git.example.com`, `https://example.com/gitea`, `http://git.example:3000`. HTTP is unencrypted. Chrome grants host access without port scoping; the extension additionally checks the exact origin (including port) and installation path before running or requesting data. GitHub remains enabled without an extra registration. Do not run the old Tampermonkey script simultaneously.

Only explicitly added Gitea installations are injected dynamically. The broad optional host patterns in the manifest do not grant all-site access at installation. Removing a site revokes its host permission when no other configured installation uses that host; reload existing Gitea tabs afterward.

### Imported author identity (1.3.3)

Migrated comments retain their original GitHub names, which may differ from the current Gitea login. Under each configured site, explicitly link **My Gitea login** to **My GitHub name on imported comments**. The own-author comparison includes this name only for that site's exact base URL and while signed in as that Gitea login. Links have individual removal controls; site removal clears its links. They are local display settings and grant no account access. Saving/removing links repaints open badges without a new comment request. The cache remains scoped to the actual Gitea login. Mention highlighting still uses that login, not the imported-author link.

Conversation pages use the same author extraction as the verified reader. Ordinary comment authors, including the issue body author, receive stable name/header colors and a comment border. Initial avatars distinguish migrated authors even if their original avatar images are identical. The linked own author uses a neutral color and an explicit You/나 label. The decorator makes no requests and changes no server content. It removes its own nodes and restores the inline properties it changed when its Enable setting is disabled, permissions are revoked, the configured site is removed, or the document is left. It preserves subsequently changed inline properties belonging to another writer. Unknown author structures are left untouched; timeline events and inline reviews are excluded.

## Back navigation

List → issue → Back reuses the last verified result and its original checked timestamp. Auto-refresh remains off by default. Use Refresh visible / 보이는 항목 갱신 or the individual badge refresh to see replies written since the cached result. Opted-in auto-refresh waits a full selected interval on return. Cache misses, eviction, a different account, browser restart, or explicit clearing require a new lookup.

Successful results and failures are bounded to 80 recent items per tab, 16 tab buckets, and 1,000,000 serialized characters globally. The worker stores these in memory-only `chrome.storage.session`, not site localStorage, `chrome.storage.local`, or sync storage. A new document rotates a lease token so late writes cannot repopulate the current document’s cache. Tabs, installations and observed account identities are isolated. Tab closure and Clear caches delete corresponding session data. Cache clearing pauses open list tabs. Disabling/reloading/updating the extension or restarting Chrome also clears session storage. Personal notes are separate explicitly saved local data; existing GitHub note keys are unchanged, and Gitea note keys include installation identity.

## Supported scope and limits

Gitea ordinary server-rendered conversation comments, including standard `/pulls/N` routes. The subject is bound to the issue’s own edit-content metadata; issue bodies, nested quoted comments, timeline events and inline code review threads are not selected as the last ordinary reply. Unknown page shapes or pagination fail closed instead of displaying a guessed result. The reader recognizes the original 1.24-style selectors and the observed standard Gitea 28.0.0 layout. Imported GitHub authors are read from Gitea's original-author span. Custom/future layouts remain unverified. GitHub’s existing verified paginated parser remains in use.

## Review verification (2026-10-08, 1.3.1)

Read-only inspection of an authenticated Gitea 28.0.0 deployment confirmed the standard footer (no generator meta), `#issue-list > .item` rows, `.issue-content-left > .comment-list`, `.issue-content-comment` body marker, account menu, and issue/PR content-update metadata. The production `sites.js`, `parser.js` and `gitea.js` reader was run locally on captured real issue DOM. It selected the actual latest ordinary comment with its original author and Markdown body, and returned all three preceding ordinary comments. Private HTML was kept outside this repository and deleted after inspection.

The structures were also compared with Gitea's official [issue template](https://github.com/go-gitea/gitea/blob/main/templates/repo/issue/view_content.tmpl) and [ordinary-comment template](https://github.com/go-gitea/gitea/blob/main/templates/repo/issue/view_content/comments.tmpl).

## Chrome runtime correction (2026-10-08, 1.3.2)

The installed 1.3.1 popup reported `TypeError: extTabs.query is not a function`. Source inspection confirmed that the code saved `chrome.tabs.query` itself as `extTabs` and then tried to call `extTabs.query`. The correction saves the API object.

The site-add operation and cleanup could also receive no response: the worker required `!sender.tab` for `LC_SITES_SYNC`. A legitimate extension options page opened in a browser tab can have this property. The worker now authorizes internal privileged operations by the extension's own URL and ID. Content scripts on GitHub/Gitea are not authorized to register sites or clear the global cache. See Chrome's [MessageSender documentation](https://developer.chrome.com/docs/extensions/reference/api/runtime#type-MessageSender).

The actual Chrome Gitea page had 20 list rows and zero extension badge hosts before the correction. After the user reloaded 1.3.2 and reported successful site addition, live Chrome observation confirmed imported-author badges, correct comment timestamps, and a rendered ordinary-comment preview with history controls. The browser tool prohibits accessing `chrome-extension://` and `chrome://` pages; it cannot reload the extension, inspect its settings/popup UI or press its host-permission prompt. These steps require the user. JavaScript syntax and ZIP generation were checked without executing test suites. The corrected popup UI remains unverified directly.

Permission cleanup and revocation changes were reviewed in source. JavaScript syntax and ZIP contents were checked. No test code was created or test suite executed for this revision. Full installed-Chrome permission prompts, revocation and Back-navigation behavior on the live deployment remain unverified. The earlier synthetic runtime results below describe the original PR, not this corrected revision.

## Live Chrome author display (2026-10-08, 1.3.3)

After the user reloaded the unpacked installation and saved a site-specific account link, the live Gitea issue body and three ordinary replies displayed the expected author styles. The linked imported author had a neutral name/header, matching border, initials and an explicit Korean own-author label. The other imported author had a distinct stable color and initials. Comment content remained present. The site's actual account identity was retained.

On a separate live list tab, linked imported-author badges used the own-author class and label, while another imported author retained the distinct other-author class and color. Keyboard preview navigation showed the latest reply and two preceding replies, including another author. One list-to-issue-to-Back cycle retained all eight results already fetched for that viewport, including their original checked timestamps. CDP observation scoped to the ordinary HTTPS page recorded the issue document navigation and Gitea's content-history request; it recorded no new ordinary-comment lookup on return. The observed pages produced no console errors.

JavaScript syntax and all 31 runtime ZIP entries were checked without creating test code or running test suites. Extension management/settings/popup pages remain inaccessible to the browser tool. The user performed reload and account-link entry. Light-theme styling, live native-account photo borders, PR-specific layouts, permission revocation, setting-disable restoration, and account/link changes during an open conversation were reviewed in source but not exercised on the live installation. Earlier synthetic results below are historical PR evidence.

## Verification (2026-10-07)

`npm run validate`: 76 tests passed, manifest and JavaScript syntax checks passed.
Real Chrome 145 extension runtime + Playwright 1.58.2, with intercepted GitHub JSON and Gitea template-derived HTML fixtures (not a live customer server): each platform had three rows. Initial comment HTML requests: 3. After three issue → Back cycles: still 3. After manual Refresh visible: 6. No page JavaScript errors. Gitea fixture contains 70 ordinary comments and a no-comment issue. Settings input rendering and dynamic content-script registration were exercised. Browser permission prompt UI was pre-granted only in the disposable test copy; production keeps optional permissions. Screenshots captured at 1280×900 and Gitea at 390×844. No Browser plugin was available; Playwright was used.

Unit coverage includes exact origin/port/subpath routing, unsafe URLs, per-tab/account/site isolation, old document token rejection, eviction, clearing, and note-key compatibility.
