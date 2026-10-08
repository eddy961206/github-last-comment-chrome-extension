/* Token-free reader for Gitea's server-rendered ordinary conversation comments. */
(() => {
    'use strict';
    const fail = code => Object.assign(new Error(code), { code });
    function parse(html, info, me, signal, options = {}) {
        if (signal?.aborted) throw fail('ABORTED');
        const doc = new DOMParser().parseFromString(html, 'text/html');
        // Keep the original PR selectors and the observed Gitea 28 layout.
        const timeline = doc.querySelector('.issue-content .comment-list > .timeline, .issue-content-left > .comment-list');
        const first = timeline && [...timeline.children].find(n => n.matches('.timeline-item.comment.first, .timeline-item.comment.issue-content-comment'));
        if (!first || !LCSites.isGitea(doc)) throw fail('PAGE_SHAPE');
        const zone = first.querySelector('.edit-content-zone[data-update-url]');
        const expected = `${info.baseUrl}/${info.owner}/${info.repo}/issues/${info.number}/content`;
        if (!zone || new URL(zone.getAttribute('data-update-url'), info.url).href.toLowerCase() !== expected.toLowerCase()) throw fail('SUBJECT');
        // Fail closed on unknown pagination rather than mislabel a partial result.
        if (timeline.querySelector('.pagination, .load-more, [data-next-page], [data-has-more="true"]')) throw fail('INCOMPLETE');
        const comments = new Map();
        for (const row of timeline.children) {
            if (!row.matches('.timeline-item.comment') || row === first || row.classList.contains('form')) continue;
            const match = row.id.match(/^issuecomment-(\d+)$/);
            if (!match) throw fail('COMMENT_SHAPE');
            const header = row.querySelector(':scope > .comment-container > .comment-header');
            const left = header?.querySelector('.comment-header-left');
            const time = left?.querySelector('relative-time[datetime],time[datetime]')?.getAttribute('datetime');
            if (!left || !Number.isFinite(Date.parse(time))) throw fail('COMMENT_SHAPE');
            let author = '';
            for (const link of left.querySelectorAll('a[href]')) {
                const u = new URL(link.getAttribute('href'), info.url);
                const part = u.pathname.slice(info.basePath.length);
                if (u.origin === info.origin && !u.hash && !u.search && /^\/[^/]+$/.test(part)) { author = decodeURIComponent(part.slice(1)); break; }
            }
            // Imported GitHub authors have no local profile link. Gitea renders
            // their original name in the leading span beside the migration icon.
            if (!author && left.querySelector(':scope > .migrate')) {
                const imported = left.firstElementChild;
                if (imported?.tagName === 'SPAN' && imported.querySelector('svg')) author = imported.textContent.trim();
            }
            const body = row.querySelector(':scope > .comment-container > .comment-body');
            if (!body) throw fail('COMMENT_SHAPE');
            const raw = body.querySelector(`[id="issuecomment-${match[1]}-raw"]`);
            const markup = body.querySelector(':scope > .render-content');
            const source = raw ? { body: raw.textContent } : { bodyHTML: markup?.innerHTML || '' };
            const image = row.querySelector(':scope > .timeline-avatar img');
            comments.set(match[1], { kind: 'comment', commentId: match[1], author, time,
                avatar: LCSites.asset(image?.getAttribute('src') || '', info),
                commentUrl: `${info.url}#issuecomment-${match[1]}`, isBot: /\[bot\]$/i.test(author),
                _mentionSource: source, _mentionLogin: me });
        }
        return options.before ? LCParser.historyWindow(comments, options.before) : LCParser.newest(comments);
    }
    globalThis.LCGitea = Object.freeze({ parse });
})();
