const { execFileSync } = require('node:child_process');
if (process.platform !== 'darwin') throw Error('A macOS Xcode host is required for native certification.');
const xcode = execFileSync('xcodebuild', ['-version'], { encoding: 'utf8' });
const sdk = execFileSync('xcrun', ['--sdk', 'iphoneos', '--show-sdk-version'], { encoding: 'utf8' }).trim();
if (!(Number(xcode.match(/Xcode (\d+)/)?.[1]) >= 26) || !(Number(sdk.split('.')[0]) >= 26)) throw Error('App Store uploads require Xcode 26+ and iOS 26 SDK+.');
console.log(xcode.trim(), 'iOS SDK', sdk);
