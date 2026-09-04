# Troubleshooting

## Blank page

Run the project through a local HTTP server instead of opening `index.html` directly. Then inspect the browser console for module-loading errors.

## No 3D scene

Confirm that JavaScript is enabled and the browser supports WebGL. Browser extensions that block scripts can also prevent startup.

## Low frame rate

Toggle bloom with `B`, reduce visual complexity where possible, and test with a lower device-pixel-ratio environment.

## Keyboard controls do nothing

Click the page to restore browser focus, then try the shortcut again.

## Layout problems

Resize the browser and reload. If the issue persists, test a current browser release and inspect the console for runtime errors.