import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const ctx = vm.createContext({ Intl, Date });
for (const file of ['shared', 'refresh']) vm.runInContext(readFileSync(new URL(`../src/${file}.js`, import.meta.url), 'utf8'), ctx);
const { LC, LCRefresh: R } = ctx;
const now = Date.parse('2026-09-11T03:00:00Z'), MIN = 60000;
const prefs = LC.normalize({ language: 'ko', timeZone: 'Asia/Seoul' });
const old = { value: { kind: 'comment' }, at: now - 2 * 86400000, attempted: true };
const auto = { ...prefs, autoRefresh: true };
test('new and existing users default to manual refresh', () => {
  assert.equal(LC.defaults.autoRefresh, false);
  assert.equal(LC.normalize({ cacheMinutes: 2 }).autoRefresh, false);
  assert.equal(LC.normalize({ autoRefresh: true }).autoRefresh, true);
  assert.equal(LC.normalize({ autoRefresh: 'true' }).autoRefresh, false);
});
test('only never-checked rows fetch during discovery', () => {
  assert.equal(R.needsLookup({ value: null, attempted: false }, prefs), true);
  for (const record of [old, { ...old, value: { kind: 'none' } }, { attempted: true }, { error: { code: 'HTTP' } }, { ...old, changed: true }])
    assert.equal(R.needsLookup(record, prefs), false);
});
test('tab return and scrolling do not catch up even with auto-refresh enabled', () => {
  assert.equal(R.needsLookup(old, auto, 'initial', now), false);
});
test('manual refresh bypasses age and failed-first-load suppression', () => {
  for (const record of [old, { attempted: true, error: {} }, { ...old, at: now }])
    assert.equal(R.needsLookup(record, prefs, 'manual', now), true);
});
test('auto ticks require an explicit opt-in and interval expiration', () => {
  assert.equal(R.needsLookup(old, prefs, 'auto', now), false);
  assert.equal(R.needsLookup(old, auto, 'auto', now), true);
  assert.equal(R.needsLookup({ ...old, at: now - 2 * MIN + 1 }, auto, 'auto', now), false);
  assert.equal(R.needsLookup({ ...old, at: now - 2 * MIN }, auto, 'auto', now), true);
  assert.equal(R.needsLookup({ ...old, at: now - 4 * MIN }, { ...auto, cacheMinutes: 5 }, 'auto', now), false);
});
test('auto handles changed counts, empty results and bounded error retry', () => {
  assert.equal(R.needsLookup({ ...old, at: now, changed: true }, auto, 'auto', now), true);
  assert.equal(R.needsLookup({ value: null, attempted: true }, auto, 'auto', now), true);
  assert.equal(R.needsLookup({ ...old, error: {}, failedAt: now - 1000 }, auto, 'auto', now), false);
});
test('invalid reason never schedules network', () => assert.equal(R.needsLookup(old, auto, 'visibilitychange', now), false));
for (const [minutes, ko, en] of [
  [0, '방금', 'Just now'], [0.9, '방금', 'Just now'], [1, '1분 전', '1m ago'], [59, '59분 전', '59m ago'],
  [60, '1시간 전', '1h ago'], [80, '1시간 20분 전', '1h 20m ago'], [1439, '23시간 59분 전', '23h 59m ago'],
  [1440, '1일 전', '1d ago'], [4320, '3일 전', '3d ago']
]) test(`relative age boundaries: ${minutes} minutes`, () => {
  assert.equal(R.relative(now - minutes * MIN, 'ko', now), ko);
  assert.equal(R.relative(now - minutes * MIN, 'en', now), en);
});
test('missing dates and clock rollback never show negative age', () => {
  assert.equal(R.relative(0, 'en', now), 'Not checked yet');
  assert.equal(R.relative(NaN, 'ko', now), '아직 갱신 안 됨');
  assert.equal(R.relative(now + MIN, 'ko', now), '방금');
});
test('a single-row success cannot reset the age of stale visible results', () => {
  const result = R.summarize([{ ...old, inView: true }, { ...old, at: now, inView: true }, { ...old, at: now - 999999999, inView: false }]);
  assert.equal(result.at, old.at); assert.equal(result.latest, now); assert.equal(result.total, 2);
});
test('errors and pending rows do not manufacture a successful timestamp', () => {
  const result = R.summarize([{ value: null, at: 0, inView: true, error: {} }, { value: null, state: 'loading', inView: true }]);
  assert.equal(result.at, 0); assert.equal(result.checked, 0); assert.equal(result.failed, 1); assert.equal(result.pending, 1);
  assert.equal(R.ageLabel(result, prefs, now), '확인 중…');
});
test('failed refresh retains the old successful timestamp', () => {
  const result = R.summarize([{ ...old, inView: true, error: {} }]);
  assert.equal(result.at, old.at); assert.equal(result.failed, 1); assert.equal(result.checked, 1);
});
test('empty, near-only and no-comment lists have truthful age states', () => {
  assert.equal(R.summarize([]).at, 0);
  assert.equal(R.summarize([{ value: { kind: 'none' }, at: now, near: true }]).at, now);
  assert.equal(R.ageLabel(R.summarize([]), prefs, now), '아직 갱신 안 됨');
});
test('under a week uses relative text; older results use exact selected-zone date', () => {
  assert.equal(R.ageLabel({ at: now - MIN }, prefs, now), '갱신: 1분 전');
  const at = now - 7 * 86400000;
  assert.equal(R.ageLabel({ at }, prefs, now), '갱신: ' + LC.date(at, prefs, true));
  assert.equal(R.ageLabel({ at }, { ...prefs, timeZone: 'UTC' }, now), '갱신: ' + LC.date(at, { ...prefs, timeZone: 'UTC' }, true));
});
test('public refresh copy has English and Korean equivalents', () => {
  for (const key of ['autoRefresh', 'autoEnable', 'autoPause', 'refreshAgeHint', 'refreshHelp', 'refreshFailed'])
    for (const lang of ['en', 'ko']) assert.notEqual(LC.t(key, lang), key);
  assert.equal(LC.t('cacheMinutes', 'ko'), '자동 갱신 간격');
});

// Reproduce the ko-KR AM/PM tokens observed on the repository's Node 20 CI.
test('Korean labels remain Korean when Intl returns Latin day-period tokens', () => {
  function MixedIntl(locale, options) {
    const formatter = new Intl.DateTimeFormat(locale, options);
    return {
      resolvedOptions: () => formatter.resolvedOptions(),
      formatToParts: stamp => formatter.formatToParts(stamp).map(part =>
        part.type === 'dayPeriod' ? { ...part, value: part.value === '오전' ? 'AM' : part.value === '오후' ? 'PM' : part.value } : part),
    };
  }
  const scope = vm.createContext({ Intl: { DateTimeFormat: MixedIntl }, Date });
  for (const file of ['shared', 'recency']) vm.runInContext(readFileSync(new URL(`../src/${file}.js`, import.meta.url), 'utf8'), scope);
  for (const [stamp, expected] of [['2026-09-11T01:04:00Z', '오전 10:04'], ['2026-09-11T06:19:00Z', '오후 3:19']]) {
    assert.ok(scope.LC.date(stamp, prefs).endsWith(expected));
    assert.equal(scope.LCRecency.describe(stamp, prefs, now).time, expected);
  }
});
