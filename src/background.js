/* MV3 worker. Settings and optional local counters; deliberately no fetch(). */
importScripts('shared.js', 'sites.js', 'notes.js', 'navigation-cache.js');
const navCache = new LCNavigationCache(chrome.storage.session);
const METRICS = new Set(['lists', 'previews', 'lookups', 'failures', 'cache']);
let configuredSites = [];
const ready = chrome.storage.local.get('giteaSites').then(v => { configuredSites = v.giteaSites || []; });
let pending = ready;
function trusted(sender) {
    if (sender.id !== chrome.runtime.id)
        return false;
    try {
        const u = new URL(sender.url || sender.origin);
        return (u.protocol === 'chrome-extension:' && u.hostname === chrome.runtime.id) || (sender.tab?.id != null && sender.frameId === 0 && !!LCSites.find(u.href, configuredSites));
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
    if (sender.id !== chrome.runtime.id || !message || typeof message !== 'object')
        return;
    if (message.type === 'LC_SITE_ACCESS') {
        ready.then(async () => {
            const site = sender.tab?.id != null && sender.frameId === 0 && LCSites.find(sender.url, configuredSites);
            return { ok: true, allowed: !!site && site.provider === 'gitea' && await chrome.permissions.contains({ origins: [LCSites.permission(site)] }) };
        }).then(reply).catch(() => reply({ ok: false }));
        return true;
    }
    if (message.type === 'LC_CACHE_OPEN' || message.type === 'LC_CACHE_PUT') {
        pending = pending.then(async () => {
            await ready;
            if (!trusted(sender) || sender.tab?.id == null) return { ok: false };
            const site = LCSites.find(sender.url, configuredSites);
            if (!site || (site.provider === 'gitea' && !await chrome.permissions.contains({ origins: [LCSites.permission(site)] }))) return { ok: false };
            return message.type === 'LC_CACHE_OPEN' ? navCache.open(sender.tab.id, site.baseUrl, message.account) : navCache.put(sender.tab.id, site.baseUrl, message.token, message.key, message.entry);
        }).then(reply).catch(() => reply({ ok: false }));
        return true;
    }
    if (!trusted(sender)) return;
    if (message.type === 'LC_SITES_SYNC' && !sender.tab) { syncSites().then(() => reply({ ok: true })).catch(() => reply({ ok: false })); return true; }
    if (message.type === 'LC_NOTE_WRITE') {
        pending = pending.then(() => LCNotes.write(chrome.storage.local, message))
            .then(reply).catch(() => reply({ ok: false, error: 'NOTE_SAVE' }));
        return true;
    }
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
        pending = pending.then(() => navCache.clear()).catch(() => {});
        pending.then(() => chrome.tabs.query({})).then(async (tabs) => {
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

// Persist registration, not arbitrary all-sites injection. Runtime checks the exact origin/path.
let registrationWork = Promise.resolve();
function syncSites() {
    registrationWork = registrationWork.catch(() => {}).then(async () => {
        configuredSites = (await chrome.storage.local.get('giteaSites')).giteaSites || [];
        const matches = [];
        for (const raw of configuredSites) {
            const site = LCSites.normalize(raw);
            if (site && await chrome.permissions.contains({ origins: [LCSites.permission(site)] })) matches.push(LCSites.permission(site));
        }
        const old = (await chrome.scripting.getRegisteredContentScripts({ ids: ['lc-gitea'] }))[0];
        if (!matches.length) { if (old) await chrome.scripting.unregisterContentScripts({ ids: ['lc-gitea'] }); return; }
        const spec = { id: 'lc-gitea', matches: [...new Set(matches)], js: chrome.runtime.getManifest().content_scripts[0].js,
            runAt: 'document_idle', allFrames: false, world: 'ISOLATED', persistAcrossSessions: true };
        if (old) await chrome.scripting.updateContentScripts([spec]); else await chrome.scripting.registerContentScripts([spec]);
    });
    return registrationWork;
}
chrome.tabs.onRemoved.addListener(tab => { pending = pending.then(() => navCache.drop(tab)).catch(() => {}); });
chrome.permissions.onAdded.addListener(() => { void syncSites().catch(() => {}); });
chrome.permissions.onRemoved.addListener(() => { chrome.tabs.query({}).then(tabs => Promise.all(tabs.filter(t => t.id != null).map(t => chrome.tabs.sendMessage(t.id, { type: 'LC_SITE_REVOKED' }).catch(() => {})))).catch(() => {}); void syncSites().catch(() => {}); pending = pending.then(() => navCache.clear()).catch(() => {}); });
chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.giteaSites) { configuredSites = changes.giteaSites.newValue || []; void syncSites().catch(() => {}); }
    if (changes.preferences && !LC.normalize(changes.preferences.newValue).enabled) pending = pending.then(() => navCache.clear()).catch(() => {});
});
void ready.then(syncSites).catch(() => {});
