# Master Plan visual system

Master Plan uses one canonical interface. Theme palettes, style personalities, and prompt/action settings were removed in schema v7.

## Principles

- Dark, minimal, futuristic, and calm.
- Information is the visual design; avoid decorative dashboards and fake telemetry.
- Thin borders, restrained surfaces, compact technical labels, and generous spacing.
- The interface stays quiet unless something needs attention.
- Motion must communicate state: active work, save confirmation, opening/closing, selection, or completion.
- The NOW bar is the reference component for the whole system.
- Saving a note must be unmistakable without interrupting note capture: a short `NOTE SAVED` signal and header scan confirm the action.
- Active work uses a slow pulse/trace. Paused work becomes static. Break state uses a separate restrained signal.
- Notes, tasks, and projects should remain easy to create while a task is running.
- Prefer tapping the content itself over duplicate edit/cog buttons.
- Respect `prefers-reduced-motion`.

## Canonical palette

The application owns a single palette through CSS variables in `src/styles.css`. There is no user-facing theme selector.

## Persistence

Visual changes never change the local-first rule. User actions are committed to local storage first; Firebase synchronization follows asynchronously.
