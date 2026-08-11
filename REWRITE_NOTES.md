# Master Plan rewrite notes — 2026-08-11

This package is the complete application source, not a patch.

## Task action window

- The task start/action window is now content-aware: it stays only as tall as its content needs.
- It may use the full currently usable app area, with a minimum 8 px gap to the fixed header above and to NOW/bottom navigation below.
- If its contents need more room than that safe region, the panel fills the available height and scrolls internally.
- The usable area is measured from the actual visible viewport rather than assuming a fixed phone height.
- The panel reserves the real rendered space used by the header, bottom navigation, and NOW/current-task bar.
- When NOW exists, the task action backdrop ends above NOW instead of covering it. NOW therefore remains visible and usable while the task window is open.
- If NOW expands, rotates with the device, or changes size, a ResizeObserver recalculates the safe region automatically.
- Mobile visual viewport changes are also tracked so the panel can react to the software keyboard and browser viewport changes.
- Mobile helper text is retained instead of being removed merely to force the panel into a smaller fixed area.

## Files changed

- `src/components/TaskActionSheet.jsx`
- `src/styles.css`
- `docs/work-sessions-plan.md`
- `REWRITE_NOTES.md`

All other application files from the supplied source are included unchanged in this full rewrite package.

## 2026-08-11 task action window full-safe-region update
- Removed the old 70% height ceiling from the task start/action window.
- The panel can now grow to the full live region available between persistent UI modules.
- A minimum 8 px visible gap is enforced below the fixed top header and above the NOW bar when present, otherwise above the bottom navigation.
- The measured top edge of an expanded NOW bar is respected automatically, so the task window cannot cover it.
- Vertical backdrop padding was removed because the 8 px safety margins are already included in the measured insets; this prevents accidental double-spacing and exposes more usable content.
- If the panel content is still taller than the safe region, the task panel itself scrolls rather than passing underneath another module.
- VisualViewport changes, rotation, and ResizeObserver updates continue to remeasure the safe region on mobile.

## 2026-08-10 task action sheet viewport fix
- Render `TaskActionSheet` through a React portal into `document.body` so its fixed-position backdrop is never constrained by an animated/transformed page container.
- Measure the real visual viewport plus the live header, bottom navigation and NOW bar.
- Set the action panel maximum height in pixels to 70% of the actual usable region; shorter content remains content-height and taller content scrolls internally.
- Keep the NOW bar outside the overlay region so it remains visible and interactive while the task action sheet is open.

## 2026-08-10 slider controls
- Replaced all check-in preset/custom buttons with one mobile-friendly range slider.
- Check-in range is Off to 2 hours in 5-minute steps.
- Replaced all estimate preset/custom buttons with one range slider.
- Estimate range is Off to 8 hours in 15-minute steps.
- The current slider value is shown beside each section heading, with Off at the left edge and the maximum at the right edge.
- Slider movement keeps the existing local-first task-start persistence path unchanged.

## 2026-08-10 adaptive history detail window
- `TaskHistorySheet` now uses the same flexible sizing behavior as the task action window.
- History details shrink to their content height when the content fits comfortably.
- The maximum height is 70% of the currently usable app region; taller history content scrolls inside the window.
- The usable region is measured from the live visual viewport between the header and persistent controls.
- When a NOW/current-task bar exists, history details stop above it so NOW remains visible and interactive.
- The history overlay is rendered through a React portal into `document.body` so animated/transformed page containers cannot distort fixed positioning on mobile browsers.
- The sheet remeasures on visual viewport changes, orientation changes, and persistent UI resizes.

Files changed for this update:
- `src/components/TaskHistorySheet.jsx`
- `src/styles.css`
- `REWRITE_NOTES.md`

## 2026-08-11 adaptive note capture window
- The main Notes capture window now measures the live visual viewport and the actual rendered header, NOW bar, and bottom navigation.
- Its height automatically shrinks when the keyboard or another persistent app module reduces the usable area, so the capture window never extends underneath those modules.
- The textarea is the flexible region: it grows when space is available and shrinks first when space becomes tight. If the phone is unusually short, the capture window scrolls internally instead of being covered.
- The sizing is recalculated on keyboard/viewport changes, rotation, focus changes, and persistent module resizes.
- Mobile edit scrolling now also treats the NOW bar as a bottom boundary instead of only reserving the bottom navigation.
- Replaced the visible priority-scale wording “COLD / HOT” with the single label “PRIORITY”.

Files changed for this update:
- `src/pages/AhaPage.jsx`
- `src/components/NoteEditForm.jsx`
- `src/lib/mobileEditorFocus.js`
- `src/styles.css`
- `REWRITE_NOTES.md`

## 2026-08-11 — Notes/bottom-nav spacing guard
- Notes capture now reserves an 8 px safety gap (minimum requested: 5 px) above persistent bottom UI.
- The available-height calculation now uses the nearest visible persistent module instead of assuming a single fixed boundary.
- Added an Android keyboard safeguard for VisualViewport/fixed-element coordinate mismatches so the lifted bottom nav cannot cover the note capture module.
