# Master Plan — phone-first development

Master Plan is a mobile-first React/Vite app wrapped with Capacitor for Android.

## The important part

**You do not need Node.js, Android Studio, PowerShell, Termux, or a computer to test normal Master Plan builds.**

The repository contains a GitHub Actions workflow that builds the Android APK in GitHub's cloud.

### Your normal phone-only loop

1. Put the updated Master Plan source in the GitHub repository.
2. GitHub automatically runs **Build Master Plan APK** when `main` changes.
3. On your phone, open the repository → **Releases**.
4. Open the newest **Master Plan test #...** prerelease.
5. Download **MasterPlan-test.apk**.
6. Tap the APK and choose **Update**.
7. Open Master Plan and test the changes.

The test APK uses the dedicated package id `app.masterplan.mobile.dev` and the same development signing key on every cloud build, so Android can update the existing test installation instead of requiring an uninstall.

## First APK installation

Android may ask you to allow your browser/GitHub app to **Install unknown apps**. Allow it for the app you use to download the APK, then install Master Plan.

Inside Master Plan, open **SYS → Notifications**:
- allow notifications;
- allow precise alarms / **Alarms & reminders** when Android offers the option;
- run **Test notification**;
- lock the screen and confirm the notification makes a sound.

Then open **SYS → Backup**:
- tap **Connect Google Drive**;
- in Android's folder picker choose Google Drive and select/create a **Master Plan Backups** folder;
- tap **Back up now** once to verify the connection.

Master Plan keeps the live database on the device. Drive stores manual recovery copies only, with the three newest Master Plan backups retained when the provider allows old-file deletion. A separate **Export backup file** option creates the same complete backup and lets the user choose the destination.


## Momentum and focus layer (v0.4)

The current build adds continuation-focused features without changing the local-first/Drive backup architecture:
- highest-priority next-task suggestions after completion, app startup, and foreground return when NOW is empty;
- Project Pulse when returning after time away;
- optional automatic Focus view (SYS → Focus);
- distraction capture without leaving NOW;
- subtle project momentum indicators and dormant-project rescue;
- quiet task-completion feedback and a daily progress strip;
- explicit Finished project state with persistent completion summaries.

See `docs/momentum-and-focus.md` for the behavioral rules.

## If the automatic build does not start

On GitHub:
1. Open the repository.
2. Open **Actions**.
3. Select **Build Master Plan APK**.
4. Tap **Run workflow**.
5. Leave the branch as `main`.
6. Tap **Run workflow**.

When the build is green, use the newest item under **Releases** to download the APK directly.

## What the cloud build does for you

GitHub automatically:
- installs Node.js 22;
- installs the project packages;
- builds the React/Vite app;
- generates the Capacitor Android project;
- copies the native Master Plan notification sound;
- adds exact-alarm support;
- adds the native Google Drive-folder backup bridge;
- signs the APK with the fixed **development-only** key;
- increases the Android version code for each workflow run;
- builds `MasterPlan-test.apk`;
- publishes it as a GitHub prerelease.

## Development signing key

`native-assets/android/masterplan-dev.keystore` is intentionally a **development-only** key.

It is included so every cloud-built test APK has the same Android signature. This is what lets a new APK update the previous test APK while preserving app-local data.

**Do not use this key or the `.dev` package identity for the finished Play Store build.** Before public release, create a separate private production signing key and store it in protected GitHub secrets / Play App Signing.

## Finished product

For development:
- output: `MasterPlan-test.apk`
- direct install/update on Android.

For a public release:
- create a signed release Android App Bundle (`.aab`);
- use a private production signing key;
- publish through Google Play.

The production signing setup is intentionally kept separate from this easy test workflow.
