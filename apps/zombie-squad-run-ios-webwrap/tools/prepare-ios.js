const fs = require('node:fs'), path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const run = (command, args) => execFileSync(command, args, { cwd: root, stdio: 'inherit' });
run(process.execPath, ['tools/prepare-web.js']); run(process.execPath, ['tools/verify-v2.js']);
const cli = path.join(root, 'node_modules/@capacitor/cli/bin/capacitor');
if (!fs.existsSync(path.join(root, 'ios/App/App.xcodeproj'))) run(process.execPath, [cli, 'add', 'ios']);
run(process.execPath, [cli, 'sync', 'ios']);
const app = path.join(root, 'ios/App/App'), project = path.join(root, 'ios/App/App.xcodeproj/project.pbxproj');
fs.copyFileSync(path.join(root, 'native/PrivacyInfo.xcprivacy'), path.join(app, 'PrivacyInfo.xcprivacy'));
let pbx = fs.readFileSync(project, 'utf8');
// Pinned CLI template anchors: fail rather than silently omit privacy resources after upgrades.
if (!pbx.includes('ZM0000000000000000000001') && !pbx.includes('AB0000000000000000000001')) {
  for (const anchor of ['/* Begin PBXBuildFile section */', '/* Begin PBXFileReference section */', '504EC3131FED79650016851F /* Info.plist */,', '504EC3121FED79650016851F /* LaunchScreen.storyboard in Resources */,']) if (!pbx.includes(anchor)) throw Error('Capacitor project template changed: ' + anchor);
  pbx = pbx.replace('/* Begin PBXBuildFile section */', '/* Begin PBXBuildFile section */\n\t\tZM0000000000000000000001 /* PrivacyInfo.xcprivacy in Resources */ = {isa = PBXBuildFile; fileRef = ZM0000000000000000000002; };')
    .replace('/* Begin PBXFileReference section */', '/* Begin PBXFileReference section */\n\t\tZM0000000000000000000002 /* PrivacyInfo.xcprivacy */ = {isa = PBXFileReference; lastKnownFileType = text.xml; path = PrivacyInfo.xcprivacy; sourceTree = "<group>"; };')
    .replace('504EC3131FED79650016851F /* Info.plist */,', '504EC3131FED79650016851F /* Info.plist */,\n\t\t\t\tZM0000000000000000000002 /* PrivacyInfo.xcprivacy */,')
    .replace('504EC3121FED79650016851F /* LaunchScreen.storyboard in Resources */,', '504EC3121FED79650016851F /* LaunchScreen.storyboard in Resources */,\n\t\t\t\tZM0000000000000000000001 /* PrivacyInfo.xcprivacy in Resources */,');
}
const buildNumber = process.env.ZOMBIE_BUILD_NUMBER || '1';
if (!/^[1-9]\d{0,8}$/.test(buildNumber)) throw Error('ZOMBIE_BUILD_NUMBER must be a positive integer');
pbx = pbx.replaceAll('ZM000000000000000000000', 'AB000000000000000000000').replace(/IPHONEOS_DEPLOYMENT_TARGET = [^;]+;/g, 'IPHONEOS_DEPLOYMENT_TARGET = 15.4;').replace(/MARKETING_VERSION = [^;]+;/g, 'MARKETING_VERSION = 2.0.0;').replace(/CURRENT_PROJECT_VERSION = [^;]+;/g, `CURRENT_PROJECT_VERSION = ${buildNumber};`);
fs.writeFileSync(project, pbx);
const plist = path.join(app, 'Info.plist');
let info = fs.readFileSync(plist, 'utf8').replace('<string>armv7</string>', '<string>arm64</string>');
if (!info.includes('ITSAppUsesNonExemptEncryption')) info = info.replace('<key>LSRequiresIPhoneOS</key>', '<key>ITSAppUsesNonExemptEncryption</key><false/>\n\t<key>LSRequiresIPhoneOS</key>');
fs.writeFileSync(plist, info);
const swift = path.join(root, 'ios/App/CapApp-SPM/Package.swift');
let spm = fs.readFileSync(swift, 'utf8');
if (!spm.includes('ion-ios-filesystem')) spm = spm.replace('dependencies: [', 'dependencies: [\n        .package(url: "https://github.com/ionic-team/ion-ios-filesystem.git", exact: "1.1.1"),');
fs.writeFileSync(swift, spm);
// iOS asset compilation resamples the authored source, retaining the original in native/.
if (process.platform === 'darwin') run('sips', ['-z', '1024', '1024', 'native/app-icon-source.png', '--out', 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png']);
fs.copyFileSync(path.join(root, 'native/LaunchScreen.storyboard'), path.join(app, 'Base.lproj/LaunchScreen.storyboard'));
console.log('V2 iOS source prepared. Compile/sign on macOS; Linux preparation is not a native build.');
