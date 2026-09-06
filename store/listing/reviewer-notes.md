# Reviewer notes

1. Install the extension and remain signed in to GitHub.
2. Open a GitHub repository with visible Issues, or visit https://github.com/issues.
3. Each supported list item receives a compact “Last comment” line rendered in Shadow DOM.
4. Hover the comment badge, focus it with Tab, or select its preview button to see the sanitized Markdown preview.
5. Open the extension action popup and select Settings.
6. Change Language from English to Korean and return to the GitHub list to verify localization. Time zone, avatars, and zero-comment display can also be changed.
7. Optional local counters can be enabled in Settings. They are stored only in `chrome.storage.local`, contain aggregate counts only, and are never transmitted. Disabling the option deletes them. Counters and redacted diagnostics can be exported from Settings.
8. The extension contains no remote executable code and no analytics network endpoint. Its content security policy disallows remote connections from extension pages.
9. A GitHub personal access token is not required. The extension uses the existing browser session.
10. If the Tampermonkey version is also installed, disable it to prevent duplicate badges.
