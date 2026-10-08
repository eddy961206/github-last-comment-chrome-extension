/* Explicitly approved Gitea installations; never auto-grant access to other sites. */
(() => {
    'use strict';
    function normalize(raw) {
        try {
            if (typeof raw !== 'string' || raw.length > 500 || /[\s*\\]/.test(raw)) return null;
            const u = new URL(raw);
            if (!['https:', 'http:'].includes(u.protocol) || u.username || u.password || u.search || u.hash || u.hostname === 'github.com') return null;
            const basePath = u.pathname.replace(/\/+$/, '');
            if (/%(?:2f|5c|2e)/i.test(basePath) || !/^[/A-Za-z0-9._~-]*$/.test(basePath)) return null;
            return { provider: 'gitea', origin: u.origin, basePath, baseUrl: u.origin + basePath };
        } catch { return null; }
    }
    const github = Object.freeze({ provider: 'github', origin: 'https://github.com', basePath: '', baseUrl: 'https://github.com' });
    function find(href, configured = []) {
        try {
            const u = new URL(href);
            if (u.username || u.password) return null;
            if (u.origin === github.origin) return github;
            return (Array.isArray(configured) ? configured : []).map(normalize).filter(Boolean)
                .sort((a, b) => b.basePath.length - a.basePath.length)
                .find(s => s.origin === u.origin && (u.pathname === s.basePath || u.pathname.startsWith(s.basePath + '/'))) || null;
        } catch { return null; }
    }
    // Chrome match patterns ignore port numbers. Runtime validation below checks the exact origin.
    const permission = s => new URL(s.baseUrl).protocol + '//' + new URL(s.baseUrl).hostname + '/*';
    function conversation(href, site) {
        if (!site) return null;
        try {
            const u = new URL(href, site.baseUrl + '/');
            if (u.origin !== site.origin || u.username || u.password || !u.pathname.startsWith(site.basePath + '/')) return null;
            const p = u.pathname.slice(site.basePath.length);
            const m = p.match(site.provider === 'github' ? /^\/([^/]+)\/([^/]+)\/(issues|pull)\/(\d+)\/?$/ : /^\/([^/]+)\/([^/]+)\/(issues|pulls)\/(\d+)\/?$/);
            if (!m || Number(m[4]) < 1) return null;
            const info = { ...site, owner: m[1], repo: m[2], type: m[3], number: m[4], url: `${site.baseUrl}/${m[1]}/${m[2]}/${m[3]}/${m[4]}` };
            info.key = `${m[1]}/${m[2]}#${m[4]}`.toLowerCase();
            return info;
        } catch { return null; }
    }
    function listKind(href, site) {
        if (!site) return '';
        const u = new URL(href);
        if (u.origin !== site.origin || !u.pathname.startsWith(site.basePath + '/')) return '';
        const p = u.pathname.slice(site.basePath.length).replace(/\/$/, '');
        if (/^\/[^/]+\/[^/]+\/(issues|pulls)$/.test(p) || /^\/(issues|pulls)(\/(assigned|mentioned|created|recent|review-requested))?$/.test(p)) return 'list';
        if (site.provider === 'github' && p === '/search' && !['code','repositories','commits','users','discussions'].includes(u.searchParams.get('type'))) return 'search';
        return '';
    }
    function isGitea(doc) {
        // Gitea 28 no longer emits the generator meta tag. Its standard footer
        // identifies the product; only explicitly approved installations use this.
        return /gitea/i.test(doc.querySelector('meta[name="generator"]')?.content || '') ||
            !!doc.querySelector('footer a[href="https://about.gitea.com"]');
    }
    function login(doc, site) {
        if (site.provider === 'github') return (doc.querySelector('meta[name="user-login"]')?.content || '').replace(/^@/, '');
        return doc.querySelector('.user-menu > .header strong')?.textContent.trim() || '';

    }
    function asset(raw, site) {
        try { const u = new URL(raw, site.baseUrl + '/'); return raw && u.origin === site.origin && !u.username && !u.password ? u.href : ''; } catch { return ''; }
    }
    function selfLogins(site, account, links) {
        if (!account) return [];
        const current = account.toLowerCase(), names = [current];
        if (site.provider === 'gitea') {
            for (const link of links) {
                if (link.baseUrl === site.baseUrl && link.giteaLogin === current) names.push(link.githubLogin);
            }
        }
        return names;
    }
    globalThis.LCSites = { normalize, find, permission, conversation, listKind, isGitea, login, asset, selfLogins, github, current: null };
})();
