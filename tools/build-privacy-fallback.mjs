// Generates the static no-JS fallback inside privacy.html from src/shared.js.
// Re-run after editing policy strings: node tools/build-privacy-fallback.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import '../src/shared.js';

const LC = globalThis.LC;
const here = path.dirname(fileURLToPath(import.meta.url));

const esc = (s) => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

const sections = [
  ['scopeTitle', 'privacyData'],
  ['dataTitle', 'privacyRetention'],
  ['note', 'notesPrivacy'],
  ['connections', 'privacyNetwork'],
  ['support', 'privacySharing'],
  ['localOnly', 'privacyUse'],
  ['source', 'privacyContact'],
];

function block(lang) {
  const t = (k) => esc(LC.t(k, lang));
  let h = `    <main class="wrap prose" lang="${lang}">\n`;
  h += `      <h1>${t('privacyTitle')}</h1>\n`;
  h += `      <p class="small">${t('privacyEffective')}</p>\n`;
  for (const [heading, body] of sections) {
    h += `      <h2>${t(heading)}</h2>\n      <p>${t(body)}</p>\n`;
  }
  h += `      <p><a href="${LC.repo}/issues">${t('support')}</a></p>\n    </main>\n`;
  return h;
}

const appInner = [
  '    <header><a class="brand" href="welcome.html"><img src="icons/icon-48.png" alt=""><span>Last Comment <small>for GitHub</small></span></a>',
  '    <nav><a href="help.html">Help · 도움말</a><a href="privacy.html">Privacy · 개인정보처리방침</a></nav></header>',
  block('en'),
  '    <hr>',
  block('ko'),
  `    <footer><span>Last Comment for GitHub</span> <a href="${LC.repo}">Source</a> <a href="${LC.repo}/issues">Support</a></footer>`,
].join('\n');

const p = path.join(here, '..', 'privacy.html');
let html = readFileSync(p, 'utf8');
html = html.replace(/<!-- Static fallback:[\s\S]*?<div id="app">[\s\S]*?\n  <\/div>/, '<div id="app"></div>');
if (!html.includes('<div id="app"></div>')) throw new Error('Static app container not found');
html = html.replace(/<div id="app"><\/div>/, `<!-- Static fallback: shown when JS is unavailable (reviewers, crawlers). Rendered dynamically when JS runs. Regenerate with: node tools/build-privacy-fallback.mjs -->\n  <div id="app">\n${appInner}\n  </div>`);
html = html.replace(
  '<noscript>JavaScript is required to display extension settings.</noscript>',
  '<noscript><p><strong>Note:</strong> the full policy text above is readable without JavaScript. Interactive settings require the installed extension.</p></noscript>',
);
writeFileSync(p, html);
console.log('privacy.html static fallback written.');
