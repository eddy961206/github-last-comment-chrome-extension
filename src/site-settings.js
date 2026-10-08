/* Explicit Gitea permissions, controlled from the extension settings page. */
(() => {
    'use strict';
    function create(prefs) {
        const ko = prefs.language === 'ko';
        const node = (tag, text) => { const el = document.createElement(tag); if (text) el.textContent = text; return el; };
        const section = node('section'); section.className = 'section'; section.id = 'gitea-sites';
        section.append(node('h2', ko ? 'Gitea 사이트' : 'Gitea sites'), node('p', ko ? 'Gitea 기본 주소를 추가해. 예: https://git.example.com 또는 https://example.com/gitea. 추가한 사이트만 접근 권한을 요청해.' : 'Add the installation base URL, e.g. https://git.example.com or https://example.com/gitea. Only the host you add requests access.'));
        const form = node('form'); form.className = 'field';
        const label = node('label', ko ? 'Gitea 기본 주소' : 'Gitea base URL');
        const input = node('input'); input.type = 'url'; input.required = true; input.placeholder = 'https://git.example.com'; input.id = 'gitea-base-url'; label.htmlFor = input.id;
        const add = node('button', ko ? '사이트 추가' : 'Add site'); add.type = 'submit'; add.className = 'btn';
        const status = node('p'); status.setAttribute('role', 'status'); status.style.overflowWrap = 'anywhere';
        const list = node('div'); list.style.overflowWrap = 'anywhere';
        form.append(label, input, add); section.append(form, status, list);
        async function show() {
            const sites = (await chrome.storage.local.get('giteaSites')).giteaSites || [];
            list.replaceChildren();
            for (const raw of sites) {
                const site = LCSites.normalize(raw); if (!site) continue;
                const row = node('p'), text = node('span', site.baseUrl + ' '), remove = node('button', ko ? '제거' : 'Remove'); remove.className = 'btn'; remove.type = 'button';
                remove.addEventListener('click', async () => {
                    remove.disabled = true;
                    try {
                        const current = (await chrome.storage.local.get('giteaSites')).giteaSites || [];
                        const next = current.filter(v => v !== raw);
                        await chrome.storage.local.set({ giteaSites: next });
                        if (!next.map(LCSites.normalize).filter(Boolean).some(v => LCSites.permission(v) === LCSites.permission(site))) await chrome.permissions.remove({ origins: [LCSites.permission(site)] });
                        await chrome.runtime.sendMessage({ type: 'LC_SITES_SYNC' });
                        await show(); status.textContent = ko ? '사이트를 제거했어. 이미 열린 탭은 새로고침해.' : 'Site removed. Reload already-open tabs.';
                    } catch { status.textContent = ko ? '제거에 실패했어. 다시 시도해.' : 'Could not remove this site. Retry.'; remove.disabled = false; }
                });
                row.append(text, remove); list.append(row);
            }
        }
        form.addEventListener('submit', async event => {
            event.preventDefault();
            const site = LCSites.normalize(input.value.trim());
            if (!site) { status.textContent = ko ? '쿼리가 없는 Gitea 기본 주소를 입력해.' : 'Enter the Gitea base URL without a query.'; return; }
            add.disabled = true;
            const origins = [LCSites.permission(site)];
            // Start the old-permission read before the request, but do not await:
            // the request must retain the submit event's direct user gesture.
            const hadPermission = chrome.permissions.contains({ origins }).catch(() => null);
            let granted = false, added = false, registered = false;
            try {
                // Request before any await: Chrome requires a direct user gesture.
                granted = await chrome.permissions.request({ origins });
                if (!granted) throw new Error('denied');
                const current = (await chrome.storage.local.get('giteaSites')).giteaSites || [];
                if (current.length >= 20 && !current.includes(site.baseUrl)) throw new Error('limit');
                if (!current.includes(site.baseUrl)) {
                    await chrome.storage.local.set({ giteaSites: [...current, site.baseUrl] });
                    added = true;
                }
                const reply = await chrome.runtime.sendMessage({ type: 'LC_SITES_SYNC' });
                if (!reply?.ok) throw new Error('registration');
                registered = true;
                await show(); input.value = '';
                status.textContent = ko ? '추가했어. Gitea 이슈 목록을 새로고침해. HTTP 사이트는 암호화되지 않아.' : 'Added. Reload the Gitea issue list. HTTP sites are not encrypted.';
            } catch {
                try {
                    if (!registered) {
                        let cleanupFailed = false, next = null;
                        try {
                            const current = (await chrome.storage.local.get('giteaSites')).giteaSites || [];
                            next = added ? current.filter(v => v !== site.baseUrl) : current;
                            if (added) await chrome.storage.local.set({ giteaSites: next });
                        } catch { cleanupFailed = true; }
                        // Permission cleanup must still run if storage is unavailable.
                        // A false pre-request check rules out pre-existing host access.
                        const used = next?.map(LCSites.normalize).filter(Boolean).some(v => LCSites.permission(v) === origins[0]);
                        const previous = await hadPermission;
                        if (granted && previous === null) cleanupFailed = true;
                        if (granted && previous === false && !used) {
                            try {
                                await chrome.permissions.remove({ origins });
                                if (await chrome.permissions.contains({ origins })) cleanupFailed = true;
                            } catch { cleanupFailed = true; }
                        }
                        try {
                            const reply = await chrome.runtime.sendMessage({ type: 'LC_SITES_SYNC' });
                            if (!reply?.ok) cleanupFailed = true;
                        } catch { cleanupFailed = true; }
                        if (cleanupFailed) throw new Error('cleanup');
                    }
                    await show();
                    status.textContent = ko ? '권한 또는 등록에 실패했어. 주소와 Chrome 사이트 권한을 확인해.' : 'Permission or registration failed. Check the URL and Chrome site permissions.';
                } catch {
                    status.textContent = ko ? '추가 실패 후 정리도 실패했어. Chrome의 확장 프로그램 사이트 권한과 등록 목록을 직접 확인해.' : 'Addition and cleanup failed. Check Chrome extension site access and the configured list manually.';
                }
            }
            finally { add.disabled = false; }
        });
        void show().catch(() => { status.textContent = ko ? '설정을 읽지 못했어.' : 'Could not read settings.'; });
        return section;
    }
    globalThis.LCSiteSettings = { create };
})();
