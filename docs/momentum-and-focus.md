# Momentum and focus features (v0.4)

Master Plan v0.4 adds a continuation layer around the existing local-first task/session model.

## Next-task suggestion
- Appears after a task is completed when no other active task remains.
- Appears on app startup, and again when the Android app returns to the foreground, when there is no running, paused, or break task.
- Uses the project worked on most recently, then selects the highest-priority unfinished item in that project.
- "Start now" uses the saved default check-in interval and the task's stored estimate.

## Project Pulse
When a project is reopened after at least six hours away, a compact return card reconstructs the thread from the latest session, latest completion, highest-priority next item, and recent note.

## Focus view
Enabled by default and switchable in SYS > Focus. While a task is running (or on a break), normal app content is replaced by a minimal task view. "Show app" exits the focus view for the current task without disabling the setting globally.

## Distraction capture
"Capture thought" is available from the focus view and the expanded NOW bar. It saves directly to Plans while leaving the active task untouched.

## Momentum
Projects receive a subtle four-segment momentum indicator derived from meaningful recent sessions, completed tasks, and project notes. It deliberately avoids scores, points, and streak penalties.

## Dormant rescue
An active project with no meaningful movement for 14 days can be surfaced on Projects with Continue, Redefine, Pause, and Archive actions.

## Completion feedback
Task completion produces a short, subtle accomplishment signal. Projects can now be explicitly marked Finished. Finished projects retain their complete notes/history and appear in a separate Finished projects section with a persistent completion summary. Current items and gallery contents are kept read-only until the project is reopened.

## Daily progress
Projects displays today's focused time, completed steps, and number of projects advanced.
