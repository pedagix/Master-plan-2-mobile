# Phone-only GitHub setup

This project is prepared so the Android APK is built by GitHub, not by your phone.

## One-time repository setup

Upload the **contents of this project folder** to the root of your GitHub repository. Make sure the hidden `.github` folder is included; it contains the automatic APK builder.

The repository must contain at least:

- `.github/workflows/build-android-apk.yml`
- `package.json`
- `capacitor.config.js`
- `scripts/configure-android.mjs`
- `native-assets/android/masterplan-dev.keystore`
- `native-assets/android/res/raw/master_plan_alert.wav`
- `src/...`

Commit the files to the `main` branch.

## Each time Master Plan changes

After the updated source reaches `main`, GitHub builds the test APK automatically.

On Android:

**GitHub repository → Releases → newest “Master Plan test #…” → MasterPlan-test.apk → Download → Install/Update**

You do not have to run npm commands.

## Build status

If a build fails, open:

**Repository → Actions → Build Master Plan APK → newest run**

The failed step will be marked red. Share a screenshot or the error text with ChatGPT and the project can be corrected from that information.

## Local data

The fixed development signature allows Android to install newer test builds over the existing Master Plan app. Do not uninstall Master Plan just to update it unless troubleshooting requires it, because uninstalling an Android app can remove its app-local data.

Keep Master Plan's own export/backup options available during development as an extra safeguard.
