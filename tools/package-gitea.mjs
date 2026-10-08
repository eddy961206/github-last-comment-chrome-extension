/* Produce Gitea custom assets from the same reviewed production modules. */
import { readFileSync, writeFileSync, mkdirSync, cpSync, readdirSync } from 'node:fs';
import { zipStore } from './zip.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const output = path.join(root, 'dist/gitea-last-comment');
const assets = path.join(output, 'public/assets/last-comment');
const revision = '1.3.4-gitea.4';
mkdirSync(assets, { recursive: true });
const read = file => readFileSync(path.join(root, file), 'utf8');
const write = (file, content) => writeFileSync(path.join(assets, file), content);
const modules = ['src/shared.js', 'src/sites.js', 'src/notes.js', 'src/navigation-cache.js'];
// Web privacy is deliberately different from extension storage/privacy.
const common = modules.map(read).join('\n') + `\n
(() => {
 const en = { ...LC.en, product: 'Last Comment for Gitea',
 appSettings: 'Gitea display settings', scopeBody: 'Available on this Gitea installation using the existing login. Reads ordinary conversations without posting, editing or deleting comments.',
 privacySummary: 'Comment results use page memory and bounded per-tab sessionStorage. Browsers may restore these results with restored tabs. Saved settings and notes use this browser’s localStorage, separated by Gitea installation and account. Nothing is sent to the developer.',
 welcomeCTA: 'Open Gitea issues', welcomeStep1: 'Open a list', welcomeBody1: 'Use this Gitea installation’s issue or pull-request list.', welcomeStep2: 'Read a reply', welcomeBody2: 'Hover or focus the author badge to preview an ordinary reply.', welcomeStep3: 'Choose your settings', welcomeBody3: 'Use the Last Comment navigation link to adjust presentation and link your imported GitHub name.',
 privacyEffective: 'Gitea web deployment · October 8, 2026',
 privacyData: 'The Gitea page reads ordinary comments with your existing same-origin login. It does not read authentication cookies or tokens, and sends no data to the extension developer. Saved settings, display-name links, notes and optional counters are stored in this browser’s localStorage, separated by installation and Gitea account.',
 privacyRetention: 'Navigation results use bounded per-tab sessionStorage (80 results and at most 1,000,000 serialized characters per tab). Browsers may restore sessionStorage when restoring tabs. Clear caches invalidates open and restored tabs for this account. Saved notes/settings remain until individually deleted or site browser data is cleared. No cross-device sync or Chrome extension storage is used.',
 notesPrivacy: 'Personal notes are browser-local, separated by Gitea account, and are never posted as Gitea comments. They are not encrypted and can be accessed by scripts from this Gitea origin. They are not a secrets vault and are excluded from diagnostics and counter exports.',
 privacyUse: 'Used only to display replies and explicitly saved local preferences and notes. No advertising or developer telemetry.',
 privacyNetwork: 'Comment lookups are read-only GET requests to this Gitea origin using existing browser sessions. No personal access token is required.',
 storeNotice: 'Gitea server UI · browser-local settings and notes',
 welcomeNote: 'Available on this Gitea installation. Browser extensions are not required.',
 faqPrivateAnswer: 'Existing Gitea permissions apply. This page does not grant repository access.',
 faqMissingAnswer: 'Unknown or custom conversation structures are left unverified. Use Refresh visible to retry.',
 faqMetricsAnswer: 'Optional counters are kept in this browser for the current Gitea account. No telemetry is sent.',
 privacyContact: 'The Gitea administrator supplies this customization. Upstream extension source is linked below.' };
 const ko = { ...LC.ko, product: 'Last Comment for Gitea',
 appSettings: 'Gitea 댓글 표시 설정', scopeBody: '이 Gitea 사이트에서 기존 로그인 권한으로 일반 대화를 읽어. 댓글 작성·수정·삭제는 하지 않아.',
 privacySummary: '댓글 결과는 페이지 메모리와 탭별 sessionStorage에 제한된 크기로 보관해. 브라우저가 탭을 복원하면 결과도 복원될 수 있어. 설정과 메모는 이 브라우저의 localStorage에 Gitea 주소·계정별로 나눠 저장하며 개발자에게 보내지 않아.',
 welcomeCTA: 'Gitea 이슈 열기', welcomeStep1: '목록 열기', welcomeBody1: '이 Gitea 사이트의 이슈 또는 풀 리퀘스트 목록을 열어.', welcomeStep2: '댓글 읽기', welcomeBody2: '작성자 배지에 마우스를 올리거나 키보드로 선택하면 일반 댓글을 미리 볼 수 있어.', welcomeStep3: '표시 설정', welcomeBody3: '상단 Last Comment 링크에서 표시 방식을 바꾸고 이전 GitHub 이름을 연결해.',
 privacyEffective: 'Gitea 웹 적용판 · 2026년 10월 8일',
 privacyData: '현재 Gitea 로그인 권한으로 같은 사이트의 일반 댓글을 읽어. 인증 쿠키나 토큰 값은 읽지 않고 확장 개발자에게 데이터를 보내지 않아. 설정·계정 이름 연결·개인 메모·선택한 통계는 이 브라우저의 localStorage에 Gitea 주소와 계정별로 나눠 저장해.',
 privacyRetention: '댓글 캐시는 탭별 sessionStorage에 최대 80개와 직렬화 문자 100만 개로 제한해. 브라우저가 탭을 복원하면 캐시도 복원될 수 있어. 캐시 삭제는 해당 계정의 열린 탭과 복원된 탭을 무효화해. 메모와 설정은 직접 삭제하거나 사이트 데이터를 지울 때까지 남아. 기기 간 동기화나 Chrome 확장 저장소는 사용하지 않아.',
 notesPrivacy: '개인 메모는 Gitea 계정별로 나눠 이 브라우저에 저장하고 Gitea 댓글로 게시하지 않아. 암호화하지 않으며 이 Gitea 주소에서 실행되는 스크립트가 접근할 수 있으므로 비밀정보 보관함으로 쓰면 안 돼. 진단·통계 내보내기에는 메모를 넣지 않아.',
 privacyUse: '댓글 표시와 직접 저장한 설정·메모에만 사용해. 광고나 개발자 원격 통계 수집은 없어.',
 privacyNetwork: '기존 로그인 세션으로 이 Gitea 주소에 읽기 전용 GET 요청을 보내. 개인 토큰은 필요 없어.',
 storeNotice: 'Gitea 서버 화면 · 설정과 메모는 이 브라우저에 저장',
 welcomeNote: '이 Gitea 사이트에서 사용해. 브라우저 확장은 필요 없어.',
 faqPrivateAnswer: '기존 Gitea 접근 권한을 그대로 적용해. 저장소 접근 권한을 추가로 주지 않아.',
 faqMissingAnswer: '확인하지 못한 댓글 구조는 추측해서 표시하지 않아. 보이는 항목 갱신으로 재시도해.',
 faqMetricsAnswer: '선택한 통계만 현재 Gitea 계정의 이 브라우저에 저장해. 외부 수집은 없어.',
 privacyContact: '이 커스텀 화면은 Gitea 관리자가 제공해. 아래에 원본 확장 소스를 안내해.' };
 const old = LC;
 globalThis.LC = Object.freeze({ ...old, en, ko, t(key, language, vars = {}) {
   let text = (language === 'ko' ? ko : en)[key] || en[key] || key;
   for (const [name, value] of Object.entries(vars)) text = text.replaceAll('{' + name + '}', String(value));
   return text;
 } });
})();\n` + read('gitea/web-platform.js');
const contentModules = ['src/refresh.js', 'src/styles.js', 'src/recency.js', 'src/parser.js', 'src/gitea.js', 'src/gitea-authors.js', 'src/render.js', 'src/transport.js'];
let content = read('src/content.js');
content = content.replace("    LCSites.current = LCSites.find(location.href, (await chrome.storage.local.get('giteaSites')).giteaSites);", "    if (document.querySelector('[data-lc-owned]')) return;\n    document.documentElement.dataset.lcWeb = '1';\n    LCSites.current = LCWeb.site;");
content = content.replace('            if (result?.ok) {', '            if (result?.invalidated) { cache.clear(); paused = true; }\n            if (result?.ok) {');
write('site.js', common + '\n(() => { const chrome = LCWeb;\n' + contentModules.map(read).join('\n') + '\n' + content + '\n})();\n');
let pages = read('src/pages.js');
pages = pages.replace("const extStore = (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) || null;", 'const extStore = chrome.storage.local;');
pages = pages.replace("const extRuntime = (typeof chrome !== 'undefined' && chrome.runtime) || null;", 'const extRuntime = chrome.runtime;');
pages = pages.replace("brand.append(img, label);", "brand.append(img, label); label.querySelector('small').textContent = 'for Gitea';");
pages = pages.replace("'https://github.com/issues'", "LCWeb.site.baseUrl + '/issues'");
pages = pages.replace("privacy.append(tools, a(t('privacy'), 'privacy.html', 'btn'));", "tools.append(btn('diagnostic', async () => download(await extRuntime.sendMessage({type:'LC_DIAGNOSTICS'}), 'last-comment-gitea-diagnostics.json'))); privacy.append(tools, a(t('privacy'), 'privacy.html', 'btn'));");
pages = pages.replace("const n = el('a', cls, text); n.href = href;", "const n = el('a', cls, text); n.href = href; if (!href.startsWith('#') && !/^[a-z]+:/i.test(href)) { const local = new URL(n.href); local.searchParams.set('account', LCWeb.account); n.href = local.href; }");
write('pages.js', common + '\n(() => { const chrome = LCWeb;\n' + read('gitea/site-settings.js') + '\n' + pages + '\n})();\n');
for (const name of ['options', 'help', 'privacy', 'welcome']) {
    const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'"><title>Last Comment for Gitea</title><link rel="stylesheet" href="pages.css?v=1.3.4-gitea"><link rel="icon" href="icons/icon-32.png"><script src="base.js?v=1.3.4-gitea" defer></script></head><body data-page="${name}" data-lc-web-page><div id="app"></div><noscript>JavaScript가 필요해.</noscript></body></html>`;
    write(name + '.html', html.replaceAll('1.3.4-gitea', revision));
}
// External bootstrap discovers the installation subpath and loads static pages.
write('base.js', `(() => { const path = location.pathname; const suffix = '/assets/last-comment/'; const index = path.lastIndexOf(suffix); if (index < 0) throw new Error('LC_WEB_ASSET_PATH'); const script = document.createElement('script'); script.src = 'pages.js?v=${revision}'; script.dataset.lcBase = path.slice(0,index); document.head.append(script); })();\n`);
write('pages.css', read('styles/pages.css'));
cpSync(path.join(root, 'icons'), path.join(assets, 'icons'), { recursive: true });
const templateDir = path.join(output, 'templates/custom'); mkdirSync(templateDir, { recursive: true });
writeFileSync(path.join(templateDir, 'footer.tmpl'), '{{if .IsSigned}}<script nonce="{{ctx.CspScriptNonce}}" src="{{AppSubUrl}}/assets/last-comment/site.js?v=' + revision + '" data-lc-base="{{AppSubUrl}}" defer></script>{{end}}\n');
const files = [];
cpSync(path.join(root, 'gitea/README.md'), path.join(output, 'README.md'));
cpSync(path.join(root, 'gitea/deploy.sh'), path.join(output, 'deploy.sh'));
function collect(dir, prefix = '') { for (const item of readdirSync(dir, { withFileTypes: true })) { const name = prefix + item.name, full = path.join(dir, item.name); if (item.isDirectory()) collect(full, name + '/'); else files.push({ name, data: readFileSync(full) }); } }
collect(output);
writeFileSync(path.join(root, 'dist/gitea-last-comment-1.3.4.zip'), zipStore(files));
console.log('gitea package: ' + output);
