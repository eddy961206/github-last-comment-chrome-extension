/* Same-origin, read-only GitHub transport. No extension/network proxy. */
(() => {
    'use strict';
    const fail = (code, status = 0) => Object.assign(new Error(code), { code, status });
    const QUERY = 'NewTimelinePaginationFrontQuery';
    const FALLBACK = 'c652a4589fe3db2aa2c32d0577666ec3';
    class Transport {
        constructor() { this.hash = FALLBACK; this.active = 0; this.queue = []; this.next = 0; this.limitedUntil = 0; this.timer = null; this.own = new Set(); this.counts = { requests: 0, pages: 0 }; this.observe(); }
        observe() {
            const learn = entry => {
                try {
                    if (this.own.has(entry.name))
                        return;
                    const u = new URL(entry.name);
                    if (u.origin !== 'https://github.com' || u.pathname !== '/_graphql')
                        return;
                    const q = JSON.parse(u.searchParams.get('body') || 'null');
                    if (q?.persistedQueryName === QUERY && /^[a-f\d]{32,64}$/i.test(q.query))
                        this.hash = q.query;
                }
                catch { }
            };
            try {
                performance.getEntriesByType('resource').forEach(learn);
                this.observer = new PerformanceObserver(list => list.getEntries().forEach(learn));
                this.observer.observe({ type: 'resource' });
            }
            catch { }
        }
        request(url, kind, signal, priority = 0) {
            if (signal?.aborted)
                return Promise.reject(fail('ABORTED'));
            const u = new URL(url);
            if (u.origin !== 'https://github.com' || !((kind === 'html' && LCParser.parseConversationUrl(url)) || (kind === 'json' && u.pathname === '/_graphql')))
                return Promise.reject(fail('SUBJECT'));
            if (Date.now() < this.limitedUntil)
                return Promise.reject(fail('RATE_LIMIT'));
            return new Promise((resolve, reject) => {
                const job = { url, kind, signal, resolve, reject, priority };
                job.abort = () => { const i = this.queue.indexOf(job); if (i >= 0) {
                    this.queue.splice(i, 1);
                    reject(fail('ABORTED'));
                } };
                signal?.addEventListener('abort', job.abort, { once: true });
                this.queue.push(job);
                this.queue.sort((a, b) => b.priority - a.priority);
                this.pump();
            });
        }
        pump() {
            clearTimeout(this.timer);
            this.timer = null;
            if (this.active >= 2 || !this.queue.length)
                return;
            if (Date.now() < this.limitedUntil) {
                for (const q of this.queue.splice(0)) {
                    q.signal?.removeEventListener('abort', q.abort);
                    q.reject(fail('RATE_LIMIT'));
                }
                return;
            }
            const delay = this.next - Date.now();
            if (delay > 0) {
                this.timer = setTimeout(() => this.pump(), delay);
                return;
            }
            const job = this.queue.shift();
            job.signal?.removeEventListener('abort', job.abort);
            if (job.signal?.aborted) {
                job.reject(fail('ABORTED'));
                this.pump();
                return;
            }
            this.active++;
            this.next = Date.now() + 350;
            this.perform(job).then(job.resolve, job.reject).finally(() => { this.active--; this.pump(); });
            if (this.queue.length)
                this.timer = setTimeout(() => this.pump(), 350);
        }
        async perform(job) {
            const c = new AbortController();
            let timeout = false;
            const abort = () => c.abort();
            job.signal?.addEventListener('abort', abort, { once: true });
            if (job.signal?.aborted)
                c.abort();
            const timer = setTimeout(() => { timeout = true; c.abort(); }, 15000);
            this.counts.requests++;
            try {
                const response = await fetch(job.url, { method: 'GET', credentials: 'same-origin', cache: 'no-cache', signal: c.signal, headers: { Accept: job.kind === 'html' ? 'text/html' : 'application/json', 'X-Requested-With': 'XMLHttpRequest' } });
                if (Number(response.headers.get('content-length') || 0) > 12000000)
                    throw fail('TOO_LARGE');
                // Stop streaming before an undeclared oversized response exhausts memory.
                const reader = response.body?.getReader();
                let text = '';
                if (reader) {
                    const decoder = new TextDecoder();
                    let bytes = 0;
                    try {
                        while (true) {
                            const chunk = await reader.read();
                            if (chunk.done)
                                break;
                            bytes += chunk.value.byteLength;
                            if (bytes > 12000000) {
                                await reader.cancel();
                                throw fail('TOO_LARGE');
                            }
                            text += decoder.decode(chunk.value, { stream: true });
                        }
                        text += decoder.decode();
                    }
                    finally {
                        reader.releaseLock();
                    }
                }
                else {
                    text = await response.text();
                    if (text.length > 12000000)
                        throw fail('TOO_LARGE');
                }
                if (response.status === 429 || (response.status === 403 && (response.headers.get('x-ratelimit-remaining') === '0' || response.headers.has('retry-after') || /rate limit|abuse detection/i.test(text)))) {
                    const r = response.headers.get('retry-after') || '', delay = /^\d+$/.test(r) ? Number(r) * 1000 : Date.parse(r) - Date.now();
                    this.limitedUntil = Date.now() + Math.min(3600000, Math.max(60000, Number.isFinite(delay) ? delay : 60000));
                    throw fail('RATE_LIMIT', response.status);
                }
                if (response.status === 401 || response.status === 403)
                    throw fail('AUTH', response.status);
                if (!response.ok)
                    throw fail(job.kind === 'json' && response.status === 422 ? 'QUERY' : 'HTTP', response.status);
                const actual = new URL(response.url || job.url);
                if (actual.origin !== 'https://github.com')
                    throw fail('SUBJECT');
                if (/^\/(login|sessions?|sso)(\/|$)/.test(actual.pathname))
                    throw fail('AUTH');
                if (job.kind === 'html' && LCParser.parseConversationUrl(actual.href)?.key !== LCParser.parseConversationUrl(job.url)?.key)
                    throw fail('SUBJECT');
                return text;
            }
            catch (e) {
                if (job.signal?.aborted)
                    throw fail('ABORTED');
                if (timeout)
                    throw fail('TIMEOUT');
                if (e.code)
                    throw e;
                throw fail('NETWORK');
            }
            finally {
                clearTimeout(timer);
                job.signal?.removeEventListener('abort', abort);
            }
        }
        async issue(info, me, parent, options = {}) {
            const c = new AbortController();
            let timeout = false;
            const abort = () => c.abort();
            parent?.addEventListener('abort', abort, { once: true });
            if (parent?.aborted)
                c.abort();
            const timer = setTimeout(() => { timeout = true; c.abort(); }, 120000);
            try {
                const html = await this.request(info.url, 'html', c.signal, options.before ? 1 : 0);
                return await LCParser.parseLastComment(html, info, me, c.signal, async (id, cursor, count, signal) => {
                    const body = { persistedQueryName: QUERY, query: this.hash, variables: { count, cursor, id, skip: null } };
                    const url = 'https://github.com/_graphql?body=' + encodeURIComponent(JSON.stringify(body));
                    this.own.add(url);
                    if (this.own.size > 300)
                        this.own.delete(this.own.values().next().value);
                    const raw = await this.request(url, 'json', signal, options.before ? 1 : 0);
                    this.counts.pages++;
                    let json;
                    try {
                        json = JSON.parse(raw);
                    }
                    catch {
                        throw fail('JSON');
                    }
                    if (!json?.data)
                        throw fail('JSON');
                    return json;
                }, options);
            }
            catch (e) {
                if (timeout && !parent?.aborted)
                    throw fail('ISSUE_TIMEOUT');
                throw e;
            }
            finally {
                clearTimeout(timer);
                parent?.removeEventListener('abort', abort);
            }
        }
        destroy() { clearTimeout(this.timer); this.observer?.disconnect(); for (const job of this.queue.splice(0)) {
            job.signal?.removeEventListener('abort', job.abort);
            job.reject(fail('ABORTED'));
        } this.own.clear(); }
    }
    globalThis.LCTransport = Transport;
})();
