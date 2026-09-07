import test from 'node:test';
import assert from 'node:assert/strict';
import '../src/recency.js';

const { describe } = globalThis.LCRecency;
const ko = { language: 'ko', timeZone: 'Asia/Seoul' };
const en = { language: 'en', timeZone: 'UTC' };
const now = Date.parse('2026-09-07T07:00:00Z'); // 16:00 in Seoul
const state = (time, prefs = ko, clock = now) => describe(time, prefs, clock);

const examples = [
    ['today, older than an hour', '2026-09-07T01:00:00Z', true, false],
    ['within the last hour', '2026-09-07T06:19:00Z', true, true],
    ['exactly one hour old is included', '2026-09-07T06:00:00Z', true, true],
    ['one millisecond past the hour is excluded', '2026-09-07T05:59:59.999Z', true, false],
    ['zero age is included', '2026-09-07T07:00:00Z', true, true],
    ['yesterday', '2026-09-06T07:00:00Z', false, false],
    ['same month/day in another year', '2025-09-07T07:00:00Z', false, false],
    ['future timestamp is not highlighted', '2026-09-07T07:00:00.001Z', false, false],
];
for (const [label, value, date, time] of examples) test(label, () => {
    const actual = state(value);
    assert.equal(actual.dateEmphasis, date);
    assert.equal(actual.timeEmphasis, time);
});
for (const value of ['', null, undefined, 'invalid', NaN, Infinity]) test(`invalid input: ${String(value)}`, () => {
    const actual = state(value);
    assert.equal(actual.valid, false);
    assert.equal(actual.dateEmphasis, false);
    assert.equal(actual.timeEmphasis, false);
});
test('Korean date and clock remain separate without changing the format', () => {
    const actual = state('2026-09-04T01:04:00Z');
    assert.equal(actual.date, '9.4 (금)');
    assert.equal(actual.time, '오전 10:04');
});
test('English date and clock', () => {
    const actual = state('2026-09-04T13:04:00Z', en);
    assert.equal(actual.date, '9.4 (Fri)');
    assert.equal(actual.time, '1:04 PM');
});
test('midnight and noon use 12-hour notation', () => {
    assert.equal(state('2026-09-06T15:00:00Z').time, '오전 12:00');
    assert.equal(state('2026-09-07T03:00:00Z').time, '오후 12:00');
});
test('today uses the display time zone, not the UTC date or last 24 hours', () => {
    const posted = '2026-09-07T14:00:00Z', clock = Date.parse('2026-09-07T16:00:00Z');
    assert.equal(state(posted, ko, clock).dateEmphasis, false);
    assert.equal(state(posted, en, clock).dateEmphasis, true);
});
test('recent reply across midnight has orange date and red time', () => {
    const posted = '2026-09-07T14:50:00Z', clock = Date.parse('2026-09-07T15:10:00Z');
    const actual = state(posted, ko, clock);
    assert.equal(actual.today, false);
    assert.equal(actual.dateEmphasis, true);
    assert.equal(actual.timeEmphasis, true);
    assert.equal(actual.date, '9.7 (월)');
    assert.equal(state(posted, ko, Date.parse(posted) + 3600001).dateEmphasis, false);
});
test('last-year reply across midnight is still recent', () => {
    const actual = state('2026-12-31T14:50:00Z', ko, Date.parse('2026-12-31T15:10:00Z'));
    assert.equal(actual.recent, true);
    assert.equal(actual.today, false);
});
test('highlight state expires without a new comment response', () => {
    const posted = Date.parse('2026-09-07T06:19:00Z');
    assert.equal(state(posted, ko, posted + 3599999).timeEmphasis, true);
    assert.equal(state(posted, ko, posted + 3600001).timeEmphasis, false);
    assert.equal(state(posted, ko, Date.parse('2026-09-07T15:00:00Z')).dateEmphasis, false);
});
test('next refresh is bounded and handles the inclusive hour boundary', () => {
    assert.equal(state(now - 3600000).nextDelay, 1);
    assert.equal(state(now - 3599500).nextDelay, 501);
    assert.equal(state(now - 600000).nextDelay, 30000);
});
test('device zone agrees with the explicitly selected equivalent zone', () => {
    const zone = new Intl.DateTimeFormat().resolvedOptions().timeZone;
    const local = state(now - 1000, { language: 'en', timeZone: 'local' });
    assert.equal(local.recent, true);
    const expected = new Intl.DateTimeFormat('en-US', { timeZone: zone, day: 'numeric' }).format(now - 1000);
    assert.match(local.date, new RegExp(`\\.${expected} \\(`));
});
test('bad reference clock does not accidentally highlight', () => {
    assert.equal(state(now, ko, NaN).valid, false);
});
