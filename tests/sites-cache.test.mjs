import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import vm from 'node:vm';
const ctx = vm.createContext({ URL, crypto: webcrypto, TextEncoder });
for (const name of ['sites','navigation-cache','notes']) vm.runInContext(readFileSync(new URL(`../src/${name}.js`, import.meta.url), 'utf8'), ctx);
const S = ctx.LCSites, Cache = ctx.LCNavigationCache;
const storage = () => { const data = {}; return { async get(k) { return { [k]: structuredClone(data[k]) }; }, async set(v) { Object.assign(data, structuredClone(v)); }, async remove(k) { delete data[k]; } }; };
const entry = at => ({ value: { kind: 'comment', author: 'qa', time: '2026-01-01', preview: { text: 'body' } }, at, attempted: true });
test('only explicit Gitea installations match, including exact ports and base paths', () => {
 const hosts = ['http://git.example:3000/gitea'];
 assert.equal(S.find('http://git.example:3000/gitea/org/repo/issues',hosts).provider,'gitea');
 for (const url of ['http://git.example:3001/gitea/org/repo/issues','https://git.example:3000/gitea/org/repo/issues','http://git.example:3000/gitea2/org/repo/issues','http://git.example:3000/elsewhere']) assert.equal(S.find(url,hosts),null);
 assert.equal(S.find('https://github.com/org/repo/issues').provider,'github');
});
test('Gitea issue/pull paths and GitHub singular pull remain separate', () => {
 const s = S.normalize('https://git.example/gitea/');
 assert.equal(S.conversation('https://git.example/gitea/org/repo/pulls/12',s).number,'12');
 assert.equal(S.conversation('https://git.example/gitea/org/repo/pull/12',s),null);
 assert.equal(S.listKind('https://git.example/gitea/org/repo/issues?type=all',s),'list');
 assert.equal(S.listKind('https://git.example/gitea/org/repo/issues/12',s),'');
});
test('unsafe installation URLs and external assets are rejected', () => {
 for (const url of ['https://user:pass@git.example','javascript:alert(1)','https://*.example','https://git.example?q=token','https://github.com','https://git.example/gitea%2fother']) assert.equal(S.normalize(url),null);
 const s=S.normalize('http://git.example:3000/gitea');
 assert.equal(S.asset('https://elsewhere.example/image',s),'');
 assert.equal(S.asset('/gitea/avatars/1',s),'http://git.example:3000/gitea/avatars/1');
});
test('navigation restores checked values without TTL refresh', async () => {
 const c=new Cache(storage()), a=await c.open(1,'https://github.com','Alice');
 await c.put(1,'https://github.com',a.token,'alice|org/repo#1',entry(10));
 const b=await c.open(1,'https://github.com','alice');
 assert.equal(b.entries.length,1); assert.equal(b.entries[0][1].at,10);
 assert.notEqual(a.token,b.token);
});
test('old document writes cannot contaminate a restored page', async () => {
 const c=new Cache(storage()), a=await c.open(1,'https://github.com','alice');
 await c.open(1,'https://github.com','alice');
 assert.equal((await c.put(1,'https://github.com',a.token,'alice|org/repo#1',entry(20))).ok,false);
});
test('account changes and logout never restore another account', async () => {
 const c=new Cache(storage()), a=await c.open(1,'https://github.com','alice');
 await c.put(1,'https://github.com',a.token,'alice|org/repo#1',entry(1));
 assert.equal((await c.open(1,'https://github.com','bob')).entries.length,0);
 assert.equal((await c.open(1,'https://github.com','alice')).entries.length,0);
});
test('tabs and sites are isolated', async () => {
 const c=new Cache(storage()), a=await c.open(1,'https://github.com','alice');
 await c.put(1,'https://github.com',a.token,'alice|org/repo#1',entry(1));
 assert.equal((await c.open(2,'https://github.com','alice')).entries.length,0);
 assert.equal((await c.open(1,'https://git.example','alice')).entries.length,0);
});
test('LRU keeps only 80 recent entries per tab', async () => {
 const c=new Cache(storage()), a=await c.open(1,'https://github.com','a');
 for(let i=0;i<85;i++) await c.put(1,'https://github.com',a.token,`a|r/r#${i}`,entry(i+1));
 const b=await c.open(1,'https://github.com','a'); assert.equal(b.entries.length,80); assert.equal(b.entries[0][0],'a|r/r#5');
});
test('cache clearing and tab closure remove matching content', async () => {
 const c=new Cache(storage()), a=await c.open(1,'x','a');
 await c.put(1,'x',a.token,'a|r/r#1',entry(1)); await c.drop(1);
 assert.equal((await c.open(1,'x','a')).entries.length,0); await c.clear(); assert.equal((await c.read()).length,0);
});
test('note keys remain compatible on GitHub and isolate Gitea sites', async () => {
 const N=ctx.LCNotes, key='org/repo#1';
 assert.notEqual(await N.keyFor({key}), await N.keyFor({key,provider:'gitea',baseUrl:'https://git.example'}));
 assert.notEqual(await N.keyFor({key,provider:'gitea',baseUrl:'https://git.example/a'}), await N.keyFor({key,provider:'gitea',baseUrl:'https://git.example/b'}));
});
