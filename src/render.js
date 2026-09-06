/* Dependency-free preview rendering. GitHub's HTML is preferred. A bounded
 * Markdown fallback handles common syntax. Never insert untrusted live HTML. */
(() => {
    'use strict';
    const TAGS = new Set('a p br strong b em i del s blockquote ul ol li h1 h2 h3 h4 h5 h6 pre code hr table thead tbody tfoot tr th td details summary span div kbd samp sup sub dl dt dd img input'.split(' '));
    const DROP = new Set('script style iframe object embed template noscript noembed noframes form button textarea select option base link meta audio video source canvas'.split(' '));
    const escaped = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    function safeUrl(raw, base, image = false) {
        if (typeof raw !== 'string' || !raw.trim() || /[\u0000-\u0020\u007f]/.test(raw))
            return '';
        try {
            const u = new URL(raw, base);
            if (u.username || u.password)
                return '';
            if (!image)
                return ['https:', 'http:', 'mailto:'].includes(u.protocol) ? u.href : '';
            const allowed = ['camo.githubusercontent.com', 'user-images.githubusercontent.com', 'private-user-images.githubusercontent.com', 'raw.githubusercontent.com', 'avatars.githubusercontent.com'];
            return u.protocol === 'https:' && (allowed.includes(u.hostname) || (u.hostname === 'github.com' && /^\/user-attachments\/assets\//.test(u.pathname))) ? u.href : '';
        }
        catch {
            return '';
        }
    }
    // This fallback is intentionally bounded. It is not a complete CommonMark
    // implementation: GitHub-specific embeds, math, and Mermaid are not executed.
    function inline(text, depth = 0) {
        if (depth > 8)
            return escaped(text);
        let out = '', i = 0;
        while (i < text.length) {
            const s = text.slice(i);
            let m;
            if ((m = /^\\([\\`*{}\[\]()#+.!_>~|-])/.exec(s))) {
                out += escaped(m[1]);
                i += m[0].length;
                continue;
            }
            if (s[0] === '`') {
                const fence = /^`+/.exec(s)[0];
                const end = text.indexOf(fence, i + fence.length);
                if (end >= 0) {
                    out += '<code>' + escaped(text.slice(i + fence.length, end).replace(/\n/g, ' ')) + '</code>';
                    i = end + fence.length;
                    continue;
                }
            }
            if ((m = /^(!?)\[([^\]\n]{0,1000})\]\(([^\s()]+)(?:\s+["']([^\n]*?)["'])?\)/.exec(s))) {
                const title = m[4] ? ` title="${escaped(m[4])}"` : '';
                out += m[1] ? `<img src="${escaped(m[3])}" alt="${escaped(m[2])}"${title}>` : `<a href="${escaped(m[3])}"${title}>${inline(m[2], depth + 1)}</a>`;
                i += m[0].length;
                continue;
            }
            if ((m = /^<(https?:\/\/[^<>\s]+|mailto:[^<>\s]+)>/.exec(s))) {
                out += `<a href="${escaped(m[1])}">${escaped(m[1])}</a>`;
                i += m[0].length;
                continue;
            }
            if ((m = /^(https?:\/\/[^\s<>]+)/.exec(s))) {
                const url = m[1].replace(/[.,;!?]+$/, '');
                out += `<a href="${escaped(url)}">${escaped(url)}</a>`;
                i += url.length;
                continue;
            }
            let done = false;
            for (const [delimiter, tag] of [['**', 'strong'], ['__', 'strong'], ['~~', 'del'], ['*', 'em'], ['_', 'em']]) {
                if (!s.startsWith(delimiter) || (delimiter.includes('_') && /\w/.test(text[i - 1] || '')))
                    continue;
                const end = text.indexOf(delimiter, i + delimiter.length);
                if (end > i + delimiter.length) {
                    out += `<${tag}>${inline(text.slice(i + delimiter.length, end), depth + 1)}</${tag}>`;
                    i = end + delimiter.length;
                    done = true;
                    break;
                }
            }
            if (done)
                continue;
            out += escaped(text[i++]);
        }
        return out;
    }
    function markdown(source, depth = 0) {
        if (depth > 12)
            return '<pre>' + escaped(source.slice(0, 16000)) + '</pre>';
        const lines = source.replace(/\r\n?/g, '\n').slice(0, 16000).split('\n');
        let i = 0, out = '';
        const cells = line => line.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map(x => x.trim().replace(/\\\|/g, '|'));
        const separator = line => /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line || '');
        const starts = line => /^\s*$|^ {0,3}(?:#{1,6} |>|`{3,}|~{3,}|[-*+] |\d+[.)] )/.test(line || '');
        while (i < lines.length) {
            const line = lines[i];
            let m;
            if (!line.trim()) {
                i++;
                continue;
            }
            if ((m = /^ {0,3}(`{3,}|~{3,})([^\s]*)\s*$/.exec(line))) {
                const fence = m[1], code = [];
                i++;
                while (i < lines.length && !(lines[i].trim().startsWith(fence) && /^[`~]+$/.test(lines[i].trim())))
                    code.push(lines[i++]);
                if (i < lines.length)
                    i++;
                out += '<pre><code>' + escaped(code.join('\n')) + '</code></pre>';
                continue;
            }
            if ((m = /^ {0,3}(#{1,6})\s+(.+?)(?:\s+#+)?\s*$/.exec(line))) {
                out += `<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`;
                i++;
                continue;
            }
            if (i + 1 < lines.length && /^(?:={3,}|-{3,})\s*$/.test(lines[i + 1]) && !/^[\s>*-]/.test(line)) {
                const level = lines[i + 1][0] === '=' ? 1 : 2;
                out += `<h${level}>${inline(line)}</h${level}>`;
                i += 2;
                continue;
            }
            if (/^\s*(?:\*\s*){3,}$|^\s*(?:-\s*){3,}$|^\s*(?:_\s*){3,}$/.test(line)) {
                out += '<hr>';
                i++;
                continue;
            }
            if (/^ {0,3}>/.test(line)) {
                const block = [];
                while (i < lines.length && /^ {0,3}>/.test(lines[i]))
                    block.push(lines[i++].replace(/^ {0,3}> ?/, ''));
                out += '<blockquote>' + markdown(block.join('\n'), depth + 1) + '</blockquote>';
                continue;
            }
            if (separator(lines[i + 1]) && line.includes('|')) {
                const headers = cells(line), aligns = cells(lines[i + 1]);
                i += 2;
                out += '<table><thead><tr>' + headers.map((h, j) => `<th align="${aligns[j]?.endsWith(':') ? (aligns[j]?.startsWith(':') ? 'center' : 'right') : 'left'}">${inline(h)}</th>`).join('') + '</tr></thead><tbody>';
                let rows = 0;
                while (i < lines.length && lines[i].includes('|') && lines[i].trim() && rows++ < 200)
                    out += '<tr>' + cells(lines[i++]).slice(0, headers.length).map(c => '<td>' + inline(c) + '</td>').join('') + '</tr>';
                out += '</tbody></table>';
                continue;
            }
            if ((m = /^( {0,3})([-*+]|\d+[.)])\s+(.+)$/.exec(line))) {
                const ordered = /\d/.test(m[2]), tag = ordered ? 'ol' : 'ul', indent = m[1].length;
                out += ordered ? `<ol start="${parseInt(m[2], 10)}">` : '<ul>';
                while (i < lines.length) {
                    const item = /^( *)([-*+]|\d+[.)])\s+(.*)$/.exec(lines[i]);
                    if (!item || item[1].length !== indent || /\d/.test(item[2]) !== ordered)
                        break;
                    i++;
                    const children = [];
                    while (i < lines.length && (lines[i].startsWith(' '.repeat(indent + 2)) || (!lines[i].trim() && /^ {2,}\S/.test(lines[i + 1] || ''))))
                        children.push(lines[i++].slice(indent + 2));
                    let body = item[3], check = '';
                    const task = /^\[([ xX])\]\s+(.*)$/.exec(body);
                    if (task) {
                        check = `<input type="checkbox" ${task[1] !== ' ' ? 'checked' : ''} disabled> `;
                        body = task[2];
                    }
                    out += '<li>' + check + inline(body) + (children.length ? markdown(children.join('\n'), depth + 1) : '') + '</li>';
                }
                out += `</${tag}>`;
                continue;
            }
            if (/^(?: {4}|\t)/.test(line)) {
                const code = [];
                while (i < lines.length && /^(?: {4}|\t)/.test(lines[i]))
                    code.push(lines[i++].replace(/^(?: {4}|\t)/, ''));
                out += '<pre><code>' + escaped(code.join('\n')) + '</code></pre>';
                continue;
            }
            const paragraph = [line];
            i++;
            while (i < lines.length && !starts(lines[i]) && !separator(lines[i + 1]))
                paragraph.push(lines[i++]);
            out += '<p>' + paragraph.map(v => inline(v)).join('<br>') + '</p>';
        }
        return out;
    }
    function render(source, base, language = 'en') {
        const fragment = document.createDocumentFragment();
        if (!source || source.format === 'text') {
            fragment.append(document.createTextNode(source?.text || LC.t('emptyBody', language)));
            return { fragment, rich: false, truncated: !!source?.truncated };
        }
        const html = source.format === 'html' ? source.text : markdown(source.text);
        const inert = document.createElement('template');
        inert.innerHTML = html.slice(0, 256000);
        let nodes = 0, chars = 0, truncated = !!source.truncated || html.length > 256000;
        function copy(node, parent, depth = 0) {
            if (++nodes > 4000 || depth > 40) {
                truncated = true;
                return;
            }
            if (node.nodeType === 3) {
                const s = node.data.slice(0, Math.max(0, 16000 - chars));
                chars += s.length;
                truncated ||= s.length < node.data.length;
                if (s)
                    parent.append(document.createTextNode(s));
                return;
            }
            if (node.nodeType !== 1 || node.namespaceURI !== 'http://www.w3.org/1999/xhtml' || DROP.has(node.localName))
                return;
            const tag = node.localName;
            if (tag === 'input' && node.getAttribute('type')?.toLowerCase() !== 'checkbox')
                return;
            let out = parent;
            if (TAGS.has(tag)) {
                out = document.createElement(tag);
                if (tag === 'a') {
                    const url = safeUrl(node.getAttribute('href'), base);
                    if (url) {
                        out.href = url;
                        out.target = '_blank';
                        out.rel = 'noopener noreferrer';
                    }
                }
                if (tag === 'img') {
                    const url = safeUrl(node.getAttribute('src'), base, true), alt = (node.getAttribute('alt') || '').slice(0, 200);
                    if (!url) {
                        const a = document.createElement('a'), href = safeUrl(node.getAttribute('src'), base);
                        a.textContent = LC.t('imageLink', language) + (alt ? ': ' + alt : '');
                        if (href) {
                            a.href = href;
                            a.target = '_blank';
                            a.rel = 'noopener noreferrer';
                        }
                        parent.append(a);
                        return;
                    }
                    out.src = url;
                    out.alt = alt;
                    out.loading = 'lazy';
                    out.decoding = 'async';
                    out.referrerPolicy = 'no-referrer';
                }
                if (tag === 'input') {
                    out.type = 'checkbox';
                    out.disabled = true;
                    out.checked = node.hasAttribute('checked');
                }
                if (tag === 'details')
                    out.open = node.hasAttribute('open');
                if (tag === 'ol' && /^\d{1,6}$/.test(node.getAttribute('start') || ''))
                    out.start = Number(node.getAttribute('start'));
                if (['th', 'td'].includes(tag)) {
                    for (const key of ['colspan', 'rowspan']) {
                        const n = Number(node.getAttribute(key));
                        if (Number.isInteger(n) && n > 0 && n <= 20)
                            out.setAttribute(key, String(n));
                    }
                    const align = node.getAttribute('align');
                    if (['left', 'right', 'center'].includes(align))
                        out.style.textAlign = align;
                }
                parent.append(out);
            }
            for (const child of node.childNodes) {
                if (nodes >= 4000 || chars >= 16000) {
                    truncated = true;
                    break;
                }
                copy(child, out, depth + 1);
            }
        }
        for (const child of inert.content.childNodes) {
            if (nodes >= 4000 || chars >= 16000) {
                truncated = true;
                break;
            }
            copy(child, fragment);
        }
        if (!fragment.childNodes.length)
            fragment.append(document.createTextNode(LC.t('emptyBody', language)));
        return { fragment, rich: true, truncated };
    }
    globalThis.LCRender = Object.freeze({ render, safeUrl, markdown });
})();
