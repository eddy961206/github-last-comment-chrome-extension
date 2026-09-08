/* Device-local, explicit-save issue notes. No telemetry, sync, or network. */
(() => {
    'use strict';
    const PREFIX = 'lc-note:v1:', MAX_CHARS = 4000;
    const validKey = key => typeof key === 'string' && /^lc-note:v1:[a-f0-9]{64}$/.test(key);
    const empty = () => ({ text: '', pinned: false, revision: '' });
    function normalize(value) {
        if (!value || typeof value.text !== 'string') return empty();
        return { text: value.text.slice(0, MAX_CHARS), pinned: value.pinned === true,
            revision: typeof value.revision === 'string' ? value.revision.slice(0, 100) : '' };
    }
    async function keyFor(info) {
        if (!info || typeof info.key !== 'string' || !/^[^/]+\/[^#]+#\d+$/.test(info.key)) throw new Error('NOTE_KEY');
        const bytes = new TextEncoder().encode('github.com|' + info.key.toLowerCase());
        const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
        return PREFIX + [...hash].map(x => x.toString(16).padStart(2, '0')).join('');
    }
    // The service worker serializes calls to this function. Per-issue keys avoid
    // whole-notebook overwrites; revisions prevent silent lost edits between tabs.
    async function write(storage, request) {
        const { key, expectedRevision, value } = request;
        if (!validKey(key) || typeof expectedRevision !== 'string' || !value ||
            typeof value.text !== 'string' || value.text.length > MAX_CHARS || typeof value.pinned !== 'boolean')
            return { ok: false, error: 'NOTE_INVALID' };
        const saved = normalize((await storage.get(key))[key]);
        if (saved.revision !== expectedRevision) return { ok: false, error: 'NOTE_CONFLICT', value: saved };
        if (!value.text.trim()) {
            await storage.remove(key); return { ok: true, value: empty() };
        }
        const next = { text: value.text, pinned: value.pinned, revision: crypto.randomUUID() };
        await storage.set({ [key]: next });
        return { ok: true, value: next };
    }
    globalThis.LCNotes = Object.freeze({ PREFIX, MAX_CHARS, validKey, normalize, empty, keyFor, write });
})();
