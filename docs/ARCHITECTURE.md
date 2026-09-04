# Architecture Notes

The application is divided by responsibility rather than by framework components.

- `main.js` coordinates renderer setup, input, animation, and lifecycle.
- `world.js` constructs and updates celestial bodies and orbit geometry.
- `data.js` owns planetary measurements and derived display-scale values.
- `ui.js` manages narrative state, navigation, and HUD presentation.
- `post.js` owns the final compositing and bloom stage.
- `shaders.js`, `textures.js`, and `noise.js` provide reusable visual primitives.

Keep physical data independent from scene geometry. UI code should consume application state rather than duplicate planetary measurements.