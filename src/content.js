/* Isolated-world content script. Page/account content never enters extension storage. */
(async () => {
    'use strict';
    if (globalThis.__lastCommentExtension)
        return;
    globalThis.__lastCommentExtension = true;
    const OWN = 'data-lc-owned', ROW = '[data-testid="issue-row"],[data-testid="pull-request-row"],[data-testid="list-row"],[data-testid="list-view-item"],[data-listview-item-id],.js-issue-row,.Box-row,[role="row"],[role="listitem"],li';
    const LINKS = 'a[href*="/issues/"],a[href*="/pull/"]';
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(LCStyles + LCRecency.css);
    let prefs = LC.normalize((await chrome.storage.local.get('preferences')).preferences);
    let transport = new LCTransport(), records = new Map(), cache = new Map(), queue = new Set(), jobs = new Map();
    let current = '', account = '', bar = null, popup = null, timer = null, scanTimer = null, dirty = new Set(), full = true, paused = false, duplicate = false;
    let timestampTimer = null;
    let previewTimer = null, closingTimer = null, hovered = null, dismissed = null, suppressHover = false, pointer = null;
    const technical = { requests: 0, verified: 0, failures: 0, cacheHits: 0, previews: 0, scans: 0 };
    const t = (key, vars) => LC.t(key, prefs.language, vars), own = n => n?.nodeType === 1 && n.closest(`[${OWN}]`);
    const node = (tag, cls, text) => { const n = document.createElement(tag); if (cls)
        n.className = cls; if (text != null)
        n.textContent = text; return n; };
    function icon(type) { const paths = { comment: 'M3 3h10v8H6l-3 2V3Z', refresh: 'M13 6a5 5 0 1 0 0 4M13 2v4H9', settings: 'M2 4h12M2 8h12M2 12h12M5 2v4M10 6v4M6 10v4', pause: 'M5 3v10M11 3v10', play: 'm5 3 7 5-7 5Z' }; const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); for (const [k, v] of Object.entries({ viewBox: '0 0 16 16', width: '14', height: '14', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.4', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' }))
        svg.setAttribute(k, v); const p = document.createElementNS(svg.namespaceURI, 'path'); p.setAttribute('d', paths[type] || paths.comment); svg.append(p); return svg; }
    function button(key, action, cls = 'action', glyph) { const b = node('button', cls); b.type = 'button'; b.title = t(key); b.setAttribute('aria-label', t(key)); if (glyph)
        b.append(icon(glyph));
    else
        b.textContent = t(key); b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); action(e); }); return b; }
    function theme() { const h = document.documentElement, mode = h.getAttribute('data-color-mode'); return mode === 'dark' || (mode === 'auto' && matchMedia('(prefers-color-scheme:dark)').matches) || (!mode && matchMedia('(prefers-color-scheme:dark)').matches) ? 'dark' : 'light'; }
    function host() { const h = node('div'); h.setAttribute(OWN, ''); h.dataset.theme = theme(); const shadow = h.attachShadow({ mode: 'open' }); shadow.adoptedStyleSheets = [sheet]; return h; }
    function kind() { const p = location.pathname.replace(/\/$/, ''); if (/^\/[^/]+\/[^/]+\/(issues|pulls)$/.test(p) || /^\/(issues|pulls)(\/(assigned|mentioned|created|recent|review-requested))?$/.test(p))
        return 'list'; if (p === '/search' && !['code', 'repositories', 'commits', 'users', 'discussions'].includes(new URLSearchParams(location.search).get('type')))
        return 'search'; return ''; }
    function login() { return (document.querySelector('meta[name="user-login"]')?.content || '').replace(/^@/, ''); }
    const identity = () => location.pathname + location.search + '|' + login().toLowerCase();
    const allowed = () => prefs.enabled && !paused && !duplicate && !!kind() && document.visibilityState !== 'hidden' && navigator.onLine !== false;
    function metric(name) { if (prefs.localStats)
        chrome.runtime.sendMessage({ type: 'LC_METRIC', metric: name }).catch(() => { }); }
    function signature(row) { const times = [...row.querySelectorAll('relative-time[datetime],time[datetime]')].filter(n => !own(n)).map(n => n.getAttribute('datetime')); const counts = [...row.querySelectorAll('[data-testid="comments-count"],a:has(.octicon-comment)')].filter(n => !own(n)).map(n => n.textContent.trim()); return JSON.stringify([times, counts]); }
    function discover(root = document.querySelector('main,[role="main"]') || document.body) { const byRow = new Map(), links = [...(root?.querySelectorAll?.(LINKS) || [])]; if (root?.matches?.(LINKS))
        links.unshift(root); for (const link of links) {
        if (own(link) || link.closest('.markdown-body,.comment-body,header,nav,[role="dialog"],[role="tooltip"]'))
            continue;
        const info = LCParser.parseConversationUrl(link.href), text = link.textContent.trim();
        if (!info || !text || /^#?\d+$/.test(text) || new URL(link.href).hash)
            continue;
        const row = link.closest(ROW) || link.parentElement;
        const score = Math.min(text.length, 100) + (link.matches('[data-testid*="title"],.js-navigation-open,.Link--primary') ? 1000 : 0);
        const old = byRow.get(row);
        if (!old || old.score < score)
            byRow.set(row, { link, row, info, score });
    } return [...byRow.values()]; }
    const near = new IntersectionObserver(entries => { for (const e of entries) {
        const r = records.get(e.target);
        if (!r)
            continue;
        r.near = e.isIntersecting;
        r.inView = e.isIntersecting && e.boundingClientRect.top < innerHeight && e.boundingClientRect.bottom > 0;
        if (r.near)
            enqueue(r);
        else if (queue.delete(r)) {
            r.state = r.value ? 'done' : 'idle';
            paint(r);
        }
    } pump(); }, { rootMargin: '220px 0px' });
    const inView = new IntersectionObserver(entries => { for (const e of entries) {
        const r = records.get(e.target);
        if (!r)
            continue;
        r.inView = e.isIntersecting;
        if (r.inView) {
            r.near = true;
            enqueue(r);
        }
    } });
    function anchorFor(r) { let a = r.link.closest('h1,h2,h3,h4,h5,h6,[role="heading"],[data-testid="list-view-item-title-container"],[data-testid="issue-title-container"]') || r.link; if (!r.row.contains(a))
        a = r.link; while (a.parentElement !== r.row && a.parentElement && getComputedStyle(a.parentElement).display === 'inline')
        a = a.parentElement; while (a.nextElementSibling?.matches('.Label,[data-testid="issue-label"],[data-testid="label"]'))
        a = a.nextElementSibling; return a; }
    const layouts = new Map();
    function mount(r) { const a = anchorFor(r), parent = a.parentElement; r.anchor = a; r.host.style.cssText = 'display:block;clear:both;flex:0 0 calc(100% - 24px);grid-column:1/-1;min-width:0;max-width:calc(100% - 24px);margin:3px 0 3px 24px;'; if (parent && ['flex', 'inline-flex'].includes(getComputedStyle(parent).display) && !getComputedStyle(parent).flexDirection.startsWith('column')) {
        if (!layouts.has(parent))
            layouts.set(parent, { value: parent.style.flexWrap, priority: parent.style.getPropertyPriority('flex-wrap'), users: new Set() });
        layouts.get(parent).users.add(r);
        parent.style.setProperty('flex-wrap', 'wrap', 'important');
        r.layout = parent;
    } a.insertAdjacentElement('afterend', r.host); }
    function make(item) { const r = { ...item, host: host(), signature: signature(item.row), state: 'idle', value: null, at: 0, error: null, near: false, inView: false, force: false }; records.set(r.link, r); mount(r); r.host.addEventListener('pointerenter', e => { if (e.pointerType === 'touch')
        return; hovered = r; clearTimeout(closingTimer); clearTimeout(previewTimer); if (suppressHover || popup?.type === 'settings')
        return; dismissed = null; previewTimer = setTimeout(() => openPreview(r), 160); }); r.host.addEventListener('pointerleave', () => { if (hovered === r)
        hovered = null; clearTimeout(previewTimer); scheduleClose(); }); r.host.addEventListener('focusin', e => { if (!e.composedPath().some(n => n?.classList?.contains('reload')))
        openPreview(r); }); r.host.addEventListener('focusout', scheduleClose); r.host.addEventListener('keydown', e => { if (e.key === 'ArrowDown' && r.value?.kind === 'comment') {
        e.preventDefault();
        dismissed = null;
        suppressHover = false;
        openPreview(r);
        popup?.body.focus();
    } }); near.observe(r.link); inView.observe(r.link); paint(r); return r; }
    function remove(r) { queue.delete(r); r.job?.subscribers.delete(r); if (r.job && !r.job.subscribers.size)
        r.job.controller.abort(); near.unobserve(r.link); inView.unobserve(r.link); if (popup?.record === r)
        closePopup(); r.host.remove(); records.delete(r.link); if (!records.size) { clearTimeout(timestampTimer); timestampTimer = null; } if (r.layout) {
        const state = layouts.get(r.layout);
        state?.users.delete(r);
        if (state && !state.users.size) {
            if (state.value)
                r.layout.style.setProperty('flex-wrap', state.value, state.priority);
            else
                r.layout.style.removeProperty('flex-wrap');
            layouts.delete(r.layout);
        }
    } }
    const ttl = r => r.kind === 'none' ? 60000 : prefs.cacheMinutes * 60000;
    function paint(r) {
        if (r.timestamp) LCRecency.update(r.timestamp, prefs);
        const data = r.value, stale = !!data && (Date.now() - r.at >= ttl(data) || r.force || !!r.error);
        const type = data?.kind === 'none' ? 'none' : data ? account && data.author.toLowerCase() === account.toLowerCase() ? 'mine' : data.mentionsMe ? 'mention' : data.isBot ? 'bot' : 'other' : r.error ? 'error' : r.state === 'loading' ? 'busy' : 'idle';
        r.host.hidden = !!data && data.kind === 'none' && !prefs.noComments && !stale;
        if (r.host.hidden)
            r.host.style.display = 'none';
        else
            r.host.style.display = 'block';
        const key = JSON.stringify([data?.commentUrl, data?.author, data?.avatar, data?.time, type, stale, r.state, !!r.error, prefs.language, prefs.avatars, prefs.timeZone, paused]);
        if (key === r.paintKey)
            return;
        r.paintKey = key;
        const root = r.host.shadowRoot;
        const active = root.activeElement?.className;
        const line = node('div', 'line'), label = node('span', 'label', t('last') + ' :');
        const chip = node('span', `chip ${type}${stale ? ' stale' : ''}${r.state === 'loading' ? ' busy' : ''}`);
        chip.setAttribute('aria-busy', String(r.state === 'loading'));
        const main = node(data?.kind === 'comment' ? 'a' : 'span', 'main');
        r.timestamp = null;
        if (data?.kind === 'comment') {
            main.href = data.commentUrl;
            main.addEventListener('click', e => e.stopPropagation());
            main.setAttribute('aria-label', `${t('preview')}: @${data.author}, ${LC.date(data.time, prefs, true)}`);
            main.setAttribute('aria-expanded', String(popup?.record === r));
            if (prefs.avatars) {
                const avatar = node('span', 'avatar', (data.author[0] || '?').toUpperCase()), url = LCParser.safeAvatar(data.avatar);
                if (url) {
                    const img = node('img', 'avatar');
                    img.src = url;
                    img.width = 16;
                    img.height = 16;
                    img.alt = '';
                    img.loading = 'lazy';
                    img.decoding = 'async';
                    img.referrerPolicy = 'no-referrer';
                    img.onerror = () => img.replaceWith(avatar);
                    main.append(img);
                }
                else
                    main.append(avatar);
            }
            r.timestamp = LCRecency.create(data.time, prefs);
            main.append(node('span', 'author', data.author ? '@' + data.author : t('unknown')), r.timestamp.element);
        }
        else
            main.textContent = data ? t('none') : r.error ? t('failed') : paused ? t('paused') : r.state === 'loading' ? t('loading') : t('queued');
        if (r.error)
            main.title = t('error_' + r.error.code);
        else if (data)
            main.title = `${t('checked')}: ${LC.date(r.at, prefs, true)}${stale ? ' · ' + t('previous') : ''}`;
        chip.append(main);
        const flag = stale ? t('previous') : ['mine', 'mention', 'bot'].includes(type) ? t(type) : '';
        if (flag)
            chip.append(node('span', 'flag', flag));
        if (data?.kind === 'comment') {
            r.peek = button('preview', () => { dismissed = null; suppressHover = false; openPreview(r); }, 'action peek', 'comment');
            chip.append(r.peek);
        }
        const reload = button('retry', () => enqueue(r, true), 'action reload', 'refresh');
        reload.disabled = r.state === 'loading' || r.state === 'queued' || !allowed() || Date.now() < transport.limitedUntil;
        chip.append(reload);
        line.append(label, chip);
        root.replaceChildren(line);
        r.chip = chip;
        r.primary = main;
        if (r.timestamp && timestampTimer === null) refreshTimestamps();
        if (active) {
            const focus = [...root.querySelectorAll('button,a')].find(n => n.className === active);
            focus?.focus({ preventScroll: true });
        }
        if (popup?.record === r)
            updatePreview();
        updateBar();
    }
    // One lightweight clock per page, independent of request pause/cache settings.
    // Only timestamp spans change; avatars, focus and an open preview are untouched.
    function refreshTimestamps() {
        clearTimeout(timestampTimer);
        timestampTimer = null;
        if (!prefs.enabled || !kind() || current !== identity() || document.hidden) return;
        const now = Date.now();
        let count = 0, delay = 30000;
        for (const r of records.values()) {
            if (!r.link.isConnected || !r.timestamp?.element.isConnected) continue;
            const state = LCRecency.update(r.timestamp, prefs, now);
            delay = Math.min(delay, state.nextDelay);
            count++;
        }
        if (count) timestampTimer = setTimeout(refreshTimestamps, delay);
    }
    function enqueue(r, force = false) { if (!r.link.isConnected || (!r.near && !force) || r.job)
        return; if (!force && r.value && !r.force && Date.now() - r.at < ttl(r.value))
        return; if (!force && r.error && Date.now() - (r.failedAt || 0) < 30000)
        return; const key = account.toLowerCase() + '|' + r.info.key + '|' + r.signature; const cached = !force && cache.get(key); if (cached && Date.now() - cached.at < ttl(cached.value)) {
        r.value = cached.value;
        r.at = cached.at;
        r.error = null;
        r.state = 'done';
        technical.cacheHits++;
        metric('cache');
        paint(r);
        return;
    } if (!allowed())
        return; if (Date.now() < transport.limitedUntil) {
        r.error = { code: 'RATE_LIMIT' };
        r.state = 'error';
        paint(r);
        return;
    } r.force ||= force; r.state = 'queued'; r.error = null; queue.add(r); paint(r); queueMicrotask(pump); }
    function pump() { if (!allowed())
        return; for (const r of [...queue])
        if (!r.link.isConnected || (!r.near && !r.force)) {
            queue.delete(r);
            r.state = r.value ? 'done' : 'idle';
            paint(r);
        } for (const r of [...queue]) {
        const key = r.info.key + '|' + r.signature;
        if (jobs.has(key))
            attach(jobs.get(key), r);
    } while (jobs.size < 2 && queue.size) {
        const r = [...queue].sort((a, b) => Number(b.force) - Number(a.force) || Number(b.inView) - Number(a.inView))[0];
        const key = r.info.key + '|' + r.signature;
        const job = { key, info: r.info, signature: r.signature, identity: current, account, controller: new AbortController(), subscribers: new Set() };
        jobs.set(key, job);
        attach(job, r);
        for (const other of [...queue])
            if (other.info.key + '|' + other.signature === key)
                attach(job, other);
        void run(job);
    } }
    function attach(job, r) { queue.delete(r); r.job = job; r.state = 'loading'; job.subscribers.add(r); paint(r); }
    function valid(r, job) { return current === job.identity && identity() === current && records.get(r.link) === r && r.job === job && r.link.isConnected && LCParser.parseConversationUrl(r.link.href)?.key === r.info.key && signature(r.row) === job.signature; }
    async function run(job) {
        try {
            const value = await transport.issue(job.info, job.account, job.controller.signal);
            if (job.controller.signal.aborted)
                return;
            const receivers = [...job.subscribers].filter(r => valid(r, job));
            if (!receivers.length)
                return;
            const entry = { value, at: Date.now() }, key = job.account.toLowerCase() + '|' + job.key;
            cache.delete(key);
            cache.set(key, entry);
            while (cache.size > 80)
                cache.delete(cache.keys().next().value);
            for (const r of receivers) {
                r.value = value;
                r.at = entry.at;
                r.error = null;
                r.force = false;
                r.job = null;
                r.state = 'done';
                paint(r);
            }
            technical.verified++;
            metric('lookups');
        }
        catch (e) {
            if (e.code === 'ABORTED' || job.controller.signal.aborted)
                return;
            technical.failures++;
            metric('failures');
            for (const r of job.subscribers)
                if (valid(r, job)) {
                    r.error = { code: e.code || 'PAGE_SHAPE' };
                    r.failedAt = Date.now();
                    r.state = 'error';
                    r.force = false;
                    r.job = null;
                    paint(r);
                }
        }
        finally {
            for (const r of job.subscribers)
                if (r.job === job) {
                    r.job = null;
                    r.state = r.value ? 'done' : 'idle';
                    if (r.link.isConnected)
                        schedule(r.row);
                }
            if (jobs.get(job.key) === job)
                jobs.delete(job.key);
            technical.requests = transport.counts.requests;
            pump();
            updateBar();
        }
    }
    function cancel() { queue.clear(); for (const j of jobs.values())
        j.controller.abort(); jobs.clear(); for (const r of records.values()) {
        r.job = null;
        if (['loading', 'queued'].includes(r.state)) {
            r.state = r.value ? 'done' : 'idle';
            r.force = false;
            paint(r);
        }
    } }
    function schedule(root) { if (root?.querySelectorAll)
        dirty.add(root);
    else
        full = true; clearTimeout(scanTimer); if (document.visibilityState !== 'hidden')
        scanTimer = setTimeout(scan, 80); }
    function reset() { closePopup(); cancel(); for (const r of [...records.values()])
        remove(r); clearTimeout(timestampTimer); timestampTimer = null; cache.clear(); bar?.remove(); bar = null; current = identity(); account = login(); dirty.clear(); full = true; }
    function scan() {
        scanTimer = null;
        if (current !== identity())
            reset();
        if (!prefs.enabled || !kind() || document.visibilityState === 'hidden')
            return;
        duplicate = !!document.querySelector('.gh-last-comment-author');
        if (duplicate) {
            if (!bar) {
                bar = host();
                bar.shadowRoot.append(node('div', 'notice', t('duplicate')));
                (document.querySelector('main') || document.body).prepend(bar);
            }
            return;
        }
        const roots = full ? [document.querySelector('main,[role="main"]') || document.body] : [...dirty].filter(r => r.isConnected);
        const isFull = full;
        full = false;
        dirty.clear();
        technical.scans++;
        const items = roots.filter((r, i) => !roots.some((other, j) => i !== j && other.contains(r))).flatMap(discover);
        const found = new Set(items.map(x => x.link));
        for (const r of [...records.values()])
            if (!r.link.isConnected || (isFull && !found.has(r.link)))
                remove(r);
        for (const item of items) {
            let r = records.get(item.link);
            if (r && (r.info.key !== item.info.key || r.signature !== signature(item.row) || r.row !== item.row)) {
                remove(r);
                r = null;
            }
            if (!r)
                r = make(item);
            else if (!r.host.isConnected || r.host.previousElementSibling !== r.anchor)
                mount(r);
            if (r.near)
                enqueue(r);
        }
        ensureBar();
        refreshTimestamps();
        if (!timer)
            timer = setTimeout(maintain, 30000);
    }
    function maintain() { timer = null; if (current !== identity()) {
        reset();
        schedule();
        return;
    } if (document.visibilityState !== 'hidden') {
        for (const r of records.values())
            if (r.near) {
                paint(r);
                enqueue(r);
            }
        for (const [k, v] of cache)
            if (Date.now() - v.at > 900000)
                cache.delete(k);
    } if (prefs.enabled && kind())
        timer = setTimeout(maintain, 30000); }
    function ensureBar() { if (!records.size) {
        bar?.remove();
        bar = null;
        return;
    } if (bar?.isConnected)
        return; bar = host(); bar.style.cssText = 'display:block;margin:0 0 10px;max-width:100%;'; const first = records.values().next().value; const list = first.row.closest('ul,ol,table,[role="list"],[role="grid"],.js-navigation-container,[data-testid="list-view-items"]') || first.row.parentElement; const main = document.querySelector('main,[role="main"]') || document.body; if (list && list !== main && main.contains(list))
        list.before(bar);
    else
        main.prepend(bar); renderBar(); metric('lists'); }
    function renderBar() { if (!bar)
        return; const content = node('div', 'bar'), brand = node('span', 'brand'); brand.append(icon('comment'), document.createTextNode(t('shortName'))); const status = node('span', 'status'); status.setAttribute('role', 'status'); const tools = node('div', 'tools'); tools.append(button('refresh', () => { for (const r of records.values())
        if (r.inView)
            enqueue(r, true); }, 'tool'), button(paused ? 'resume' : 'pause', () => { paused = !paused; if (paused)
        cancel();
    else
        for (const r of records.values())
            if (r.near)
                enqueue(r); for (const r of records.values())
        paint(r); renderBar(); }, 'tool')); const settings = button('settings', e => openSettings(e.currentTarget), 'tool'); tools.append(settings); content.append(brand, status, tools); bar.shadowRoot.replaceChildren(content); updateBar(); }
    function updateBar() { const s = bar?.shadowRoot.querySelector('.status'); if (!s)
        return; const text = !prefs.enabled ? t('paused') : navigator.onLine === false ? t('offline') : paused ? t('paused') : Date.now() < transport.limitedUntil ? t('limited') : t('ready', { done: [...records.values()].filter(r => r.value).length, total: records.size }); if (s.textContent !== text)
        s.textContent = text; }
    function showPopup(type, anchor, title) {
        closePopup();
        const h = host();
        h.style.cssText = `position:fixed;inset:auto;margin:0;padding:0;border:0;background:transparent;z-index:2147483647;width:${type === 'settings' ? 320 : 540}px;max-width:calc(100vw - 24px);max-height:calc(100dvh - 24px);overflow:visible;`;
        h.setAttribute('popover', 'manual');
        const panel = node('section', 'panel');
        panel.setAttribute('role', 'region');
        panel.setAttribute('aria-label', title);
        const head = node('div', 'head'), heading = node('div', 'heading', title);
        const close = button('close', () => closePopup(true), 'close');
        close.textContent = '×';
        head.append(heading, close);
        const body = node('div', 'body');
        body.tabIndex = 0;
        const foot = node('div', 'foot');
        panel.append(head, body, foot);
        h.shadowRoot.append(panel);
        document.body.append(h);
        try {
            h.showPopover();
        }
        catch {
            h.removeAttribute('popover');
        }
        popup = { host: h, type, anchor, heading, body, foot, record: null, source: null, controller: new AbortController() };
        const signal = popup.controller.signal;
        h.addEventListener('pointerenter', () => clearTimeout(closingTimer));
        h.addEventListener('pointerleave', () => scheduleClose());
        h.addEventListener('focusin', () => clearTimeout(closingTimer));
        h.addEventListener('focusout', scheduleClose);
        document.addEventListener('pointerdown', e => { if (popup && !e.composedPath().includes(h) && !e.composedPath().includes(popup.anchor) && !e.composedPath().includes(popup.record?.host))
            closePopup(); }, { capture: true, signal });
        document.addEventListener('keydown', e => { if (e.key === 'Escape') {
            e.stopPropagation();
            closePopup(true);
        } }, { capture: true, signal });
        document.addEventListener('scroll', e => { if (popup && !e.composedPath().includes(h))
            position(); }, { capture: true, passive: true, signal });
        window.addEventListener('resize', position, { passive: true, signal });
        window.visualViewport?.addEventListener('resize', position, { passive: true, signal });
        h.shadowRoot.addEventListener('load', position, { capture: true, signal });
        h.shadowRoot.addEventListener('toggle', position, { capture: true, signal });
        h.shadowRoot.addEventListener('error', e => { const image = e.composedPath()[0]; if (image instanceof HTMLImageElement) {
            image.replaceWith(node('span', null, t('imageLink') + ': ' + image.alt));
            position();
        } }, { capture: true, signal });
        return popup;
    }
    function position() {
        if (!popup)
            return;
        const p = popup, h = p.host;
        if (!p.anchor?.isConnected) {
            closePopup();
            return;
        }
        const v = window.visualViewport, w = v?.width || innerWidth, ht = v?.height || innerHeight;
        const left = v?.offsetLeft || 0, top = v?.offsetTop || 0, a = p.anchor.getBoundingClientRect();
        if (a.bottom < top || a.top > top + ht) {
            closePopup();
            return;
        }
        h.style.width = Math.max(120, Math.min(p.type === 'settings' ? 320 : 540, w - 24)) + 'px';
        const below = top + ht - a.bottom - 20, above = a.top - top - 20;
        const ideal = p.type === 'settings' ? 520 : 480;
        const down = below >= Math.min(ideal, 260) || below >= above;
        const room = down ? below : above;
        h.style.maxHeight = Math.max(120, Math.min(ideal, room, ht - 24)) + 'px';
        const r = h.getBoundingClientRect();
        const x = Math.max(left + 12, Math.min(a.left, left + w - r.width - 12));
        const y = Math.max(top + 12, Math.min(down ? a.bottom + 8 : a.top - r.height - 8, top + ht - r.height - 12));
        h.style.left = x + 'px';
        h.style.top = y + 'px';
    }
    function closePopup(restore = false) { clearTimeout(previewTimer); clearTimeout(closingTimer); const p = popup; popup = null; if (!p)
        return; p.controller.abort(); try {
        p.host.hidePopover();
    }
    catch { } p.host.remove(); p.record?.primary?.setAttribute('aria-expanded', 'false'); if (restore) {
        hovered = null;
        dismissed = p.record;
        suppressHover = true;
        const target = p.type === 'preview' ? p.record?.peek : p.anchor;
        target?.focus({ preventScroll: true });
    } }
    function scheduleClose() { clearTimeout(closingTimer); if (popup?.type !== 'preview')
        return; closingTimer = setTimeout(() => { if (!popup || popup.host.matches(':hover') || popup.host.shadowRoot.activeElement || hovered === popup.record || popup.record?.host.shadowRoot.activeElement)
        return; closePopup(); }, 260); }
    function openPreview(r) { clearTimeout(previewTimer); clearTimeout(closingTimer); if (r.value?.kind !== 'comment' || !r.host.isConnected || popup?.type === 'settings' || dismissed === r)
        return; if (popup?.record === r) {
        position();
        return;
    } const p = showPopup('preview', r.host, t('preview')); p.record = r; r.primary?.setAttribute('aria-expanded', 'true'); technical.previews++; metric('previews'); updatePreview(); }
    const rendered = new WeakMap();
    function updatePreview() { const p = popup, r = p?.record; if (!r || p.type !== 'preview')
        return; const value = r.value; p.heading.textContent = '@' + (value.author || t('unknown')) + ' · ' + LC.date(value.time, prefs, true); const source = value.preview; if (p.source !== source || p.language !== prefs.language) {
        p.source = source;
        p.language = prefs.language;
        if (source) {
            let saved = rendered.get(source), result = saved?.language === prefs.language ? saved.result : null;
            if (!result) {
                result = LCRender.render(source, value.commentUrl, prefs.language);
                rendered.set(source, { language: prefs.language, result });
            }
            p.body.replaceChildren(result.fragment.cloneNode(true));
            p.body.classList.toggle('markdown', result.rich);
            p.truncated = result.truncated;
            p.rich = result.rich;
        }
        else {
            p.body.textContent = t('noBody');
            p.body.classList.remove('markdown');
        }
        p.body.scrollTop = 0;
    } p.foot.replaceChildren(node('span', null, (r.error || r.force || Date.now() - r.at >= ttl(value) ? t('previous') + ' · ' : '') + (p.truncated ? t('truncated') + ' · ' : '') + t(p.rich ? 'markdown' : 'plain'))); const link = node('a', null, t('openComment') + ' ↗'); link.href = value.commentUrl; link.target = '_blank'; link.rel = 'noopener noreferrer'; p.foot.append(link); position(); }
    function preferenceField(key, label, type, values) { const wrapper = node('label', 'field'), text = node('span', null, t(label)); const control = node(type === 'checkbox' ? 'input' : 'select'); if (type === 'checkbox') {
        control.type = 'checkbox';
        control.checked = prefs[key];
    }
    else {
        for (const [value, caption] of values) {
            const opt = node('option', null, caption);
            opt.value = value;
            control.append(opt);
        }
        control.value = String(prefs[key]);
    } control.dataset.pref = key; control.addEventListener('change', async () => { const next = { ...prefs, [key]: type === 'checkbox' ? control.checked : key === 'cacheMinutes' ? Number(control.value) : control.value }; try {
        await chrome.storage.local.set({ preferences: LC.normalize(next) });
    }
    catch {
        control.title = t('saveFailed');
    } }); wrapper.append(text, control); return wrapper; }
    function settingsBody() { if (popup?.type !== 'settings')
        return; const p = popup, focused = p.host.shadowRoot.activeElement?.dataset.pref; p.heading.textContent = t('settingsTitle'); const fields = node('div', 'fields'); fields.append(preferenceField('language', 'language', 'select', [['en', 'English'], ['ko', '한국어']]), preferenceField('avatars', 'avatars', 'checkbox'), preferenceField('noComments', 'noComments', 'checkbox'), preferenceField('cacheMinutes', 'cacheMinutes', 'select', [2, 5, 10].map(n => [String(n), t('minutes', { n })])), preferenceField('timeZone', 'timeZone', 'select', [['local', t('local')], ['Asia/Seoul', t('seoul')], ['UTC', 'UTC']])); p.body.replaceChildren(fields, node('p', 'help', t('legend'))); p.foot.replaceChildren(button('options', () => chrome.runtime.sendMessage({ type: 'LC_OPTIONS' }).catch(() => { }), 'linkbutton')); if (focused)
        p.body.querySelector(`[data-pref="${focused}"]`)?.focus({ preventScroll: true }); position(); }
    function openSettings(anchor) { if (popup?.type === 'settings') {
        closePopup();
        return;
    } showPopup('settings', anchor, t('settingsTitle')); settingsBody(); }
    function diagnostics() { return { schemaVersion: 1, version: chrome.runtime.getManifest().version, counts: { ...technical, requests: transport.counts.requests, pages: transport.counts.pages }, openRecords: records.size, activeJobs: jobs.size, queuedJobs: queue.size, language: prefs.language }; }
    chrome.runtime.onMessage.addListener((message, sender, reply) => { if (sender.id !== chrome.runtime.id)
        return; if (message?.type === 'LC_STATUS') {
        reply({ supported: !!kind(), enabled: prefs.enabled, duplicate, paused, counts: { ...technical } });
    } if (message?.type === 'LC_DIAGNOSTICS')
        reply(diagnostics()); if (message?.type === 'LC_REFRESH') {
        for (const r of records.values())
            if (r.inView)
                enqueue(r, true);
        reply({ ok: true });
    } if (message?.type === 'LC_CLEAR_CACHE') {
        paused = true;
        reset();
        schedule();
        reply({ ok: true });
    } });
    chrome.storage.onChanged.addListener((changes, area) => { if (area !== 'local' || !changes.preferences)
        return; const old = prefs; prefs = LC.normalize(changes.preferences.newValue); if (!prefs.enabled) {
        reset();
        clearTimeout(timer);
        timer = null;
        return;
    } if (!old.enabled) {
        schedule();
        return;
    } for (const r of records.values()) {
        r.paintKey = '';
        paint(r);
    } refreshTimestamps(); if (popup?.type === 'settings') {
        renderBar();
        popup.anchor = bar.shadowRoot.querySelector('.tools button:last-child');
        settingsBody();
    }
    else {
        renderBar();
        updatePreview();
    } });
    const observer = new MutationObserver(mutations => { if (!prefs.enabled)
        return; if (identity() !== current) {
        schedule();
        return;
    } if (!kind())
        return; for (const m of mutations) {
        const target = m.target.nodeType === 1 ? m.target : m.target.parentElement;
        if (!target || own(target))
            continue;
        const added = [...(m.addedNodes || [])], removed = [...(m.removedNodes || [])];
        if (m.type === 'childList' && !removed.length && added.length && added.every(n => n.nodeType === 1 && n.hasAttribute(OWN)))
            continue;
        const row = target.closest(ROW);
        if (row && row.querySelector(LINKS))
            dirty.add(row);
        for (const n of [...added, ...removed])
            if (n.nodeType === 1 && !n.hasAttribute(OWN) && (n.matches(LINKS) || n.querySelector(LINKS))) {
                if (n.isConnected)
                    dirty.add(n.closest(ROW) || n);
                else
                    full = true;
            }
        if (m.type === 'attributes' && target.matches(LINKS))
            dirty.add(row || target.parentElement);
    } if (dirty.size || full)
        schedule([...dirty][0]); });
    observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['href', 'datetime', 'content'] });
    const changeTheme = () => { for (const r of records.values())
        r.host.dataset.theme = theme(); if (bar)
        bar.dataset.theme = theme(); if (popup)
        popup.host.dataset.theme = theme(); };
    new MutationObserver(changeTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-color-mode', 'data-dark-theme', 'data-light-theme'] });
    matchMedia('(prefers-color-scheme:dark)').addEventListener('change', changeTheme);
    for (const ev of ['turbo:load', 'pjax:end', 'soft-nav:end'])
        document.addEventListener(ev, () => schedule());
    window.addEventListener('popstate', () => schedule());
    window.navigation?.addEventListener('currententrychange', () => schedule());
    document.addEventListener('pointermove', e => { const old = pointer; pointer = { x: e.clientX, y: e.clientY }; if (suppressHover && old && (old.x !== e.clientX || old.y !== e.clientY)) {
        suppressHover = false;
        dismissed = null;
        if (hovered) {
            clearTimeout(previewTimer);
            const r = hovered;
            previewTimer = setTimeout(() => openPreview(r), 160);
        }
    } }, { passive: true });
    window.addEventListener('focus', refreshTimestamps);
    document.addEventListener('visibilitychange', () => { if (document.hidden) {
        clearTimeout(timestampTimer);
        timestampTimer = null;
        closePopup();
        cancel();
        clearTimeout(timer);
        timer = null;
    }
    else {
        refreshTimestamps();
        schedule();
        pump();
    } });
    window.addEventListener('offline', () => { cancel(); updateBar(); });
    window.addEventListener('online', () => { for (const r of records.values())
        if (r.near)
            enqueue(r); });
    window.addEventListener('pagehide', () => { reset(); transport.destroy(); clearTimeout(timer); timer = null; });
    window.addEventListener('pageshow', e => { if (e.persisted) {
        transport = new LCTransport();
        schedule();
    } });
    reset();
    scan();
})();
