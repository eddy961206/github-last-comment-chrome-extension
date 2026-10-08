/* Gitea web deployment: account-local Web Storage, Web Locks and same-origin UI.
 * This adapter does not read credentials, issue writes or call extension APIs. */
(() => {
    'use strict';
    const script = document.querySelector('script[data-lc-base]');
    const basePath = script?.dataset.lcBase;
    if (typeof basePath !== 'string') throw new Error('LC_WEB_BASE');
    const site = LCSites.normalize(location.origin + basePath);
    if (!site) throw new Error('LC_WEB_SITE');
    const settingsPage = document.body.hasAttribute('data-lc-web-page');
    const account = (settingsPage ? new URL(location.href).searchParams.get('account') || '' : LCSites.login(document, site)).toLowerCase();
    if (account && !/^[a-z0-9][a-z0-9_.-]{0,63}$/.test(account)) throw new Error('LC_WEB_ACCOUNT');
    const prefix = 'lc-web:v1:' + encodeURIComponent(site.baseUrl) + ':' + encodeURIComponent(account) + ':';
    const listeners = new Set(), messages = new Set();
    const channel = new BroadcastChannel(prefix);
    const defaults = { ...LC.defaults, language: navigator.language.toLowerCase().startsWith('ko') ? 'ko' : 'en' };
    function notify(changes) { for (const listener of listeners) listener(changes, 'local'); }
    const local = {
        async get(keys) {
            const names = typeof keys === 'string' ? [keys] : keys;
            const result = {};
            for (const key of names) {
                if (key === 'giteaSites') { result[key] = [site.baseUrl]; continue; }
                const raw = localStorage.getItem(prefix + key);
                if (raw !== null) result[key] = JSON.parse(raw);
                else if (key === 'preferences') result[key] = defaults;
            }
            return result;
        },
        async set(values) {
            const changes = {};
            for (const [key, value] of Object.entries(values)) {
                if (key === 'giteaSites') throw new Error('LC_WEB_SITE_FIXED');
                const oldValue = (await local.get(key))[key];
                localStorage.setItem(prefix + key, JSON.stringify(value));
                changes[key] = { oldValue, newValue: value };
            }
            notify(changes);
        },
        async remove(keys) {
            const changes = {};
            for (const key of typeof keys === 'string' ? [keys] : keys) {
                changes[key] = { oldValue: (await local.get(key))[key] };
                localStorage.removeItem(prefix + key);
            }
            notify(changes);
        }
    };
    window.addEventListener('storage', event => {
        if (event.storageArea !== localStorage || !event.key?.startsWith(prefix)) return;
        const key = event.key.slice(prefix.length);
        // Internal epochs are raw UUIDs, not preference JSON. Restored pages
        // check them on cache-open; active pages also receive the broadcast.
        if (key === 'cache-epoch') return;
        notify({ [key]: { oldValue: event.oldValue === null ? undefined : JSON.parse(event.oldValue), newValue: event.newValue === null ? undefined : JSON.parse(event.newValue) } });
    });
    const session = {
        async get(key) { const raw = sessionStorage.getItem(prefix + key); return raw === null ? {} : { [key]: JSON.parse(raw) }; },
        async set(values) { for (const [key, value] of Object.entries(values)) sessionStorage.setItem(prefix + key, JSON.stringify(value)); },
        async remove(key) { sessionStorage.removeItem(prefix + key); }
    };
    const cache = new LCNavigationCache(session), cacheKey = 'lc-navigation:v1';
    // Keep a document-local epoch too: another document in the same tab can
    // update sessionStorage while an older document remains in Back/Forward cache.
    let observedEpoch = sessionStorage.getItem(prefix + 'cache-epoch');
    let pending = Promise.resolve();
    function serial(action) { const result = pending.then(action); pending = result.catch(() => {}); return result; }
    function sendContent(message) {
        let result;
        for (const listener of messages) listener(message, { id: 'lc-gitea-web' }, value => { result = value; });
        return result;
    }
    async function clearCache(broadcast) {
        await cache.clear();
        sendContent({ type: 'LC_CLEAR_CACHE' });
        if (broadcast) channel.postMessage({ type: 'clear-cache' });
    }
    channel.addEventListener('message', event => {
        if (event.data?.type === 'clear-cache') void serial(() => clearCache(false));
    });
    const metrics = new Set(['lists', 'previews', 'lookups', 'failures', 'cache']);
    const diagnosticQueries = new Map();
    channel.addEventListener('message', event => {
        const message = event.data;
        if (message?.type === 'diagnostic-query') {
            const report = sendContent({ type: 'LC_DIAGNOSTICS' });
            if (report) channel.postMessage({ type: 'diagnostic-reply', id: message.id, report });
        }
        if (message?.type === 'diagnostic-reply' && diagnosticQueries.has(message.id)) diagnosticQueries.get(message.id).push(message.report);
    });
    const runtime = {
        id: 'lc-gitea-web',
        getManifest: () => ({ version: '1.3.4-gitea' }),
        onMessage: { addListener: listener => messages.add(listener) },
        async sendMessage(message) {
            if (message.type === 'LC_CACHE_OPEN') return serial(async () => {
                if (message.account.toLowerCase() !== account) { await cache.clear(); return { ok: false }; }
                const epoch = localStorage.getItem(prefix + 'cache-epoch') || '';
                const oldEpoch = observedEpoch;
                const invalidated = oldEpoch !== null && oldEpoch !== epoch;
                if (oldEpoch !== epoch) {
                    await session.remove(cacheKey); sessionStorage.setItem(prefix + 'cache-epoch', epoch);
                }
                observedEpoch = epoch;
                return { ...await cache.open('web-tab', site.baseUrl, account), invalidated };
            });
            if (message.type === 'LC_CACHE_PUT') return serial(() => cache.put('web-tab', site.baseUrl, message.token, message.key, message.entry));
            if (message.type === 'LC_NOTE_WRITE') return navigator.locks.request(prefix + 'note:' + message.key, () => LCNotes.write(local, message));
            if (message.type === 'LC_METRIC' && metrics.has(message.metric)) return navigator.locks.request(prefix + 'counters', async () => {
                const values = await local.get(['preferences', 'counters']);
                if (LC.normalize(values.preferences).localStats) {
                    const counters = {};
                    for (const key of metrics) counters[key] = Math.min(1e9, Math.max(0, Math.trunc(Number(values.counters?.[key]) || 0)));
                    counters[message.metric] = Math.min(1e9, counters[message.metric] + 1);
                    await local.set({ counters });
                }
                return { ok: true };
            });
            if (message.type === 'LC_CLEAR_COUNTERS') { await local.remove('counters'); return { ok: true }; }
            if (message.type === 'LC_CLEAR_CACHE') return serial(async () => {
                localStorage.setItem(prefix + 'cache-epoch', crypto.randomUUID());
                await clearCache(true); return { ok: true };
            });
            if (message.type === 'LC_DIAGNOSTICS') {
                const id = crypto.randomUUID(), reports = [], own = sendContent(message);
                if (own) reports.push(own);
                diagnosticQueries.set(id, reports); channel.postMessage({ type: 'diagnostic-query', id });
                await new Promise(resolve => setTimeout(resolve, 500)); diagnosticQueries.delete(id);
                return { schemaVersion: 1, version: runtime.getManifest().version, localOnly: true, pages: reports };
            }
            if (message.type === 'LC_OPTIONS') { runtime.openOptionsPage(); return { ok: true }; }
            if (message.type === 'LC_SITE_ACCESS') return { ok: true, allowed: true };
            throw new Error('LC_WEB_MESSAGE');
        },
        openOptionsPage() {
            const url = new URL(site.baseUrl + '/assets/last-comment/options.html'); url.searchParams.set('account', account);
            window.open(url.href, '_blank', 'noopener');
        }
    };
    listeners.add(changes => { if (changes.preferences && !LC.normalize(changes.preferences.newValue).localStats) void local.remove('counters'); });
    if (!settingsPage && account) {
        const menu = document.querySelector('#navbar .navbar-right');
        if (menu) {
            const link = document.createElement('a'); link.className = 'item'; link.textContent = 'Last Comment';
            link.href = site.baseUrl + '/assets/last-comment/options.html?account=' + encodeURIComponent(account);
            link.target = '_blank'; link.rel = 'noopener'; link.dataset.lcWebSettings = ''; menu.prepend(link);
        }
    }
    globalThis.LCWeb = { storage: { local, onChanged: { addListener: listener => listeners.add(listener) } }, runtime, site, account };
})();
