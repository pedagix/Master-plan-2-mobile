# Phone-only GitHub workflow

Master Plan is prepared so GitHub builds the Android APK in the cloud. Normal testing does not require a computer, Android Studio, Node.js, Termux, or command-line work on the phone.

## Repository files that must be present

Keep these in the root/source repository:

- `.github/workflows/build-android-apk.yml`
- `package.json`
- `capacitor.config.json`
- `scripts/configure-android.mjs`
- `native-assets/android/masterplan-dev.keystore`
- `native-assets/android/MasterPlanBackupPlugin.java`
- `native-assets/android/res/raw/master_plan_alert.wav`
- `src/...`

The generated `android/` directory is deliberately not stored as source; GitHub creates a fresh Android project on each build and applies the native Master Plan patches automatically.

## Each time Master Plan changes

After the updated source reaches `main`, GitHub automatically starts **Build Master Plan APK**.

On Android:

**GitHub repository → Releases → newest “Master Plan test #…” → `MasterPlan-test.apk` → Download → Install/Update**

Do not uninstall the existing test app just to update it. The fixed development package/signature allows normal APK updates to retain app-local data.

## Build status

If a build fails:

**Repository → Actions → Build Master Plan APK → newest run**

Open the red failed step and use its error text/screenshot to diagnose the source.

## Back up before risky development changes

The normal update path preserves local data, but development builds can contain bugs. In Master Plan use **SYS → Backup → Back up now** to keep the three newest Drive copies, or **Export backup file** for a portable copy controlled by you.
