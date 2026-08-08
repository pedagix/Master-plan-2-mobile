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
- Check-in interval presets, custom interval, and Off.
- Start / pause / resume / finish.
- Small persistent animated NOW bar above bottom navigation.
- One active task at a time; starting another pauses the running segment first.
- In-app check-in prompt.
- “Still working” continues and schedules the next check-in.
- “Got distracted” can subtract 5/10/15/30/custom minutes and pause the task.
- 5- and 10-minute break state.
- Completed tasks preserve tracked duration and session count.
- Backups/reset/migration include the new local work-session state.

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
