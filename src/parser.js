/* Last Comment for GitHub — verified timeline parser. MIT.
 * Derived from the user's gh-last-comment-author parser (v1.5–1.7.1).
 * Only direct IssueComment nodes count; edits and timeline events do not.
 */
(() => {
    'use strict';
    const CONFIG = { showAvatar: true, pageSize: 50, maxTimelinePages: 40 };
    const obj = v => v && typeof v === 'object' && !Array.isArray(v) ? v : null;
    const str = (...values) => values.find(v => typeof v === 'string' && v.trim())?.trim() || '';
    const integer = v => Number.isSafeInteger(v) && v >= 0 ? v : null;
    const keyOf = i => `${i.owner}/${i.repo}#${i.number}`.toLowerCase();
    const fail = code => Object.assign(new Error(code), { code });
    const abortCheck = signal => { if (signal?.aborted)
        throw fail('ABORTED'); };
    const stats = { commentFastPaths: 0, avoidedPagination: 0, pages: 0 };
    const log = () => { };
    const alias = () => '';
    const shapeOf = () => ({});
    function bodySource(source) {
        if (!obj(source))
            return null;
        for (const [format, fields] of [['html', ['bodyHTML', 'bodyHtml', 'body_html']],
            ['markdown', ['rawBody', 'raw_body', 'body']], ['text', ['bodyText', 'body_text']]]) {
            for (const field of fields)
                if (typeof source[field] === 'string' && source[field].trim()) {
                    const limit = format === 'html' ? 128000 : 16000;
                    return { format, text: source[field].slice(0, limit), truncated: source[field].length > limit };
                }
        }
        return { format: 'text', text: '', truncated: false };
    }
    function parseConversationUrl(href) {
        try {
            const url = new URL(href, 'https://github.com');
            if (url.origin !== 'https://github.com' || url.username || url.password)
                return null;
            const m = url.pathname.match(/^\/([^/]+)\/([^/]+)\/(issues|pull)\/(\d+)\/?$/);
            if (!m)
                return null;
            const info = { owner: m[1], repo: m[2], type: m[3], number: m[4],
                url: `${url.origin}/${m[1]}/${m[2]}/${m[3]}/${m[4]}` };
            info.key = keyOf(info);
            return info;
        }
        catch {
            return null;
        }
    }
    function walkJson(root, visit) {
        const stack = [root], seen = new WeakSet();
        while (stack.length) {
            const value = stack.pop();
            if (!value || typeof value !== 'object' || seen.has(value))
                continue;
            seen.add(value);
            visit(value);
            const children = Array.isArray(value) ? value : Object.values(value);
            for (let i = children.length - 1; i >= 0; i--)
                if (children[i] && typeof children[i] === 'object')
                    stack.push(children[i]);
        }
    }
    function embeddedRoots(doc) {
        const roots = [];
        for (const s of doc.querySelectorAll('script[type="application/json"]')) {
            try {
                roots.push(JSON.parse(s.textContent));
            }
            catch { }
        }
        return roots;
    }
    function connections(subject) {
        const result = {};
        if (!obj(subject))
            return result;
        for (const [key, value] of Object.entries(subject)) {
            if (/^(?:front|back)?timelineitems$/i.test(key) && obj(value) &&
                (Array.isArray(value.edges) || Array.isArray(value.nodes))) {
                result[/^front/i.test(key) ? 'front' : /^back/i.test(key) ? 'back' : 'timeline'] = value;
            }
        }
        return result;
    }
    function hasSubjectFields(v) {
        return Object.keys(connections(v)).length > 0 || (obj(v?.comments) &&
            (integer(v.comments.totalCount) !== null || Array.isArray(v.comments.edges) || Array.isArray(v.comments.nodes)));
    }
    function subjectMatches(value, info, expectedId = '') {
        if (!obj(value))
            return false;
        const id = str(value.id, value.nodeId, value.node_id);
        if (expectedId && id && id !== expectedId)
            return false;
        if (value.number != null && String(value.number) !== info.number)
            return false;
        const repo = str(value.repository?.nameWithOwner);
        if (repo && repo.toLowerCase() !== `${info.owner}/${info.repo}`.toLowerCase())
            return false;
        const raw = str(value.url, value.resourcePath, value.resource_path);
        if (raw) {
            const p = parseConversationUrl(raw);
            if (!p || keyOf(p) !== keyOf(info))
                return false;
        }
        return true;
    }
    function findSubject(roots, info, expectedId = '') {
        const matches = [];
        for (const root of roots)
            walkJson(root, value => {
                if (!hasSubjectFields(value) || !subjectMatches(value, info, expectedId))
                    return;
                const id = str(value.id, value.nodeId, value.node_id);
                const url = parseConversationUrl(str(value.url, value.resourcePath, value.resource_path));
                const numberMatches = String(value.number ?? '') === info.number;
                if (!(expectedId && id === expectedId) && !url && !numberMatches)
                    return;
                matches.push({ value, score: (expectedId && id === expectedId ? 100 : 0) + (url ? 20 : 0) +
                        (numberMatches ? 8 : 0) + (connections(value).front ? 4 : 0) + (value.repository?.nameWithOwner ? 2 : 0) });
            });
        matches.sort((a, b) => b.score - a.score);
        if (!matches.length)
            return null;
        if (matches[1]?.score === matches[0].score && str(matches[1].value.id) !== str(matches[0].value.id))
            throw fail('SUBJECT');
        return matches[0].value;
    }
    function edgesOf(conn) {
        if (Array.isArray(conn?.edges))
            return conn.edges;
        if (Array.isArray(conn?.nodes))
            return conn.nodes.map(node => ({ node }));
        return [];
    }
    function pageInfo(conn) {
        const p = conn?.pageInfo || conn?.page_info || {};
        return { next: p.hasNextPage ?? p.has_next_page, previous: p.hasPreviousPage ?? p.has_previous_page,
            end: str(p.endCursor, p.end_cursor, edgesOf(conn).at(-1)?.cursor) };
    }
    function edgeKey(edge) { return str(edge?.node?.id, edge?.node?.url, edge?.node?.resourcePath, edge?.cursor); }
    function commentCount(subject) {
        return integer(subject?.comments?.totalCount) ?? integer(subject?.comments?.total_count);
    }
    function safeAvatar(raw) {
        if (typeof raw !== 'string' || !raw.trim())
            return '';
        try {
            const u = new URL(raw, 'https://github.com');
            if (u.protocol !== 'https:' || u.username || u.password ||
                !['github.com', 'avatars.githubusercontent.com'].includes(u.hostname))
                return '';
            return u.href;
        }
        catch {
            return '';
        }
    }
    function mentioned(value, me) {
        if (!me)
            return false;
        let text = str(value.bodyText, value.body_text, value.body, value.rawBody, value.raw_body);
        if (!text) {
            const html = str(value.bodyHTML, value.bodyHtml, value.body_html);
            if (html) {
                const template = document.createElement('template');
                template.innerHTML = html;
                template.content.querySelectorAll('pre, code, blockquote').forEach(n => n.remove());
                text = template.content.textContent || '';
            }
        }
        const escaped = me.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`(^|[^A-Za-z0-9_])@${escaped}(?![A-Za-z0-9_-])`, 'i').test(text);
    }
    function commentFromNode(value, info, me) {
        if (!obj(value))
            return null;
        const type = str(value.__typename, value.type);
        if (type && type !== 'IssueComment' && type !== 'issue_comment')
            return null;
        const raw = str(value.url, value.permalink, value.htmlUrl, value.html_url, value.resourcePath, value.resource_path);
        let id = '', parsedUrl = null;
        if (raw) {
            try {
                parsedUrl = new URL(raw, 'https://github.com');
            }
            catch {
                throw fail('COMMENT_SHAPE');
            }
            const match = parsedUrl.hash.match(/^#issuecomment-(\d+)$/);
            if (match) {
                const p = parseConversationUrl(parsedUrl.href);
                if (!p || keyOf(p) !== keyOf(info)) {
                    if (type === 'IssueComment' || type === 'issue_comment')
                        throw fail('SUBJECT');
                    return null;
                }
                id = match[1];
            }
            else if (parsedUrl.hostname === 'api.github.com') {
                const m = parsedUrl.pathname.match(/^\/repos\/([^/]+)\/([^/]+)\/issues\/comments\/(\d+)$/);
                if (m && `${m[1]}/${m[2]}`.toLowerCase() === `${info.owner}/${info.repo}`.toLowerCase())
                    id = m[3];
            }
        }
        if (!type && !id)
            return null;
        if (!id && !raw) {
            const databaseId = value.fullDatabaseId ?? value.databaseId ?? value.database_id;
            if (/^\d+$/.test(String(databaseId ?? '')))
                id = String(databaseId);
        }
        if (!id)
            throw fail('COMMENT_SHAPE');
        const time = str(value.createdAt, value.created_at);
        if (!Number.isFinite(Date.parse(time)))
            throw fail('COMMENT_SHAPE');
        const actor = obj(value.author) || obj(value.user) || {};
        const author = str(actor.login, actor.username, value.authorLogin, value.author_login).replace(/^@/, '');
        const avatar = CONFIG.showAvatar ? safeAvatar(str(actor.avatarUrl, actor.avatar_url, author ? `https://github.com/${encodeURIComponent(author)}.png?size=32` : '')) : '';
        return { kind: 'comment', commentId: id, author, avatar, time,
            commentUrl: `${info.url}#issuecomment-${id}`, isBot: str(actor.__typename, actor.type).toLowerCase() === 'bot' || /\[bot\]$/i.test(author),
            mentionsMe: false, _mentionSource: value, _mentionLogin: me };
    }
    function compareComments(a, b) {
        const delta = Date.parse(a.time) - Date.parse(b.time);
        if (delta) return delta;
        const left = BigInt(a.commentId), right = BigInt(b.commentId);
        return left === right ? 0 : left < right ? -1 : 1;
    }
    function publicComment(item) {
        const { commentId, _mentionSource, _mentionLogin, ...result } = item;
        result.mentionsMe = _mentionSource ? mentioned(_mentionSource, _mentionLogin) : !!result.mentionsMe;
        result.preview = bodySource(_mentionSource);
        return result;
    }
    function newest(comments) {
        let latest = null;
        for (const item of comments.values())
            if (!latest || compareComments(item, latest) > 0) latest = item;
        return latest ? publicComment(latest) : { kind: 'none' };
    }
    // Called only after the existing completeness checks, and only on an explicit
    // history request. Missing/deleted anchors are errors, never guessed predecessors.
    function historyWindow(comments, before) {
        const ordered = [...comments.values()].sort((a, b) => compareComments(b, a));
        const index = ordered.findIndex(item => item.commentUrl === before);
        if (index < 0) throw fail('HISTORY_ANCHOR');
        const result = [];
        let chars = 0;
        for (const item of ordered.slice(index + 1)) {
            const value = publicComment(item), size = value.preview?.text.length || 0;
            if (result.length && (result.length >= 20 || chars + size > 256000)) break;
            chars += size; result.push(value);
        }
        return { kind: 'history', before, comments: result, hasMore: index + 1 + result.length < ordered.length };
    }
    function addComments(edges, info, me, into) {
        for (const edge of edges) {
            const candidate = commentFromNode(edge?.node, info, me);
            if (candidate)
                into.set(candidate.commentId, candidate);
        }
    }
    function collectLegacyDom(doc, info, me, expected, select = newest) {
        if (expected === null)
            throw fail('PAGE_SHAPE');
        const found = new Map();
        for (const node of doc.querySelectorAll('[id^="issuecomment-"]')) {
            if (!/^issuecomment-\d+$/.test(node.id) || node.closest('.markdown-body, .comment-body, blockquote'))
                continue;
            const container = node.matches('.timeline-comment, .js-comment-container') ? node :
                node.closest('.timeline-comment, .js-comment-container') || node;
            const header = container.querySelector('.timeline-comment-header, [data-testid="comment-header"]');
            if (!header)
                continue;
            const authorNode = header.querySelector('a.author, a[data-hovercard-type="user"], a[data-hovercard-type="bot"]');
            const author = authorNode?.textContent.trim().replace(/^@/, '') || '';
            const permalink = [...header.querySelectorAll('a[href]')].find(a => a.getAttribute('href')?.endsWith(`#${node.id}`));
            const datetime = (permalink || header).querySelector('relative-time[datetime], time[datetime]')?.getAttribute('datetime');
            const candidate = commentFromNode({ __typename: 'IssueComment', url: `${info.url}#${node.id}`, createdAt: datetime,
                author: { login: author }, bodyHTML: container.querySelector('.comment-body')?.innerHTML || '' }, info, me);
            if (candidate)
                found.set(candidate.commentId, candidate);
        }
        if (found.size !== expected)
            throw fail('INCOMPLETE');
        return select(found);
    }
    function findPageConnection(json, info, id) {
        const bound = findSubject([json], info, id);
        if (bound) {
            const c = connections(bound);
            return c.front || c.timeline || null;
        }
        const direct = [json?.data?.node, json?.data?.issue, json?.data?.repository?.issue,
            json?.data?.repository?.pullRequest, json?.data?.repository?.issueOrPullRequest];
        for (const item of direct) {
            if (!subjectMatches(item, info, id))
                continue;
            const c = connections(item);
            if (c.front || c.timeline)
                return c.front || c.timeline;
        }
        return null;
    }
    async function parseLastComment(html, info, me, signal, fetchPage, options = {}) {
        const select = options.before ? comments => historyWindow(comments, options.before) : newest;
        abortCheck(signal);
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const roots = embeddedRoots(doc);
        const subject = findSubject(roots, info);
        if (!subject) {
            log('subject_not_found', { jsonScripts: roots.length, shape: shapeOf(roots.slice(0, 2)) });
            throw fail('PAGE_SHAPE');
        }
        const expectedComments = commentCount(subject);
        const conns = connections(subject);
        const front = conns.front || conns.timeline;
        const back = conns.back;
        if (!front) {
            const c = subject.comments, edges = edgesOf(c), pi = pageInfo(c);
            if ((expectedComments !== null && edges.length === expectedComments) ||
                (edges.length > 0 && pi.next === false && pi.previous === false)) {
                const comments = new Map();
                addComments(edges, info, me, comments);
                if (comments.size !== edges.length)
                    throw fail('COMMENT_SHAPE');
                if (expectedComments !== null && comments.size !== expectedComments)
                    throw fail('INCOMPLETE');
                return select(comments);
            }
            return collectLegacyDom(doc, info, me, expectedComments, select);
        }
        const comments = new Map(), loaded = new Set();
        const frontEdges = edgesOf(front), backEdges = edgesOf(back);
        const backKeys = new Set(backEdges.map(edgeKey).filter(Boolean));
        const frontKeys = new Set(frontEdges.map(edgeKey).filter(Boolean));
        const backIsTail = Boolean(back && pageInfo(back).next === false);
        let joinedTail = backIsTail && [...frontKeys].some(key => backKeys.has(key));
        const totals = [front, back].filter(Boolean).map(c => integer(c.totalCount) ?? integer(c.total_count)).filter(n => n !== null);
        if (new Set(totals).size > 1)
            throw fail('SNAPSHOT_CHANGED');
        let total = totals[0] ?? null;
        function add(edges) {
            for (const edge of edges) {
                const key = edgeKey(edge);
                if (key)
                    loaded.add(key);
            }
            addComments(edges, info, me, comments);
        }
        add(frontEdges);
        add(backEdges);
        if (total !== null && loaded.size > total)
            throw fail('SNAPSHOT_CHANGED');
        if (expectedComments !== null && comments.size > expectedComments)
            throw fail('INCOMPLETE');
        if (expectedComments !== null && comments.size === expectedComments) {
            stats.commentFastPaths++;
            if (pageInfo(front).next !== false && !(total !== null && loaded.size === total))
                stats.avoidedPagination++;
            log('comments_complete', { item: alias(info), comments: comments.size });
            return select(comments);
        }
        let pi = pageInfo(front);
        if (pi.previous === true && !(total !== null && loaded.size === total))
            throw fail('INCOMPLETE');
        let cursor = pi.end, pages = 0;
        const cursors = new Set(cursor ? [cursor] : []);
        const id = str(subject.id, subject.nodeId, subject.node_id);
        const isComplete = () => pi.next === false || joinedTail || (total !== null && loaded.size === total);
        while (!isComplete()) {
            abortCheck(signal);
            if (total !== null && loaded.size > total)
                throw fail('SNAPSHOT_CHANGED');
            if (!id || !cursor)
                throw fail('INCOMPLETE');
            if (pages >= CONFIG.maxTimelinePages)
                throw fail('PAGE_LIMIT');
            const missing = total === null ? CONFIG.pageSize : Math.max(1, total - loaded.size);
            const count = Math.min(CONFIG.pageSize, missing);
            const json = await fetchPage(id, cursor, count, signal);
            abortCheck(signal);
            if (Array.isArray(json?.errors) && json.errors.length)
                throw fail('QUERY');
            const next = findPageConnection(json, info, id);
            if (!next) {
                log('pagination_shape', { shape: shapeOf(json) });
                throw fail('INCOMPLETE');
            }
            const newTotal = integer(next.totalCount) ?? integer(next.total_count);
            if (newTotal !== null && total !== null && newTotal !== total)
                throw fail('SNAPSHOT_CHANGED');
            if (total === null && newTotal !== null)
                total = newTotal;
            const edges = edgesOf(next), previousSize = loaded.size;
            if (backIsTail && edges.some(e => backKeys.has(edgeKey(e))))
                joinedTail = true;
            add(edges);
            pages++;
            stats.pages++;
            if (total !== null && loaded.size > total)
                throw fail('SNAPSHOT_CHANGED');
            if (expectedComments !== null && comments.size > expectedComments)
                throw fail('INCOMPLETE');
            if (expectedComments !== null && comments.size === expectedComments) {
                stats.commentFastPaths++;
                log('comments_complete', { item: alias(info), pages, comments: comments.size });
                return select(comments);
            }
            const nextPi = pageInfo(next);
            if (total !== null && loaded.size > total)
                throw fail('SNAPSHOT_CHANGED');
            const complete = nextPi.next === false || joinedTail || (total !== null && loaded.size === total);
            if (!complete && (!nextPi.end || cursors.has(nextPi.end) || loaded.size === previousSize || !edges.length))
                throw fail('NO_PROGRESS');
            if (nextPi.next === false && total !== null && loaded.size !== total)
                throw fail('INCOMPLETE');
            pi = nextPi;
            cursor = nextPi.end;
            if (cursor)
                cursors.add(cursor);
        }
        if (total !== null && loaded.size !== total)
            throw fail('INCOMPLETE');
        if (expectedComments !== null && comments.size !== expectedComments)
            throw fail('INCOMPLETE');
        log('timeline_complete', { item: alias(info), pages, items: loaded.size, comments: comments.size });
        return select(comments);
    }
    globalThis.LCParser = Object.freeze({ parseLastComment, parseConversationUrl, safeAvatar, bodySource,
        commentFromNode, newest, pageInfo, commentCount, historyWindow, compareComments });
})();
