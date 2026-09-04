# Contributing

## Workflow

1. Fork or branch the repository.
2. Make one focused change at a time.
3. Test the experience in a local HTTP server.
4. Check the browser console for errors.
5. Open a pull request with a concise description.

## Code Guidelines

- Keep rendering, data, UI, and post-processing responsibilities separated.
- Prefer small, readable JavaScript functions.
- Preserve keyboard controls and reduced-motion behavior.
- Avoid adding a framework or build step without a clear reason.

## Visual Changes

Test desktop and narrow-screen layouts. Check that controls remain usable and that performance remains acceptable with bloom enabled and disabled.