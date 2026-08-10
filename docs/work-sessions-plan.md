# Master Plan Work Sessions

## Locked product direction

Master Plan remains a notes / plans / projects app. Time tracking is an added work-session layer, not a separate command-center product.

Core rule: time tracking must never make it harder to capture notes and ideas or create tasks and projects while a task is running.

## V1 objectives

- Existing checklist items remain the tasks.
- Only one task can be current at a time.
- Starting a task asks for a Check-in interval; check-ins can also be disabled.
- Elapsed time is calculated from timestamps. The app never persists one timer tick per second.
- Pausing/resuming creates accurate work-session history.
- The persistent NOW bar stays small, visibly active, and leaves the rest of Master Plan usable.
- Check-ins ask whether the user is still on task and can offer a short break.
- If the user got distracted, they can estimate how many minutes ago work stopped so the active segment can be corrected.
- Finishing a task ends the current work segment and completes the existing checklist item.
- Later V1 batches add manual session editing, 0–5 value ratings, estimates, project progression timelines, and global/project time reports.

## Batch 1 implemented

- Schema v4 foundation with `taskSessions` and `activeTask`.
- Separate Firestore `taskSessions` collection and `runtime/activeTask` document.
- Project checklist and Plans checklist task-action sheet.
- Check-in interval slider from Off to 2 hours.
- Start / pause / resume / finish.
- Small persistent animated NOW bar above bottom navigation.
- One active task at a time; starting another pauses the running segment first.
- In-app check-in prompt.
- “Still working” continues and schedules the next check-in.
- “Got distracted” can subtract 5/10/15/30/custom minutes and pause the task.
- 5- and 10-minute break state.
- Completed tasks preserve tracked duration and session count.
- Backups/reset/migration include the new local work-session state.

### Batch 1.1 persistence fix

- Task actions are written to local storage immediately, before cloud sync finishes.
- Active-task state carries an update revision so refresh hydration can keep the newest local/cloud state instead of blindly accepting a stale cloud null.
- Active-task state is also saved on the canonical user document as a fallback, while the runtime document remains available for later realtime sync.
- Completed-task history is merged instead of replaced during hydration, preventing just-finished progression from disappearing after refresh.
- Task-session/runtime Firestore writes are isolated from the core save so a rules/deployment problem on the new tracking collections cannot block normal Master Plan data from saving.

## Next batch

- Manual session history and correction UI.
- Task completion value rating 0–5.
- Optional time estimate and estimate-vs-actual display.
- Project progression timeline: task, completion date, time, value rating.
- Basic weekly/monthly reports and project drilldown.
- Improve break-complete prompting/sound behavior.
- Realtime cross-device listener for only the active-task runtime document.

## Later / explicitly not required now

- Service-worker / background notification improvements.
- Capacitor / native Android wrapper if PWA behavior proves insufficient.
- AI analysis, XP, achievements, fake productivity scores, automatic app/screen monitoring, or giant analytics dashboards.

## Batch 2 implemented — Completion & History

- Schema v5 adds completion `valueRating`, per-completion `sessionIds`, and restore metadata.
- Completing any task now opens a shared completion sheet instead of a browser confirm.
- Completion sheet shows tracked time/session count and asks for **Valuable** rating 0–5; rating can be skipped.
- 0 is preserved as a real rating and displayed as 0/5; 5 means completely worth doing.
- Projects now have **Current / History** views.
- Plans now have **Current / History** views.
- History is a newest-first progression timeline showing completion date group, task name, tracked time, and Valuable rating.
- Tapping a history item opens detailed completion history with exact completion time, sessions, total tracked time, and editable Valuable rating.
- Historical work sessions can be corrected by editing their duration or deleted if they were recorded by mistake.
- Completed tasks can be restored to the checklist without deleting or rewriting their previous history/rating.
- Re-completing a restored task creates a new completion event using only the work sessions from the restored work cycle, so earlier timeline totals stay accurate.

## Next recommended batch

- Optional task time estimate and estimate-vs-actual display.
- Global Reports view plus project report drilldowns (today/week/month).
- Aggregate time by project/task and Valuable rating.
- Break totals and average session length.
- Realtime cross-device listener for the active-task runtime document.
- PWA/service-worker notification work after the core report workflow has been tested in daily use.

## Batch 3 implemented — Reports & Time Analysis

- Schema v6 added optional `estimateMinutes` to tasks, active work, and completion history.
- Starting a task can optionally capture an estimate with a slider from Off to 8 hours; Off remains the default when a task has no saved estimate.
- Completion/history details show the estimate when one exists.
- Added a global **Reports** view with Today / Week / Month periods.
- Reports are calculated entirely from the current local Master Plan data; no server query is required to render them.
- Global report summary shows tracked time, tasks completed, average Valuable rating, and average work-session length.
- Global report groups tracked time by project plus Plans and supports one-tap project/Plans drilldown.
- Project/Plans report shows completed task rows with time and Valuable rating and opens the existing task-history detail/edit sheet.
- Added estimate-vs-actual totals for tasks that have both an estimate and tracked time.
- Added time distribution by Valuable rating.
- Added **High time / low value** review list for tasks rated 0–2 with the most tracked time.
- Added **Most time** list for the longest completed tasks in a period.
- Reports are linked from Projects, Plans History, and each Project History without adding another bottom-navigation tab.
- Full-backup schema metadata is now kept in sync at v7.

## Next recommended batch

- Record completed break sessions so break totals can be reported accurately.
- Improve break-complete sound/prompt behavior.
- Realtime cross-device listener for only the active-task runtime document.
- PWA/service-worker notifications after the current timer/report workflow has been exercised in daily use.
- Consider a lightweight review/reflection field for high-time/low-value tasks only if the reports prove useful.


## Current-item simplification
- The separate checklist creation UI has been retired.
- Any current note/item can be started or completed through the same action sheet.
- Completed History entries can be permanently removed from visible/history data; associated timing sessions are deleted too.
- Deletion is local-first. Tiny deletion tombstones prevent stale cloud/device data from resurrecting deliberately removed History/session records while Firestore sync catches up.

## Mobile task action module layout note
The task action module must use the full safe vertical region between the fixed header and the NOW/bottom-navigation area on mobile. The module itself is the scroll container; do not vertically center an auto-height sheet inside that safe region, because that can collapse the usable scroll viewport on Android.


## Task action window sizing

The task start/action window is content-sized with a hard maximum of 70% of the currently usable app area. It must never be forced to 70% when its content needs less room. If the content exceeds the 70% ceiling, the window remains capped and its own contents become vertically scrollable.

The usable app area is measured dynamically from the visible viewport between the fixed header and the highest persistent bottom UI. When a NOW/current-task bar exists, its actual rendered top edge is the lower boundary, so even an expanded NOW bar remains visible and usable while the task window is open. The bottom navigation is treated the same way when NOW is absent. The calculation responds to viewport changes, orientation changes, the mobile visual viewport/keyboard, and NOW bar resizing.
