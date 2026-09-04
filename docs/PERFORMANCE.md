# Performance Guide

SOL uses several runtime safeguards because WebGL cost varies by device.

## First steps

- Disable bloom with `B` when the frame rate is low.
- Disable true relative scale with `R` if the scene becomes expensive.
- Use reduced-motion preferences on systems where animation should be minimized.
- Test with browser developer tools throttling before optimizing a rendering path.

## What the renderer adapts

The application caps device pixel ratio and can reduce rendering cost after startup. Hidden or restored tabs are also handled defensively so resize and animation work can recover cleanly.

When changing rendering code, compare startup performance with bloom both enabled and disabled.