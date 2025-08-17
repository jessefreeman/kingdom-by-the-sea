# 4X Engine Architecture and Refactor Plan

This document proposes how to refactor the current game into a modular 4X engine with a small Core and a first-class Plugin system. It targets clean separation of concerns, testability, determinism, and future extensibility (2D/3D renderers, rulesets, worldgen, AI, UI, persistence).

## Goals

- Separate the monolithic game file into cohesive modules with clear contracts.
- Establish a Core Engine that owns loop, events, services, and plugin lifecycle.
- Support multiple renderers (2D Canvas, 3D/Three) as swappable plugins.
- Encapsulate game rules, worldgen, AI, audio, input, and persistence as plugins.
- Make simulation deterministic (seeded RNG) for replays and future multiplayer.
- Enable modding via plugin manifests and stable, versioned APIs.

Non-goals (initial phase): networking, ECS overhaul (optional later), complex tooling.

## High-level Architecture

- Core (engine runtime)
  - Game loop (fixed-tick simulation + render interpolation)
  - Event bus (pub/sub) and command dispatch
  - Service registry (DI-lite)
  - State store (serializable) and snapshot API
  - Scheduler/timers (tick-based)
  - Plugin lifecycle and capability gating
- Plugins (opt-in capabilities)
  - Renderer plugins (2D Canvas / 3D Three)
  - Game rules / simulation plugins (economy, combat, diplomacy)
  - Worldgen plugins (islands, maps, biomes)
  - Input plugins (keyboard/mouse, gestures)
  - UI/HUD plugins (panels, overlays)
  - Audio plugins
  - Persistence plugins (save/load, codecs)
  - Utility services (pathfinding, autotiling, tile atlas, RNG)

Data flows through Engine events and explicit service contracts. Plugins communicate via events and shared services, not direct imports, to reduce coupling.

## Core Engine Responsibilities

- Initialize/configure services and plugins from a manifest
- Advance a fixed-step simulation clock (e.g., 30–60 Hz), independent render
- Provide deterministic RNG (seeded) and time services
- Manage a serializable state tree with undo/redo and snapshot support
- Dispatch input events, route commands, and enforce capability rules
- Expose a simple diagnostics/logging interface and hooks for profiling

### Core Types (contract sketch)

```ts
export interface EngineOptions {
  seed?: string | number;
  timestepMs?: number; // default 33.333 (30 Hz) or 16.667 (60 Hz)
  plugins: EnginePlugin[];
  services?: Record<string, unknown>; // prebound services
  config?: Record<string, unknown>;
}

export interface EngineContext {
  engine: Engine; // start/pause/stop, getState, setState, snapshots
  events: EventBus; // publish/subscribe
  services: ServiceLocator; // get/provide services
  logger: Logger;
  rng: RNG; // deterministic, seedable
  time: Time; // now, tick, delta
  state: StateStore<GameState>; // serializable
  config: Record<string, unknown>;
}

export interface EnginePlugin {
  id: string; // unique, e.g., "kbts.rules.v1"
  version: string; // semver
  requires?: string[]; // plugin or service ids
  provides?: string[]; // services or capabilities
  init(ctx: EngineContext): void | Promise<void>; // register services, events
  start?(ctx: EngineContext): void; // engine started
  update?(ctx: EngineContext, dt: number): void; // fixed tick
  render?(ctx: EngineContext, alpha: number): void; // optional (renderer uses)
  stop?(ctx: EngineContext): void; // engine stopped
  dispose?(ctx: EngineContext): void; // cleanup
}

export interface RendererPlugin extends EnginePlugin {
  kind: 'renderer';
  mount(target: HTMLElement): void;
  resize?(w: number, h: number): void;
}
```

### Events (topics)

- engine.init, engine.start, engine.stop, engine.tick, engine.snapshot
- input.* (mouse.down, mouse.move, key.down, key.up, wheel)
- map.* (tile.changed, chunk.loaded, chunk.unloaded)
- entity.* (created, updated, removed)
- worldgen.* (start, progress, done)
- render.request, render.after
- save.request, save.done, load.request, load.done

## State and Determinism

- StateStore manages a plain, serializable tree (JSON-compatible) with versioning.
- RNG backed by a seedable generator; advancing only in update() ensures determinism.
- Time service exposes tick count and dt; no plugin should call Date.now directly.
- Snapshots support: takeSnapshot(), restoreSnapshot(), diff patches.

Optional future: ECS layer on top of StateStore for high-entity simulations.

## Subsystems as Plugins (mapping from current code)

- Rendering
  - 2D Canvas renderer plugin (basic tiles, overlays)
  - 3D Three renderer plugin (current `renderer/three.ts` code adapts here)
  - Tile atlas and autotiling as either internal to renderer or separate services
- Worldgen
  - `worldgen/island.ts` becomes a worldgen plugin; emits worldgen.* events; writes to StateStore via context
- Rules/Simulation
  - Current rules and turn/real-time logic live in a rules plugin; listens to input/commands; mutates state; publishes entity/map events
- Input
  - Wraps DOM listeners; normalizes into input.* events and high-level commands
- UI/HUD
  - Panels, selections, tooltips; subscribes to state/events and requests renders
- Audio
  - Plays sfx/music in response to events
- Persistence
  - JSON save/load; later binary or cloud sync variants as separate plugins

## Suggested Directory Layout

```
frontend/src/engine/core/
  Engine.ts           // loop, lifecycle, plugin host
  EventBus.ts
  Services.ts         // DI-lite ServiceLocator
  StateStore.ts
  Time.ts
  RNG.ts
  Logger.ts

frontend/src/engine/contracts/
  types.ts            // GameState, Tile, Entity, IDs
  plugins.ts          // EnginePlugin, RendererPlugin, etc
  events.ts           // topic constants

frontend/src/plugins/
  renderer/canvas2d/Canvas2DRenderer.ts
  renderer/three/ThreeRenderer.ts
  worldgen/islands/IslandWorldgen.ts
  rules/core/CoreRules.ts
  input/dom/DOMInput.ts
  ui/hud/HUD.ts
  audio/howler/Audio.ts (optional)
  persistence/json/JSONPersistence.ts

frontend/src/services/
  TileAtlas.ts        // extracted from `tileAtlas.ts`
  Autotile.ts         // extracted from `autotile.ts`
  Pathfinding.ts      // future
```

Entry points:
- `main.ts` wires Engine + desired plugin set and mounts renderer.

## Minimal Engine Lifecycle

1) Engine constructed with options/plugins
2) init(): create services, init plugins
3) start(): start loop, call start() on plugins
4) tick(): fixed dt; call update() on plugins in order
5) render(): call renderer plugin(s) render(); support interpolation alpha
6) stop(): stop loop; call stop()/dispose()

## Rendering Abstraction

- Only renderer plugins access DOM/WebGL/Three.
- Simulation never calls renderer directly; it emits events or updates state.
- Renderer reads StateStore snapshots or subscribes to map/entity events.
- Swapping renderers should not affect simulation.

## Plugin Versioning and Capabilities

- Plugins declare `version`, `requires`, and `provides`.
- Engine validates dependency graph and start order.
- Capability examples: `cap:renderer`, `cap:worldgen`, `svc:tileAtlas`, `svc:autotile`.

## Testing Strategy

- Unit tests per plugin and core modules (deterministic RNG and loop).
- Contract tests: any renderer must pass a minimal rendering conformance suite.
- Worldgen snapshot tests: same seed -> same map hash.
- Rules plugin tests: simulation invariants (e.g., resource conservation).

## Migration Plan (Phased)

Phase 0 — Preparatory
- Identify state shape in current code; codify minimal GameState in `contracts/types.ts`.
- Extract RNG and Logger utilities; replace direct Date/Math.random calls in core.

Phase 1 — Core Shell
- Create `Engine.ts`, `EventBus.ts`, `Services.ts`, `StateStore.ts`, `Time.ts`.
- Introduce Engine loop (fixed timestep) and plugin host; run with a No-Op plugin.

Phase 2 — Renderer Plugins
- Wrap current 3D renderer (`renderer/three.ts`) behind `RendererPlugin`.
- Add a simple Canvas2D renderer for smoke tests.

Phase 3 — Worldgen Plugin
- Move `worldgen/island.ts` into a `worldgen` plugin; write to StateStore.
- Emit worldgen.* events for progress/UI.

Phase 4 — Rules/Simulation Plugin
- Move rules and game logic from the monolith into a `rules` plugin.
- Replace direct calls with event subscriptions and state mutations via context.

Phase 5 — Services Extraction
- Extract `tileAtlas.ts`, `autotile.ts`, `tileAtlasPreloader.ts` into services or plugins used by renderers and worldgen.

Phase 6 — Input/UI/Audio
- Add input plugin to normalize DOM events; wire a minimal HUD plugin to visualize state.

Phase 7 — Persistence
- Add JSON persistence plugin; wire save/load commands and hotkeys.

Phase 8 — Cleanup and Docs
- Remove old monolith; update docs and examples; add conformance tests.

## Acceptance Criteria

- Engine boots with either Canvas2D or Three renderer with identical simulation output.
- Given a fixed seed, worldgen and rules produce identical map hashes across runs.
- Plugins load order resolved; missing dependencies produce clear errors.
- No plugin directly imports another plugin's internals (only contracts/services).
- Test suite covers core loop, RNG determinism, and at least one plugin per type.

## Example Contracts (WIP)

```ts
// contracts/types.ts
export interface GameState {
  seed: string;
  tick: number;
  map: {
    width: number;
    height: number;
    tiles: Uint16Array | number[]; // tile ids
  };
  entities: Record<string, Entity>;
}

export interface Entity {
  id: string;
  kind: string; // e.g., 'unit', 'city'
  x: number;
  y: number;
  // component-like optional bags
  props?: Record<string, unknown>;
}

// contracts/plugins.ts
export interface EventBus {
  publish<T = unknown>(topic: string, payload?: T): void;
  subscribe<T = unknown>(topic: string, handler: (p: T) => void): () => void; // returns unsubscribe
}

export interface ServiceLocator {
  get<T>(id: string): T;
  provide<T>(id: string, svc: T): void;
  has(id: string): boolean;
}
```

## Mapping Current Files → New Modules

- `frontend/src/renderer/three.ts` → `plugins/renderer/three/ThreeRenderer.ts`
- `frontend/src/tileAtlas.ts` → `services/TileAtlas.ts`
- `frontend/src/tileAtlasPreloader.ts` → `services/TileAtlasPreloader.ts` or part of TileAtlas service
- `frontend/src/autotile.ts` → `services/Autotile.ts` (used by renderers/worldgen)
- `frontend/src/worldgen/island.ts` → `plugins/worldgen/islands/IslandWorldgen.ts`
- `frontend/src/rules.ts` → `plugins/rules/core/CoreRules.ts`
- `frontend/src/game.ts` / `kbts.ts` monolith → split across Engine core + plugins above
- `frontend/src/main.ts` → entry that wires the engine + plugin list

## Quick Start (target)

```ts
import { Engine } from './engine/core/Engine';
import { ThreeRenderer } from './plugins/renderer/three/ThreeRenderer';
import { CoreRules } from './plugins/rules/core/CoreRules';
import { IslandWorldgen } from './plugins/worldgen/islands/IslandWorldgen';

const engine = new Engine({
  seed: 'kbts-001',
  timestepMs: 33.333,
  plugins: [
    new ThreeRenderer({ mount: document.getElementById('app')! }),
    new IslandWorldgen(),
    new CoreRules(),
  ],
});

await engine.init();
engine.start();
```

## Next Steps

- Approve this architecture.
- Bootstrap core folders and minimal Engine + EventBus + RNG.
- Wrap current Three renderer as the first plugin and boot simulation without rules.
- Move worldgen next, then rules, then UI/input.

---

Appendix: Future Enhancements
- ECS atop StateStore for large entity counts
- Lockstep/network sync and replay system
- Scripting layer for mods (WASM/Lua/JS sandboxes)
- Asset pipeline and hot-reload for data-driven rules
