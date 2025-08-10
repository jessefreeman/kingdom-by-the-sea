# Kingdom By The Sea – Renderers

This project now supports pluggable renderers.

- debug: the original 2D canvas tile renderer (default)
- three: a placeholder for a future Three.js low-poly, pixel-art island renderer

API (via `window.KBTS`):
- `KBTS.setRenderer(name: 'debug' | 'three')`
- `KBTS.getRenderer(): string`
- `KBTS.draw()` calls the active renderer
- `KBTS.resize()` keeps the canvas size in sync

Notes
- The `three` renderer is currently a stub that forwards to `debug` so nothing breaks.
- You can start wiring Three.js by replacing the placeholder: create a scene, camera, and renderer, mount it next to the canvas, and mirror draw/resize.

Roadmap (three)
- mount: create Three WebGLRenderer (antialias off, powerPreference: 'high-performance')
- camera: isometric-ish perspective, fixed tilt; orbit around Y with limits
- tiles: instanced boxes or extruded planes per tile; height offset by type
- materials: toon/lambert with pixelated texture effect; color palette mapping to `C`
- interaction: raycast to select tile; dispatch back to KBTS to open panel
- perf: instancing + frustum culling; reuse meshes on resize
