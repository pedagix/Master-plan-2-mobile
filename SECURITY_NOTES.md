# Security Notes

Master Plan currently has no server-side user account or cloud database. The live database is local to the app/device.

## Backup security model

- Google Drive backups are written only after the user explicitly selects a folder through Android's system document picker.
- Master Plan retains only the Android URI permission granted to that selected folder; it does not store Google account credentials or OAuth tokens.
- The app does not contain a private Google Drive API key, service-account credential, or remote database credential.
- Portable backup export is also user initiated and uses the system save picker.
- Backup files contain the user's full Master Plan state, potentially including project notes and gallery images. Treat `.mpbackup` files as private personal data.
- Restore validates the backup first and creates a local recovery snapshot before replacing current data.

## Development APK signing

`native-assets/android/masterplan-dev.keystore` exists only so successive GitHub-built test APKs can update the same development installation. It is intentionally not a production secret and must never be reused for the public Play Store identity.

A production release must use a separate protected signing setup (for example Play App Signing / protected GitHub secrets).
