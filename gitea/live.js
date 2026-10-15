/* Visible-page conversation updates. Read-only, bounded polling; no credentials. */
(() => {
    'use strict';
    const timelineSelector = '.issue-content .comment-list > .timeline, .issue-content-left > .comment-list';
    const list = document.getElementById('issue-list');
    const timeline = document.querySelector(timelineSelector);
    if (!list && !timeline) return;
    const interval = 30000;
    const preference = 'lc-live:v1:' + location.origin + LCWeb.site.basePath;
    let enabled = localStorage.getItem(preference) !== 'off';
    let timer, controller, failures = 0, lastCheck = 0, busy = false, stopped = false;
    const snapshots = new Map();
    const control = document.createElement('div');
    control.dataset.lcLive = '';
    control.style.cssText = 'display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:8px 0;font:12px/1.5 system-ui;color:var(--color-text-light-2)';
    const toggle = document.createElement('button');
    toggle.type = 'button'; toggle.className = 'ui mini basic button';
    const status = document.createElement('span');
    status.setAttribute('role', 'status');
    control.append(toggle, status);
    (list || timeline).before(control);
    function paint(message) {
        toggle.textContent = enabled ? '자동 반영 켜짐 · 30초' : '자동 반영 꺼짐';
        toggle.setAttribute('aria-pressed', String(enabled));
        status.textContent = message;
    }
    function schedule(delay = interval) {
        clearTimeout(timer);
        if (enabled && !document.hidden && !stopped && navigator.onLine) timer = setTimeout(check, delay);
    }
    function interacting() {
        if (document.getSelection()?.toString()) return true;
        if (document.querySelector('.ui.dropdown.active.visible, .ui.modal.active, .CodeMirror-focused, .monaco-editor.focused, .issue-checkbox:checked')) return true;
        const active = document.activeElement;
        if (active && !control.contains(active) && active.matches('input,textarea,[contenteditable="true"]')) return true;
        // Never discard a draft, including a detached/non-focused rich editor.
        for (const node of document.querySelectorAll('.comment-form textarea, .edit-content-zone textarea, .comment-form [contenteditable="true"], .edit-content-zone [contenteditable="true"]')) {
            if (node.getClientRects().length && (node.value || node.textContent).trim()) return true;
        }
        return !!document.querySelector('form.dirty, .dropzone .dz-preview, [data-lc-owned]:focus-within');
    }
    function entries(root) {
        return [...root.children].filter(node => list ? node.matches('.item') : /^(issue|issuecomment)-\d+$/.test(node.id));
    }
    function key(node) {
        return list ? node.querySelector('a.list-item-large-title')?.getAttribute('href') : node.id;
    }
    function signature(node) {
        const clone = node.cloneNode(true);
        for (const owned of clone.querySelectorAll('[data-lc-owned]')) owned.remove();
        for (const time of clone.querySelectorAll('relative-time, time[datetime]')) time.textContent = time.getAttribute('datetime');
        return clone.outerHTML;
    }
    async function check() {
        if (busy || stopped || !enabled || document.hidden || !navigator.onLine) return;
        if (interacting()) { paint('입력·선택 중 · 내용 보존'); schedule(); return; }
        busy = true;
        controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);
        try {
            const url = new URL(location.href); url.hash = '';
            const response = await fetch(url, {credentials: 'same-origin', cache: 'no-cache', signal: controller.signal, headers: {Accept: 'text/html', 'X-Requested-With': 'XMLHttpRequest'}});
            if (!response.ok || response.redirected || !response.headers.get('content-type')?.includes('text/html')) throw new Error('LIVE_RESPONSE');
            const reader = response.body.getReader(), decoder = new TextDecoder();
            let html = '', bytes = 0;
            for (;;) {
                const chunk = await reader.read();
                if (chunk.done) break;
                bytes += chunk.value.byteLength;
                if (bytes > 12000000) { await reader.cancel(); throw new Error('LIVE_SIZE'); }
                html += decoder.decode(chunk.value, {stream: true});
            }
            html += decoder.decode();
            const doc = new DOMParser().parseFromString(html, 'text/html');
            const source = doc.querySelector(list ? '#issue-list' : timelineSelector);
            // Identity changes or an expired login must not replace private content.
            if (!source || LCSites.login(doc, LCWeb.site).toLowerCase() !== LCWeb.account) throw new Error('LIVE_IDENTITY');
            if (interacting() || document.hidden || !enabled || stopped) return;
            const root = list || timeline, incoming = entries(source), current = new Map(entries(root).map(node => [key(node), node]));
            if (incoming.some(node => !key(node))) throw new Error('LIVE_SHAPE');
            let changed = false;
            const anchor = [...root.children].find(node => node.getBoundingClientRect().bottom > 0);
            const anchorKey = anchor && key(anchor), anchorTop = anchor?.getBoundingClientRect().top;
            let previous = null;
            for (const fresh of incoming) {
                const id = key(fresh), old = current.get(id), value = signature(fresh);
                let node = old;
                if (!old || snapshots.get(id) !== value) {
                    node = document.importNode(fresh, true);
                    for (const script of node.querySelectorAll('script')) script.remove();
                    if (old) old.replaceWith(node);
                    changed = true;
                }
                if (!old || (list && node.previousElementSibling !== previous)) {
                    if (previous) previous.after(node);
                    else if (list) root.prepend(node);
                    else (root.querySelector('#timeline-comments-end, .pull-merge-box, .comment.form') || null)?.before(node);
                    if (!node.isConnected) throw new Error('LIVE_INSERT');
                    changed = true;
                }
                previous = node; snapshots.set(id, value); current.delete(id);
            }
            for (const [id, node] of current) { node.remove(); snapshots.delete(id); changed = true; }
            if (anchorKey) {
                const retained = entries(root).find(node => key(node) === anchorKey);
                if (retained) window.scrollBy(0, retained.getBoundingClientRect().top - anchorTop);
            }
            if (changed && list) void chrome.runtime.sendMessage({type: 'LC_LIVE_REFRESH'});
            failures = 0; lastCheck = Date.now();
            control.dataset.checked = String(lastCheck);
            control.dataset.bytes = String(bytes);
            paint('확인 ' + new Date(lastCheck).toLocaleTimeString('ko-KR') + (changed ? ' · 변경 반영' : ' · 변경 없음'));
        } catch (error) {
            if (!stopped && enabled && !document.hidden) {
                failures++;
                paint('연결 확인 지연 · ' + Math.min(300, 30 * 2 ** failures) + '초 뒤 재시도');
            }
        } finally {
            clearTimeout(timeout); busy = false; controller = null;
            schedule(Math.min(300000, interval * 2 ** failures));
        }
    }
    toggle.addEventListener('click', () => {
        enabled = !enabled; localStorage.setItem(preference, enabled ? 'on' : 'off');
        if (!enabled) { clearTimeout(timer); controller?.abort(); }
        paint(enabled ? '보는 동안 자동 확인' : '수동 새로고침으로 확인'); schedule();
    });
    document.addEventListener('visibilitychange', () => {
        clearTimeout(timer);
        if (document.hidden) controller?.abort();
        else schedule(Math.max(1000, interval - (Date.now() - lastCheck)));
    });
    window.addEventListener('offline', () => { clearTimeout(timer); controller?.abort(); });
    window.addEventListener('online', () => schedule());
    window.addEventListener('pagehide', () => { stopped = true; clearTimeout(timer); controller?.abort(); });
    window.addEventListener('pageshow', event => { if (event.persisted) { stopped = false; schedule(); } });
    paint(enabled ? '보는 동안 자동 확인 · 입력 중에는 보류' : '수동 새로고침으로 확인');
    schedule();
})();
