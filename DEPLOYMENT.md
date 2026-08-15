# Deployment

## Phone-first Android development

The primary test workflow is GitHub Actions cloud building. `.github/workflows/build-android-apk.yml` runs on pushes to `main` and can also be started manually.

A successful main-branch build produces:

- an Actions artifact retained for 30 days; and
- a GitHub prerelease containing `MasterPlan-test.apk` for direct phone installation.

The workflow installs Node 22, builds Vite, generates a clean Capacitor Android project, applies `scripts/configure-android.mjs`, runs Capacitor sync, builds with Gradle, and publishes the APK.

## Native Android patches

`scripts/configure-android.mjs` applies the native pieces that are not part of the React bundle:

- Master Plan notification sound;
- exact-alarm permission for task/check-in timing;
- the `MasterPlanBackupPlugin` Android Storage Access Framework bridge;
- fixed development signing;
- monotonically increasing test version code/name.

The custom backup plugin is copied from `native-assets/android/MasterPlanBackupPlugin.java` into the generated app package and registered in `MainActivity` on each cloud build.

## Local-first persistence and backup

The live Master Plan database is local-only. There is no remote database dependency in the current build.

Google Drive is used as a manual recovery destination through a user-selected Android document-tree folder. Master Plan can write/read that folder after the user grants persistent access, rotate the three newest backups, and restore a selected backup. A second portable-export path uses Android's normal save picker.

Weekly backup reminders use local Android notifications and are reset after a successful full backup.

## Native task notifications

Android local notifications cover task check-ins, break completion, and estimate completion. Schedules are derived from local task timestamps, so an internet connection is not required after they are scheduled.

Android notification permission and precise-alarm access must be granted when required by the OS.

## Browser/PWA build

The browser target remains available:

- framework: Vite
- build: `npm run build`
- output: `dist`
- Node: 22+

Native Drive-folder backup is Android-only. Portable backup export/restore remains available in the browser using normal file download/upload behavior.

## Stable test signing

`native-assets/android/masterplan-dev.keystore` is deliberately included for development APK continuity under package id `app.masterplan.mobile.dev`.

Do not use that identity/key for production.

## Public Android release later

For public distribution:

1. create a separate production application identity as appropriate;
2. use a private production signing key / Play App Signing;
3. create a signed release AAB;
4. publish through Google Play.
