/* Repository validation: manifest, locales, required files, JS syntax. */
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const fail = (message) => {
  console.error(`validate: ${message}`);
  process.exitCode = 1;
};

const manifestPath = path.join(root, 'manifest.json');
let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
} catch (error) {
  fail(`manifest.json is not valid JSON: ${error.message}`);
  process.exit(1);
}

if (manifest.manifest_version !== 3) fail('manifest_version must be 3');
if (manifest.default_locale !== 'en') fail('default_locale must be en');
if (JSON.stringify(manifest.permissions) !== JSON.stringify(['storage'])) {
  fail('permissions must be exactly ["storage"]');
}

const contentScripts = manifest.content_scripts?.[0];
const expectedJs = ['src/shared.js', 'src/styles.js', 'src/parser.js', 'src/render.js', 'src/transport.js', 'src/content.js'];
if (!contentScripts || JSON.stringify(contentScripts.js) !== JSON.stringify(expectedJs)) {
  fail(`content_scripts.js must be ${expectedJs.join(', ')}`);
}
if (!contentScripts?.matches || JSON.stringify(contentScripts.matches) !== JSON.stringify(['https://github.com/*'])) {
  fail('content_scripts.matches must be exactly ["https://github.com/*"]');
}

const requiredFiles = [
  'manifest.json',
  ...expectedJs,
  'src/background.js',
  'src/pages.js',
  'styles/content.css',
  'styles/pages.css',
  'popup.html',
  'options.html',
  'welcome.html',
  'help.html',
  'privacy.html',
  'icons/icon-16.png',
  'icons/icon-32.png',
  'icons/icon-48.png',
  'icons/icon-128.png',
  'icons/mark.svg',
  '_locales/en/messages.json',
  '_locales/ko/messages.json'
];
for (const file of requiredFiles) {
  if (!existsSync(path.join(root, file))) fail(`missing required file: ${file}`);
}

for (const locale of ['en', 'ko']) {
  try {
    const messages = JSON.parse(readFileSync(path.join(root, `_locales/${locale}/messages.json`), 'utf8'));
    if (!messages.extensionName?.message || !messages.extensionDescription?.message) {
      fail(`_locales/${locale}/messages.json must define extensionName and extensionDescription`);
    }
  } catch (error) {
    fail(`_locales/${locale}/messages.json is not valid JSON: ${error.message}`);
  }
}

const jsFiles = [...expectedJs, 'src/background.js', 'src/pages.js', 'tools/package.mjs', 'tests/validate.mjs'];
for (const file of jsFiles) {
  try {
    execFileSync(process.execPath, ['--check', path.join(root, file)], { stdio: 'pipe' });
  } catch (error) {
    fail(`${file} failed syntax check`);
  }
}

const csp = manifest.content_security_policy?.extension_pages || '';
if (!csp.includes("connect-src 'none'") || !csp.includes("script-src 'self'")) {
  fail('extension_pages CSP must keep connect-src none and script-src self');
}
if (JSON.stringify(manifest.content_scripts?.[0]?.matches) !== JSON.stringify(['https://github.com/*'])) {
  fail('GitHub host access must remain narrow');
}

if (process.exitCode) {
  console.error('validate: failed');
} else {
  console.log(`validate: OK (${requiredFiles.length} files, ${jsFiles.length} JS syntax checks)`);
}
