const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { buildSync } = require('esbuild');
const root = path.resolve(__dirname, '..'), repo = path.resolve(root, '../..');
const source = path.join(repo, 'docs/v2'), destination = path.join(root, 'web');
const output = fs.mkdtempSync(path.join(root, '.web-build-'));
const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim();
const version = fs.readFileSync(path.join(source, 'src/config.js'), 'utf8').match(/export const VERSION = '([^']+)'/)[1];
fs.mkdirSync(output, { recursive: true });
function copy(directory, relative = '') {
  for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
    const next = path.join(relative, item.name), input = path.join(directory, item.name);
    if (item.isDirectory()) copy(input, next);
    else if (/\.(js|html|css|png|mp3|webmanifest)$/.test(item.name)) {
      const target = path.join(output, next); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(input, target);
    }
  }
}
copy(source);
for (const name of ['privacy.html', 'support.html']) fs.copyFileSync(path.join(root, 'native', name), path.join(output, name));
buildSync({ entryPoints: [path.join(root, 'native/bootstrap.js')], outfile: path.join(output, 'native.js'), bundle: true, format: 'esm', platform: 'browser', target: 'safari15', external: ['./src/game.js'], minify: true });
let html = fs.readFileSync(path.join(output, 'index.html'), 'utf8');
html = html.replace(/<a class="legacy-link"[^>]*>.*?<\/a>/, '<a class="legacy-link" href="./privacy.html">Privacy</a> <a class="legacy-link" href="./support.html">Help and support</a>');
html = html.replace('src="./src/game.js"', 'src="./native.js"');
html = html.replace('<head>', '<head>\n<meta http-equiv="Content-Security-Policy" content="default-src \'self\' capacitor:; script-src \'self\'; style-src \'self\' \'unsafe-inline\'; img-src \'self\' data:; media-src \'self\' blob:; connect-src \'self\' capacitor:; object-src \'none\'; base-uri \'self\'; frame-src \'none\'">');
fs.writeFileSync(path.join(output, 'index.html'), html);
const hashes = {};
function hashDir(directory, relative = '') {
  for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
    const rel = path.join(relative, item.name);
    if (item.isDirectory()) hashDir(path.join(directory, item.name), rel);
    else if (rel !== 'build-manifest.json') hashes[rel] = crypto.createHash('sha256').update(fs.readFileSync(path.join(directory, item.name))).digest('hex');
  }
}
hashDir(output);
const dirty = !!execFileSync('git', ['status', '--porcelain', '--untracked-files=normal', '--', 'docs/v2', 'apps/zombie-squad-run-ios-webwrap/native', 'apps/zombie-squad-run-ios-webwrap/tools', 'apps/zombie-squad-run-ios-webwrap/package.json', 'apps/zombie-squad-run-ios-webwrap/package-lock.json', 'apps/zombie-squad-run-ios-webwrap/capacitor.config.json'], { cwd: repo, encoding: 'utf8' }).trim();
fs.writeFileSync(path.join(output, 'build-manifest.json'), JSON.stringify({ version, sourceCommit, dirty, monetization: 'paid-upfront', files: hashes }, null, 2));
// Preserve the previous generated package rather than leaving stale files in the new build.
if (fs.existsSync(destination)) fs.renameSync(destination, path.join(fs.mkdtempSync(path.join(root, '.web-backup-')), 'web'));
fs.renameSync(output, destination);
console.log('Packaged Zombie Mayhem', version, 'from', sourceCommit, 'with', Object.keys(hashes).length, 'files.');
