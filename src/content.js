/* Isolated-world content script. Fetched comment content stays in memory; explicit personal notes use local storage. */
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
    const noteCache = new Map(), noteDrafts = new Map();
    let noteEpoch = 0, noteHovered = null, noteTimer = null, noteReadPromise = null;
    const technical = { requests: 0, verified: 0, failures: 0, cacheHits: 0, previews: 0, scans: 0 };
    const t = (key, vars) => LC.t(key, prefs.language, vars), own = n => n?.nodeType === 1 && n.closest(`[${OWN}]`);
    const node = (tag, cls, text) => { const n = document.createElement(tag); if (cls)
        n.className = cls; if (text != null)
        n.textContent = text; return n; };
    function icon(type) { const paths = { comment: 'M3 3h10v8H6l-3 2V3Z', refresh: 'M13 6a5 5 0 1 0 0 4M13 2v4H9', settings: 'M2 4h12M2 8h12M2 12h12M5 2v4M10 6v4M6 10v4', pause: 'M5 3v10M11 3v10', play: 'm5 3 7 5-7 5Z', note: 'M3 2h7l3 3v9H3V2Zm7 0v4h3M5 8h6M5 11h4', older: 'm9 3-5 5 5 5', newer: 'm6 3 5 5-5 5', latest: 'm3 3 5 5-5 5M12 3v10', edit: 'm3 10 7-7 3 3-7 7-4 1 1-4Z', trash: 'M2 4h12M6 4V2h4v2M4 4v10h8V4M6 7v4M10 7v4' }; const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); for (const [k, v] of Object.entries({ viewBox: '0 0 16 16', width: '14', height: '14', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.4', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' }))
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
    function bindChip(r, chip, main) {
        // The full-width row and label are deliberately not hover targets.
        chip.addEventListener('pointerenter', event => {
            if (event.pointerType === 'touch') return;
            hovered = r; clearTimeout(closingTimer); clearTimeout(previewTimer);
            if (suppressHover || ['settings', 'note-edit'].includes(popup?.type)) return;
            dismissed = null;
            previewTimer = setTimeout(() => { if (r.chip === chip && chip.matches(':hover')) openPreview(r); }, 160);
        });
        chip.addEventListener('pointerleave', () => {
            if (hovered === r) hovered = null;
            clearTimeout(previewTimer); scheduleClose();
        });
        if (main.tagName !== 'A') return;
        main.setAttribute('aria-keyshortcuts', 'ArrowDown Space');
        main.addEventListener('focus', () => openPreview(r));
        main.addEventListener('blur', scheduleClose);
        main.addEventListener('keydown', event => {
            if (event.key === 'ArrowDown' || event.key === ' ') {
                event.preventDefault(); event.stopPropagation();
                dismissed = null; suppressHover = false; openPreview(r);
                if (popup?.type === 'preview') { popup.pinned = true; popup.body.focus(); }
            }
        });
        let touch = false;
        main.addEventListener('pointerdown', event => { touch = event.pointerType === 'touch'; });
        main.addEventListener('click', event => {
            if (touch) {
                event.preventDefault(); touch = false; dismissed = null; suppressHover = false;
                openPreview(r); if (popup?.type === 'preview') popup.pinned = true;
            }
        });
    }
    function make(item) {
        const r = { ...item, host: host(), signature: signature(item.row), state: 'idle', value: null,
            at: 0, error: null, near: false, inView: false, force: false, note: LCNotes.empty(), noteLoaded: false };
        records.set(r.link, r); mount(r);
        near.observe(r.link); inView.observe(r.link); paint(r); return r;
    }
    function remove(r) { queue.delete(r); r.job?.subscribers.delete(r); if (r.job && !r.job.subscribers.size)
        r.job.controller.abort(); near.unobserve(r.link); inView.unobserve(r.link); if (popup?.record === r) {
        keepNoteDraft(); closePopup(false, true);
    } r.host.remove(); records.delete(r.link); if (!records.size) { clearTimeout(timestampTimer); timestampTimer = null; } if (r.layout) {
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
        r.host.hidden = !!data && data.kind === 'none' && !prefs.noComments && !stale && !r.note?.text;
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
        const reload = button('retry', () => enqueue(r, true), 'action reload', 'refresh');
        reload.disabled = r.state === 'loading' || r.state === 'queued' || !allowed() || Date.now() < transport.limitedUntil;
        chip.append(reload);
        r.noteButton = button('note', () => openNote(r, true), 'action note-button', 'note');
        r.noteButton.addEventListener('pointerenter', event => {
            if (event.pointerType === 'touch') return;
            noteHovered = r; clearTimeout(closingTimer); clearTimeout(noteTimer);
            if (r.note?.text && !r.note.pinned && !['settings', 'note-edit'].includes(popup?.type))
                noteTimer = setTimeout(() => openNote(r, false), 180);
        });
        r.noteButton.addEventListener('pointerleave', () => { noteHovered = null; clearTimeout(noteTimer); scheduleClose(); });
        r.noteButton.addEventListener('focus', () => { if (r.note?.text && !r.note.pinned) openNote(r, false); });
        r.noteButton.addEventListener('blur', scheduleClose);
        line.append(label, chip, r.noteButton);
        r.noteInline = button('noteEdit', () => openNote(r, true), 'note-inline');
        root.replaceChildren(line, r.noteInline);
        r.chip = chip;
        r.primary = main;
        bindChip(r, chip, main); paintNote(r);
        if (r.timestamp && timestampTimer === null) refreshTimestamps();
        if (active) {
            const focus = [...root.querySelectorAll('button,a')].find(n => n.className === active);
            focus?.focus({ preventScroll: true });
        }
        if (popup?.record === r) {
            if (popup.type === 'preview') popup.anchor = chip;
            else if (popup.type.startsWith('note')) popup.anchor = r.noteButton;
            updatePreview();
        }
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
    function pump() { if (!allowed() || popup?.historyBusy)
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
    function reset() { keepNoteDraft(); closePopup(false, true); cancel(); for (const r of [...records.values()])
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
        void loadNotes();
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
        if (closePopup() === false) return null;
        const h = host();
        h.style.cssText = `position:fixed;inset:auto;margin:0;padding:0;border:0;background:transparent;z-index:2147483647;width:${type === 'settings' ? 320 : type === 'note-edit' ? 400 : type === 'note' ? 360 : 540}px;max-width:calc(100vw - 24px);max-height:calc(100dvh - 24px);overflow:visible;`;
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
        h.shadowRoot.addEventListener('click', event => event.stopPropagation());
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
        h.style.width = Math.max(120, Math.min(p.type === 'settings' ? 320 : p.type === 'note-edit' ? 400 : p.type === 'note' ? 360 : 540, w - 24)) + 'px';
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
    function keepNoteDraft() {
        const p = popup;
        if (p?.type === 'note-edit' && p.noteDirty) {
            noteDrafts.set(p.noteKey, { text: p.editor.value, pinned: p.pin.checked, revision: p.noteRevision });
            if (noteDrafts.size > 20) noteDrafts.delete(noteDrafts.keys().next().value);
        }
    }
    function closePopup(restore = false, force = false) {
        const p = popup;
        if (p?.type === 'note-edit' && !force) {
            if (p.noteSaving) return false;
            if (p.noteDirty && !confirm(t('noteDiscard'))) return false;
            noteDrafts.delete(p.noteKey);
        }
        clearTimeout(previewTimer); clearTimeout(closingTimer); clearTimeout(noteTimer);
        popup = null; if (!p) return true;
        p.controller.abort();
        try { p.host.hidePopover(); } catch {}
        p.host.remove(); p.record?.primary?.setAttribute('aria-expanded', 'false');
        if (restore) {
            hovered = null; noteHovered = null; dismissed = p.record; suppressHover = true;
            const target = p.type === 'preview' ? p.record?.primary : p.type.startsWith('note') ? p.record?.noteButton : p.anchor;
            target?.focus({ preventScroll: true });
        }
        queueMicrotask(pump); return true;
    }
    function scheduleClose() {
        clearTimeout(closingTimer);
        if (!['preview', 'note'].includes(popup?.type) || popup.pinned) return;
        closingTimer = setTimeout(() => {
            const p = popup;
            if (!p || p.pinned || p.host.matches(':hover') || p.host.shadowRoot.activeElement) return;
            const anchorHovered = p.type === 'preview' ? hovered === p.record : noteHovered === p.record;
            const focus = p.record?.host.shadowRoot.activeElement;
            if (anchorHovered || (p.type === 'preview' ? focus === p.record?.primary : focus === p.record?.noteButton)) return;
            closePopup();
        }, 260);
    }
    function openPreview(r) {
        clearTimeout(previewTimer); clearTimeout(closingTimer);
        if (r.value?.kind !== 'comment' || !r.chip?.isConnected || current !== identity() ||
            ['settings', 'note-edit'].includes(popup?.type) || dismissed === r) return;
        if (popup?.type === 'preview' && popup.record === r) { position(); return; }
        const p = showPopup('preview', r.chip, t('preview')); if (!p) return;
        p.record = r; p.history = [r.value]; p.index = 0; p.buffer = []; p.hasMore = true;
        p.historyBusy = false; p.historyError = ''; p.pinned = false; p.initialUrl = r.value.commentUrl;
        r.primary?.setAttribute('aria-expanded', 'true'); technical.previews++; metric('previews'); updatePreview();
    }
    const rendered = new WeakMap();
    function authorTone(author) {
        let hash = 0;
        for (const c of (author || '?').toLowerCase()) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
        return hash % 6;
    }
    function historyTrail(p) {
        const trail = node('nav', 'history-trail'); trail.setAttribute('aria-label', t('historyTrail'));
        const groups = [];
        for (let i = p.history.length - 1; i >= 0; i--) {
            const value = p.history[i], last = groups.at(-1);
            if (value.author && last?.author.toLowerCase() === value.author.toLowerCase()) {
                last.count++; last.indices.push(i);
            } else groups.push({ author: value.author, count: 1, indices: [i] });
        }
        for (const group of groups) {
            if (trail.childNodes.length) { const arrow = node('span', 'trail-arrow', '→'); arrow.setAttribute('aria-hidden', 'true'); trail.append(arrow); }
            const b = node('button', 'trail-person', (group.author ? '@' + group.author : t('unknown')) + (group.count > 1 ? ` ×${group.count}` : ''));
            b.type = 'button'; b.dataset.tone = String(authorTone(group.author));
            b.setAttribute('aria-current', group.indices.includes(p.index) ? 'true' : 'false');
            b.addEventListener('click', () => { if (p.historyBusy) return; p.index = group.indices.at(-1); p.pinned = true; updatePreview(); });
            trail.append(b);
        }
        return trail;
    }
    async function previousComment(p) {
        if (popup !== p || p.historyBusy) return;
        p.pinned = true; p.historyError = '';
        if (p.index + 1 < p.history.length) { p.index++; updatePreview(); return; }
        if (!p.buffer.length && p.hasMore) {
            if (!allowed()) { p.historyError = t('historyPaused'); updatePreview(); return; }
            const before = p.history[p.index].commentUrl;
            p.historyBusy = true; updatePreview();
            try {
                const result = await transport.issue(p.record.info, account, p.controller.signal, { before });
                if (popup !== p || p.controller.signal.aborted || current !== identity()) return;
                if (result?.kind !== 'history' || result.before !== before || !Array.isArray(result.comments)) throw new Error('history shape');
                p.buffer = result.comments; p.hasMore = result.hasMore;
            } catch (error) {
                if (popup !== p || p.controller.signal.aborted) return;
                p.historyError = error.code === 'HISTORY_ANCHOR' ? t('error_HISTORY_ANCHOR') : t('historyError');
            } finally {
                p.historyBusy = false; if (popup === p) updatePreview(); pump();
            }
        }
        if (popup !== p) return;
        if (p.buffer.length) {
            p.history.push(p.buffer.shift()); p.index++;
            // A single preview owns a bounded sliding history, never persistent data.
            let chars = p.history.reduce((n, value) => n + (value.preview?.text.length || 0), 0);
            while (p.index > 0 && (p.history.length > 50 || chars > 512000)) {
                chars -= p.history[0].preview?.text.length || 0; p.history.shift(); p.index--;
            }
        }
        updatePreview();
    }
    function updatePreview() {
        const p = popup;
        if (!p || p.type !== 'preview' || !p.record) return;
        const value = p.history[p.index], source = value.preview;
        const headingKey = JSON.stringify([value.commentUrl, value.author, value.time, prefs.language, prefs.timeZone, value.isBot]);
        if (p.headingKey !== headingKey) {
            p.headingKey = headingKey;
            const identityRow = node('div', 'comment-identity');
            const disc = node('span', 'author-disc', (value.author?.[0] || '?').toUpperCase());
            disc.dataset.tone = String(authorTone(value.author)); disc.setAttribute('aria-hidden', 'true');
            const author = node('strong', 'comment-author', value.author ? '@' + value.author : t('unknown'));
            const time = node('span', 'history-time', LC.date(value.time, prefs)); time.title = LC.date(value.time, prefs, true);
            identityRow.append(disc, author, time);
            if (value.isBot) identityRow.append(node('span', 'flag', t('bot')));
            p.heading.replaceChildren(identityRow);
        }
        const trailKey = JSON.stringify([p.history.map(v => v.commentUrl), p.index, prefs.language]);
        if (p.trailKey !== trailKey) {
            p.trailKey = trailKey; p.trail?.remove();
            if (p.history.length > 1) {
                p.trail = historyTrail(p); p.heading.parentElement.after(p.trail);
                p.trail.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
            }
        }
        if (p.source !== source || p.language !== prefs.language) {
            p.source = source; p.language = prefs.language;
            if (source) {
                let saved = rendered.get(source), result = saved?.language === prefs.language ? saved.result : null;
                if (!result) { result = LCRender.render(source, value.commentUrl, prefs.language); rendered.set(source, { language: prefs.language, result }); }
                p.body.replaceChildren(result.fragment.cloneNode(true)); p.body.classList.toggle('markdown', result.rich);
                p.truncated = result.truncated;
            } else { p.body.textContent = t('noBody'); p.body.classList.remove('markdown'); p.truncated = false; }
            p.body.scrollTop = 0;
        }
        const atStart = !p.hasMore && !p.buffer.length && p.index === p.history.length - 1;
        if (!p.historyControls) {
            const controls = node('nav', 'history-controls');
            const older = button('older', () => previousComment(p), 'history-older');
            const newer = button('newer', () => { if (p.historyBusy || p.index === 0) return; p.index--; p.pinned = true; p.historyError = ''; updatePreview(); }, 'action history-next', 'newer');
            const latest = button('latest', () => {
                if (p.historyBusy) return;
                p.history = [p.record.value]; p.index = 0; p.buffer = []; p.hasMore = true;
                p.pinned = true; p.historyError = ''; updatePreview();
            }, 'action history-latest', 'latest');
            const open = node('a', 'history-open'); open.target = '_blank'; open.rel = 'noopener noreferrer';
            const status = node('span', 'history-notice'); status.setAttribute('role', 'status'); status.hidden = true;
            controls.append(older, newer, latest); p.foot.replaceChildren(controls, open, status);
            p.historyControls = { older, newer, latest, open, status };
        }
        const { older, newer, latest, open, status } = p.historyControls;
        const olderLabel = t(p.historyBusy ? 'historyLoading' : atStart ? 'firstComment' : 'older');
        if (older.textContent !== olderLabel) older.textContent = olderLabel;
        older.title = olderLabel; older.setAttribute('aria-label', olderLabel);
        older.disabled = atStart; older.setAttribute('aria-disabled', String(p.historyBusy || atStart));
        newer.disabled = p.historyBusy || p.index === 0;
        latest.disabled = p.historyBusy || (p.history.length === 1 && value.commentUrl === p.record.value.commentUrl);
        for (const [control, label] of [[newer, 'newer'], [latest, 'latest']]) { control.title = t(label); control.setAttribute('aria-label', t(label)); }
        open.textContent = t('openComment') + ' ↗'; open.href = value.commentUrl;
        status.hidden = !p.historyError && !p.truncated;
        status.className = p.historyError ? 'history-error' : 'history-notice';
        status.textContent = p.historyError || (p.truncated ? t('truncated') : '');
        position();
    }

    function loadNotes() {
        if (noteReadPromise) return noteReadPromise;
        const batch = [...records.values()].filter(r => !r.noteLoaded && !r.noteLoading);
        if (!batch.length) return Promise.resolve();
        for (const r of batch) r.noteLoading = true;
        const epoch = noteEpoch;
        noteReadPromise = (async () => {
            let changedDuringRead = false;
            try {
                await Promise.all(batch.map(async r => { r.noteKey ||= await LCNotes.keyFor(r.info); }));
                const missing = [...new Set(batch.map(r => r.noteKey))].filter(key => !noteCache.has(key));
                const data = missing.length ? await chrome.storage.local.get(missing) : {};
                for (const r of batch) {
                    if (records.get(r.link) !== r) continue;
                    if (noteEpoch !== epoch && !noteCache.has(r.noteKey)) { changedDuringRead = true; continue; }
                    const value = noteCache.get(r.noteKey) || LCNotes.normalize(data[r.noteKey]);
                    noteCache.set(r.noteKey, value); r.note = value; r.noteLoaded = true; r.noteReadError = false; paintNote(r);
                }
                while (noteCache.size > 250) noteCache.delete(noteCache.keys().next().value);
            } catch {
                for (const r of batch) { r.noteReadError = true; paintNote(r); }
            } finally {
                for (const r of batch) r.noteLoading = false;
                noteReadPromise = null;
                // New rows or a concurrent storage change must not miss pinned notes.
                if (changedDuringRead || [...records.values()].some(r => !batch.includes(r) && !r.noteLoaded && !r.noteReadError))
                    queueMicrotask(loadNotes);
            }
        })();
        return noteReadPromise;
    }
    function paintNote(r) {
        if (!r.noteButton) return;
        r.noteButton.classList.toggle('has-note', !!r.note.text);
        r.noteButton.title = r.noteReadError ? t('noteLoadError') : noteDrafts.has(r.noteKey) ? t('noteDraft') : t('note');
        r.noteButton.setAttribute('aria-label', r.noteButton.title);
        r.noteInline.hidden = !r.note.text || !r.note.pinned;
        r.noteInline.textContent = r.note.text;
        if (r.note.text) { r.host.hidden = false; r.host.style.display = 'block'; }
        if (popup?.type === 'note' && popup.record === r) {
            if (!r.note.text) closePopup(); else { popup.body.textContent = r.note.text; position(); }
        }
    }
    async function openNote(r, edit) {
        if (current !== identity() || records.get(r.link) !== r) return;
        clearTimeout(previewTimer); clearTimeout(closingTimer); clearTimeout(noteTimer);
        if (!r.noteLoaded) {
            await loadNotes();
            if (!r.noteLoaded && !r.noteReadError) await loadNotes();
            if (!r.noteLoaded || records.get(r.link) !== r) return;
        }
        if (!edit && (!r.note.text || r.note.pinned || ['settings', 'note-edit'].includes(popup?.type) || suppressHover)) return;
        if (popup?.record === r && popup.type === (edit ? 'note-edit' : 'note')) return;
        const p = showPopup(edit ? 'note-edit' : 'note', r.noteButton, t('note')); if (!p) return;
        p.record = r; p.noteKey = r.noteKey; p.noteRevision = r.note.revision;
        p.pinned = edit; p.noteDirty = false; p.noteSaving = false;
        if (!edit) {
            p.body.textContent = r.note.text; p.body.classList.add('note-body');
            p.foot.append(node('span', null, t('noteLocal')), button('noteEdit', () => openNote(r, true), 'note-edit-button'));
            position(); return;
        }
        const draft = noteDrafts.get(r.noteKey), value = draft || r.note;
        if (draft) { p.noteRevision = draft.revision; p.noteDirty = true; }
        const editor = node('textarea', 'note-editor'); editor.maxLength = LCNotes.MAX_CHARS;
        editor.rows = 7; editor.value = value.text; editor.placeholder = t('notePlaceholder'); editor.setAttribute('aria-label', t('note'));
        editor.spellcheck = false;
        const pinLabel = node('label', 'note-pin'), pin = node('input'); pin.type = 'checkbox'; pin.checked = value.pinned;
        pinLabel.append(pin, node('span', null, t('notePinned')));
        const status = node('span', 'note-status', draft ? t('noteDraft') : t('noteLocal')); status.setAttribute('role', 'status');
        const save = button('noteSave', () => saveNote(p), 'note-save'); save.disabled = !p.noteDirty;
        p.editor = editor; p.pin = pin; p.noteStatus = status; p.saveButton = save;
        p.body.replaceChildren(editor);
        const left = node('div', 'note-controls'); left.append(pinLabel, status); p.foot.append(left, save);
        const markDirty = () => { p.noteDirty = editor.value !== r.note.text || pin.checked !== r.note.pinned; save.disabled = !p.noteDirty; };
        editor.addEventListener('input', markDirty); pin.addEventListener('change', markDirty);
        editor.addEventListener('keydown', event => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); void saveNote(p); }
        });
        window.addEventListener('beforeunload', event => {
            if (p.noteDirty) { event.preventDefault(); event.returnValue = ''; }
        }, { signal: p.controller.signal });
        if (r.note.text) {
            const del = button('noteDelete', () => {
                if (!confirm(t('noteDeleteConfirm'))) return;
                editor.value = ''; pin.checked = false; p.noteDirty = true; void saveNote(p);
            }, 'action note-delete', 'trash');
            p.heading.after(del);
        }
        position(); editor.focus({ preventScroll: true });
    }
    async function saveNote(p) {
        if (p.noteSaving || !p.noteDirty) return false;
        p.noteSaving = true; p.saveButton.disabled = true; p.editor.disabled = p.pin.disabled = true;
        p.noteStatus.textContent = t('noteSaving');
        try {
            const response = await chrome.runtime.sendMessage({ type: 'LC_NOTE_WRITE', key: p.noteKey,
                expectedRevision: p.noteRevision, value: { text: p.editor.value, pinned: p.pin.checked } });
            if (!response?.ok) {
                if (response?.error === 'NOTE_CONFLICT') {
                    // Updating the revision does not write anything: overwriting needs a second explicit click.
                    p.noteRevision = response.value.revision; p.noteStatus.textContent = t('noteConflict');
                    p.saveButton.textContent = t('noteOverwrite');
                } else p.noteStatus.textContent = t('saveFailed');
                return false;
            }
            p.noteDirty = false; noteDrafts.delete(p.noteKey); noteCache.set(p.noteKey, response.value);
            for (const r of records.values()) if (r.noteKey === p.noteKey) {
                r.note = response.value; r.noteLoaded = true; paintNote(r);
            }
            if (popup === p) closePopup(true, true);
            return true;
        } catch { p.noteStatus.textContent = t('saveFailed'); return false; }
        finally {
            p.noteSaving = false; p.editor.disabled = p.pin.disabled = false; p.saveButton.disabled = !p.noteDirty;
        }
    }

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
    } if (showPopup('settings', anchor, t('settingsTitle'))) settingsBody(); }
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
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local') return;
        for (const [key, change] of Object.entries(changes)) if (LCNotes.validKey(key)) {
            noteEpoch++; const value = LCNotes.normalize(change.newValue); noteCache.set(key, value);
            if (noteCache.size > 250) noteCache.delete(noteCache.keys().next().value);
            for (const r of records.values()) if (r.noteKey === key) { r.note = value; r.noteLoaded = true; paintNote(r); }
        }
        if (!changes.preferences) return; const old = prefs; prefs = LC.normalize(changes.preferences.newValue); if (!prefs.enabled) {
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
        if (popup?.type !== 'note-edit') closePopup();
        cancel();
        clearTimeout(timer);
        timer = null;
    }
    else {
        refreshTimestamps();
        schedule();
        pump();
    } });
    window.addEventListener('offline', () => { if (popup?.type === 'preview') closePopup(); cancel(); updateBar(); });
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
