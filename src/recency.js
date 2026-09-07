/* Timestamp-only presentation. No network, storage, or comment-body access. */
(() => {
    'use strict';
    const HOUR = 60 * 60 * 1000;
    const formatters = new Map();
    const copy = {
        en: { today: 'Posted today', recent: 'Posted within the last hour' },
        ko: { today: '오늘 작성된 댓글입니다', recent: '최근 1시간 이내에 작성된 댓글입니다' },
    };
    function formatter(prefs) {
        const language = prefs.language === 'ko' ? 'ko' : 'en';
        const zone = ['Asia/Seoul', 'UTC'].includes(prefs.timeZone)
            ? prefs.timeZone : new Intl.DateTimeFormat().resolvedOptions().timeZone;
        const key = `${language}|${zone}`;
        if (!formatters.has(key)) {
            formatters.set(key, new Intl.DateTimeFormat(language === 'ko' ? 'ko-KR' : 'en-US', {
                timeZone: zone, year: 'numeric', month: 'numeric', day: 'numeric',
                weekday: 'short', hour: 'numeric', minute: '2-digit', hourCycle: 'h12',
            }));
            if (formatters.size > 12) formatters.delete(formatters.keys().next().value);
        }
        return formatters.get(key);
    }
    const parts = (fmt, stamp) => Object.fromEntries(fmt.formatToParts(stamp).map(p => [p.type, p.value]));
    const dayKey = p => `${p.year}-${p.month}-${p.day}`;
    function describe(value, prefs = {}, now = Date.now()) {
        const stamp = value === null || value === undefined || value === '' ? NaN : new Date(value).getTime();
        const empty = { valid: false, date: '', time: '', today: false, recent: false, dateEmphasis: false, timeEmphasis: false, hint: '', nextDelay: 30000 };
        if (!Number.isFinite(stamp) || !Number.isFinite(now)) return empty;
        const fmt = formatter(prefs), posted = parts(fmt, stamp), current = parts(fmt, now);
        const language = prefs.language === 'ko' ? 'ko' : 'en';
        const age = now - stamp;
        // Future timestamps are not recent, even if their calendar date is today.
        const today = age >= 0 && dayKey(posted) === dayKey(current);
        const recent = age >= 0 && age <= HOUR;
        return {
            valid: true,
            date: `${posted.month}.${posted.day} (${posted.weekday})`,
            time: language === 'ko' ? `${posted.dayPeriod} ${posted.hour}:${posted.minute}` : `${posted.hour}:${posted.minute} ${posted.dayPeriod}`,
            today, recent,
            // A reply just before midnight still receives both colors for its first hour.
            dateEmphasis: today || recent, timeEmphasis: recent,
            hint: recent ? copy[language].recent : today ? copy[language].today : '',
            nextDelay: recent ? Math.max(1, Math.min(30000, HOUR - age + 1)) : 30000,
        };
    }
    function update(view, prefs, now = Date.now()) {
        if (!view) return null;
        const state = describe(view.value, prefs, now);
        if (view.day.textContent !== state.date) view.day.textContent = state.date;
        if (view.clock.textContent !== state.time) view.clock.textContent = state.time;
        view.day.classList.toggle('date-today', state.dateEmphasis);
        view.clock.classList.toggle('time-recent', state.timeEmphasis);
        if (state.hint) {
            if (view.element.title !== state.hint) view.element.title = state.hint;
        } else view.element.removeAttribute('title');
        return state;
    }
    function create(value, prefs, doc = document) {
        const element = doc.createElement('span'), day = doc.createElement('span'), clock = doc.createElement('span');
        element.className = 'date'; day.className = 'date-day'; clock.className = 'date-clock';
        element.append(day, doc.createTextNode(' '), clock);
        const view = { element, day, clock, value };
        update(view, prefs);
        return view;
    }
    const css = `
.date .date-day.date-today { color: #a44700; }
.date .date-clock.time-recent { color: #cf222e; }
:host([data-theme="dark"]) .date .date-day.date-today { color: #ffa657; }
:host([data-theme="dark"]) .date .date-clock.time-recent { color: #ff7b72; }
@media (forced-colors: active) {
    .date .date-day.date-today { color: LinkText; text-decoration: underline; }
    .date .date-clock.time-recent { color: LinkText; text-decoration: underline double; }
}
`;
    globalThis.LCRecency = Object.freeze({ describe, create, update, css });
})();
