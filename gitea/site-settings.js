/* The installation is fixed; only display-name links are configurable. */
(() => {
    'use strict';
    function create(prefs) {
        const ko = prefs.language === 'ko', node = (tag, text) => { const n = document.createElement(tag); if (text) n.textContent = text; return n; };
        const section = node('section'); section.className = 'section';
        section.append(node('h2', ko ? 'Gitea 계정 연결' : 'Gitea account link'));
        const status = node('p'); status.setAttribute('role', 'status'); section.append(status);
        const account = LCWeb.account, site = LCWeb.site;
        section.append(node('p', site.baseUrl + ' · @' + account));
        section.append(node('p', ko ? '이전된 GitHub 댓글을 본인 색상으로 표시할 이름을 연결해. 이 브라우저와 현재 Gitea 계정에만 저장해.' : 'Link the GitHub name on imported comments to this Gitea account. Stored only for this account in this browser.'));
        const form = node('form'); form.className = 'identity-form';
        const label = node('label', ko ? '이전 댓글의 내 GitHub 이름' : 'My GitHub name on imported comments');
        const input = node('input'); input.required = true; input.maxLength = 64; input.pattern = '[A-Za-z0-9][A-Za-z0-9_.-]{0,63}'; input.autocomplete = 'off'; input.spellcheck = false;
        label.append(input); const save = node('button', ko ? '내 계정 연결 저장' : 'Save my account link'); save.className = 'btn'; save.type = 'submit';
        const remove = node('button', ko ? '연결 제거' : 'Remove link'); remove.className = 'btn'; remove.type = 'button';
        form.append(label, save, remove); section.append(form);
        const show = async () => { const data = await LCWeb.storage.local.get('giteaIdentityLinks'); input.value = data.giteaIdentityLinks?.find(l => l.giteaLogin === account)?.githubLogin || ''; };
        form.addEventListener('submit', async event => {
            event.preventDefault(); save.disabled = true;
            try { await LCWeb.storage.local.set({ giteaIdentityLinks: [{ baseUrl: site.baseUrl, giteaLogin: account, githubLogin: input.value.trim().toLowerCase() }] }); status.textContent = ko ? '저장했어. 열린 목록과 본문에 바로 적용해.' : 'Saved. Open lists and conversations update immediately.'; }
            catch { status.textContent = ko ? '저장하지 못했어.' : 'Could not save.'; }
            finally { save.disabled = false; }
        });
        remove.addEventListener('click', async () => { await LCWeb.storage.local.set({ giteaIdentityLinks: [] }); await show(); status.textContent = ko ? '연결을 제거했어.' : 'Link removed.'; });
        void show(); return section;
    }
    globalThis.LCSiteSettings = { create };
})();
