# Submission checklist

Before publishing:

- [ ] Load the repository root with Chrome “Load unpacked” (`manifest.json` must resolve `src/styles.js` and `icons/*.png`)
- [ ] Verify issue list and pull request list behavior while signed in to GitHub
- [ ] Verify a private repository if the intended audience uses private repositories
- [ ] Verify a long issue with many timeline items and pagination
- [ ] Verify Refined GitHub compatibility
- [ ] Verify English default and Korean switch in popup, settings, welcome, help, and privacy pages
- [ ] Verify time-zone options (device, Seoul, UTC)
- [ ] Verify light and dark GitHub themes and narrow layout behavior
- [ ] Verify comment preview links, images, keyboard access, and Escape handling
- [ ] Verify pause, per-item retry, and result reuse settings
- [ ] Verify optional local counters stay local, export correctly, and are deleted when disabled
- [ ] Host a public privacy policy URL (GitHub Pages is suitable) and link it in the listing
- [ ] Replace draft screenshots in `store/assets` if the final extension UI changes
- [ ] Run `npm run validate` and `npm run package`, then test the exact ZIP that will be uploaded
- [ ] Complete privacy disclosures using `store/listing/privacy-disclosure.md`
- [ ] Add support URL and privacy policy URL to the store listing
- [ ] Confirm the package contains no remote executable code
