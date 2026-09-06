/* Shared, side-effect-free preferences and translations. No browser data here. */
(() => {
    'use strict';
    const defaults = Object.freeze({ language: 'en', enabled: true, avatars: true, noComments: true,
        cacheMinutes: 2, timeZone: 'local', localStats: false });
    const en = {
        product: 'Last Comment for GitHub', shortName: 'Last Comment', last: 'Last comment', settings: 'Display',
        settingsTitle: 'Display settings', language: 'Language', english: 'English', korean: '한국어',
        enabled: 'Enable on GitHub', avatars: 'Show author avatars', noComments: 'Show issues with no comments',
        cacheMinutes: 'Reuse results for', minutes: '{n} minutes', timeZone: 'Time zone', local: 'Device time zone', seoul: 'Seoul (UTC+9)', utc: 'UTC',
        refresh: 'Refresh visible', retry: 'Refresh this issue', pause: 'Pause', resume: 'Resume', close: 'Close',
        loading: 'Checking…', queued: 'Waiting…', none: 'No comments', failed: 'Could not verify', previous: 'Previous result',
        mine: 'You', bot: 'Bot', mention: 'Mention', unknown: 'Unknown author', preview: 'Preview last comment',
        openComment: 'Open comment', author: 'Author', posted: 'Posted', checked: 'Checked', markdown: 'Markdown preview',
        plain: 'Text preview', truncated: 'Long comment shortened', emptyBody: 'This comment has no text content.',
        noBody: 'The response did not include a preview. Open the comment to read it.',
        imageLink: 'Open image', limited: 'GitHub temporarily limited requests', offline: 'Offline', paused: 'Paused',
        ready: '{done} of {total} checked', currentTab: 'Current tab', active: 'Ready on this list', notList: 'Open a GitHub issue or pull request list.',
        needsReload: 'Reload GitHub after installing the extension.', duplicate: 'Another Last Comment script is active. Disable the Tampermonkey version and reload this page.',
        legend: 'Blue: another person · Gray: you or a bot · Amber: your username appears in the comment. This is not an unread or reply-needed indicator.',
        options: 'All settings', help: 'Getting started', privacy: 'Privacy', source: 'Source code', support: 'Support & feedback',
        save: 'Settings saved', saveFailed: 'Settings could not be saved. Please try again.',
        welcomeTitle: 'Know who replied. Stay in the list.',
        welcomeLead: 'See the last comment author, date, and a readable preview beneath every issue and pull request title.',
        welcomeCTA: 'Open GitHub issues', welcomeStep1: 'Open an issue or pull request list',
        welcomeBody1: 'Your existing GitHub sign-in is used. No token or separate account is required.',
        welcomeStep2: 'Read the latest reply at a glance', welcomeBody2: 'Hover over a badge, or use the preview button, to read formatted Markdown.',
        welcomeStep3: 'Make it yours', welcomeBody3: 'Choose your language, time zone, avatars, and cache duration. Pause anytime.',
        welcomeNote: 'Already using the Tampermonkey script? Disable it to prevent duplicate badges. Refresh existing GitHub tabs after installation.',
        localOnly: 'Private by design. No developer telemetry.',
        privacySummary: 'Comment content stays in the page memory. Preferences stay on this device. No repository content is sent to the developer.',
        openSettings: 'Customize your experience', keyboard: 'Keyboard access', keyboardHelp: 'Tab to a badge to preview. Press Arrow Down to enter the preview. Escape closes it. Enter opens the comment.',
        statsTitle: 'Local usage statistics', statsDescription: 'Optional counters stored only on this device. No account IDs, repository names, URLs, comment text, or timestamps. Never sent automatically.',
        localStats: 'Enable local counters', statsOff: 'Local counters are off. Turning them off also deletes saved counts.',
        statLists: 'Lists viewed', statPreviews: 'Previews opened', statLookups: 'Issues checked', statFailures: 'Lookup failures', statCache: 'Cached results reused',
        exportStats: 'Export counters', clearStats: 'Delete counters', statsCleared: 'Counters deleted',
        diagnostic: 'Export diagnostics', diagnosticHelp: 'Includes version and aggregate technical counts only. No comment content, usernames, issue titles, repository paths, cookies, or tokens.',
        dataTitle: 'Your data, your control', clearCache: 'Clear caches and pause open GitHub tabs', cacheCleared: 'Cache clearing and pause requested for open GitHub tabs',
        reset: 'Reset preferences', resetConfirm: 'Reset preferences and delete local usage counters?',
        scopeTitle: 'Focused access', scopeBody: 'Runs on github.com only. Reads issue and pull request conversation data to provide the badges and previews. It does not post, edit, or delete comments.',
        limitsTitle: 'What to expect', limitsBody: 'General conversation comments only; not inline code review comments. GitHub Enterprise domains are not supported. GitHub interface changes may temporarily affect verification. No reply is guessed when verification fails.',
        storeNotice: 'Independent extension. Not affiliated with or endorsed by GitHub or Google.',
        details: 'Learn more', faqTitle: 'Frequently asked questions', faqPrivate: 'Does it work with private repositories?',
        faqPrivateAnswer: 'It is designed to use your existing GitHub page session for repositories you can access. Content is processed locally; there is no developer account or token exchange. Please verify against your organization’s policies.',
        faqMissing: 'Why does an issue say “Could not verify”?', faqMissingAnswer: 'The extension could not prove which general comment is newest. Retry, check your GitHub session, or report a redacted diagnostic file. It never treats a parsing failure as “No comments”.',
        faqSlow: 'Why are some results waiting?', faqSlowAnswer: 'Only items near the viewport are fetched, with two concurrent issue jobs and spaced requests. Large timelines may need additional pages. Scroll to load more.',
        faqMetrics: 'Does the developer collect analytics?', faqMetricsAnswer: 'No telemetry endpoint is included. Optional local counters can be inspected, exported, and deleted. The Chrome Web Store provides its own aggregate listing statistics separately.',
        privacyTitle: 'Privacy policy', privacyEffective: 'Effective September 6, 2026 · Version 1.0.0',
        privacyData: 'The extension reads issue/PR URLs, comment authors, timestamps, avatars, and bodies on supported GitHub lists. The signed-in username is used locally to distinguish your replies and username mentions. GitHub requests use the browser’s existing same-origin session; the extension does not read authentication cookies or tokens.',
        privacyRetention: 'Conversation data stays in page memory. Cached results are reused briefly; displayed results may remain until refreshed, cleared, or the page closes. Route/account changes clear this memory. Preferences are stored in chrome.storage.local, not synchronized. Optional aggregate usage counters persist locally until deleted, disabled, or uninstalled.',
        privacyNetwork: 'Requests needed for comments go to GitHub. Avatar and permitted attachment/proxy images may be requested from GitHub services while shown. Those providers receive normal network metadata such as IP addresses. No comment data or analytics are transmitted to the developer. No analytics SDKs, tracking pixels, remote scripts, or advertising are included.',
        privacySharing: 'Exports occur only when you explicitly download a file. You decide whether to share it. Support tickets and voluntary attachments are handled by GitHub under GitHub’s privacy policy. Do not put confidential information in public support issues.',
        privacyUse: 'Use of information received from Google APIs adheres to the Chrome Web Store User Data Policy, including Limited Use requirements. Data is used only for the extension’s single purpose and user-facing functionality, never sold or used for advertising.',
        privacyContact: 'Maintainer: eddy961206. Contact the maintainer through the repository support channel. This policy must be updated before changing data practices.',
        appSettings: 'Extension settings', appearance: 'Reading experience', connections: 'Access & privacy', clearDone: 'Done', unavailable: 'Unavailable on this page',
        error_ABORTED: 'The request was cancelled.', error_TIMEOUT: 'The response timed out. Please retry.', error_ISSUE_TIMEOUT: 'This timeline took too long to verify. Please retry.',
        error_RATE_LIMIT: 'GitHub limited requests. Please retry after the cooldown.', error_AUTH: 'Please check your GitHub sign-in and access permissions.',
        error_HTTP: 'GitHub returned an unexpected response.', error_NETWORK: 'The network request failed.',
        error_PAGE_SHAPE: 'This GitHub page format could not be read.', error_SUBJECT: 'The response did not match this issue.',
        error_COMMENT_SHAPE: 'A comment could not be verified.', error_INCOMPLETE: 'The full comment set could not be verified.',
        error_NO_PROGRESS: 'Timeline pagination stopped progressing.', error_PAGE_LIMIT: 'This timeline reached the safety limit.',
        error_SNAPSHOT_CHANGED: 'The timeline changed during verification. Please retry.', error_QUERY: 'GitHub rejected the timeline query. Open a long issue and select Load more, then return and retry.',
        error_JSON: 'The timeline response could not be read.', error_TOO_LARGE: 'The response exceeded the processing size limit.',
    };
    const ko = {
        product: 'Last Comment for GitHub', shortName: 'Last Comment', last: '마지막 댓글', settings: '표시', settingsTitle: '표시 설정', language: '언어', english: 'English', korean: '한국어',
        enabled: 'GitHub에서 사용', avatars: '작성자 아바타 표시', noComments: '댓글이 없는 항목도 표시', cacheMinutes: '결과 재사용 시간', minutes: '{n}분', timeZone: '시간대', local: '기기 시간대', seoul: '서울 (UTC+9)', utc: 'UTC',
        refresh: '보이는 항목 갱신', retry: '이 항목 새로고침', pause: '일시정지', resume: '재개', close: '닫기', loading: '확인 중…', queued: '대기 중…', none: '댓글 없음', failed: '확인 불가', previous: '이전 결과', mine: '내 댓글', bot: '봇', mention: '언급', unknown: '작성자 정보 없음', preview: '마지막 댓글 미리보기', openComment: '댓글 열기', author: '작성자', posted: '작성 시각', checked: '확인 시각', markdown: '마크다운 미리보기', plain: '텍스트 미리보기', truncated: '긴 댓글 일부 표시', emptyBody: '텍스트 본문이 없는 댓글입니다.', noBody: '응답에 미리보기 본문이 없습니다. 댓글을 열어 확인해 주세요.', imageLink: '이미지 열기', limited: 'GitHub 요청 일시 제한', offline: '오프라인', paused: '일시정지됨', ready: '{total}개 중 {done}개 확인', currentTab: '현재 탭', active: '목록에서 사용 가능', notList: 'GitHub 이슈 또는 Pull Request 목록을 열어 주세요.', needsReload: '설치 후 GitHub 페이지를 새로고침해 주세요.', duplicate: '다른 Last Comment 스크립트가 실행 중입니다. Tampermonkey 버전을 끄고 페이지를 새로고침해 주세요.',
        legend: '파랑: 다른 작성자 · 회색: 본인 또는 봇 · 노랑: 본문에 사용자 이름 포함. 읽지 않은 댓글이나 답변 필요 여부를 판단하는 기능이 아닙니다.',
        options: '전체 설정', help: '시작 안내', privacy: '개인정보', source: '소스 코드', support: '지원 및 의견', save: '설정이 저장되었습니다', saveFailed: '설정을 저장하지 못했습니다. 다시 시도해 주세요.',
        welcomeTitle: '누가 답했는지, 목록에서 바로.', welcomeLead: '이슈와 Pull Request 제목 아래에서 마지막 댓글 작성자와 시각을 확인하고 본문을 미리 볼 수 있습니다.', welcomeCTA: 'GitHub 이슈 열기', welcomeStep1: '이슈 또는 Pull Request 목록 열기', welcomeBody1: '기존 GitHub 로그인 상태를 사용합니다. 별도 계정이나 토큰이 필요하지 않습니다.', welcomeStep2: '마지막 댓글 바로 확인', welcomeBody2: '배지에 마우스를 올리거나 미리보기 버튼을 누르면 마크다운 서식으로 본문을 볼 수 있습니다.', welcomeStep3: '원하는 방식으로 설정', welcomeBody3: '언어, 시간대, 아바타, 캐시 시간을 설정하고 언제든 조회를 일시정지할 수 있습니다.', welcomeNote: 'Tampermonkey 스크립트를 사용 중이라면 중복 표시를 방지하도록 꺼 주세요. 설치 전에 열어 둔 GitHub 탭은 새로고침이 필요합니다.', localOnly: '개인정보 중심 설계. 개발자에게 통계를 전송하지 않습니다.', privacySummary: '댓글 본문은 페이지 메모리에서만 처리하고 설정은 기기에 저장합니다. 저장소 내용을 개발자에게 전송하지 않습니다.', openSettings: '사용 환경 설정', keyboard: '키보드 사용', keyboardHelp: 'Tab으로 배지에 이동하면 미리보기가 열립니다. 아래쪽 화살표로 본문에 진입하고 Escape로 닫습니다. Enter로 댓글을 엽니다.',
        statsTitle: '기기 내 사용 통계', statsDescription: '선택적으로 사용 횟수만 이 기기에 저장합니다. 계정 ID, 저장소 이름, URL, 댓글 본문, 시각 정보는 포함하지 않으며 자동 전송하지 않습니다.', localStats: '기기 내 횟수 기록 사용', statsOff: '사용 횟수 기록이 꺼져 있습니다. 이 기능을 끄면 저장된 횟수도 삭제됩니다.', statLists: '조회한 목록', statPreviews: '열어 본 미리보기', statLookups: '확인한 항목', statFailures: '확인 실패', statCache: '캐시 재사용', exportStats: '통계 내보내기', clearStats: '통계 삭제', statsCleared: '통계가 삭제되었습니다', diagnostic: '진단 정보 내보내기', diagnosticHelp: '버전과 기술적 집계 횟수만 포함합니다. 댓글 내용, 사용자 이름, 이슈 제목, 저장소 경로, 쿠키, 토큰은 포함하지 않습니다.', dataTitle: '데이터 관리', clearCache: '열린 GitHub 탭의 캐시 삭제 및 조회 일시정지', cacheCleared: '열린 GitHub 탭에 캐시 삭제와 조회 일시정지를 요청했습니다', reset: '설정 초기화', resetConfirm: '설정을 초기화하고 기기 내 사용 통계를 삭제하시겠습니까?', scopeTitle: '필요한 범위만 접근', scopeBody: 'github.com에서만 실행됩니다. 배지와 미리보기 제공을 위해 이슈 및 Pull Request 대화 정보를 읽습니다. 댓글을 작성, 수정 또는 삭제하지 않습니다.', limitsTitle: '지원 범위', limitsBody: '일반 대화 댓글만 대상으로 하며 코드 줄 리뷰 댓글은 제외됩니다. GitHub Enterprise 별도 도메인은 지원하지 않습니다. GitHub 구조 변경으로 확인이 일시 중단될 수 있으며, 확인에 실패한 댓글을 추측하여 표시하지 않습니다.', storeNotice: 'GitHub 및 Google과 제휴하거나 공식 승인을 받은 제품이 아닙니다.', details: '자세히 보기', faqTitle: '자주 묻는 질문', faqPrivate: '비공개 저장소에서도 사용할 수 있나요?', faqPrivateAnswer: '접근 권한이 있는 저장소에서 기존 GitHub 페이지 로그인 상태를 사용하도록 설계되었습니다. 내용은 기기에서 처리하며 개발자 계정이나 토큰 교환은 없습니다. 소속 조직의 보안 정책도 확인해 주세요.', faqMissing: '“확인 불가”는 무슨 뜻인가요?', faqMissingAnswer: '최신 일반 댓글을 확정하지 못했다는 뜻입니다. 다시 시도하거나 GitHub 로그인 상태를 확인해 주세요. 문제 보고 시 민감한 내용을 제외한 진단 정보를 첨부할 수 있습니다. 분석 실패를 댓글 없음으로 처리하지 않습니다.', faqSlow: '대기 중인 항목이 있는 이유는 무엇인가요?', faqSlowAnswer: '화면 근처 항목부터 두 개씩 조회하며 요청 간격을 둡니다. 긴 타임라인은 추가 페이지 조회가 필요할 수 있습니다. 목록을 스크롤하면 다음 항목이 조회됩니다.', faqMetrics: '개발자에게 사용 통계가 전송되나요?', faqMetricsAnswer: '통계 전송 서버가 포함되어 있지 않습니다. 선택적으로 기기에 저장한 횟수를 확인, 내보내기, 삭제할 수 있습니다. Chrome 웹 스토어의 집계 통계는 별도로 제공됩니다.', privacyTitle: '개인정보 처리방침', privacyEffective: '시행일: 2026년 9월 6일 · 버전 1.0.0',
        privacyData: '지원하는 GitHub 목록의 이슈/PR 주소, 댓글 작성자, 시각, 아바타 및 본문을 읽습니다. 로그인된 사용자 이름은 본인 댓글과 이름 언급을 구분하기 위해 기기에서 사용합니다. GitHub 요청에는 브라우저의 기존 동일 출처 세션을 사용하며 인증 쿠키나 토큰 값을 직접 읽지 않습니다.',
        privacyRetention: '대화 정보는 페이지 메모리에만 보관합니다. 캐시는 일정 시간 재사용하며, 표시 중인 결과는 갱신, 삭제 또는 페이지 종료 시까지 남을 수 있습니다. 경로나 계정 변경 시 해당 메모리를 비웁니다. 설정은 동기화하지 않고 chrome.storage.local에 저장합니다. 선택적 사용 횟수는 삭제, 기능 해제 또는 확장 제거 시까지 기기에 보관됩니다.',
        privacyNetwork: '댓글 조회에 필요한 요청은 GitHub로 전송됩니다. 표시 중인 아바타와 허용된 첨부/프록시 이미지는 GitHub 서비스에 요청할 수 있습니다. 해당 서비스는 IP 주소 등 통상적인 네트워크 정보를 받습니다. 댓글이나 통계를 개발자에게 전송하지 않습니다. 분석 SDK, 추적 픽셀, 원격 스크립트 및 광고는 포함하지 않습니다.',
        privacySharing: '내보내기는 사용자가 파일 다운로드를 직접 선택할 때만 수행하며 공유 여부는 사용자가 결정합니다. 지원 요청과 자발적 첨부 파일은 GitHub의 개인정보 처리방침에 따라 처리됩니다. 공개 지원 이슈에 기밀 정보를 포함하지 마세요.',
        privacyUse: 'Google API에서 받은 정보의 사용은 제한적 사용 요건을 포함한 Chrome 웹 스토어 사용자 데이터 정책을 준수합니다. 데이터는 확장의 단일 목적과 사용자 기능에만 사용하며 판매하거나 광고에 사용하지 않습니다.',
        privacyContact: '관리자: eddy961206. 저장소의 지원 채널로 문의할 수 있습니다. 데이터 처리 방식 변경 전 본 방침을 갱신해야 합니다.', appSettings: '확장 프로그램 설정', appearance: '읽기 환경', connections: '접근 권한 및 개인정보', clearDone: '완료', unavailable: '이 페이지에서는 사용할 수 없습니다',
        error_ABORTED: '요청이 취소되었습니다.', error_TIMEOUT: '응답 시간이 초과되었습니다. 다시 시도해 주세요.', error_ISSUE_TIMEOUT: '타임라인 확인 시간이 초과되었습니다. 다시 시도해 주세요.', error_RATE_LIMIT: 'GitHub에서 요청을 제한했습니다. 제한이 해제된 후 다시 시도해 주세요.', error_AUTH: 'GitHub 로그인 상태와 접근 권한을 확인해 주세요.', error_HTTP: 'GitHub에서 예상하지 못한 응답을 받았습니다.', error_NETWORK: '네트워크 요청에 실패했습니다.', error_PAGE_SHAPE: 'GitHub 페이지 구조를 읽지 못했습니다.', error_SUBJECT: '응답이 해당 이슈와 일치하지 않습니다.', error_COMMENT_SHAPE: '댓글 정보를 검증하지 못했습니다.', error_INCOMPLETE: '전체 댓글을 확인하지 못했습니다.', error_NO_PROGRESS: '타임라인 페이지 조회가 진행되지 않습니다.', error_PAGE_LIMIT: '타임라인 조회가 안전 한도에 도달했습니다.', error_SNAPSHOT_CHANGED: '조회 중 타임라인이 변경되었습니다. 다시 시도해 주세요.', error_QUERY: 'GitHub에서 타임라인 요청을 거절했습니다. 긴 이슈의 Load more를 누른 후 목록에서 다시 시도해 주세요.', error_JSON: '타임라인 응답을 해석하지 못했습니다.', error_TOO_LARGE: '응답이 처리 크기 제한을 초과했습니다.',
    };
    function normalize(raw = {}) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw))
            raw = {};
        const p = { ...defaults };
        for (const key of ['enabled', 'avatars', 'noComments', 'localStats'])
            if (typeof raw[key] === 'boolean')
                p[key] = raw[key];
        if (['en', 'ko'].includes(raw.language))
            p.language = raw.language;
        if ([2, 5, 10].includes(raw.cacheMinutes))
            p.cacheMinutes = raw.cacheMinutes;
        if (['local', 'Asia/Seoul', 'UTC'].includes(raw.timeZone))
            p.timeZone = raw.timeZone;
        return p;
    }
    function t(key, language = 'en', vars = {}) {
        return ((language === 'ko' ? ko[key] : en[key]) || en[key] || key).replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m);
    }
    const formatters = new Map();
    function date(value, prefs, exact = false) {
        const stamp = new Date(value);
        if (!Number.isFinite(stamp.getTime()))
            return '';
        const key = `${prefs.language}|${prefs.timeZone}`;
        if (!formatters.has(key))
            formatters.set(key, new Intl.DateTimeFormat(prefs.language === 'ko' ? 'ko-KR' : 'en-US', {
                ...(prefs.timeZone === 'local' ? {} : { timeZone: prefs.timeZone }), year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short', hour: 'numeric', minute: '2-digit', hourCycle: 'h12', timeZoneName: 'short'
            }));
        const v = Object.fromEntries(formatters.get(key).formatToParts(stamp).map(x => [x.type, x.value]));
        const clock = prefs.language === 'ko' ? `${v.dayPeriod} ${v.hour}:${v.minute}` : `${v.hour}:${v.minute} ${v.dayPeriod}`;
        return `${exact ? v.year + '.' : ''}${v.month}.${v.day} (${v.weekday}) ${clock}${exact ? ' ' + v.timeZoneName : ''}`;
    }
    globalThis.LC = Object.freeze({ defaults, normalize, t, date, en, ko, repo: 'https://github.com/eddy961206/github-last-comment-chrome-extension' });
})();
