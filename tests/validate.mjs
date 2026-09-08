/* Repository validation: manifest, locales, required files, JS syntax,
   store image sizes, and submission zip structure. */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { zipEntries } from '../tools/zip.mjs';
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

if (JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).version !== manifest.version) fail('package and manifest versions must match');
if (manifest.manifest_version !== 3) fail('manifest_version must be 3');
if (manifest.default_locale !== 'en') fail('default_locale must be en');
if (JSON.stringify(manifest.permissions) !== JSON.stringify(['storage'])) {
  fail('permissions must be exactly ["storage"]');
}

const contentScripts = manifest.content_scripts?.[0];
const expectedJs = ['src/shared.js', 'src/notes.js', 'src/styles.js', 'src/recency.js', 'src/parser.js', 'src/render.js', 'src/transport.js', 'src/content.js'];
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

const jsFiles = [...expectedJs, 'src/background.js', 'src/pages.js', 'tools/package.mjs', 'tests/validate.mjs', 'tests/features.test.mjs', 'tools/zip.mjs'];
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

// Store image sizes (read PNG IHDR directly, no dependencies).
const pngSize = (file) => {
  const buf = readFileSync(file);
  const pngSig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!buf.subarray(0, 8).equals(pngSig) || buf.toString('ascii', 12, 16) !== 'IHDR') return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
};
const assetDir = path.join(root, 'store/assets');
if (existsSync(assetDir)) {
  for (const name of readdirSync(assetDir).filter((n) => n.endsWith('.png'))) {
    const size = pngSize(path.join(assetDir, name));
    if (!size) {
      fail(`store asset is not a valid PNG: ${name}`);
      continue;
    }
    const shot = (size.width === 1280 && size.height === 800) || (size.width === 640 && size.height === 400);
    const promo = size.width === 440 && size.height === 280;
    if (name.startsWith('promo-') ? !promo : !shot) {
      fail(`store asset has wrong size ${size.width}x${size.height}: ${name}`);
    }
  }
}

// Submission zip must preserve manifest-referenced paths (no flattening).
const zipPath = path.join(root, 'dist', `last-comment-extension-${manifest.version}.zip`);
if (existsSync(zipPath)) {
  let entries = [];
  try {
    entries = zipEntries(readFileSync(zipPath));
  } catch (error) {
    fail(`cannot list submission zip: ${error.message}`);
  }
  const referenced = new Set([
    'manifest.json', 'popup.html', 'options.html', 'welcome.html', 'help.html', 'privacy.html',
    manifest.background?.service_worker,
    manifest.action?.default_popup,
    ...(manifest.action?.default_icon ? Object.values(manifest.action.default_icon) : []),
    ...(manifest.options_ui?.page ? [manifest.options_ui.page] : []),
    ...Object.values(manifest.icons || {}),
    ...(contentScripts?.js || []),
    '_locales/en/messages.json',
    '_locales/ko/messages.json'
  ].filter(Boolean));
  for (const ref of referenced) {
    if (!entries.includes(ref)) fail(`submission zip is missing manifest path: ${ref}`);
  }
}

if (process.exitCode) {
  console.error('validate: failed');
} else {
  console.log(`validate: OK (${requiredFiles.length} files, ${jsFiles.length} JS syntax checks)`);
}
