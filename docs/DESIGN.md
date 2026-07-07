# PawPilot Design Notes

## Modal And Scroll Containers

- Modal shells own the visual frame: background, border, shadow, radius, and clipping.
- Scroll must live in an inner child, not on the rounded shell itself.
- Use this structure for tall dialogs:
  - outer shell: `rounded-* overflow-hidden flex flex-col max-height`
  - inner body: `overflow-y-auto min-h-0 padding`
- This prevents scrolling content and overlay scrollbars from visually breaking through the top or bottom rounded corners.

## Async Actions

- Any button that enters a loading state must always leave it through `finally`.
- IPC or shell-backed actions need an explicit timeout with a user-readable error.
- Never leave a primary action in an indefinite loading state. If the underlying process may continue in the background, the UI still needs to recover and explain what happened.
