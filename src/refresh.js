/* Refresh policy and display age. No timers, storage, or network side effects. */
(() => {
    'use strict';
    const MINUTE = 60000, DAY = 86400000;
    const interval = prefs => ([2, 5, 10].includes(prefs.cacheMinutes) ? prefs.cacheMinutes : 2) * MINUTE;

    // Discovery may fetch a never-checked item. Only a manual action or an explicit
    // auto-refresh tick may replace an existing result, regardless of its age.
    function needsLookup(record, prefs, reason = 'initial', now = Date.now()) {
        if (reason === 'manual') return true;
        if (reason === 'initial') return !record.value && !record.attempted && !record.error;
        if (reason !== 'auto' || !prefs.autoRefresh) return false;
        if (record.error && now - (record.failedAt || 0) < 30000) return false;
        return !record.value || record.changed || !Number.isFinite(record.at) || now - record.at >= interval(prefs);
    }

    function relative(at, language = 'en', now = Date.now()) {
        const ko = language === 'ko';
        if (!Number.isFinite(at) || at <= 0) return ko ? '아직 갱신 안 됨' : 'Not checked yet';
        const minutes = Math.floor(Math.max(0, now - at) / MINUTE);
        if (minutes === 0) return ko ? '방금' : 'Just now';
        if (minutes < 60) return ko ? `${minutes}분 전` : `${minutes}m ago`;
        const hours = Math.floor(minutes / 60), rest = minutes % 60;
        if (hours < 24) return ko ? `${hours}시간${rest ? ` ${rest}분` : ''} 전` : `${hours}h${rest ? ` ${rest}m` : ''} ago`;
        const days = Math.floor(minutes / 1440);
        return ko ? `${days}일 전` : `${days}d ago`;
    }

    // Use the OLDEST successful result on screen, not the last request to finish.
    // A single successful retry must not make a partially stale list look fresh.
    function summarize(records) {
        const visible = records.filter(r => r.inView);
        const near = records.filter(r => r.near);
        const selected = visible.length ? visible : near.length ? near : records;
        const times = selected.filter(r => r.value && Number.isFinite(r.at) && r.at > 0).map(r => r.at);
        return {
            at: times.length ? Math.min(...times) : 0,
            latest: times.length ? Math.max(...times) : 0,
            total: selected.length, checked: times.length,
            failed: selected.filter(r => r.error).length,
            pending: selected.filter(r => ['queued', 'loading'].includes(r.state)).length,
        };
    }
    function ageLabel(summary, prefs, now = Date.now()) {
        const ko = prefs.language === 'ko';
        if (!summary.at) return summary.pending ? (ko ? '확인 중…' : 'Checking…') : relative(0, prefs.language, now);
        if (Math.max(0, now - summary.at) < 7 * DAY)
            return `${ko ? '갱신' : 'Updated'}: ${relative(summary.at, prefs.language, now)}`;
        // After a week an actual date is easier to locate than "137 days ago".
        // Include the year and clock; never silently choose another time zone.
        return `${ko ? '갱신' : 'Updated'}: ${LC.date(summary.at, prefs, true)}`;
    }
    const css = `
      .refresh-cluster{display:flex;align-items:center;gap:6px;flex-wrap:wrap;min-width:0}
      .refresh-age{font-size:11px;color:var(--muted);font-variant-numeric:tabular-nums;line-height:1.5;cursor:help;overflow-wrap:anywhere;max-width:100%}
      .refresh-age:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:3px}
      .tools .auto-toggle{width:30px;min-width:30px;height:30px;padding:6px;justify-content:center}
      .tools .auto-toggle[aria-pressed="true"]{color:var(--accent);border-color:var(--line);background:var(--soft)}
      .tools .auto-toggle[aria-pressed="false"]{color:var(--muted)}
      .refresh-error{color:var(--danger)}
      @media(max-width:560px){.tools{gap:4px}.refresh-cluster{gap:3px 6px}.refresh-age{font-size:11px}}
      @media(forced-colors:active){.tools .auto-toggle[aria-pressed="true"]{outline:1px solid Highlight}.refresh-error{color:CanvasText}}
    `;
    globalThis.LCRefresh = Object.freeze({ interval, needsLookup, relative, summarize, ageLabel, css });
})();
