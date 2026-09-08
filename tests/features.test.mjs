import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import vm from 'node:vm';
import { zipStore, zipEntries, crc32 } from '../tools/zip.mjs';

const context = vm.createContext({ URL, TextEncoder, crypto: webcrypto });
for (const name of ['shared', 'notes', 'parser']) vm.runInContext(readFileSync(new URL(`../src/${name}.js`, import.meta.url), 'utf8'), context);
const N = context.LCNotes, P = context.LCParser, LC = context.LC;
const info = P.parseConversationUrl('https://github.com/example/repo/issues/12');
const plain = value => JSON.parse(JSON.stringify(value));
const storage = () => {
  const data = {};
  return { data, async get(key) { return { [key]: data[key] }; }, async set(values) { Object.assign(data, values); }, async remove(key) { delete data[key]; } };
};
const comment = (id, author = 'alice', time = '2026-09-08T01:00:00Z', body = 'Hello') => P.commentFromNode({
  __typename: 'IssueComment', url: `${info.url}#issuecomment-${id}`, createdAt: time, author: { login: author }, body
}, info, 'viewer');
const comments = values => new Map(values.map(v => [v.commentId, v]));

test('note keys are stable, case-insensitive and contain no raw issue URL', async () => {
  const key = await N.keyFor(info);
  assert.match(key, /^lc-note:v1:[a-f0-9]{64}$/);
  assert.equal(key, await N.keyFor({ key: info.key.toUpperCase() }));
  assert.ok(!key.includes('example'));
});
test('different issues use distinct keys', async () => {
  assert.notEqual(await N.keyFor(info), await N.keyFor({ key: 'example/repo#13' }));
});
test('invalid note keys are rejected without storage writes', async () => {
  const s = storage();
  const result = await N.write(s, { key: 'preferences', expectedRevision: '', value: { text: 'x', pinned: false } });
  assert.equal(result.error, 'NOTE_INVALID'); assert.deepEqual(s.data, {});
});
test('note save uses opaque revision and preserves literal user text', async () => {
  const s = storage(), key = await N.keyFor(info);
  const result = await N.write(s, { key, expectedRevision: '', value: { text: '<img onerror="x">', pinned: true } });
  assert.equal(result.ok, true); assert.equal(s.data[key].text, '<img onerror="x">');
  assert.equal(s.data[key].pinned, true); assert.ok(result.value.revision);
});
test('stale revision cannot overwrite another tab', async () => {
  const s = storage(), key = await N.keyFor(info);
  await N.write(s, { key, expectedRevision: '', value: { text: 'first', pinned: false } });
  const result = await N.write(s, { key, expectedRevision: '', value: { text: 'stale', pinned: false } });
  assert.equal(result.error, 'NOTE_CONFLICT'); assert.equal(s.data[key].text, 'first');
});
test('explicit empty save deletes the note', async () => {
  const s = storage(), key = await N.keyFor(info);
  const first = await N.write(s, { key, expectedRevision: '', value: { text: 'first', pinned: false } });
  const result = await N.write(s, { key, expectedRevision: first.value.revision, value: { text: '  ', pinned: false } });
  assert.equal(result.ok, true); assert.deepEqual(s.data, {});
});
test('oversized notes and invalid pin state are rejected', async () => {
  for (const value of [{ text: 'x'.repeat(4001), pinned: false }, { text: 'x', pinned: 'true' }]) {
    const s = storage(), key = await N.keyFor(info);
    assert.equal((await N.write(s, { key, expectedRevision: '', value })).error, 'NOTE_INVALID');
    assert.deepEqual(s.data, {});
  }
});
test('storage failure is propagated for UI error handling', async () => {
  const s = storage(); s.set = async () => { throw new Error('quota'); };
  await assert.rejects(N.write(s, { key: await N.keyFor(info), expectedRevision: '', value: { text: 'draft', pinned: false } }), /quota/);
});
test('history selects exact predecessor and stable same-time order', () => {
  const map = comments([comment('1'), comment('3', 'bob'), comment('2')]);
  const result = P.historyWindow(map, `${info.url}#issuecomment-3`);
  assert.deepEqual(plain(result.comments.map(c => c.commentUrl)), [`${info.url}#issuecomment-2`, `${info.url}#issuecomment-1`]);
  assert.equal(result.hasMore, false);
});
test('history does not guess a deleted or foreign anchor', () => {
  const map = comments([comment('1')]);
  assert.throws(() => P.historyWindow(map, `${info.url}#issuecomment-999`), /HISTORY_ANCHOR/);
  assert.throws(() => P.historyWindow(map, 'https://github.com/elsewhere/repo/issues/1#issuecomment-1'), /HISTORY_ANCHOR/);
});
test('history keeps authors distinct and strips internal parser references', () => {
  const map = comments([comment('1', 'alice'), comment('2', 'alice'), comment('3', 'bob')]);
  const result = P.historyWindow(map, `${info.url}#issuecomment-3`);
  assert.equal(result.comments[0].author, 'alice');
  assert.equal(result.comments[0].preview.text, 'Hello');
  assert.ok(!('_mentionSource' in result.comments[0]));
});
test('history ends correctly at the first comment', () => {
  const result = P.historyWindow(comments([comment('1')]), `${info.url}#issuecomment-1`);
  assert.equal(result.comments.length, 0); assert.equal(result.hasMore, false);
});
test('history bounds each reusable batch', () => {
  const map = comments(Array.from({ length: 35 }, (_, i) => comment(String(i + 1))));
  const result = P.historyWindow(map, `${info.url}#issuecomment-35`);
  assert.equal(result.comments.length, 20); assert.equal(result.hasMore, true);
});
test('newest-comment selection remains unchanged', () => {
  const map = comments([comment('9', 'old', '2026-09-07T00:00:00Z'), comment('8', 'new', '2026-09-08T00:00:00Z')]);
  assert.equal(P.newest(map).author, 'new'); assert.equal(P.newest(new Map()).kind, 'none');
});
test('English and Korean expose the same feature translations', () => {
  for (const key of ['older', 'newer', 'latest', 'note', 'noteSave', 'notePinned', 'notesPrivacy']) {
    assert.notEqual(LC.t(key, 'en'), key); assert.notEqual(LC.t(key, 'ko'), key);
  }
});
test('ZIP encoding produces deterministic real ZIP with preserved paths', () => {
  const files = [{ name: 'manifest.json', data: '{"version":"1.1.0"}' }, { name: 'src/notes.js', data: 'local notes' }];
  const zip = zipStore(files);
  assert.equal(zip.readUInt32LE(0), 0x04034b50);
  assert.deepEqual(zipEntries(zip), files.map(f => f.name));
  assert.deepEqual(zip, zipStore(files));
  assert.equal(crc32(Buffer.from('123456789')), 0xcbf43926);
});
test('ZIP writer refuses duplicate or traversing paths', () => {
  assert.throws(() => zipStore([{ name: '../x', data: '' }]), /Invalid ZIP path/);
  assert.throws(() => zipStore([{ name: 'x', data: '' }, { name: 'x', data: '' }]), /Invalid ZIP path/);
});
test('generated stylesheet matches the final CSS overlay', () => {
  const scope = vm.createContext({});
  vm.runInContext(readFileSync(new URL('../src/styles.js', import.meta.url), 'utf8'), scope);
  assert.equal(scope.LCStyles, readFileSync(new URL('../styles/content.css', import.meta.url), 'utf8'));
});
