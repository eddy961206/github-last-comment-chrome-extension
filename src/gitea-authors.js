/* Local presentation of ordinary Gitea conversation authors. No requests/writes. */
(() => {
    'use strict';
    const OWN = 'data-lc-owned';
    function hue(login) {
        let hash = 0;
        for (const char of login.toLowerCase()) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
        return hash % 360;
    }
    class Authors {
        constructor() { this.rows = new Map(); this.listAuthors = new Map(); }
        clearListAuthor(element, removeWrapper = true) {
            const previous = this.listAuthors.get(element);
            if (!previous) return;
            if (element.style.getPropertyValue('color') === previous.installed) {
                if (previous.color) element.style.setProperty('color', previous.color, previous.priority);
                else element.style.removeProperty('color');
            }
            this.listAuthors.delete(element);
            if (removeWrapper && element.hasAttribute('data-lc-list-author')) {
                const parent = element.parentNode;
                element.replaceWith(document.createTextNode(element.textContent));
                parent?.normalize();
            }
        }
        updateList(site, self, theme) {
            const found = new Set();
            for (const container of document.querySelectorAll('#issue-list > .item > .item-main > .item-body > div.flex-text-inline')) {
                let actor = LCGitea.author(container, { ...site, url: site.baseUrl + '/' });
                if (!actor && self.length) {
                    // Migrated list creators have no profile link. The observed
                    // Korean Gitea markup puts "<login>에 의해" before its time.
                    const wrapped = container.querySelector(':scope > [data-lc-list-author]');
                    if (wrapped) actor = { login: wrapped.textContent, element: wrapped };
                    else {
                        const text = [...container.childNodes].find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
                        const match = text?.textContent.match(/^(\s*)([a-z0-9][a-z0-9_.-]{0,63})(에 의해\s*)$/i);
                        if (match && container.querySelector(':scope > relative-time[datetime]') && !self.includes(match[2].toLowerCase())) {
                            const name = document.createElement('span');
                            name.dataset.lcListAuthor = ''; name.textContent = match[2];
                            text.replaceWith(document.createTextNode(match[1]), name, document.createTextNode(match[3]));
                            actor = { login: match[2], element: name };
                        }
                    }
                }
                if (!actor?.login) continue;
                const element = actor.element;
                // Keep the site's original color for the signed-in account and
                // its explicitly linked migration identity. Guests are unclassified.
                if (!self.length || self.includes(actor.login.toLowerCase())) continue;
                found.add(element);
                const login = actor.login.toLowerCase();
                // Stable author hue, restrained saturation and consistent brightness.
                let colorHash = 2166136261;
                for (const char of login) colorHash = Math.imul(colorHash ^ char.charCodeAt(0), 16777619) >>> 0;
                const color = `hsl(${colorHash % 360} ${theme === 'dark' ? '24% 70%' : '28% 36%'})`;
                let record = this.listAuthors.get(element);
                if (record && element.style.getPropertyValue('color') === record.installed && record.theme === theme && record.login === login) continue;
                if (record) this.clearListAuthor(element, false);
                record = { color: element.style.getPropertyValue('color'), priority: element.style.getPropertyPriority('color'), theme, login };
                element.style.setProperty('color', color);
                record.installed = element.style.getPropertyValue('color');
                this.listAuthors.set(element, record);
            }
            for (const element of this.listAuthors.keys()) if (!found.has(element)) this.clearListAuthor(element);
        }
        clearRow(row) {
            const record = this.rows.get(row);
            if (!record) return;
            for (const node of record.nodes) node.remove();
            for (const [element, property, old, priority, installed] of record.styles) {
                if (element.style.getPropertyValue(property) !== installed) continue;
                if (old) element.style.setProperty(property, old, priority);
                else element.style.removeProperty(property);
            }
            this.rows.delete(row);
        }
        clear() {
            for (const row of [...this.rows.keys()]) this.clearRow(row);
            for (const element of [...this.listAuthors.keys()]) this.clearListAuthor(element);
        }
        update(info, self, theme, language, site) {
            this.updateList(site, self, theme);
            if (!info) {
                for (const row of [...this.rows.keys()]) this.clearRow(row);
                return;
            }
            const rows = [...document.querySelectorAll('.issue-content-left > .comment-list > .timeline-item.comment, .issue-content .comment-list > .timeline > .timeline-item.comment')]
                .filter(row => !row.classList.contains('form'));
            const found = new Set(rows);
            for (const row of this.rows.keys()) if (!found.has(row)) this.clearRow(row);
            for (const row of rows) {
                const header = row.querySelector(':scope > .comment-container > .comment-header');
                const actor = LCGitea.author(header?.querySelector('.comment-header-left'), info);
                if (!actor?.login) { this.clearRow(row); continue; }
                const mine = self.includes(actor.login.toLowerCase());
                const signature = JSON.stringify([actor.login, mine, theme, language]);
                const previous = this.rows.get(row);
                if (previous?.signature === signature && previous.authorElement === actor.element && previous.header === header) continue;
                this.clearRow(row);
                const record = { signature, authorElement: actor.element, header, styles: [], nodes: [] };
                this.rows.set(row, record);
                const style = (element, property, value) => {
                    const old = element.style.getPropertyValue(property), priority = element.style.getPropertyPriority(property);
                    element.style.setProperty(property, value);
                    record.styles.push([element, property, old, priority, element.style.getPropertyValue(property)]);
                };
                const dark = theme === 'dark', color = mine ? (dark ? '#aab3c2' : '#526173') : `hsl(${hue(actor.login)} 72% ${dark ? '72%' : '32%'})`;
                const tint = mine ? (dark ? 'rgba(170,179,194,.12)' : 'rgba(82,97,115,.08)') : `hsl(${hue(actor.login)} 72% 50% / ${dark ? '.14' : '.08'})`;
                style(actor.element, 'color', color);
                style(actor.element, 'font-weight', '750');
                style(actor.element, 'border', `1px solid ${color}`);
                style(actor.element, 'border-radius', '6px');
                style(actor.element, 'padding', '3px 7px');
                style(actor.element, 'background-color', tint);
                style(header, 'background-color', tint);
                style(header.parentElement, 'border-left', `3px solid ${color}`);
                if (mine) {
                    const flag = document.createElement('span'); flag.setAttribute(OWN, '');
                    flag.style.cssText = 'display:inline-block;margin-left:6px;';
                    const shadow = flag.attachShadow({ mode: 'open' }), badge = document.createElement('span');
                    badge.textContent = language === 'ko' ? '나' : 'You';
                    badge.style.cssText = `font:700 12px/1.4 system-ui;color:${color};padding:2px 6px;border:1px solid ${color};border-radius:5px;white-space:nowrap;`;
                    shadow.append(badge); actor.element.after(flag); record.nodes.push(flag);
                }
                // Original migration avatars are identical. Initials keep each
                // author identifiable even when color perception differs.
                const avatar = row.querySelector(':scope > .timeline-avatar');
                const image = avatar?.querySelector('img');
                if (avatar && image) {
                    if (!header.querySelector('.comment-header-left > .migrate')) {
                        style(image, 'border', `2px solid ${color}`);
                        style(image, 'border-radius', '50%');
                        style(image, 'box-sizing', 'border-box');
                        continue; // Keep real local-account profile pictures.
                    }
                    style(avatar, 'position', 'relative');
                    style(image, 'visibility', 'hidden');
                    const host = document.createElement('span'); host.setAttribute(OWN, '');
                    host.style.cssText = 'position:absolute;inset:0;display:block;pointer-events:none;';
                    const shadow = host.attachShadow({ mode: 'open' }), initials = document.createElement('span');
                    initials.textContent = actor.login.slice(0, 2).toUpperCase(); initials.title = '@' + actor.login;
                    initials.style.cssText = `box-sizing:border-box;display:grid;place-items:center;width:100%;height:100%;min-width:32px;min-height:32px;border-radius:50%;border:2px solid ${color};background:${dark ? '#20242c' : '#fff'};color:${color};font:750 14px/1 system-ui;`;
                    shadow.append(initials); avatar.append(host); record.nodes.push(host);
                }
            }
        }
    }
    globalThis.LCGiteaAuthors = Authors;
})();
