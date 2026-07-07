# PawPilot Design Notes

## Modal And Scroll Containers

- Modal shells own the visual frame: background, border, shadow, radius, and clipping.
- Scroll must live in an inner child, not on the rounded shell itself.
- Use this structure for tall dialogs:
  - outer shell: `rounded-* overflow-hidden flex flex-col max-height padding`
  - inner body: `overflow-y-auto min-h-0 padding`
- Leave an 8px visual inset between the rounded shell and the scroll container. The scrollbar should start and end inside this inset, not touch the modal's curved top or bottom edge.
- Give the scroll body at least 16px of top and bottom padding, plus `scroll-padding-block`, so content feels like it stops before the frame instead of crashing into it.
- This is not only a clipping fix. The safe inset makes tall dialogs feel calmer and prevents both content and overlay scrollbars from visually fighting the rounded corners.

## Async Actions

- Any button that enters a loading state must always leave it through `finally`.
- IPC or shell-backed actions need an explicit timeout with a user-readable error.
- Never leave a primary action in an indefinite loading state. If the underlying process may continue in the background, the UI still needs to recover and explain what happened.
