# Master Plan Mobile — Data Storage, Backup, Import/Export, and Deletion Reference

## 1) Where data is stored

### Local-first storage (always active)
- The app stores primary state in browser `localStorage` under:
  - `master_plan_v1` (full app state JSON)
  - `master_plan_rollbacks_v1` (recent rollback/import snapshots)
- `localDataStore.load()` reads `master_plan_v1`, parses JSON, and always runs `migrateData(...)` so older/malformed payloads are normalized to schema v3 defaults. If parsing fails, defaults are used.  
- `localDataStore.save()` writes migrated full-state JSON back to `master_plan_v1`.

### Cloud sync (optional, only when Firebase is configured + user signed in)
- On each local state change, the app saves local first, then enqueues Firestore save in the background.
- Firestore is structured per user:
  - `users/{uid}/projects/{projectId}`
  - `users/{uid}/notes/{captureId}` (this collection stores **captures**)
  - `users/{uid}/suggestions/{suggestionId}`
  - `users/{uid}/galleryImages/{imageId}`
- On login, cloud data is loaded and migrated into current in-memory state.

## 2) Full JSON structure (schema v3)

The canonical app state object (local backup/export and in-memory model) contains:

- `meta`
  - `appName`: always `Master Plan`
  - `schemaVersion`: forced to `3`
  - `exportType`: e.g. `full-backup`
  - `exportedAt`: ISO timestamp

- `settings`
  - `activePromptProfileId`
  - `promptProfiles[]` with per-profile `promptActions`
  - `notesProcessorHiddenActionIds[]`
  - `lastDestination` (`hmm` or a valid project id)
  - `lastSelectedProjectId`
  - `hasCompletedInitialSetup`

- `aiInstructions`
  - `activePromptProfileId`
  - `mainRole`, `tone`, `goal`
  - `promptActions` (normalized action map)

- `projects[]`
  - normalized fields include: `id`, `name`, `title`, `description`, `status`, `tasksDone`, `archived`, `hidden`, `createdAt`, `updatedAt`, `lastInteractedAt`, `interactionCount`, `notes[]` (legacy-compatible), `gallery[]`

- `notes[]` (new canonical notes system)
  - typical fields: `id`, `text`, `createdAt`, `updatedAt`, `destination`, `projectId`, `priority`, `important`, `isTodo`, `pendingTodoIntent`, `deleted`, `deletedAt`, `selectedActions[]`, `sourceType`, `sourceId`, `sourceCaptureId`, `sourceSuggestionId`, `legacyShape`

- `completedTasks[]`
  - normalized fields include: `id`, `projectId`, `text`, `priority`, `completedAt`, and source linkage fields when present

- `captures[]`
  - fields include: `id`, `text`, `projectId`, `isNewIdea`, `rawState` (`unprocessed|archived`), `analysisState` (`not-analyzed|analyzed`), `processedAt`, `archivedRawAt`, `needsReanalysis`, `needsProjectAssignment`, `candidateProjectIds[]`, `processingTags[]`, timestamps

- `suggestions[]`
  - normalized fields include: `state`, `inboxStatus`, `selectedAction`, `approvedAt`, `dismissedAt`, `hiddenAt`, `hiddenUntil`, `importance`, `sourceCaptureId`, `sourceNoteId`, `sourceSuggestionId`, `needsProjectAssignment`

- Legacy-compatible arrays still kept in root schema:
  - `tasks[]`, `checklists[]`, `questions[]`

- Learning/logging arrays:
  - `badIdeaLog[]`, `inboxActionLog[]`, `questionFeedbackLog[]`

- `questionLearningSettings`
  - `enabled`, `recentQuestionLimit`, `generationMix`, `avoidRecentlyDownvoted`, `preferAnsweredAndUpvoted`

## 3) How data is read and normalized

- All major entry points call `migrateData(...)`.
- `migrateData` guarantees:
  - schema/app metadata normalization
  - project normalization and status sanitization
  - capture/suggestion/note normalization with defaults
  - automatic migration from legacy note-bearing fields into canonical `notes[]` if `notes[]` missing
  - invalid project links stripped from notes/tasks
  - settings repair (`lastSelectedProjectId`, `lastDestination`, prompt profiles)
  - AI instructions synchronized to active prompt profile

This means nearly any imported JSON shape is coerced into stable schema v3.

## 4) How data is edited by feature

- **Aha / Project detail / Hmm flows** edit canonical `notes[]` (create/update/soft-delete), update note flags (`important`, `isTodo`), and may append to `completedTasks[]`.
- **Capture/Raw Notes workflows** create and edit `captures[]`, including note-processing lifecycle fields (`rawState`, `analysisState`, `processingTags`, etc.).
- **Inbox workflows** operate on `suggestions[]`, transitioning state/action selections and may create follow-up items (e.g., questions).
- **Settings prompt/action editing** updates `settings.promptProfiles[].promptActions` and mirrors active prompt actions into `aiInstructions.promptActions`.

## 5) Backup and restore behavior

### Full export backup
- “Export full backup” writes a downloadable JSON file of full migrated state plus metadata (`exportType`, `exportedAt`, etc.).

### Rollback snapshots (local)
- Before risky operations (imports, reset-all prompt actions, etc.), app may save rollback snapshots into `master_plan_rollbacks_v1`.
- Snapshot contains:
  - `id`, `createdAt`, `reason`
  - summary `counts` (`projects`, `notes`, `captures`, `suggestions`, `questions`, `completedTasks`, `includesSettings`)
  - full `state`
- Only latest 3 snapshots are retained.
- Snapshots can be applied (restore) or deleted in Settings.

### Import behavior
- JSON import is previewed first; if applied, current state can be snapshotted before replace.
- Pasted plain text can be imported as a new Hmm note entry.

## 6) Deletion semantics

### Soft delete vs hard delete
- Canonical `notes[]` deletes are usually **soft deletes** (`deleted: true`, `deletedAt`), preserving record history in same array.
- Some destructive maintenance actions perform **hard cleanup** (array/field/document removal), described below.

### Reset app data
- “Reset app data” replaces active state with `buildResetData()` (empty projects/notes/captures/suggestions/tasks/checklists/questions/logs, default settings/AI profile), clears rollback snapshots locally, and syncs reset state to cloud if signed in.

### Global note cleanup (development tool)
- “Delete all notes” triggers both cloud and local cleanup.
- Local cleanup uses `buildGlobalNoteCleanupData(...)`, which clears note-related arrays and strips legacy note fields from projects, resets project `tasksDone`, clears rollbacks, and removes legacy `master_plan_*` localStorage note keys.
- Cloud cleanup:
  1. Deletes documents from many historical note-related collection groups.
  2. Patches top-level `users` docs to delete note-related fields.
  3. Patches `projects` docs to delete note-related fields + reset `tasksDone` and `updatedAt`.
  4. Patches `galleryImages` docs to remove note linkage fields (`noteId`, `sourceNoteId`, `sourceCaptureId`, `sourceSuggestionId`).
- Firebase Auth users are intentionally not deleted.

## 7) Categories, states, and options in stored data

### Project status categories
- `active`, `paused`, `hidden`, `archived`
- “Real” project logic excludes hidden/archived and special `hmm` pseudo-project.

### Destinations/categories for notes
- `destination` is either:
  - `hmm` (inbox/idea space), or
  - `project` (with valid `projectId`)

### Capture processing categories
- `rawState`: `unprocessed` or `archived`
- `analysisState`: `not-analyzed` or `analyzed`
- re-analysis flags and tag-based processing (`processingTags[]`)

### Suggestion/inbox categories
- `state` includes lifecycle values like pending/approved/dismissed/hidden/bad-idea/converted
- `inboxStatus` normalized to values like `pending-review`, `approved`, `dismissed`, `hidden`
- `selectedAction` captures user decision routing

### Prompt action categories (settings)
Default prompt-action IDs currently include:
- `suggestions`
- `nextSteps`
- `checklists`
- `weeklyReview`
- `projectCleanup`
- `motivation`
- `brutalFilter`
- `connections`
- `archiveDeleteRecommendations`
- `clarifyingQuestions`
- `followUpQuestions`
- `newIdeaRouting`
- `inboxDecisionWorkflow`
- `rawNotesWorkflow`

Each action has configurable: `title`, `description`, `enabled`, `prompt`.

## 8) Firestore vs local schema differences (important)

- Local canonical state keeps many arrays (`notes`, `captures`, `suggestions`, `questions`, etc.) in one JSON object.
- Current Firestore sync persists only:
  - projects
  - captures (in `users/{uid}/notes`)
  - suggestions
  - gallery images
- On cloud load, returned object contains `{ projects, captures, suggestions }` and then local `migrateData(...)` fills missing sections with defaults.
- This means some local-only sections are not yet fully represented as first-class Firestore collections in current implementation.

## 9) Legacy compatibility and migration cleanup

- Model contains explicit legacy note field lists to migrate from and to clean out during global purge.
- Local storage cleanup also removes old key patterns (e.g., old note/capture/inbox/import/export/review key names) to avoid resurrecting stale data.
- Migration enforces canonical schema version and repairs malformed/incomplete content.

## 10) Operational summary

1. App boots from local storage (`master_plan_v1`) -> migrate -> state.
2. If Firebase user available, remote load replaces local state with migrated cloud payload.
3. Any state change saves locally immediately; cloud sync runs queued best-effort.
4. Exports create full JSON backup files.
5. Risky ops can snapshot full rollback states locally.
6. Delete/reset tools clear note data locally and optionally across Firestore according to dedicated cleanup logic.
