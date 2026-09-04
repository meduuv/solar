# Local Development

SOL is a static browser application and does not require a package manager for the current source tree.

## Start a local server

From the repository root, run:

```bash
python -m http.server 8000
```

Open `http://localhost:8000` in a modern browser.

## Making changes

- Edit source files under `js/` for application behavior.
- Edit `styles.css` for presentation.
- Keep Three.js imports compatible with the checked-in vendor module.
- Refresh the page after changes and inspect the browser console.

A local HTTP server is recommended because ES modules may not work correctly from `file://` URLs.