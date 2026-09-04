# SOL · ORBITAL ATLAS

> **An interactive 3D journey through the Solar System.**
>
> Scroll through the worlds. Orbit around them. Zoom in. Explore the system as a cinematic, real-time WebGL experience.

<p align="center">
  <strong>☉ SOLAR SYSTEM · AN EXPANDING JOURNEY</strong><br>
  <sub>Real-time 3D · Scroll-driven exploration · Three.js</sub>
</p>

---

## Overview

**SOL · ORBITAL ATLAS** is a browser-based 3D visualization of the Solar System built with vanilla JavaScript and [Three.js](https://threejs.org/).

Instead of presenting the planets as a static diagram, the experience turns the Solar System into a guided journey. Scroll from the Sun through the planets and out to Pluto while the camera transitions between cinematic shots, planetary data updates in the HUD, and each world is rendered with its own visual characteristics.

The project is designed to feel more like an interactive space exhibit than a conventional astronomy page.

## Experience

- **3D Solar System** rendered with WebGL
- **Scroll-driven camera choreography** between celestial bodies
- **Interactive orbit controls** using pointer dragging
- **Shift + wheel zoom** for closer inspection
- **Cinematic auto-tour** for hands-free exploration
- **Orbit-line toggle**
- **Bloom/post-processing toggle**
- **True relative scale mode**
- **Planet and moon picking** with hover information
- **Live HUD** showing distance, orbital velocity, local day and scale
- **Responsive layout** for different screen sizes
- **Reduced-motion support** through `prefers-reduced-motion`
- **Performance fallback** that can reduce rendering cost on slower hardware

## Worlds Included

| World | Type | Distance from Sun |
| --- | --- | ---: |
| ☉ Sol | G2V main-sequence star | — |
| Mercury | Terrestrial planet | 0.387 AU |
| Venus | Terrestrial planet | 0.723 AU |
| Earth | Terrestrial planet | 1.000 AU |
| Mars | Terrestrial planet | 1.524 AU |
| Jupiter | Gas giant | 5.204 AU |
| Saturn | Gas giant | 9.583 AU |
| Uranus | Ice giant | 19.191 AU |
| Neptune | Ice giant | 30.070 AU |
| Pluto | Dwarf planet | 39.480 AU |

The dataset also includes planetary characteristics such as radius, mass, gravity, temperature, rotation period, orbital period, composition, moons and descriptive facts. Display geometry uses compressed mathematical scaling so the entire system remains explorable in a browser while preserving the ordering of the worlds.

## Controls

| Input | Action |
| --- | --- |
| **Scroll** | Travel through the Solar System |
| **Drag** | Orbit the current world |
| **Shift + Wheel** | Zoom |
| **T** | Toggle cinematic auto-tour |
| **O** | Toggle orbit lines |
| **B** | Toggle bloom |
| **R** | Toggle true relative scale |
| **Space / ↓ / Page Down** | Next world |
| **↑ / Page Up** | Previous world |
| **Home** | Jump to Sol |
| **End** | Jump to Pluto |
| **0–9** | Jump directly to a world |
| **Click a world** | Focus it |

## Tech Stack

- **HTML5** — application shell
- **CSS3** — interface, HUD and visual effects
- **JavaScript (ES modules)** — application logic
- **Three.js** — real-time 3D rendering
- **WebGL** — GPU-accelerated rendering
- **Custom shaders/post-processing** — atmosphere, surface and cinematic effects

There is no framework or bundler required for the current project. The repository includes a local Three.js module under `vendor/`, allowing the experience to run without installing a JavaScript package first.

## Project Structure

```text
solar/
├── index.html
├── styles.css
├── LICENSE
├── README.md
│
├── js/
│   ├── main.js       # Renderer, camera choreography, input and animation loop
│   ├── world.js      # Solar System scene and celestial-body construction
│   ├── data.js       # Planetary data and display-scale calculations
│   ├── ui.js         # Scroll narrative, HUD and interface logic
│   ├── post.js       # Post-processing pipeline
│   ├── shaders.js    # Custom shader code
│   ├── textures.js   # Procedural/embedded texture data
│   ├── noise.js      # Noise utilities
│   └── data          # Data asset
│
└── vendor/
    └── three.module.min.js
```

## Running Locally

Because this is a static web experience, you only need a local HTTP server.

### Option 1 — Python

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

### Option 2 — Node.js

If you already have a static server available, serve the repository root and open the resulting local URL.

> Opening `index.html` directly with `file://` may not work correctly because the project uses ES modules.

## Architecture

The project is intentionally split into small rendering and experience layers:

### `main.js`

The application entry point. It creates the Three.js renderer, camera, world, post-processing pipeline and UI, then coordinates input, camera movement, animation and performance adaptation.

### `data.js`

Contains the Solar System dataset and derived display geometry. Planetary values are kept separately from rendering logic so the visualization can use the same data for the HUD and narrative UI.

### `world.js`

Responsible for constructing and updating the 3D Solar System, including planetary meshes, moons, orbit paths and visual features.

### `ui.js`

Builds and synchronizes the scroll-based narrative, navigation rail, information panels and HUD state.

### `shaders.js` / `textures.js` / `noise.js`

Provide the lower-level visual building blocks used to create procedural planetary surfaces, atmospheric effects and other rendering details.

### `post.js`

Handles the final rendering/compositing stage, including the optional bloom effect.

## Scaling

Real Solar System dimensions are impractical for an interactive camera experience. The project therefore uses compressed display geometry rather than literal scene dimensions.

Planet radii are transformed using a power-law scale, while orbital distances use a separate compressed curve. This keeps every world recognizable and correctly ordered without forcing the camera to travel billions of kilometres between meaningful interactions.

The **True Scale** control can be used to move the visualization toward the relative physical size relationships between the bodies.

## Data

Planetary figures in the source dataset are documented as following **NASA/JPL planetary fact sheets (2025)**. The visualization combines those measurements with descriptive, editorial content for the interactive experience.

The displayed values are intended for educational visualization rather than scientific simulation.

## Performance

The renderer includes several safeguards for real-world browser performance:

- Device-pixel-ratio capping
- High-performance WebGL renderer preference
- Optional bloom pass
- Reduced-motion handling
- Automatic performance evaluation after startup
- Automatic bloom/DPR reduction when the initial frame rate is too expensive
- Defensive camera/resize handling for hidden or restored browser tabs

## Browser Requirements

A modern browser with **WebGL** and JavaScript module support is required.

Recommended:

- Chrome / Chromium
- Firefox
- Safari
- Edge

A discrete or modern integrated GPU will provide the best experience, especially with bloom and higher device-pixel ratios enabled.

## Development

The project currently has no build step. Most changes can be made directly to the source files and tested by refreshing the local server.

When adding a new world or changing planetary information, start with `js/data.js` so the dataset remains the single source for the corresponding visualization data.

## License

This project is released under the **MIT License**. See [`LICENSE`](./LICENSE) for details.

## Credits

Built by **Medu**.

Repository: https://github.com/meduuv/solar
