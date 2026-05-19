# Terminology and Schema Map (Aha / Hmm / Ta-da)

## Purpose
This document audits the current terminology and storage schema without changing runtime behavior. It is intended to prevent confusion during future refactors.

## Workflow vocabulary (current product direction)
- **Aha** = quick idea/note capture in canonical root `notes[]`.
- **Hmm** = system bucket / pseudo-project destination (`destination: "hmm"`), **not** a normal persisted project card.
- **Ta-da** = project dashboard and project task-oriented view.

## High-risk naming collision (must keep in mind)
There are **two different "notes" concepts** currently:
1. Canonical root app-state `notes[]` = Aha notes (and note-like items migrated from legacy structures), now protected by id-based safe merge during cloud hydration and reload. 
2. Firestore collection `users/{uid}/notes/*` = **captures documents** (legacy naming at collection-path level).

The code already maps Firestore `notes` docs into local `captures` in memory, but the path name remains `notes` for compatibility.

## Storage surfaces at a glance
- **LocalStorage canonical key**: `master_plan_v1` (stores one JSON object containing arrays/objects below).
- **LocalStorage legacy keys** still recognized/cleaned: `master_plan_notes_v1`, `master_plan_raw_notes_v1`, `master_plan_captures_v1`, `master_plan_inbox_v1`, etc.
- **Firestore root doc**: `users/{uid}` stores canonical root fields (including `notes`, `tasks`, `checklists`, `questions`, `completedTasks`, `aiInstructions`, `meta.destructiveResetAt`, etc.).
- **Firestore collections**: `users/{uid}/projects`, `users/{uid}/notes` (captures), `users/{uid}/suggestions`, `users/{uid}/galleryImages`.

## Term-by-term audit

| Current term | Where in code | LocalStorage presence | Firestore presence | Aha/Hmm/Ta-da active? | Legacy AI-era? | Recommended future name | Rename now? |
|---|---|---|---|---|---|---|---|
| `notes` | Canonical data model, note pages/components, migration and sorting logic | In `master_plan_v1` root object | Root user payload field `notes` on `users/{uid}` | **Yes (core Aha/Hmm)** | Partly (also receives migrated legacy content) | `ahaNotes` | **Wait** (cross-cutting + migration needed) |
| `captures` | Raw notes/processor/review flows and normalization | In `master_plan_v1` root object | Persisted in collection path `users/{uid}/notes/*` | **Yes** (capture intake + processor) | Yes (naming from older workflows) | `captureDocs` (or `legacyCaptureDocs` for cloud-path references) | **Wait** (path + compatibility constraints) |
| `rawNotes` | Legacy field list and legacy local keys | Legacy keys only (cleaned) | Legacy import/migration compatibility only | Partly (UI still says Raw Notes in places, data model uses captures) | **Yes** | `captures` / `captureQueue` wording | Documentation-safe now; runtime rename later |
| `projects` | Canonical project model and Ta-da/Project pages | In `master_plan_v1` | `users/{uid}/projects/*` | **Yes (Ta-da core)** | No | keep `projects` | Safe to keep |
| `tasks` | Canonical root array + migration logic | In `master_plan_v1` | Root user payload field `tasks` | Partial (legacy + derived outputs) | Mostly yes | `projectTasks` (if retained) | Wait |
| `completedTasks` | Canonical root array + counters | In `master_plan_v1` | Root user payload field `completedTasks` | Partial | Mixed | `doneTasks` / `completedProjectTasks` | Wait |
| `checklists` | Canonical root array + prompt-action output | In `master_plan_v1` | Root user payload field `checklists` | Partial | Mostly yes | `actionChecklists` | Wait |
| `suggestions` | Notes processor + inbox-decision state machine | In `master_plan_v1` | `users/{uid}/suggestions/*` | Partial-active (legacy queue behavior still active) | **Yes (AI-era heavy)** | `proposals` or `legacyProposals` | Wait |
| `questions` | Canonical root array + processor/review references | In `master_plan_v1` | Root user payload field `questions` | Partial | Mostly yes | `followUpQuestions` | Wait |
| `inbox` / `inboxStatus` / `inboxActionLog` | Suggestion state fields and logs | Stored in canonical state/logs and legacy-key cleanup | Root payload includes `inboxActionLog`; suggestion docs include `inboxStatus` | Partial | **Yes** | `proposalQueue` / `decisionStatus` / `proposalActionLog` | Wait |
| `promptActions` | Settings + aiInstructions normalization | In `settings.promptProfiles[].promptActions` and `aiInstructions.promptActions` | Root user payload fields under settings/aiInstructions | Partial (settings still functional) | **Yes (AI control plane)** | `analysisActions` | Wait |
| `aiInstructions` | Default model data + persistence and settings mirroring | In `master_plan_v1` | Root payload field `aiInstructions` | Partial/legacy | **Yes** | `assistantConfig` / `analysisConfig` | Wait |
| `galleryImages` | Firebase load/save of project gallery docs | In-memory via projects[].gallery (not separate root array locally) | `users/{uid}/galleryImages/*` | Yes (project media) | No | keep `galleryImages` | Keep |
| `destructiveResetAt` | Reset markers and merge cutoff logic | `meta.destructiveResetAt` in canonical local object | `users/{uid}.meta.destructiveResetAt` | Yes (safety-critical) | No | keep name (explicit) | Keep |

## Other app-state arrays/objects worth tracking
- `badIdeaLog`, `inboxActionLog`, `questionFeedbackLog` (legacy decision-learning traces).
- `settings.notesProcessorHiddenActionIds` (UI visibility prefs for processor actions).
- Legacy compatibility field lists include: `inboxNotes`, `analysisResults`, `importedJsonGroups`, `inboxGroups`, etc.; these are migration/cleanup concerns rather than first-class current workflow entities.

## Recommended future naming plan (documentation-only for now)
1. **Canonical note rename target**: `notes[]` ➜ `ahaNotes[]`.
2. **Cloud collection disambiguation**: keep Firestore path `users/{uid}/notes` unchanged for now, but refer to it in code/docs as **captureDocs** or **legacyCaptureDocs**.
3. **Hmm semantics**: keep as explicit system destination/bucket, not user-created normal project.
4. **Ta-da semantics**: document as the project dashboard surface (projects + project tasks + important notes).
5. **AI-era structures**: mark each as active-vs-legacy (especially `suggestions`, `inbox*`, `promptActions`, `aiInstructions`, legacy key families).

## Rename safety guidance
- **Do now (safe)**: documentation clarifications, comments, glossary labels, and explicit “legacy” tags.
- **Do later (migration phase)**: runtime variable renames, payload field renames, and any Firestore path changes.
- **Must not change casually**: `users/{uid}/notes` path and reset-marker semantics, because they are coupled to current sync/reset logic.
