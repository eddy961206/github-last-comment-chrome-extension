# Gitea server UI

This optional deployment installs Last Comment into Gitea's custom footer and static assets. It reuses the extension's production parser, list UI, sanitized previews, comment navigation, author presentation, notes and preference schema. No browser extension or personal access token is needed.

The navigation bar's **Last Comment** link replaces the extension popup. The list toolbar retains visible-item refresh, automatic refresh and display controls. The settings page includes language, time zone, avatars, zero-comment display, imported-author account links, optional counters, cache clearing and diagnostic export. Chrome host-registration controls are omitted because the installation is fixed.

## Build and install

1. Run `node tools/package-gitea.mjs`. It creates `dist/gitea-last-comment/` and `dist/gitea-last-comment-1.3.4.zip`. It does not run tests.
2. Create a deployment archive: `tar -czf gitea-last-comment-1.3.4.tar.gz -C dist/gitea-last-comment public templates`.
3. Copy the archive and `gitea/deploy.sh` to the intended server. Record the archive's SHA-256.
4. Run the installer manually as an administrator: `sh deploy.sh /absolute/GiteaCustomPath existing-container /absolute/archive.tar.gz expected-sha256`.
5. Reload Gitea. Open **Last Comment** to link your imported GitHub name if it differs from your Gitea login.

The installer expects a Docker container with the `gitea` executable and `git` user, and the host directory corresponding to Gitea's CustomPath. It verifies embedded template support, backs up existing assets/footer, changes only those assets/footer, and restarts only the named container. The readiness probe expects the default internal HTTP port 3000. Adapt that probe before use on other deployments. Do not schedule the installer.

Existing footer content is preserved. Updates replace only this package's recognized one-line include; unfamiliar edits are refused. A failed installation restores the prior footer/assets and attempts a restart. Review the result log and page before declaring success. Runtime JavaScript changes can be served without restarting, but cached assets may persist. Changing the footer asset revision requires a restart because production templates are loaded at startup.

Issue/PR list creator names retain the original Gitea color for the signed-in account and its explicitly linked imported identity. Other creators use a stable hue derived from their case-insensitive login name, with restrained saturation and consistent brightness (dark: 24% saturation/70% lightness; light: 28%/36%). This keeps each author consistent between issue/PR lists without vivid rainbow colors. Hues are not unique identifiers and can coincide. This affects creator names below each list title, not repository links or the Last Comment badge. Both normal profile links and the observed Korean migrated-creator text (`<login>에 의해`) are supported. Only the imported name is wrapped for styling; surrounding wording/time stays unchanged. Removing the presentation restores its original text. Unrecognized migration wording is left untouched. The existing author presentation restores the original inline style when disabled or when an identity becomes the current account. List re-rendering and automatic page updates reapply the distinction.

## Automatic page updates

The server deployment checks the visible issue/PR conversation or list every 30 seconds with one same-origin HTML GET. It applies changed conversation entries, review summaries, reactions and list rows without reloading the document. Existing Gitea global observers initialize inserted controls. A list change refreshes visible Last Comment badges through the existing bounded request queue. Code/diff tabs, PR merge controls and sidebar widgets are not replaced.

The **자동 반영 켜짐 · 30초** button disables/enables this browser's site preference. Hidden/offline pages stop polling. Network failures back off up to five minutes. Each response has a 12-second deadline and 12 MB decoded-byte bound. There is no new NAS daemon, public port, webhook or database query loop independent of an open browser.

Updates pause while a visible editor contains a draft, an input/editor is focused, text is selected, a menu/modal is open or bulk-selection checkboxes are checked. Scroll position is anchored to the visible conversation/list entry. A draft can therefore defer updates beyond 30 seconds. This is periodic HTML reconciliation rather than instant server push. Long threads and many simultaneously visible users increase server rendering and transfer cost.

Live verification on 2026-10-15 used VMS PR 9: adding an eyes reaction through tea appeared on the open page without navigation; the reaction was then removed. A temporary unsent editor draft paused reconciliation and remained intact across the next interval. The observed response was about 183 KB decoded HTML, with headers received about 120 ms after request start. These are one-page observations, not a concurrent-user load measurement. The Gitea container retained its 2026-10-08 start timestamp; deployment did not restart it. No test code or test suite was created or run.

## Storage and privacy

- Requests only read ordinary comments from the current Gitea origin with the existing browser login. The UI does not read cookie/token values or post repository comments.
- Preferences, explicitly saved author-name links, personal notes and optional counters use browser `localStorage`, separated by installation URL and Gitea account. There is no cross-device sync or automatic import of extension settings/notes.
- Results use page memory and bounded per-tab `sessionStorage`: 80 results and 1,000,000 serialized characters. Browsers may restore session storage with restored tabs. Cache clearing broadcasts to active pages and changes an epoch checked by restored documents. The epoch is document-local as well as tab-local so a newer page cannot conceal invalidation from an older Back/Forward-cached page.
- Notes are not encrypted. Any script on the Gitea origin, and another person using the same browser profile, may access browser storage. Account namespaces prevent accidental display mixing; they are not an access-control boundary. Signing out does not erase saved browser data.
- Counters and diagnostics exclude issue bodies, authors, repository paths, notes, name links and credentials. No developer telemetry or additional firewall access is needed.

## Rollback

The installer prints an adjacent `ui-backups/<timestamp>` directory. To restore that installation, move the current `public/assets/last-comment` directory into the backup for recovery, copy `original-assets` back if present, and restore `original-footer.tmpl`. If no original footer existed, move the installed footer into the backup instead. Preserve the existing numerical owner and readable static-file modes. Restart only the same Gitea container and reload the page. The first installation's backup removes the customization entirely; an update backup restores the preceding revision. Do not delete the repository data, database or container volumes.

## Verification and limits

On 2026-10-08 the custom footer/assets were installed on an authenticated Gitea 28.0.0 deployment. An in-app browser without the Chrome extension rendered issue-list badges, imported own-author labels, previews with previous/latest navigation, distinct conversation authors, pinned local notes retained on reload, and settings changes across open tabs. Disabling the feature removed its owned presentation. Visible-item refresh and optional counter updates were observed. Temporary verification notes were cleared and automatic refresh/counters were left off.

Generated JavaScript syntax and package contents were checked. No test code or test suite was created or executed for this deployment. Automatic-refresh scheduling reuses the extension's production code, but a full timed interval was not observed. The diagnostic export button completed without a console error; download receipt could not be confirmed by the in-app browser tool. A second authenticated account, subpath deployment, custom themes, inline code-review comments and every PR timeline variant were not exercised. Standard issue/PR conversation support uses the same production modules; inline code reviews remain outside scope.

On 2026-10-15 the PR reader was corrected to exclude Gitea's `.pull-merge-box` controls. Gitea gives this non-comment panel the same `.timeline-item.comment` classes as ordinary comments, but it has no comment ID, author header or body. Previously it caused the entire lookup to fail. Only this recognized control is excluded; malformed ordinary comments still fail verification. The generated `site.js` was replaced without changing templates or restarting Gitea. Refreshing all seven open PRs in the authenticated global list produced ordinary-comment badges or verified no-comment results. Browser-cached assets can require a hard reload after this static-file update.

On 2026-10-15 review summary bodies were added to the Gitea conversation reader. Gitea 28 wraps these comments in a timeline-item-group and places the timestamp in a separate review event. The reader now compares ordinary comments and review summaries by creation time and comment ID. Mention highlighting applies only after choosing the newest comment; inline file discussions and bodyless review events remain excluded.

Extension 1.3.4 skips pages carrying the server UI marker. Disable older extension copies on a server-enabled Gitea site, or reload the updated unpacked extension and site, to avoid two independent copies. The GitHub extension remains useful on GitHub.

Cache clearing paused active lists; visible-item refresh resumed them. Back navigation after clearing did not reuse the previous result timestamps. The browser tool did not establish whether that navigation used a full document reload or Back/Forward cache, so the frozen-document path is source-reviewed rather than a separate observed browser case.
