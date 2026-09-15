const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '..'), web = path.join(root, 'web');
const manifest = JSON.parse(fs.readFileSync(path.join(web, 'build-manifest.json')));
const config = JSON.parse(fs.readFileSync(path.join(root, 'capacitor.config.json')));
if (process.argv.includes('--release') && manifest.dirty) throw Error('Release package must be built from committed source');
if (config.server?.url || config.webDir !== 'web' || config.appName !== 'Zombie Mayhem') throw Error('Incorrect native target or remote-only runtime');
for (const file of ['index.html', 'native.js', 'src/game.js', 'src/checkpoint.js', 'src/renderer.js', 'assets/combat-props.png', 'assets/characters.png', 'assets/audio/bed.mp3', 'privacy.html', 'support.html']) if (!manifest.files[file]) throw Error('Missing V2 file: ' + file);
for (const [file, hash] of Object.entries(manifest.files)) {
  if (file.includes('..') || path.isAbsolute(file) || /(^|\/)(\.env|node_modules|AGENTS.md)/.test(file)) throw Error('Unsafe packaged path');
  if (crypto.createHash('sha256').update(fs.readFileSync(path.join(web, file))).digest('hex') !== hash) throw Error('Asset changed after packaging: ' + file);
}
const source = fs.readFileSync(path.join(root, '../../docs/v2/src/config.js'), 'utf8');
if (!source.includes("VERSION = '" + manifest.version + "'")) throw Error('Stale V2 package');
if (!/^[a-f0-9]{40}$/.test(manifest.sourceCommit)) throw Error('Missing source provenance');
const actualFiles = fs.readdirSync(web, { recursive: true, withFileTypes: true }).filter(item => item.isFile()).map(item => path.relative(web, path.join(item.parentPath, item.name))).filter(file => file !== 'build-manifest.json').sort();
if (JSON.stringify(actualFiles) !== JSON.stringify(Object.keys(manifest.files).sort())) throw Error('Unmanifested packaged files');
console.log('Verified offline V2 package:', manifest.version, manifest.sourceCommit);
