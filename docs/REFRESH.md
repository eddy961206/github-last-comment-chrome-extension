# Refresh behavior (v1.3)

## Controls

`Refresh visible` checks items currently on screen. The adjacent age describes displayed data, not tab-open time or a request attempt. The icon-only control enables or pauses automatic refresh; its tooltip describes the action and selected interval. Keyboard users receive a label, pressed state and description.

Automatic refresh is off by default, including migration from older preferences without `autoRefresh`. The existing `cacheMinutes` preference now means Auto-refresh interval (2/5/10 minutes), not a time-to-live that triggers requests during discovery. Turning automatic refresh off does not disable manual refresh, first lookups, previous-comment navigation or notes.

## Request policy

| Event | Existing checked result | Never-checked/evicted item |
| --- | --- | --- |
| Open an issue, then Back | Restore snapshot and original checked time; no request | Initial lookup when visible |
| Tab return, focus, scroll or same-issue DOM replacement | Keep data; update elapsed text locally | Resume initial loading |
| Row count or metadata changes | Keep prior result, mark previous when detected | Initial lookup |
| Network reconnect | No catch-up refresh | Resume initial loading |
| Manual visible or per-row refresh | Explicit request regardless of age | Explicit request |
| Opted-in auto-refresh tick | Recheck expired/changed visible items | Retry visible missing results |
| Failed refresh | Keep successful value and timestamp with failure status | Show failure, never guessed No comments |

Returning to a tab, reconnecting or enabling automatic refresh starts a new full interval, not an immediate catch-up burst. Backgrounding cancels active lookups and retains completed results. Automatic pause only cancels automatic jobs. The separate privacy action Clear session caches and pause open tabs is a hard pause; manual refresh or enabling automatic refresh resumes the tab.

## Time semantics

The toolbar uses the oldest successful check among visible items, with nearby/all discovered items as a fallback. A single successful row refresh cannot make the whole list appear fresh. The tooltip shows checked/total counts and exact oldest/newest timestamps in the selected zone. Requests, retries and failures do not advance successful-check time.

Elapsed labels and comment-recency colors update locally without comment fetches, avatar reloads or preview-body replacement. Age text is not an aria-live region. Under a week, labels are relative; older checks use exact selected-zone dates. English and Korean remain available.

## Navigation snapshots

Route resets detach UI and cancel requests without discarding the same account's recent results. A new document waits for its per-tab, per-installation, observed-account cache before discovering rows. Session snapshots are bounded to 80 entries per tab, 16 tab buckets and 1,000,000 serialized characters globally. Lease tokens reject superseded document writes. Account/site changes, explicit clearing, tab closure and browser/extension session resets discard corresponding data; new or evicted rows must fetch again. This is not a permanent offline archive. Personal notes remain separate explicit-save local data.

## Verification

`npm run validate` covers request reasons, interval/age boundaries, failure timestamps, visible age selection, locale fallback, cache leases, account/site/tab separation and eviction. Real Chrome extension runtime tests with intercepted GitHub and Gitea fixture responses exercised three issue/Back cycles: each platform remained at three initial fetches, then manual refresh raised the count to six. See [full environment and untested cases](GITEA-NAVIGATION.md).
