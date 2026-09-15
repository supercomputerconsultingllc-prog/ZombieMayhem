const { execFileSync } = require('node:child_process');
const call = args => execFileSync('xcrun', ['simctl', ...args], { encoding: 'utf8' }).trim();
const devices = JSON.parse(call(['list', 'devices', 'available', '-j'])).devices;
const device = Object.entries(devices).filter(([runtime]) => /iOS-26/.test(runtime)).flatMap(([, items]) => items).find(item => item.name.startsWith('iPhone'));
if (!device) throw Error('No iOS 26 iPhone simulator installed');
if (device.state !== 'Booted') call(['boot', device.udid]);
call(['bootstatus', device.udid, '-b']);
call(['install', device.udid, 'build/simulator/Build/Products/Release-iphonesimulator/App.app']);
console.log(call(['launch', device.udid, 'com.zombiesquadrun.game']));
setTimeout(() => {
  call(['io', device.udid, 'screenshot', 'build/simulator-smoke.png']);
  console.log('Simulator process launched; screenshot requires review. Physical-device certification remains separate.');
}, 8000);
