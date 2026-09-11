/* Product pages share the same preference schema as GitHub content scripts. */
(async () => {
    'use strict';
    const app = document.getElementById('app'), page = document.body.dataset.page;
    // Extension APIs are unavailable on plain web pages (e.g. the hosted
    // privacy policy) and with scripting disabled contexts. Degrade gracefully:
    // render with defaults and disable features that need the extension.
    const extStore = (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) || null;
    const extRuntime = (typeof chrome !== 'undefined' && chrome.runtime) || null;
    const extTabs = (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) || null;
    const webLang = (typeof navigator !== 'undefined' && String(navigator.language || '').toLowerCase().startsWith('ko')) ? 'ko' : 'en';
    let prefs = LC.normalize({ language: webLang }), toastTimer;
    if (extStore) {
        try {
            prefs = LC.normalize({ language: webLang, ...((await extStore.get('preferences')).preferences) });
        }
        catch {
            /* fall back to defaults */
        }
    }
    const t = (k, v) => LC.t(k, prefs.language, v), el = (tag, cls, text) => { const n = document.createElement(tag); if (cls)
        n.className = cls; if (text != null)
        n.textContent = text; return n; };
    function a(text, href, cls) { const n = el('a', cls, text); n.href = href; if (/^https:/.test(href)) {
        n.target = '_blank';
        n.rel = 'noopener noreferrer';
    } return n; }
    function toast(key) { let n = document.querySelector('.toast'); if (!n) {
        n = el('div', 'toast');
        n.setAttribute('role', 'status');
        document.body.append(n);
    } n.textContent = t(key); clearTimeout(toastTimer); toastTimer = setTimeout(() => n.remove(), 3500); }
    function btn(key, callback, cls = 'btn') { const b = el('button', cls, t(key)); b.type = 'button'; b.addEventListener('click', () => Promise.resolve(callback()).catch(() => toast('saveFailed'))); return b; }
    async function sendRuntimeMessage(message) { if (!extRuntime || !extRuntime.sendMessage)
        return null; try {
        return await extRuntime.sendMessage(message);
    }
    catch {
        return null;
    } }
    async function save(key, value) { if (!extStore) {
        toast('unavailable');
        return;
    } const current = (await extStore.get('preferences')).preferences; prefs = LC.normalize({ ...current, [key]: value }); await extStore.set({ preferences: prefs }); toast('save'); }
    function field(key, label, type, values) { const wrap = el('label', 'field'), text = el('span', null, t(label)), control = el(type === 'checkbox' ? 'input' : 'select'); if (type === 'checkbox') {
        control.type = 'checkbox';
        control.checked = prefs[key];
    }
    else {
        for (const [v, name] of values) {
            const opt = el('option', null, name);
            opt.value = v;
            control.append(opt);
        }
        control.value = String(prefs[key]);
    } control.dataset.pref = key; control.addEventListener('change', () => save(key, type === 'checkbox' ? control.checked : key === 'cacheMinutes' ? Number(control.value) : control.value).catch(() => toast('saveFailed'))); wrap.append(text, control); return wrap; }
    function lang() { const s = el('select'); s.setAttribute('aria-label', t('language')); s.dataset.pref = 'language'; for (const [v, label] of [['en', 'English'], ['ko', '한국어']]) {
        const o = el('option', null, label);
        o.value = v;
        s.append(o);
    } s.value = prefs.language; s.addEventListener('change', () => save('language', s.value).catch(() => toast('saveFailed'))); return s; }
    function header() { const h = el('header'), brand = a('', 'welcome.html', 'brand'), img = el('img'); img.src = 'icons/icon-48.png'; img.alt = ''; const label = el('span', null, 'Last Comment'); label.append(el('small', null, 'for GitHub')); brand.append(img, label); const nav = el('nav'); nav.append(a(t('help'), 'help.html'), a(t('privacy'), 'privacy.html'), lang()); h.append(brand, nav); return h; }
    function footer() { const f = el('footer'); f.append(el('span', null, t('storeNotice')), a(t('source'), LC.repo), a(t('support'), LC.repo + '/issues')); return f; }
    function section(id, title) { const s = el('section', 'section'); s.id = id; s.append(el('h2', null, t(title))); return s; }
    function demo() { const d = el('div', 'demo'); d.setAttribute('aria-label', 'Illustrative GitHub issue list with sample data'); const head = el('div', 'demo-head'); head.append(el('span', null, 'octo-demo / atlas'), el('span', null, 'Issues')); d.append(head); for (const [title, author, state, time] of [['Improve keyboard navigation', 'morgan', '', '2026-09-04T01:04:00Z'], ['Review the release checklist', 'you', 'mine', '2026-09-04T00:35:00Z'], ['Document the retry behavior', 'alex', 'mention', '2026-09-03T09:18:00Z']]) {
        const row = el('div', 'demo-row'), h = el('div', 'demo-title');
        h.append(el('span', 'dot'), document.createTextNode(title));
        const line = el('div', 'demo-line');
        line.append(el('span', null, t('last') + ' :'));
        const b = el('span', 'demo-badge ' + state);
        b.append(el('strong', null, '@' + author), el('span', null, LC.date(time, prefs)));
        line.append(b);
        row.append(h, line);
        d.append(row);
    } d.append(el('div', 'demo-hint', prefs.language === 'ko' ? '예시 데이터 · 실제 저장소가 아닙니다' : 'Illustrative data · not a real repository')); return d; }
    function welcome() { const w = el('main', 'wrap'), hero = el('section', 'hero'), copy = el('div'); copy.append(el('h1', null, t('welcomeTitle')), el('p', 'lead', t('welcomeLead'))); const actions = el('div', 'actions'); actions.append(a(t('welcomeCTA'), 'https://github.com/issues', 'btn primary'), a(t('openSettings'), 'options.html', 'btn')); copy.append(actions); hero.append(copy, demo()); const steps = el('section', 'steps'); for (let i = 1; i <= 3; i++) {
        const s = el('div');
        s.append(el('span', 'step-number', String(i)), el('h3', null, t('welcomeStep' + i)), el('p', null, t('welcomeBody' + i)));
        steps.append(s);
    } const band = el('section', 'privacy-band'), privacy = el('div'); privacy.append(el('h3', null, t('localOnly')), el('p', null, t('privacySummary'))); band.append(privacy, a(t('privacy'), 'privacy.html', 'btn')); w.append(hero, steps, el('aside', 'note', t('welcomeNote')), band); return w; }
    function settings() {
        const w = el('main', 'wrap settings-layout'), rail = el('aside', 'rail');
        rail.append(el('h1', null, t('appSettings')), a(t('appearance'), '#display'), a(t('statsTitle'), '#statistics'), a(t('connections'), '#privacy'));
        const main = el('div', 'settings-main');
        const display = section('display', 'appearance');
        display.append(field('enabled', 'enabled', 'checkbox'), field('language', 'language', 'select', [['en', 'English'], ['ko', '한국어']]), field('avatars', 'avatars', 'checkbox'), field('noComments', 'noComments', 'checkbox'), field('timeZone', 'timeZone', 'select', [['local', t('local')], ['Asia/Seoul', t('seoul')], ['UTC', 'UTC']]), field('autoRefresh', 'autoRefresh', 'checkbox'), field('cacheMinutes', 'cacheMinutes', 'select', [2, 5, 10].map(n => [String(n), t('minutes', { n })])));
        const stats = section('statistics', 'statsTitle');
        stats.append(el('p', 'small', t('statsDescription')), field('localStats', 'localStats', 'checkbox'));
        const off = el('p', 'small', t('statsOff'));
        off.hidden = prefs.localStats;
        stats.append(off);
        const grid = el('div', 'stats');
        grid.id = 'counter-grid';
        for (const [key, label] of [['lists', 'statLists'], ['previews', 'statPreviews'], ['lookups', 'statLookups'], ['failures', 'statFailures'], ['cache', 'statCache']]) {
            const cell = el('div', 'stat'), n = el('strong', null, '0');
            n.dataset.counter = key;
            cell.append(n, el('span', null, t(label)));
            grid.append(cell);
        }
        stats.append(grid);
        const controls = el('div', 'actions');
        controls.append(btn('exportStats', exportCounters), btn('clearStats', async () => { await sendRuntimeMessage({ type: 'LC_CLEAR_COUNTERS' }); await refreshCounters(); toast('statsCleared'); }));
        stats.append(controls);
        const privacy = section('privacy', 'dataTitle');
        privacy.append(el('p', 'small', t('privacySummary')), el('p', 'small', t('diagnosticHelp')));
        const tools = el('div', 'actions');
        tools.append(btn('clearCache', async () => { await sendRuntimeMessage({ type: 'LC_CLEAR_CACHE' }); toast('cacheCleared'); }), btn('reset', async () => { if (confirm(t('resetConfirm'))) {
            await sendRuntimeMessage({ type: 'LC_CLEAR_COUNTERS' });
            if (extStore)
                await extStore.set({ preferences: LC.defaults });
        } }));
        privacy.append(tools, a(t('privacy'), 'privacy.html', 'btn'));
        main.append(display, stats, privacy);
        w.append(rail, main);
        void refreshCounters();
        return w;
    }
    function legal() { const w = el('main', 'wrap prose'); w.append(el('h1', null, t('privacyTitle')), el('p', 'small', t('privacyEffective'))); for (const [heading, body] of [['scopeTitle', 'privacyData'], ['dataTitle', 'privacyRetention'], ['note', 'notesPrivacy'], ['connections', 'privacyNetwork'], ['support', 'privacySharing'], ['localOnly', 'privacyUse'], ['source', 'privacyContact']])
        w.append(el('h2', null, t(heading)), el('p', null, t(body))); w.append(a(t('support'), LC.repo + '/issues')); return w; }
    function help() { const w = el('main', 'wrap prose'); w.append(el('h1', null, t('help')), el('p', null, t('welcomeNote')), el('h2', null, t('keyboard')), el('p', null, t('keyboardHelp')), el('h2', null, t('note')), el('p', null, t('notesHelp')), el('h2', null, t('autoRefresh')), el('p', null, t('refreshHelp')), el('h2', null, t('limitsTitle')), el('p', null, t('limitsBody')), el('h2', null, t('faqTitle'))); for (const [q, ans] of [['faqPrivate', 'faqPrivateAnswer'], ['faqMissing', 'faqMissingAnswer'], ['faqSlow', 'faqSlowAnswer'], ['faqMetrics', 'faqMetricsAnswer']]) {
        const d = el('details');
        d.append(el('summary', null, t(q)), el('p', null, t(ans)));
        w.append(d);
    } w.append(el('div', 'actions')); w.lastChild.append(a(t('support'), LC.repo + '/issues', 'btn'), a(t('source'), LC.repo, 'btn')); return w; }
    async function activeTab() { if (!extTabs)
        return null; const [tab] = await extTabs.query({ active: true, currentWindow: true }); return tab?.id; }
    async function tabMessage(type) { const id = await activeTab(); if (id == null)
        return null; if (!extTabs)
        return null; try {
        return await chrome.tabs.sendMessage(id, { type });
    }
    catch {
        return null;
    } }
    function popup() { document.body.classList.add('popup-page'); const w = el('main', 'wrap'), status = el('div', 'tab-status'); status.append(el('strong', null, t('currentTab')), el('p', null, t('needsReload'))); w.append(status, field('enabled', 'enabled', 'checkbox'), field('language', 'language', 'select', [['en', 'English'], ['ko', '한국어']])); const actions = el('div', 'actions'), refresh = btn('refresh', () => tabMessage('LC_REFRESH'), 'btn primary'); refresh.disabled = true; actions.append(refresh, btn('options', () => { if (extRuntime && extRuntime.openOptionsPage)
            extRuntime.openOptionsPage(); else
            toast('unavailable'); })); w.append(actions, el('p', 'small', t('privacySummary'))); const links = el('div', 'popup-links'); links.append(a(t('help'), 'help.html'), a(t('privacy'), 'privacy.html'), btn('diagnostic', async () => { const report = await tabMessage('LC_DIAGNOSTICS'); if (report)
        download(report, 'last-comment-diagnostics.json');
    else
        toast('unavailable'); }, 'btn')); for (const link of links.querySelectorAll('a'))
        link.target = '_blank'; w.append(links); void tabMessage('LC_STATUS').then(result => { status.lastChild.textContent = result?.duplicate ? t('duplicate') : result?.supported ? (prefs.enabled ? t('active') : t('paused')) : t('notList'); refresh.disabled = !result?.supported || !prefs.enabled; }); return w; }
    function download(value, name) { const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }), url = URL.createObjectURL(blob), link = a('', url); link.download = name; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500); }
    async function exportCounters() { if (!extStore || !extRuntime || !extRuntime.getManifest) {
        toast('unavailable');
        return;
    } const data = await extStore.get(['preferences', 'counters']); const counts = {}; for (const k of ['lists', 'previews', 'lookups', 'failures', 'cache'])
        counts[k] = Math.max(0, Math.trunc(Number(data.counters?.[k]) || 0)); download({ schemaVersion: 1, version: extRuntime.getManifest().version, localOnly: true, counters: counts }, 'last-comment-local-counters.json'); }
    async function refreshCounters() { if (!extStore)
        return; const { counters = {} } = await extStore.get('counters'); for (const n of document.querySelectorAll('[data-counter]'))
        n.textContent = String(Math.max(0, Math.trunc(Number(counters[n.dataset.counter]) || 0))); }
    function render() { const focused = document.activeElement?.dataset.pref; document.documentElement.lang = prefs.language; document.title = t(page === 'options' ? 'appSettings' : page === 'privacy' ? 'privacyTitle' : page === 'help' ? 'help' : 'product'); app.replaceChildren(header(), page === 'welcome' ? welcome() : page === 'options' ? settings() : page === 'privacy' ? legal() : page === 'help' ? help() : popup()); if (page !== 'popup')
        app.append(footer()); if (focused)
        app.querySelector(`[data-pref="${focused}"]`)?.focus({ preventScroll: true }); }
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged)
        chrome.storage.onChanged.addListener((changes, area) => { if (area !== 'local')
            return; if (changes.preferences) {
            prefs = LC.normalize(changes.preferences.newValue);
            render();
        } if (changes.counters)
            void refreshCounters(); });
    render();
})();
