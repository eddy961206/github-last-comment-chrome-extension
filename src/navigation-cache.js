/* Memory-only browser session cache, accessed through the trusted worker. */
(() => {
    'use strict';
    const KEY = 'lc-navigation:v1';
    class NavigationCache {
        constructor(storage) { this.storage = storage; }
        async read() { const raw = (await this.storage.get(KEY))[KEY]; return Array.isArray(raw) ? raw : []; }
        async write(buckets) {
            while (buckets.length > 16) buckets.shift();
            while (JSON.stringify(buckets).length > 1000000 && buckets.length) {
                if (buckets[0].entries.length) buckets[0].entries.shift(); else buckets.shift();
            }
            await this.storage.set({ [KEY]: buckets });
        }
        async open(tab, site, account) {
            account = typeof account === 'string' ? account.slice(0, 256).toLowerCase() : '';
            const all = await this.read();
            const previous = all.find(b => b.tab === tab && b.site === site && b.account === account);
            const bucket = { tab, site, account, token: crypto.randomUUID(), entries: previous?.entries || [] };
            const rest = all.filter(b => b.tab !== tab); rest.push(bucket); await this.write(rest);
            return { ok: true, token: bucket.token, entries: bucket.entries };
        }
        async put(tab, site, token, key, entry) {
            if (typeof key !== 'string' || key.length > 800 || !entry || JSON.stringify(entry).length > 150000) return { ok: false };
            if (!entry.value && !entry.error) return { ok: false };
            if (entry.value && !['comment', 'none'].includes(entry.value.kind)) return { ok: false };
            const all = await this.read(), bucket = all.find(b => b.tab === tab && b.site === site && b.token === token);
            if (!bucket || !key.startsWith(bucket.account + '|')) return { ok: false };
            bucket.entries = bucket.entries.filter(([k]) => k !== key); bucket.entries.push([key, entry]);
            while (bucket.entries.length > 80) bucket.entries.shift();
            all.splice(all.indexOf(bucket), 1); all.push(bucket); await this.write(all);
            return { ok: true };
        }
        async drop(tab) { await this.write((await this.read()).filter(b => b.tab !== tab)); }
        async clear() { await this.storage.remove(KEY); }
    }
    globalThis.LCNavigationCache = NavigationCache;
})();
