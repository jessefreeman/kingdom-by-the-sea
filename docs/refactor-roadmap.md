# Refactor Roadmap — Modular 4X Engine

Use this checklist to track progress as we extract a Core engine and plugins from the current monolith.

Legend: ☐ todo, 🔄 in progress, ✅ done

## Phase 0 — Preparatory

- ✅ Identify minimal serializable `GameState` shape
- ✅ Adopt seedable RNG utility and replace `Math.random` in core paths
- ✅ Add lightweight `Logger` service

Deliverables:
- `frontend/src/engine/contracts/types.ts`
- `frontend/src/engine/core/RNG.ts`
- `frontend/src/engine/core/Logger.ts`

## Phase 1 — Core Shell

- ✅ Implement `EventBus` (pub/sub)
- ✅ Implement `ServiceLocator` (DI-lite)
- ✅ Implement `StateStore` (get/set/patch/snapshot)
- ✅ Implement `Time` service
- ✅ Implement `Engine` (init/start/stop, fixed-tick loop, plugin host)
- ✅ Boot with a No-Op plugin and log ticks

Deliverables:
- `frontend/src/engine/core/EventBus.ts`
- `frontend/src/engine/core/Services.ts`
- `frontend/src/engine/core/StateStore.ts`
- `frontend/src/engine/core/Time.ts`
- `frontend/src/engine/core/Engine.ts`

## Phase 2 — Renderer Plugins

- ☐ Define `RendererPlugin` contract
- ☐ Wrap existing ThreeJS renderer behind plugin API
- ☐ Add minimal Canvas2D renderer for smoke tests
- ☐ Swap between renderers via `main.ts` config

Deliverables:
- `frontend/src/engine/contracts/plugins.ts`
- `frontend/src/plugins/renderer/three/ThreeRenderer.ts`
- `frontend/src/plugins/renderer/canvas2d/Canvas2DRenderer.ts`

## Phase 3 — Worldgen Plugin

- ☐ Extract `worldgen/island.ts` into plugin
- ☐ Emit `worldgen.*` events (start/progress/done)
- ☐ Deterministic output from seed; add snapshot test

Deliverables:
- `frontend/src/plugins/worldgen/islands/IslandWorldgen.ts`
- Tests under `frontend/src/tests/worldgen.*.tests.ts`

## Phase 4 — Rules/Simulation Plugin

- ☐ Extract rules and simulation step into `CoreRules` plugin
- ☐ Consume input/commands; publish map/entity events
- ☐ Deterministic tick progression with seed

Deliverables:
- `frontend/src/plugins/rules/core/CoreRules.ts`
- Tests under `frontend/src/tests/rules.*.tests.ts`

## Phase 5 — Services Extraction

- ☐ Extract TileAtlas service
- ☐ Extract Autotile service
- ☐ Optional: Preloader as part of TileAtlas or separate service

Deliverables:
- `frontend/src/services/TileAtlas.ts`
- `frontend/src/services/Autotile.ts`

## Phase 6 — Input/UI/Audio

- ☐ DOM input plugin (mouse/keyboard → input.* events)
- ☐ Minimal HUD plugin to visualize state
- ☐ Optional audio plugin (SFX/music on events)

Deliverables:
- `frontend/src/plugins/input/dom/DOMInput.ts`
- `frontend/src/plugins/ui/hud/HUD.ts`
- `frontend/src/plugins/audio/howler/Audio.ts` (optional)

## Phase 7 — Persistence

- ☐ JSON save/load plugin
- ☐ Wire commands and hotkeys (e.g., Ctrl/Cmd+S, L)

Deliverables:
- `frontend/src/plugins/persistence/json/JSONPersistence.ts`

## Phase 8 — Cleanup and Docs

- ☐ Delete legacy monolith modules replaced by plugins/core
- ☐ Update `README` and examples
- ☐ Add plugin conformance tests and CI

## Quality Gates

- ☐ Build passes and lints clean
- ☐ Deterministic worldgen hash across runs (same seed)
- ☐ Renderer conformance: both 2D/3D render same test world snapshot
- ☐ Minimum test coverage for core loop and RNG

## Tracking

Convert each checkbox into a GitHub Issue. Use labels:
- `area:core`, `area:renderer`, `area:worldgen`, `area:rules`, `area:services`, `area:ui`, `area:input`, `area:persistence`
- `type:refactor`, `type:feature`, `type:test`, `good first issue`

Milestones:
- M1 Core Shell
- M2 Renderer Plugins
- M3 Worldgen + Rules
- M4 Services + Persistence
- M5 Cleanup + Docs
