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
            try {
                // Request before any await: Chrome requires a direct user gesture.
                const granted = await chrome.permissions.request({ origins: [LCSites.permission(site)] });
                if (!granted) throw new Error('denied');
                const current = (await chrome.storage.local.get('giteaSites')).giteaSites || [];
                if (current.length >= 20 && !current.includes(site.baseUrl)) throw new Error('limit');
                await chrome.storage.local.set({ giteaSites: [...new Set([...current, site.baseUrl])] });
                const reply = await chrome.runtime.sendMessage({ type: 'LC_SITES_SYNC' });
                if (!reply?.ok) throw new Error('registration');
                await show(); input.value = '';
                status.textContent = ko ? '추가했어. Gitea 이슈 목록을 새로고침해. HTTP 사이트는 암호화되지 않아.' : 'Added. Reload the Gitea issue list. HTTP sites are not encrypted.';
            } catch { status.textContent = ko ? '권한 또는 등록에 실패했어. 주소와 Chrome 사이트 권한을 확인해.' : 'Permission or registration failed. Check the URL and Chrome site permissions.'; }
            finally { add.disabled = false; }
        });
        void show().catch(() => { status.textContent = ko ? '설정을 읽지 못했어.' : 'Could not read settings.'; });
        return section;
    }
    globalThis.LCSiteSettings = { create };
})();
