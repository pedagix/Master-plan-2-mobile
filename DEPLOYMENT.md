# Deployment

## Phone-first Android development

The recommended Master Plan test workflow is **GitHub Actions cloud building**. No Android development tools are required on the phone.

The workflow is:

`.github/workflows/build-android-apk.yml`

It runs automatically on every push to `main` and can also be started manually from GitHub Actions.

Each successful `main` build creates:
- an Actions artifact retained for 30 days; and
- a GitHub prerelease containing **MasterPlan-test.apk** for direct phone download.

See `PHONE_ONLY_WORKFLOW.md` for the user-facing process.

## Why the Android project is generated in the cloud

The source repository keeps Capacitor configuration and native patches as the source of truth. The workflow generates a clean Android project from the pinned Capacitor 8 dependency line, applies `scripts/configure-android.mjs`, syncs the web assets/plugins, then runs Gradle.

This avoids requiring Android Studio or a checked-in generated Android project during phone-only iteration.

## Stable test signing

Cloud runners are disposable. Their ordinary debug keys would change between runs, which would prevent Android from updating an existing test installation.

For that reason, this project includes:

`native-assets/android/masterplan-dev.keystore`

It is used **only for development test APKs** under `app.masterplan.mobile.dev`. The public/Play Store release must use a separate private production key.

## Native notification behavior

The Android build supports local notifications for:
- task check-ins;
- break completion;
- estimated-time completion.

The notification schedule is derived from local `activeTask` state. It does not depend on Firebase or an internet connection after the alarm has been scheduled on the device.

Android notification permission and precise-alarm access must be granted by the user when required by their Android version.

## Cloudflare Pages / web build

The browser/PWA build is still supported.

- Framework: Vite
- Build command: `npm run build`
- Output: `dist`
- Node: 22+

## Public Android release later

When Master Plan is ready for distribution:
1. create a private production signing key;
2. move production signing material to GitHub secrets / Play App Signing;
3. build a signed release `.aab`;
4. publish the AAB to Google Play.

Do not publish the included development signing key as the production identity.
