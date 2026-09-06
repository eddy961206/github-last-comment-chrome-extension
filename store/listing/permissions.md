# Permission justification

## `storage`
Used to save extension display preferences (enabled state, language, time zone, avatars, zero-comment display, cache duration) and optional local-only usage counters. Counters are disabled by default, contain only aggregate counts, and are never transmitted to the developer. Disabling the option deletes saved counts.

## GitHub page access
The content script is limited to `https://github.com/*`. It must read GitHub issue and pull request list structure and request corresponding GitHub pages with the existing browser session to determine the latest ordinary comment. The extension does not request a personal access token and does not read authentication cookies or tokens directly.

## No broader permissions
The extension does not request `history`, `bookmarks`, `downloads`, `cookies`, `identity`, `webRequest`, `management`, clipboard access, or broad all-sites access. It includes no remote executable code, analytics SDK, tracking pixel, or advertising.
