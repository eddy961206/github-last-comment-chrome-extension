/* Package runtime files into dist/last-comment-extension-<version>.zip. No dev-only files. */
/* Uses tar (Windows bsdtar / GNU tar) so directory structure is preserved
   on every platform, including the ubuntu release runner. */
import { readFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const manifest = JSON.parse(readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const version = manifest.version || '1.0.0';
const dist = path.join(root, 'dist');
mkdirSync(dist, { recursive: true });
const out = path.join(dist, `last-comment-extension-${version}.zip`);

const runtimeFiles = [
  'manifest.json',
  'popup.html',
  'options.html',
  'welcome.html',
  'help.html',
  'privacy.html',
  'src/shared.js',
  'src/styles.js',
  'src/recency.js',
  'src/parser.js',
  'src/render.js',
  'src/transport.js',
  'src/content.js',
  'src/background.js',
  'src/pages.js',
  'styles/content.css',
  'styles/pages.css',
  'icons/icon-16.png',
  'icons/icon-32.png',
  'icons/icon-48.png',
  'icons/icon-128.png',
  '_locales/en/messages.json',
  '_locales/ko/messages.json'
];

for (const file of runtimeFiles) {
  if (!existsSync(path.join(root, file))) {
    console.error(`package: missing runtime file ${file}`);
    process.exit(1);
  }
}

try {
  if (existsSync(out)) rmSync(out);
  execFileSync('tar', ['-a', '-c', '-f', out, ...runtimeFiles], { cwd: root, stdio: 'inherit' });
  console.log(`package: ${out}`);
} catch (error) {
  console.error(`package: failed (tar required): ${error.message}`);
  process.exit(1);
}
