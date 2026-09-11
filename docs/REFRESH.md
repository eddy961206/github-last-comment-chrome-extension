# Refresh behavior (v1.2)

## Controls

`Refresh visible` checks the items currently on screen. The adjacent age describes the displayed data, not when the tab was opened or a request was attempted. The icon-only control enables or pauses automatic refresh; its tooltip describes the next action and the selected interval. Keyboard users receive a label, pressed state and description.

Automatic refresh is **off by default**, including migration from older preferences without the new `autoRefresh` field. Turning it off does not disable manual refresh, initial lookup of new items, previous-comment navigation, or local notes. The setting is saved locally and shared across tabs of this extension profile. The old `cacheMinutes` preference is retained for migration, but is now labelled **Auto-refresh interval** (2/5/10 minutes).

## Request policy

| Event | Existing checked result | Never-checked item |
| --- | --- | --- |
| Tab return, window focus | Keep data; update elapsed text locally | Resume unfinished initial loading when visible |
| Scroll or same-issue DOM replacement | Restore/keep snapshot; no age-based request | Load once near the viewport |
| GitHub updates row count or metadata | Keep prior result, mark it as previous | Load once |
| Network reconnect | No catch-up refresh | Resume initial loading |
| Refresh visible / row refresh | Explicit request regardless of age | Explicit request |
| Automatic refresh tick, when enabled | Check expired or changed visible items | Retry visible missing results |
| Failed automatic/manual request | Preserve last successful value and check time | Show failure, not No comments |

Auto-refresh runs only while the page is visible. Returning to the tab, reconnecting, or enabling the option starts a **new full interval**, not a catch-up burst. The next interval is scheduled after the current batch finishes so staggered completion times do not skip every second batch. Automatic pause cancels only automatic jobs; it does not cancel an explicit manual lookup. Backgrounding the tab cancels active lookups and keeps completed results.

The separate privacy action **Clear caches and pause open GitHub tabs** remains a hard pause. An explicit manual refresh or enabling auto-refresh resumes that tab. Disabling the whole extension remains separate from disabling automatic refresh.

## Elapsed-time semantics

The toolbar uses the **oldest successful check among visible items** (nearby/all discovered items are a fallback when visibility is temporarily unknown). A single successful row refresh therefore cannot make every result appear fresh. The tooltip reports checked/total items and both oldest and newest exact timestamps in the selected display time zone. Pending requests, retries and failures never advance the successful-check timestamp.

| Age | English example | Korean example |
| --- | --- | --- |
| Under one minute | Updated: Just now | 갱신: 방금 |
| Under one hour | Updated: 5m ago | 갱신: 5분 전 |
| Under one day | Updated: 1h 20m ago | 갱신: 1시간 20분 전 |
| Under one week | Updated: 3d ago | 갱신: 3일 전 |
| One week or older | Exact date, year, time and zone | 연도·날짜·시각·시간대 |

Elapsed labels and comment-recency colors are updated by the existing lightweight page clock, without fetching comments or storing usage timestamps. Age text is not an aria-live region, avoiding recurring screen-reader announcements. The author/avatar and open preview body are not recreated by clock-only updates.

## Retention and limits

Attached rows keep their last result until it is explicitly replaced or cleared. A page-memory LRU of 80 snapshots restores recently detached/recreated items; it is not a persistent offline archive. Route/account changes, explicit cache clearing and document teardown clear fetched conversation data. Reloading the document or browser discarding/recreating the tab starts a fresh initial load. New rows outside the retained cache still need an initial request. User-authored local notes retain their existing independent storage and deletion behavior.

No new host permissions, analytics events, remote libraries, or server-side storage are added.

## Validation

Run `npm run package` and `npm run validate`. The refresh tests cover default migration, explicit request reasons, interval boundaries, failure timestamps, visible-item age selection, English/Korean labels, and Intl day-period fallback. Browser QA additionally exercised the production content script, transport/parser and renderer with synthetic GitHub responses and mocked Chrome APIs. That fixture is not an authenticated GitHub + installed extension + Refined GitHub integration test.
