# Master Plan — work sessions / NOW

## Core model

Checklist/task-like notes remain the underlying work items. Time tracking is separate:

- `taskSessions[]` contains finished working segments.
- `activeTask` is the single global current session/runtime record.
- only one task can be active at a time.

All task/session changes are committed to local state immediately. There is no remote write dependency in the current architecture.

## Starting work

Starting a task opens the task action sheet and allows:

- check-in interval: Off → 2 h;
- estimated time: Off → 8 h.

Starting creates/updates `activeTask`. Android notifications are reconciled from that persisted state after the local change.

## Running / paused / break

`activeTask.status` can be `running`, `paused`, or `break`.

- running time contributes to tracked work;
- pause stops tracked time and cancels/reschedules alarms as needed;
- break has its own `breakStartedAt` / `breakEndsAt` timestamps;
- resume starts a new running segment.

The persistent NOW bar stays available above bottom navigation.

## Check-ins

When enabled, `nextCheckInAt` is a real timestamp rather than a UI-only countdown. Android receives a local notification scheduled for that timestamp.

A check-in asks whether the user is still working. Continuing schedules the next check-in. Stopping/correcting work updates the local task/session state before notifications are reconciled again.

## Estimate notification

Estimated time is measured against tracked working time rather than wall-clock time. Pauses and breaks therefore do not consume the estimate. On resume, only the remaining estimate is scheduled.

## Completing work

Finishing closes the active segment, records completion/history data, and clears current native task notifications. Completion can include the Valuable rating used by reporting/history.

## History deletion

Deleting a completed item removes its completion/session records from the local database. Local deletion tombstones remain available in the schema for migration/compatibility so removed records are not accidentally reconstructed by older state shapes.

## Window safety on mobile

Task and History action sheets use the live safe vertical region between the fixed header and the highest persistent bottom UI. They remain content-sized when possible and become internally scrollable when content exceeds that region.

The safe bounds respond to VisualViewport changes, orientation, the software keyboard, and live header/NOW/navigation geometry. A minimum 8 px visible gap is preserved around persistent modules.
