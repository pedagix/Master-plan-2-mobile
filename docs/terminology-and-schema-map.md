# Terminology and schema map

## Current user-facing vocabulary

- **Notes** — fast capture and note/task entry.
- **Plans** — the current checklist/plan surface.
- **Projects** — longer-running project spaces.
- **NOW** — the single active task/work-session control.
- **History** — completed task/session timeline.

Older Aha / Hmm / Ta-da names can still appear in internal filenames/routes for compatibility, but they are not the current product vocabulary.

## Canonical local storage

- Main state key: `master_plan_v1`
- Recovery snapshots: `master_plan_rollbacks_v1`
- Current schema: v11

The complete canonical state is one local object normalized by `migrateData(...)`.

## Important fields

| Field | Current role | Notes |
|---|---|---|
| `projects[]` | Project records | Includes project gallery data. |
| `notes[]` | Canonical note/task-like items | Project assignment and priority live here. |
| `completedTasks[]` | Completion history | Used together with session history. |
| `taskSessions[]` | Timed work segments | Separate from underlying notes/tasks. |
| `activeTask` | Single current NOW session | `running`, `paused`, or `break`. |
| `taskTracking` | Runtime/deletion metadata | Includes timestamps/tombstones for compatibility. |
| `settings` | App preferences | Notifications plus backup reminder timestamps. |
| `captures[]`, `suggestions[]`, `tasks[]`, `checklists[]`, `questions[]` | Legacy-compatible structures | Preserved/migrated so older backups can still load. |

## Backup-related settings (introduced in schema v10)

- `backupReminderEnabled`
- `backupReminderAnchorAt`
- `lastSuccessfulBackupAt`
- `backupReminderSnoozeUntil`

The selected Google Drive folder is not stored in the JavaScript app database. Android keeps the folder URI/permission in native SharedPreferences and the system's persisted URI permission list.

## Backup format

Current external backup files use `.mpbackup` and contain the full migrated state plus format/version/integrity metadata. Legacy full JSON backups remain accepted by restore validation.

## Rename safety

Internal route/component filenames such as `AhaPage`, `HmmPage`, and `TaDaPage` are compatibility details. Renaming those is lower priority than preserving schema and upgrade compatibility. User-facing copy should consistently use Notes / Plans / Projects.


## Momentum/focus settings (schema v11)
- `focusModeEnabled`: whether running tasks automatically enter the minimal Focus view.
- Projects may use `status: "finished"` with `finishedAt` to preserve completed projects without archiving them.
