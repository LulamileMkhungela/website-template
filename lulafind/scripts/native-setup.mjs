#!/usr/bin/env node
/**
 * LulaFind native platform setup.
 *
 *   node scripts/native-setup.mjs android      # patch android/ after `npx cap add android`
 *   node scripts/native-setup.mjs ios          # patch ios/ after `npx cap add ios`
 *   node scripts/native-setup.mjs all          # both platforms
 *   node scripts/native-setup.mjs check        # report what is present / missing
 *
 * android/ and ios/ ship in this repo, so Android Studio and Xcode can open
 * them. This script is still safe to run after a fresh `npx cap add`: it adds
 * only the permissions LulaFind uses, targets API 36, and copies the Apple
 * privacy manifest into the iOS app target.
 *
 * Idempotent: running it twice changes nothing.
 */
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const PERMISSIONS = [
  'android.permission.INTERNET',
  'android.permission.ACCESS_NETWORK_STATE',
  // Location is consent-first and only ever read after the user taps allow.
  'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.ACCESS_FINE_LOCATION',
  // Camera + photos for case posters.
  'android.permission.CAMERA',
  'android.permission.READ_MEDIA_IMAGES',
  'android.permission.READ_MEDIA_VIDEO',
  // Legacy photo access for Android 12 and below.
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.WRITE_EXTERNAL_STORAGE',
  // Push notifications for missing-person alerts.
  'android.permission.POST_NOTIFICATIONS',
  // Native share sheet + haptics.
  'android.permission.VIBRATE'
];

const FEATURE_NOT_REQUIRED = 'android.hardware.camera';

const USAGE_STRINGS = {
  NSLocationWhenInUseUsageDescription:
    'LulaFind uses your location only when you choose to attach it to a case, and to sort cases near you. It is never read in the background without your consent.',
  NSLocationAlwaysAndWhenInUseUsageDescription:
    'Optional safety beacon: sends an "I am safe" check-in with your location to people you choose. You can turn it off at any time.',
  NSCameraUsageDescription:
    'LulaFind uses the camera so you can photograph a missing person\'s poster or a last-seen location.',
  NSPhotoLibraryUsageDescription:
    'LulaFind reads photos you pick so you can attach them to a case or a story.',
  NSPhotoLibraryAddUsageDescription:
    'LulaFind can save a case poster to your photos so you can print or share it.',
  NSUserTrackingUsageDescription:
    'LulaFind does not track you across other apps.',
  NSFaceIDUsageDescription: 'Optional: unlock LulaFind with Face ID.'
};

function log(msg) {
  console.log(`  ${msg}`);
}

function patchAndroid() {
  const manifestPath = join(ROOT, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
  if (!existsSync(manifestPath)) {
    console.error('\n  android/app/src/main/AndroidManifest.xml not found.');
    console.error('  Run `npx cap add android` first, then re-run this script.\n');
    process.exitCode = 1;
    return false;
  }
  let xml = readFileSync(manifestPath, 'utf8');

  const existing = new Set(
    [...xml.matchAll(/<uses-permission[^>]*android:name="([^"]+)"/g)].map((m) => m[1])
  );
  const toAdd = PERMISSIONS.filter((p) => !existing.has(p));

  if (toAdd.length) {
    const block = toAdd
      .map((p) => `    <uses-permission android:name="${p}" />`)
      .join('\n');
    // insert immediately after the opening <manifest ...> tag so the XML
    // declaration stays on line 1
    const openTag = xml.match(/<manifest[^>]*>/);
    if (!openTag) {
      console.error('  Could not find the <manifest> tag - is this a Capacitor manifest?');
      process.exitCode = 1;
      return false;
    }
    xml = xml.replace(openTag[0], `${openTag[0]}\n${block}`);
  }

  // The camera is optional: a phone without one must still install the app.
  if (!xml.includes(`android:name="${FEATURE_NOT_REQUIRED}"`)) {
    const feature = `    <uses-feature android:name="${FEATURE_NOT_REQUIRED}" android:required="false" />\n`;
    xml = xml.replace(/([ \t]*)<application/, `${feature}$1<application`);
  }

  writeFileSync(manifestPath, xml);
  console.log('\n  AndroidManifest.xml');
  log(toAdd.length ? `added ${toAdd.length} permission(s): ${toAdd.join(', ')}` : 'permissions already present');
  log('uses-feature camera required=false ensured');

  // Play Store: target Android 16 (API 36) from 31 Aug 2026.
  const varsPath = join(ROOT, 'android', 'variables.gradle');
  if (existsSync(varsPath)) {
    let vars = readFileSync(varsPath, 'utf8');
    const bumped = vars
      .replace(/targetSdkVersion\s*=\s*\d+/, 'targetSdkVersion = 36')
      .replace(/compileSdkVersion\s*=\s*\d+/, 'compileSdkVersion = 36')
      .replace(/minSdkVersion\s*=\s*\d+/, 'minSdkVersion = 24');
    if (bumped !== vars) {
      writeFileSync(varsPath, bumped);
      log('variables.gradle: compileSdk/targetSdk = 36 (Android 16), minSdk = 24');
    } else {
      log('variables.gradle already targets API 36');
    }
  }
  return true;
}

const PRIVACY_SRC = join(ROOT, 'native', 'ios', 'PrivacyInfo.xcprivacy');
const PRIVACY_FILE = 'A11F00011FED79650016851F';
const PRIVACY_BUILD = 'A11F00021FED79650016851F';

function installPrivacyManifest() {
  if (!existsSync(PRIVACY_SRC)) {
    console.error('  native/ios/PrivacyInfo.xcprivacy is missing from the repo.');
    process.exitCode = 1;
    return false;
  }
  const destDir = join(ROOT, 'ios', 'App', 'App');
  if (!existsSync(destDir)) {
    console.error('  ios/App/App is missing. Run `npx cap add ios` first.');
    process.exitCode = 1;
    return false;
  }
  copyFileSync(PRIVACY_SRC, join(destDir, 'PrivacyInfo.xcprivacy'));
  log('PrivacyInfo.xcprivacy copied into the iOS app');

  const pbxPath = join(ROOT, 'ios', 'App', 'App.xcodeproj', 'project.pbxproj');
  if (!existsSync(pbxPath)) {
    log('no Xcode project yet');
    return true;
  }
  let proj = readFileSync(pbxPath, 'utf8');
  if (proj.includes('PrivacyInfo.xcprivacy')) {
    log('Xcode project already lists PrivacyInfo.xcprivacy');
    return true;
  }
  const buildFile = `\t\t${PRIVACY_BUILD} /* PrivacyInfo.xcprivacy in Resources */ = {isa = PBXBuildFile; fileRef = ${PRIVACY_FILE} /* PrivacyInfo.xcprivacy */; };\n`;
  const fileRef = `\t\t${PRIVACY_FILE} /* PrivacyInfo.xcprivacy */ = {isa = PBXFileReference; lastKnownFileType = text.xml; path = PrivacyInfo.xcprivacy; sourceTree = "<group>"; };\n`;
  proj = proj.replace('/* Begin PBXBuildFile section */\n', `/* Begin PBXBuildFile section */\n${buildFile}`);
  proj = proj.replace('/* Begin PBXFileReference section */\n', `/* Begin PBXFileReference section */\n${fileRef}`);
  proj = proj.replace(
    '504EC3131FED79650016851F /* Info.plist */,',
    `504EC3131FED79650016851F /* Info.plist */,\n\t\t\t\t${PRIVACY_FILE} /* PrivacyInfo.xcprivacy */,`
  );
  proj = proj.replace(
    '2FAD9763203C412B000D30F8 /* config.xml in Resources */,',
    `2FAD9763203C412B000D30F8 /* config.xml in Resources */,\n\t\t\t\t${PRIVACY_BUILD} /* PrivacyInfo.xcprivacy in Resources */,`
  );
  if (!proj.includes('PrivacyInfo.xcprivacy in Resources')) {
    console.error('  Could not add PrivacyInfo.xcprivacy to the Xcode project.');
    process.exitCode = 1;
    return false;
  }
  writeFileSync(pbxPath, proj);
  log('Xcode app target now copies PrivacyInfo.xcprivacy into the bundle');
  return true;
}

function patchIos() {
  const projDir = join(ROOT, 'ios', 'App', 'App');
  const plistPath = join(projDir, 'Info.plist');
  if (!existsSync(plistPath)) {
    console.error('\n  ios/App/App/Info.plist not found.');
    console.error('  Run `npx cap add ios` first, then re-run this script.\n');
    process.exitCode = 1;
    return false;
  }
  let xml = readFileSync(plistPath, 'utf8');
  let added = 0;
  for (const [key, text] of Object.entries(USAGE_STRINGS)) {
    if (xml.includes(`<key>${key}</key>`)) continue;
    const entry = `\t<key>${key}</key>\n\t<string>${text}</string>\n`;
    const close = xml.lastIndexOf('</dict>');
    if (close < 0) continue;
    xml = `${xml.slice(0, close)}${entry}${xml.slice(close)}`;
    added++;
  }
  writeFileSync(plistPath, xml);
  console.log('\n  Info.plist');
  log(added ? `added ${added} usage-description string(s)` : 'usage strings already present');
  return installPrivacyManifest();
}

function check() {
  console.log('\nLulaFind native setup check\n');
  const rows = [
    ['www/index.html (built web app)', existsSync(join(ROOT, 'www', 'index.html'))],
    ['capacitor.config.ts', existsSync(join(ROOT, 'capacitor.config.ts'))],
    ['android/ platform', existsSync(join(ROOT, 'android', 'build.gradle'))],
    ['ios/ platform', existsSync(join(ROOT, 'ios', 'App'))],
    ['Apple privacy manifest', existsSync(join(ROOT, 'ios', 'App', 'App', 'PrivacyInfo.xcprivacy'))]
  ];
  for (const [label, ok] of rows) console.log(`  ${ok ? '✓' : '·'} ${label}`);
  console.log('\n  Next steps:');
  if (!rows[0][1]) console.log('    npm run build');
  if (!rows[2][1]) console.log('    npx cap add android && node scripts/native-setup.mjs android');
  if (!rows[3][1]) console.log('    npx cap add ios && node scripts/native-setup.mjs ios');
  if (rows[3][1] && !rows[4][1]) console.log('    node scripts/native-setup.mjs ios');
  console.log('    npx cap sync && npx cap open android\n');
}

const arg = process.argv[2] ?? 'check';
if (arg === 'android') patchAndroid();
else if (arg === 'ios') patchIos();
else if (arg === 'all') {
  patchAndroid();
  patchIos();
} else check();
