# Chrome Web Store privacy disclosure notes

Recommended answers, based on v1.0.0 behavior:

- Personally identifiable information: **Not collected by the developer**
- Authentication information: **Not collected by the developer**
- Personal communications / comment content: **Processed locally for the user-facing feature; not transmitted to the developer**
- Website content: **Processed locally on GitHub pages for the feature; not transmitted to the developer**
- Web history: **Not collected**
- User activity: **No developer telemetry. Optional local counters are disabled by default, contain only aggregate counts, and stay on-device**
- Location: **Not collected**
- Financial / health information: **Not collected**

Data usage:
- Not sold
- Not used for advertising
- Not used for creditworthiness or lending
- Used only to provide the extension's user-facing GitHub list feature
- Use of information received from Google APIs adheres to the Chrome Web Store User Data Policy, including Limited Use requirements

Important reviewer note:
The extension necessarily reads GitHub page content and comment data in the user's browser to show the requested latest-comment information. “Not collected by the developer” does not mean “never processed in the browser.” Conversation data stays in page memory, preferences stay in `chrome.storage.local`, and exports occur only when the user explicitly downloads a file.
