# Master Plan — Data storage and backup

## Source of truth

Master Plan is local-first. The live database is stored on the Android device/browser in `localStorage` under `master_plan_v1` and is normalized through `migrateData(...)` whenever it is loaded or saved.

There is no account, server database, or automatic cloud merge in the current architecture. A network connection is not required for normal task/project/note use or for already-scheduled Android notifications.

Recent recovery snapshots are kept separately under `master_plan_rollbacks_v1`. These snapshots are intended for safe restore/import operations and are not a substitute for an external backup.

## Current schema

The canonical state is schema version 10. Important root fields include:

- `projects[]`
- `notes[]`
- `completedTasks[]`
- `taskSessions[]`
- `activeTask`
- `taskTracking`
- `settings`
- legacy-compatible arrays such as `captures`, `suggestions`, `tasks`, `checklists`, and `questions`

Project gallery images are stored inside project state, so they are included in a full Master Plan backup.

## Google Drive backup

The primary external backup flow is deliberately manual and user-controlled.

On Android, Master Plan uses the system document-tree picker through the native `MasterPlanBackup` Capacitor plugin. The user chooses Google Drive and selects or creates a folder such as `Master Plan Backups`. Master Plan retains Android's persisted read/write permission for that chosen folder.

After the one-time connection, **Back up now** creates a full `.mpbackup` file in the selected Drive folder. A successful backup is created before rotation occurs. Master Plan then keeps the three newest matching `MasterPlan-*.mpbackup` files and attempts to delete older copies. If the cloud provider refuses an old-file deletion, the new backup is retained and rotation can be retried later.

Master Plan does not silently upload live edits. Google Drive contains recovery copies only; the on-device state remains authoritative.

## Weekly reminder

Backup reminders are enabled by default. The reminder clock is based on the most recent successful complete backup. If no backup has been made yet, it starts from the local reminder anchor created by schema migration/default setup.

A successful Google Drive backup or a successful portable backup export resets the weekly reminder clock. The reminder uses the same Android local-notification infrastructure as task reminders and does not require a Master Plan server.

The Android reminder exposes **Back up** and **Remind tomorrow** actions. If Drive is already connected, **Back up** attempts the full backup immediately and then opens Settings for status/confirmation; otherwise it opens Settings so the folder can be connected. **Remind tomorrow** records a one-day snooze and reschedules the reminder without changing the last-successful-backup timestamp.

## Portable backup

The secondary backup option is **Export backup file**. It creates the same complete `.mpbackup` package but opens Android's normal save dialog so the user decides what to do with it.

Master Plan does not expose separate Dropbox, OneDrive, email, or other provider buttons. The operating system handles the destination chosen by the user.

In the browser build, portable export falls back to a normal file download.

## Backup package

New backups use names such as:

`MasterPlan-2026-08-15-101530-123.mpbackup`

The package contains:

- backup format/version;
- Master Plan app/schema version;
- creation timestamp;
- basic record counts;
- complete migrated app state;
- SHA-256 integrity metadata when Web Crypto is available.

`parseAndValidateBackup(...)` checks the format and integrity before returning state for restore. Earlier full JSON exports remain restore-compatible.

## Restore safety

Restore never directly merges an external file into the live state.

1. Read the selected Drive/file backup.
2. Parse and validate it.
3. Show the user its date and basic record counts.
4. Ask for explicit confirmation.
5. Save the current app state as a local recovery snapshot.
6. Migrate and replace the live state.

This means a bad, wrong, or unwanted restore does not silently destroy the immediately previous state. After a backup restore, Settings also exposes **Undo last restore** while that safety snapshot remains available.

## Delete/reset behavior

Deleting/resetting Master Plan data only affects the local app state unless the user separately deletes external backup files. Existing Google Drive or portable backup files are not removed by an app reset.

Uninstalling the Android app can remove its local state and the remembered folder permission. Files already stored in Google Drive remain outside the app and can be selected again after reinstalling.
