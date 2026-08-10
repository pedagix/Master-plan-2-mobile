# Master Plan rewrite notes — 2026-08-10

This package is the complete application source, not a patch.

## Task action window

- The task start/action window is now content-aware: it stays only as tall as its content needs.
- Its maximum height is 70% of the currently usable app area.
- If its contents need more room than the 70% ceiling, the panel stays capped and scrolls internally.
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

All other application files from the supplied source are included unchanged in this full rewrite package.

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
