/* MV3 worker. Settings and optional local counters; deliberately no fetch(). */
importScripts('shared.js');
const METRICS = new Set(['lists', 'previews', 'lookups', 'failures', 'cache']);
let pending = Promise.resolve();
function trusted(sender) {
    if (sender.id !== chrome.runtime.id)
        return false;
    try {
        const u = new URL(sender.url || sender.origin);
        return (u.protocol === 'chrome-extension:' && u.hostname === chrome.runtime.id) || (u.origin === 'https://github.com' && sender.tab?.id != null);
    }
    catch {
        return false;
    }
}
chrome.runtime.onInstalled.addListener(async (details) => {
    const saved = await chrome.storage.local.get('preferences');
    if (!saved.preferences)
        await chrome.storage.local.set({ preferences: LC.defaults });
    if (details.reason === 'install')
        await chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') });
});
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.preferences && !LC.normalize(changes.preferences.newValue).localStats)
        pending = pending.then(() => chrome.storage.local.remove('counters')).catch(() => { });
});
chrome.runtime.onMessage.addListener((message, sender, reply) => {
    if (!trusted(sender) || !message || typeof message !== 'object')
        return;
    if (message.type === 'LC_METRIC' && METRICS.has(message.metric)) {
        pending = pending.then(async () => {
            const data = await chrome.storage.local.get(['preferences', 'counters']);
            if (!LC.normalize(data.preferences).localStats)
                return;
            const counters = {};
            for (const key of METRICS)
                counters[key] = Math.min(1e9, Math.max(0, Math.trunc(Number(data.counters?.[key]) || 0)));
            counters[message.metric] = Math.min(1e9, counters[message.metric] + 1);
            await chrome.storage.local.set({ counters });
        }).then(() => reply({ ok: true })).catch(() => reply({ ok: false }));
        return true;
    }
    if (message.type === 'LC_CLEAR_COUNTERS') {
        pending = pending.then(() => chrome.storage.local.remove('counters')).then(() => reply({ ok: true })).catch(() => reply({ ok: false }));
        return true;
    }
    if (message.type === 'LC_CLEAR_CACHE' && !sender.tab) {
        chrome.tabs.query({}).then(async (tabs) => {
            await Promise.all(tabs.filter(t => t.id != null).map(t => chrome.tabs.sendMessage(t.id, { type: 'LC_CLEAR_CACHE' }).catch(() => { })));
            reply({ ok: true });
        }).catch(() => reply({ ok: false }));
        return true;
    }
    if (message.type === 'LC_OPTIONS') {
        chrome.runtime.openOptionsPage().then(() => reply({ ok: true })).catch(() => reply({ ok: false }));
        return true;
    }
});
