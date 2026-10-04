// Release maintenance only; no runtime dependency or build system.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.join(__dirname, '..');
const filename = path.join(root, 'sw.js');
let source = fs.readFileSync(filename, 'utf8');
const version = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(version || '')) throw Error('Usage: node tools/update-shell.cjs NEW_VERSION');
source = source.replace(/const VERSION = '[^']+';/, `const VERSION = '${version}';`);
const list = source.match(/const ASSETS = (\[[\s\S]*?\]);/)[1];
const assets = [...list.matchAll(/'([^']+)'/g)].map(match => match[1]);
const hashes = Object.fromEntries(assets.map(asset => {
  const file = asset === './' ? 'index.html' : asset;
  const bytes = fs.readFileSync(path.join(root, file));
  const variants = [bytes];
  // Git/static hosting may normalize text line endings on Windows. Accept only
  // these byte-equivalent text variants of the same release, never arbitrary content.
  if (/\.(html|css|js|svg|webmanifest)$/.test(file)) {
    const text = bytes.toString('utf8').replace(/\r\n/g, '\n');
    variants.push(Buffer.from(text), Buffer.from(text.replace(/\n/g, '\r\n')));
  }
  const hashes = [...new Set(variants.map(value =>
    'sha256-' + crypto.createHash('sha256').update(value).digest('base64')))];
  return [asset, hashes.join(' ')];
}));
source = source.replace(/const INTEGRITY = [\s\S]*?;/, `const INTEGRITY = ${JSON.stringify(hashes, null, 2)};`);
fs.writeFileSync(filename, source);
