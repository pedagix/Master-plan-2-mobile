import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const androidRoot = path.join(root, 'android');

function fail(message) {
  console.error(`[Master Plan Android] ${message}`);
  process.exit(1);
}

if (!fs.existsSync(androidRoot)) {
  fail('Android project not found. The cloud workflow should run `npx cap add android` before this script.');
}

function replaceOnce(source, pattern, replacement, description) {
  if (!pattern.test(source)) fail(`Could not patch ${description}. Capacitor's Android template may have changed.`);
  return source.replace(pattern, replacement);
}

// 1) Native notification sound.
const sourceSound = path.join(root, 'native-assets', 'android', 'res', 'raw', 'master_plan_alert.wav');
const rawDir = path.join(androidRoot, 'app', 'src', 'main', 'res', 'raw');
if (!fs.existsSync(sourceSound)) fail('Missing native notification sound.');
fs.mkdirSync(rawDir, { recursive: true });
fs.copyFileSync(sourceSound, path.join(rawDir, 'master_plan_alert.wav'));

// 2) Exact-alarm permission.
const manifestPath = path.join(androidRoot, 'app', 'src', 'main', 'AndroidManifest.xml');
let manifest = fs.readFileSync(manifestPath, 'utf8');
const permission = '<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />';
if (!manifest.includes('android.permission.SCHEDULE_EXACT_ALARM')) {
  manifest = replaceOnce(
    manifest,
    /<manifest([^>]*)>/,
    `<manifest$1>\n    ${permission}`,
    'AndroidManifest exact-alarm permission',
  );
  fs.writeFileSync(manifestPath, manifest);
}

// 3) Stable development signing key.
// This deliberately lives in the repository so every GitHub test build has the
// same signature and can update the previously installed test APK without
// uninstalling it. NEVER use this development key for a Play Store release.
const keystorePath = path.join(root, 'native-assets', 'android', 'masterplan-dev.keystore');
if (!fs.existsSync(keystorePath)) fail('Missing Master Plan development signing key.');

const appGradlePath = path.join(androidRoot, 'app', 'build.gradle');
let gradle = fs.readFileSync(appGradlePath, 'utf8');

const runNumberRaw = process.env.GITHUB_RUN_NUMBER || process.env.MASTERPLAN_VERSION_CODE || '1';
const parsedRun = Number.parseInt(runNumberRaw, 10);
const versionCode = Number.isFinite(parsedRun) && parsedRun > 0 ? parsedRun : 1;
const versionName = `0.2.${versionCode}`;

gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${versionCode}`);
gradle = gradle.replace(/versionName\s+"[^"]+"/, `versionName "${versionName}"`);

if (!gradle.includes('signingConfigs {\n        masterplanDev')) {
  const signingBlock = `signingConfigs {
        masterplanDev {
            storeFile file('../../native-assets/android/masterplan-dev.keystore')
            storePassword 'masterplan-dev'
            keyAlias 'masterplan-dev'
            keyPassword 'masterplan-dev'
        }
    }

    `;
  gradle = replaceOnce(
    gradle,
    /(\s+)buildTypes\s*\{/,
    `$1${signingBlock}buildTypes {`,
    'development signing configuration',
  );
}

if (!/debug\s*\{\s*signingConfig signingConfigs\.masterplanDev/s.test(gradle)) {
  gradle = replaceOnce(
    gradle,
    /buildTypes\s*\{/,
    `buildTypes {
        debug {
            signingConfig signingConfigs.masterplanDev
        }`,
    'debug signing configuration',
  );
}

fs.writeFileSync(appGradlePath, gradle);

console.log(`Configured Android test build ${versionName} (${versionCode}).`);
console.log('Configured exact alarms, Master Plan alert sound, and stable development signing.');
