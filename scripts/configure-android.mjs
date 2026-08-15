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

const capacitorConfigPath = path.join(root, 'capacitor.config.json');
if (!fs.existsSync(capacitorConfigPath)) fail('Missing capacitor.config.json.');
const capacitorConfig = JSON.parse(fs.readFileSync(capacitorConfigPath, 'utf8'));
const appId = capacitorConfig.appId;
if (!appId) fail('Missing appId in capacitor.config.json.');
const packageDir = path.join(androidRoot, 'app', 'src', 'main', 'java', ...appId.split('.'));

// 1) Native notification sound.
const sourceSound = path.join(root, 'native-assets', 'android', 'res', 'raw', 'master_plan_alert.wav');
const rawDir = path.join(androidRoot, 'app', 'src', 'main', 'res', 'raw');
if (!fs.existsSync(sourceSound)) fail('Missing native notification sound.');
fs.mkdirSync(rawDir, { recursive: true });
fs.copyFileSync(sourceSound, path.join(rawDir, 'master_plan_alert.wav'));

// 2) Exact-alarm permission for task timers/check-ins.
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

// 3) App-local native backup plugin. Android's Storage Access Framework gives
// the user persistent access to one chosen folder (normally Google Drive) and
// lets Master Plan rotate the three newest .mpbackup files without a server.
const backupPluginTemplatePath = path.join(root, 'native-assets', 'android', 'MasterPlanBackupPlugin.java');
if (!fs.existsSync(backupPluginTemplatePath)) fail('Missing MasterPlanBackupPlugin.java template.');
fs.mkdirSync(packageDir, { recursive: true });
const backupPluginSource = fs.readFileSync(backupPluginTemplatePath, 'utf8').replace('__PACKAGE__', appId);
fs.writeFileSync(path.join(packageDir, 'MasterPlanBackupPlugin.java'), backupPluginSource);

const mainActivityPath = path.join(packageDir, 'MainActivity.java');
if (!fs.existsSync(mainActivityPath)) fail(`MainActivity.java not found for ${appId}.`);
let mainActivity = fs.readFileSync(mainActivityPath, 'utf8');
if (!mainActivity.includes('registerPlugin(MasterPlanBackupPlugin.class)')) {
  if (!mainActivity.includes('import android.os.Bundle;')) {
    mainActivity = mainActivity.replace(/(package\s+[^;]+;\s*)/, '$1\nimport android.os.Bundle;\n');
  }
  mainActivity = replaceOnce(
    mainActivity,
    /public class MainActivity extends BridgeActivity\s*\{\s*\}/,
    `public class MainActivity extends BridgeActivity {\n    @Override\n    public void onCreate(Bundle savedInstanceState) {\n        registerPlugin(MasterPlanBackupPlugin.class);\n        super.onCreate(savedInstanceState);\n    }\n}`,
    'MainActivity backup plugin registration',
  );
  fs.writeFileSync(mainActivityPath, mainActivity);
}

// 4) Stable development signing key.
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
const versionName = `0.3.${versionCode}`;

gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${versionCode}`);
gradle = gradle.replace(/versionName\s+"[^"]+"/, `versionName "${versionName}"`);

if (!gradle.includes('signingConfigs {\n        masterplanDev')) {
  const signingBlock = `signingConfigs {\n        masterplanDev {\n            storeFile file('../../native-assets/android/masterplan-dev.keystore')\n            storePassword 'masterplan-dev'\n            keyAlias 'masterplan-dev'\n            keyPassword 'masterplan-dev'\n        }\n    }\n\n    `;
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
    `buildTypes {\n        debug {\n            signingConfig signingConfigs.masterplanDev\n        }`,
    'debug signing configuration',
  );
}

fs.writeFileSync(appGradlePath, gradle);

console.log(`Configured Android test build ${versionName} (${versionCode}).`);
console.log('Configured exact alarms, notification sound, Drive-folder backup plugin, and stable development signing.');
