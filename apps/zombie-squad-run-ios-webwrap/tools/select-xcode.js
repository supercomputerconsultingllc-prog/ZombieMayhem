const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const versions = fs.readdirSync('/Applications').filter(name => /^Xcode_26(?:\.\d+)*\.app$/.test(name)).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
if (!versions.length) throw Error('This macOS runner has no supported Xcode 26 installation.');
execFileSync('sudo', ['xcode-select', '-s', `/Applications/${versions[0]}/Contents/Developer`], { stdio: 'inherit' });
console.log('Selected', versions[0]);
