# Data Guidelines

Planetary source values live in `js/data.js` and should remain the single source of truth for the visualization.

When changing a value:

1. Keep the unit explicit in the data model or display conversion.
2. Preserve the existing world identifiers used by rendering and UI code.
3. Update descriptive text when a factual change affects the narrative.
4. Prefer authoritative astronomical references for measured values.
5. Keep display-scale transforms separate from physical measurements.

The project is an educational visualization, not a precision orbital simulator. Display geometry intentionally compresses distances and radii for interaction.