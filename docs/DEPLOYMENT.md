# Deployment

SOL can be deployed as a static site because the current project does not require a build step.

## Requirements

Serve the repository root over HTTP(S) and preserve the existing directory structure, especially `js/` and `vendor/`.

## Static hosts

Any host that serves static HTML, CSS, JavaScript modules, and local assets can be used.

## Verification

After deployment, verify that:

- `index.html` loads without console errors.
- JavaScript modules return successful HTTP responses.
- The `vendor/` module is reachable.
- Textures and other assets load without 404 responses.
- Keyboard and pointer controls work on both desktop and mobile layouts.